import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { TiendanubeClient } from "@/lib/tiendanube/client";

export async function POST(request: Request) {
    try {
        const rawBody = await request.text();
        const signature = request.headers.get("x-tiendanube-hmac-sha256");
        const event = request.headers.get("x-tiendanube-event");
        const storeId = request.headers.get("x-tiendanube-store-id");

        if (!signature || !event || !storeId) {
            return NextResponse.json({ error: "Missing required headers" }, { status: 400 });
        }

        const clientSecret = process.env.TIENDANUBE_CLIENT_SECRET;
        if (!clientSecret) {
            console.error("TIENDANUBE_CLIENT_SECRET is not configured");
            return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
        }

        // Verify HMAC
        const hmac = crypto.createHmac("sha256", clientSecret);
        hmac.update(rawBody);
        const expectedSignature = hmac.digest("hex");

        if (signature !== expectedSignature) {
            console.error(`Invalid webhook signature. Expected ${expectedSignature}, got ${signature}`);
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const payload = JSON.parse(rawBody);

        // Process only order/paid events (or other order events if preferred)
        if (event === "order/paid" || event === "order/created") {
            await handleOrderEvent(storeId, payload.id, event);
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error processing Tiendanube webhook:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

async function handleOrderEvent(storeId: string, orderId: number, event: string) {
    const supabase = await createClient();

    // 1. Get Tiendanube settings to find the access token for this store
    // Since we simplified the schema we only have a general app_settings or we assume single tenant
    // Let's get the token from settings.
    const { data: settings } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["tiendanube_access_token", "tiendanube_store_id"]);

    const tokenSetting = settings?.find((s) => s.key === "tiendanube_access_token")?.value;
    const dbStoreId = settings?.find((s) => s.key === "tiendanube_store_id")?.value;

    if (!tokenSetting || dbStoreId !== storeId) {
        console.error("Store ID mismatch or no token config found.");
        return; // Skip if not our store
    }

    const tnClient = new TiendanubeClient(tokenSetting, storeId);

    // 2. Fetch order details to get the exact items
    const order = await tnClient.getOrder(orderId);

    // We only process if it hasn't been processed yet, or depend on idempotency.
    // Order products structure: order.products is an array.
    if (!order || !order.products || order.products.length === 0) {
        return;
    }

    // 3. Find primary warehouse
    const { data: primaryWarehouse } = await supabase
        .from("warehouses")
        .select("id")
        .eq("is_primary", true)
        .eq("active", true)
        .maybeSingle();

    if (!primaryWarehouse) {
        console.error("No primary warehouse found to deduct stock");
        return;
    }

    // 4. Process each product in the order
    for (const item of order.products) {
        const tnVariantId = item.variant_id;
        const quantityToDeduct = parseInt(item.quantity, 10);

        if (!tnVariantId || isNaN(quantityToDeduct)) continue;

        // Find the variant in our DB by tn_variant_id
        const { data: variant } = await supabase
            .from("variants")
            .select("id")
            .eq("tn_variant_id", tnVariantId)
            .maybeSingle();

        if (!variant) {
            console.warn(`Variant with tn_variant_id ${tnVariantId} not found in DB`);
            continue;
        }

        // We should record the stock movement as 'venta'
        // For webhooks, we don't have a user_id. We can leave it null or map to an admin bot.

        // 5. Create a movement of type 'venta'
        const { data: movement, error: movError } = await supabase
            .from("stock_movements")
            .insert({
                variant_id: variant.id,
                source_warehouse_id: primaryWarehouse.id,
                target_warehouse_id: null,
                movement_type: "venta",
                quantity: quantityToDeduct,
                reference: `TN Order #${order.number} (${event})`,
                notes: `Automatizado via Webhook. TiendaNube Item Id: ${item.id}`,
            })
            .select("id")
            .single();

        if (movError) {
            console.error("Failed to insert stock_movement:", movError.message);
            continue;
        }

        // 6. Update stock_levels
        const { data: currentStock } = await supabase
            .from("stock_levels")
            .select("id, quantity")
            .eq("variant_id", variant.id)
            .eq("warehouse_id", primaryWarehouse.id)
            .maybeSingle();

        if (currentStock) {
            const newQty = Math.max(0, currentStock.quantity - quantityToDeduct);
            await supabase
                .from("stock_levels")
                .update({
                    quantity: newQty,
                    updated_at: new Date().toISOString()
                })
                .eq("id", currentStock.id);
        } else {
            // It shouldn't be null ideally if there's stock, but if there isn't we can insert negative or zero.
            // Let's just create it with 0 if it goes below 0, or just let it exist.
            // Some stores allow negative stock but usually we cap at 0 like in `upsertStockLevel`
            await supabase
                .from("stock_levels")
                .insert({
                    variant_id: variant.id,
                    warehouse_id: primaryWarehouse.id,
                    quantity: 0 // Cannot be negative based on business logic from previous files
                });
        }

        console.log(`Processed order item ${item.id} for order ${orderId}, deducted ${quantityToDeduct} from variant ${variant.id}`);
    }
}
