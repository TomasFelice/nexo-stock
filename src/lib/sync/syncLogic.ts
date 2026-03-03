import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";
import { TiendanubeClient } from "@/lib/tiendanube/client";

const MAX_RETRY_COUNT = 5;
const BACKOFF_BASE_MS = 1000; // 1s, 2s, 4s, 8s, 16s

export async function processSyncQueue(batchSize = 30) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

    // Use service_role_key to bypass RLS since this is a background job
    const supabase = createClient<Database>(supabaseUrl, supabaseKey);

    // Get TN credentials from settings
    const { data: settingsData, error: settingsError } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["tn_access_token", "tn_store_id"]);

    if (settingsError || !settingsData) {
        throw new Error("Error fetching settings");
    }

    const settings = Object.fromEntries(
        settingsData.map((s) => [s.key, s.value])
    );

    if (!settings.tn_access_token || !settings.tn_store_id) {
        throw new Error("Tiendanube is not connected");
    }

    const tnClient = new TiendanubeClient(
        settings.tn_access_token,
        settings.tn_store_id
    );

    // Step 1: Re-enqueue failed items eligible for retry (backoff has expired)
    const { data: failedItems } = await supabase
        .from("sync_queue")
        .select("*")
        .eq("status", "failed")
        .lt("retry_count", MAX_RETRY_COUNT);

    if (failedItems && failedItems.length > 0) {
        const now = Date.now();
        for (const item of failedItems) {
            const backoffMs = BACKOFF_BASE_MS * Math.pow(2, item.retry_count);
            const processedAt = item.processed_at ? new Date(item.processed_at).getTime() : 0;
            const eligibleAt = processedAt + backoffMs;

            if (now >= eligibleAt) {
                await supabase
                    .from("sync_queue")
                    .update({ status: "pending" })
                    .eq("id", item.id);
            }
        }
    }

    // Step 2: Mark failed items with retry_count >= MAX_RETRY_COUNT as dead_letter
    await supabase
        .from("sync_queue")
        .update({ status: "dead_letter" })
        .eq("status", "failed")
        .gte("retry_count", MAX_RETRY_COUNT);

    // Step 3: Query up to batchSize pending items from sync_queue
    const { data: queueItems, error: queueError } = await supabase
        .from("sync_queue")
        .select("*")
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(batchSize);

    if (queueError || !queueItems) {
        throw new Error("Error fetching queue");
    }

    if (queueItems.length === 0) {
        return { message: "No items to sync", success: 0, failed: 0, details: [] };
    }

    // Mark as processing
    const itemIds = queueItems.map((item) => item.id);
    await supabase
        .from("sync_queue")
        .update({ status: "processing" })
        .in("id", itemIds);

    const results = {
        success: 0,
        failed: 0,
        details: [] as any[],
    };

    for (const item of queueItems) {
        const startTime = Date.now();

        try {
            if (item.action !== "update_stock") {
                throw new Error(`Unsupported action: ${item.action}`);
            }

            // Sum the stock_levels across all warehouses where syncs_to_web = true
            const { data: stockData, error: stockError } = await supabase
                .from("stock_levels")
                .select("quantity, warehouses!inner(id, syncs_to_web)")
                .eq("variant_id", item.variant_id)
                .eq("warehouses.syncs_to_web", true);

            if (stockError) throw stockError;

            const totalWebStock = stockData?.reduce(
                (sum, stock) => sum + stock.quantity,
                0
            ) || 0;

            // Fetch tn_variant_id and tn_product_id
            const { data: variantData, error: variantError } = await supabase
                .from("variants")
                .select("tn_variant_id, product_id, products(tn_product_id)")
                .eq("id", item.variant_id)
                .single();

            if (variantError) throw variantError;

            const productsInfo = Array.isArray(variantData.products) ? variantData.products[0] : variantData.products;

            if (!variantData.tn_variant_id || !productsInfo?.tn_product_id) {
                const durationMs = Date.now() - startTime;
                await supabase
                    .from("sync_queue")
                    .update({
                        status: "completed",
                        processed_at: new Date().toISOString(),
                        error_message: "Variant not linked to Tiendanube",
                    })
                    .eq("id", item.id);

                await supabase.from("sync_log").insert({
                    direction: "outbound",
                    event_type: "stock_update",
                    status: "success",
                    duration_ms: durationMs,
                    payload: {
                        variant_id: item.variant_id,
                        skipped: true,
                        reason: "Variant not linked to Tiendanube",
                    },
                });

                results.success++;
                continue;
            }

            const productId = productsInfo.tn_product_id;
            const variantId = variantData.tn_variant_id;
            const requestPayload = { stock: totalWebStock };

            // Call tiendanubeClient.updateVariant and capture response
            const tnResponse = await tnClient.updateVariant(productId, variantId, requestPayload);
            const durationMs = Date.now() - startTime;

            // Update the sync_queue item with completed
            await supabase
                .from("sync_queue")
                .update({
                    status: "completed",
                    processed_at: new Date().toISOString(),
                    error_message: null,
                })
                .eq("id", item.id);

            // Log success with request/response and duration
            await supabase.from("sync_log").insert({
                direction: "outbound",
                event_type: "stock_update",
                status: "success",
                duration_ms: durationMs,
                payload: {
                    variant_id: item.variant_id,
                    new_stock: totalWebStock,
                    request: {
                        tn_product_id: productId,
                        tn_variant_id: variantId,
                        body: requestPayload,
                    },
                    response: tnResponse,
                },
            });

            results.success++;
        } catch (error: any) {
            const durationMs = Date.now() - startTime;
            const newRetryCount = item.retry_count + 1;
            const isFinalAttempt = newRetryCount >= MAX_RETRY_COUNT;

            // If max retries reached, mark as dead_letter; otherwise keep as failed for future retry
            await supabase
                .from("sync_queue")
                .update({
                    status: isFinalAttempt ? "dead_letter" : "failed",
                    processed_at: new Date().toISOString(),
                    error_message: error.message || "Unknown error",
                    retry_count: newRetryCount,
                })
                .eq("id", item.id);

            await supabase.from("sync_log").insert({
                direction: "outbound",
                event_type: "stock_update",
                status: "error",
                duration_ms: durationMs,
                error_details: error.message || "Unknown error",
                payload: {
                    variant_id: item.variant_id,
                    retry_count: newRetryCount,
                    is_dead_letter: isFinalAttempt,
                },
            });

            results.failed++;
            results.details.push({ id: item.id, error: error.message, retry_count: newRetryCount, dead_letter: isFinalAttempt });
        }
    }

    return {
        message: "Batch processed",
        ...results
    };
}
