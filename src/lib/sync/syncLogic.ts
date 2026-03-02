import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";
import { TiendanubeClient } from "@/lib/tiendanube/client";

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

    // Step 1: Query up to 30 pending items from sync_queue
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
        try {
            if (item.action !== "update_stock") {
                throw new Error(`Unsupported action: ${item.action}`);
            }

            // Step 2: Sum the stock_levels across all warehouses where syncs_to_web = true
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

            // Step 3: Fetch tn_variant_id and tn_product_id
            // Need products joined
            const { data: variantData, error: variantError } = await supabase
                .from("variants")
                .select("tn_variant_id, product_id, products(tn_product_id)")
                .eq("id", item.variant_id)
                .single();

            if (variantError) throw variantError;

            // supabase-js returns nested relationships as an object or array. products is One-to-One here (variant belongs to product)
            const productsInfo = Array.isArray(variantData.products) ? variantData.products[0] : variantData.products;

            if (!variantData.tn_variant_id || !productsInfo?.tn_product_id) {
                // If variant is not linked to TN, just mark as completed but mention it's not connected
                await supabase
                    .from("sync_queue")
                    .update({
                        status: "completed",
                        processed_at: new Date().toISOString(),
                        error_message: "Variant not linked to Tiendanube",
                    })
                    .eq("id", item.id);
                results.success++;
                continue;
            }

            const productId = productsInfo.tn_product_id;
            const variantId = variantData.tn_variant_id;

            // Step 4: Call tiendanubeClient.updateVariant
            await tnClient.updateVariant(productId, variantId, { stock: totalWebStock });

            // Step 5: Update the sync_queue item with completed
            await supabase
                .from("sync_queue")
                .update({
                    status: "completed",
                    processed_at: new Date().toISOString(),
                    error_message: null,
                })
                .eq("id", item.id);

            // Also log success
            await supabase.from("sync_log").insert({
                direction: "outbound",
                event_type: "stock_update",
                status: "success",
                payload: { variant_id: item.variant_id, new_stock: totalWebStock },
            });

            results.success++;
        } catch (error: any) {
            // Update the sync_queue item with failed
            await supabase
                .from("sync_queue")
                .update({
                    status: "failed",
                    processed_at: new Date().toISOString(),
                    error_message: error.message || "Unknown error",
                    retry_count: item.retry_count + 1,
                })
                .eq("id", item.id);

            await supabase.from("sync_log").insert({
                direction: "outbound",
                event_type: "stock_update",
                status: "error",
                error_details: error.message || "Unknown error",
                payload: { variant_id: item.variant_id },
            });

            results.failed++;
            results.details.push({ id: item.id, error: error.message });
        }
    }

    return {
        message: "Batch processed",
        ...results
    };
}
