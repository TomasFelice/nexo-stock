import { NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";
import { TiendanubeClient } from "@/lib/tiendanube/client";

export async function POST(request: Request) {
    try {
        const rawBody = await request.text();

        console.log("Headers received:", Object.fromEntries(request.headers.entries()));
        console.log("Body length:", rawBody.length);

        const signature = request.headers.get("x-tiendanube-hmac-sha256") || request.headers.get("x-linkedstore-hmac-sha256");

        console.log("Mapped headers:", { signature });

        if (!signature) {
            console.error("Missing required signature header in webhook");
            return NextResponse.json({ error: "Missing required signature header" }, { status: 400 });
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
        const event = payload.event;
        const storeId = payload.store_id?.toString();

        if (!event || !storeId) {
            console.error("Missing required payload fields");
            return NextResponse.json({ error: "Missing required payload fields" }, { status: 400 });
        }

        console.log(`Received webhook event: ${event} for store: ${storeId}, orderId: ${payload.id}`);

        // Handle order payment: only order/paid triggers stock deduction.
        // We intentionally do NOT handle order/created here because Tiendanube
        // always fires order/paid when payment is confirmed (even for instant payments).
        // Processing order/created caused duplicate sales due to race conditions.
        if (event === "order/paid" || event === "orders/paid") {
            const result = await handleOrderSaleEvent(storeId, payload.id, event);
            if (result) return result;
        }

        // Handle order cancellation: revert stock movements if they exist
        if (event === "order/cancelled" || event === "orders/cancelled") {
            const result = await handleOrderCancelledEvent(storeId, payload.id, event);
            if (result) return result;
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error processing Tiendanube webhook:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

/**
 * Creates a Supabase admin client and validates the store settings.
 * Returns { supabase, tnClient } or throws/returns an error response.
 */
async function getClientsForStore(storeId: string) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient<Database>(supabaseUrl, supabaseKey);

    const { data: settings } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["tn_access_token", "tn_store_id"]);

    const tokenSetting = settings?.find((s) => s.key === "tn_access_token")?.value;
    const dbStoreId = settings?.find((s) => s.key === "tn_store_id")?.value;

    if (!tokenSetting || dbStoreId !== storeId) {
        console.error("Store ID mismatch or no token config found.");
        return { error: NextResponse.json({ error: "Store ID mismatch or no token config found" }, { status: 400 }) };
    }

    const tnClient = new TiendanubeClient(tokenSetting, storeId);
    return { supabase, tnClient };
}

/**
 * Handles order/paid events.
 * Verifies the order's payment_status is "paid" before deducting stock.
 * Idempotent: skips if a venta movement already exists for this order.
 */
async function handleOrderSaleEvent(storeId: string, orderId: number, event: string) {
    const clients = await getClientsForStore(storeId);
    if ("error" in clients) return clients.error;
    const { supabase, tnClient } = clients;

    // Fetch order details from Tiendanube
    const order = await tnClient.getOrder(orderId);

    if (!order || !order.products || order.products.length === 0) {
        console.log(`Order ${orderId} has no products, skipping.`);
        return;
    }

    // Key guard: only process if payment is confirmed (payment_status === "paid")
    // This handles both events consistently:
    // - order/created with payment_status "paid" → immediate payment (e.g. MercadoPago)
    // - order/paid → always has payment_status "paid"
    // - order/created with payment_status "pending" → skip, wait for order/paid
    const paymentStatus = order.payment_status;
    const orderStatus = order.status;

    console.log(`Order #${order.number} (id: ${orderId}) — status: "${orderStatus}", payment_status: "${paymentStatus}", event: "${event}"`);

    if (paymentStatus !== "paid") {
        console.log(
            `Order #${order.number}: payment_status is "${paymentStatus}" (not "paid"). Skipping stock deduction.`
        );
        return;
    }

    // Guard against cancelled orders arriving with wrong event
    if (orderStatus === "cancelled") {
        console.log(`Order #${order.number}: status is "cancelled". Skipping sale processing.`);
        return;
    }

    // Prevent duplicate processing: check if a venta movement already exists for this order
    const { data: existingMovements } = await supabase
        .from("stock_movements")
        .select("id")
        .eq("movement_type", "venta")
        .like("reference", `TN Order #${order.number} (%`)
        .limit(1);

    if (existingMovements && existingMovements.length > 0) {
        console.log(`Order #${order.number} already processed as venta. Skipping to avoid duplicate.`);
        return;
    }

    // Find primary warehouse
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

    // ── Create unified sale record ──────────────────────────────────────────
    // This allows TN orders to appear in the sales report alongside POS sales.
    const saleNumber = `TN-${order.number}`;
    const customerName =
        order.contact_name ||
        [order.billing_address?.first_name, order.billing_address?.last_name].filter(Boolean).join(" ") ||
        null;
    const orderTotal = parseFloat(order.total) || 0;

    const { data: createdSale, error: saleError } = await supabase
        .from("sales")
        .insert({
            sale_number: saleNumber,
            channel: "web",
            payment_method: "tiendanube",
            customer_name: customerName,
            total: orderTotal,
            status: "completed",
        })
        .select("id")
        .single();

    if (saleError) {
        console.error("Failed to insert TN sale record:", saleError.message);
        // Continue anyway — stock movements are still created
    }

    // Process each product in the order
    for (const item of order.products) {
        const tnVariantId = item.variant_id;
        const quantityToDeduct = parseInt(item.quantity, 10);

        if (!tnVariantId || isNaN(quantityToDeduct)) continue;

        // Find variant in our DB by tn_variant_id
        const { data: variant } = await supabase
            .from("variants")
            .select("id, price")
            .eq("tn_variant_id", tnVariantId)
            .maybeSingle();

        if (!variant) {
            console.warn(`Variant with tn_variant_id ${tnVariantId} not found in DB`);
            continue;
        }

        const unitPrice = parseFloat(item.price) || variant.price || 0;
        const subtotal = unitPrice * quantityToDeduct;

        // Create stock movement of type 'venta'
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

        // Create sale_item linked to the sale record (if created successfully)
        if (createdSale) {
            const { error: saleItemError } = await supabase
                .from("sale_items")
                .insert({
                    sale_id: createdSale.id,
                    variant_id: variant.id,
                    warehouse_id: primaryWarehouse.id,
                    quantity: quantityToDeduct,
                    unit_price: unitPrice,
                    subtotal,
                });

            if (saleItemError) {
                console.error("Failed to insert sale_item for TN order:", saleItemError.message);
            }
        }

        // Update stock_levels
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
                .update({ quantity: newQty, updated_at: new Date().toISOString() })
                .eq("id", currentStock.id);
        } else {
            await supabase
                .from("stock_levels")
                .insert({ variant_id: variant.id, warehouse_id: primaryWarehouse.id, quantity: 0 });
        }

        console.log(
            `Processed item ${item.id}: deducted ${quantityToDeduct} from variant ${variant.id} (movement: ${movement?.id})`
        );
    }

    console.log(`✅ Order #${order.number} sale processed successfully (sale record: ${createdSale?.id ?? "n/a"}).`);
}

/**
 * Handles order/cancelled events.
 * If the order had venta movements already recorded, reverts the stock by creating
 * 'cancelacion' movements and restoring stock_levels.
 */
async function handleOrderCancelledEvent(storeId: string, orderId: number, event: string) {
    const clients = await getClientsForStore(storeId);
    if ("error" in clients) return clients.error;
    const { supabase, tnClient } = clients;

    // Fetch order details to get the order number for reference lookup
    const order = await tnClient.getOrder(orderId);

    if (!order) {
        console.log(`Order ${orderId} not found in Tiendanube. Nothing to revert.`);
        return;
    }

    console.log(`Processing cancellation for Order #${order.number} (id: ${orderId})`);

    // Find all venta movements for this order
    const { data: ventaMovements } = await supabase
        .from("stock_movements")
        .select("id, variant_id, quantity, source_warehouse_id")
        .eq("movement_type", "venta")
        .like("reference", `TN Order #${order.number} (%`);

    if (!ventaMovements || ventaMovements.length === 0) {
        console.log(`Order #${order.number}: no venta movements found. Nothing to revert.`);
        return;
    }

    // Check if already reverted: use wildcard to match any event variant
    // (Tiendanube can fire both "order/cancelled" and "orders/cancelled" for the same order)
    const { data: existingReversals } = await supabase
        .from("stock_movements")
        .select("id")
        .eq("movement_type", "cancelacion")
        .like("reference", `TN Order #${order.number} (%`)
        .limit(1);

    if (existingReversals && existingReversals.length > 0) {
        console.log(`Order #${order.number}: cancellation already processed. Skipping.`);
        return;
    }

    // Revert each venta movement
    for (const ventaMov of ventaMovements) {
        const { variant_id, quantity, source_warehouse_id } = ventaMov;

        if (!source_warehouse_id) continue;

        // Create a cancelacion movement to restore stock
        const { data: devMov, error: devErr } = await supabase
            .from("stock_movements")
            .insert({
                variant_id,
                source_warehouse_id: null,
                target_warehouse_id: source_warehouse_id,
                movement_type: "cancelacion",
                quantity,
                reference: `TN Order #${order.number} (${event})`,
                notes: `Reversión automática por cancelación de orden TiendaNube. Movimiento original: ${ventaMov.id}`,
            })
            .select("id")
            .single();

        if (devErr) {
            console.error(`Failed to insert cancelacion movement for venta ${ventaMov.id}:`, devErr.message);
            continue;
        }

        // Restore stock_levels
        const { data: currentStock } = await supabase
            .from("stock_levels")
            .select("id, quantity")
            .eq("variant_id", variant_id)
            .eq("warehouse_id", source_warehouse_id)
            .maybeSingle();

        if (currentStock) {
            await supabase
                .from("stock_levels")
                .update({ quantity: currentStock.quantity + quantity, updated_at: new Date().toISOString() })
                .eq("id", currentStock.id);
        } else {
            // Stock level didn't exist; create it with the restored quantity
            await supabase
                .from("stock_levels")
                .insert({ variant_id, warehouse_id: source_warehouse_id, quantity });
        }

        console.log(
            `Reverted venta movement ${ventaMov.id}: restored ${quantity} units to variant ${variant_id} in warehouse ${source_warehouse_id} (cancelacion: ${devMov?.id})`
        );
    }

    console.log(`✅ Order #${order.number} cancellation processed — ${ventaMovements.length} venta movement(s) reverted.`);

    // Also mark the unified sales record as cancelled (if it exists)
    await supabase
        .from("sales")
        .update({ status: "cancelled" })
        .eq("sale_number", `TN-${order.number}`);
}
