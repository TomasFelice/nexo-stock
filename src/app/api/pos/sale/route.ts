import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ─── Types ───────────────────────────────────────────────

interface SaleItem {
    variant_id: number;
    warehouse_id: number;
    quantity: number;
    unit_price: number;
}

interface SaleRequest {
    items: SaleItem[];
    payment_method: string;
    customer_name?: string;
    notes?: string;
}

const VALID_PAYMENT_METHODS = ["efectivo", "tarjeta", "transferencia", "otro"] as const;

// ─── POST /api/pos/sale — Create a sale ──────────────────

export async function POST(request: Request) {
    const supabase = await createClient();

    // Auth check
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body: SaleRequest = await request.json();
    const { items, payment_method, customer_name, notes } = body;

    // ── Validation ──

    if (!items || !Array.isArray(items) || items.length === 0) {
        return NextResponse.json(
            { error: "El carrito está vacío" },
            { status: 400 }
        );
    }

    if (!payment_method || !VALID_PAYMENT_METHODS.includes(payment_method as typeof VALID_PAYMENT_METHODS[number])) {
        return NextResponse.json(
            { error: `Medio de pago inválido. Opciones: ${VALID_PAYMENT_METHODS.join(", ")}` },
            { status: 400 }
        );
    }

    for (const item of items) {
        if (
            item.variant_id == null ||
            item.warehouse_id == null ||
            item.quantity == null ||
            item.unit_price == null
        ) {
            return NextResponse.json(
                { error: "Cada item debe tener variant_id, warehouse_id, quantity y unit_price" },
                { status: 400 }
            );
        }
        if (item.quantity <= 0 || !Number.isInteger(item.quantity)) {
            return NextResponse.json(
                { error: "La cantidad debe ser un número entero positivo" },
                { status: 400 }
            );
        }
    }

    // ── Stock availability check ──

    for (const item of items) {
        const { data: stockLevel } = await supabase
            .from("stock_levels")
            .select("quantity")
            .eq("variant_id", item.variant_id)
            .eq("warehouse_id", item.warehouse_id)
            .maybeSingle();

        const available = stockLevel?.quantity || 0;
        if (available < item.quantity) {
            // Get variant info for error message
            const { data: variant } = await supabase
                .from("variants")
                .select("sku, products!inner(name)")
                .eq("id", item.variant_id)
                .single();

            const product = variant?.products as Record<string, unknown> | null;
            const name = product?.name || `Variante #${item.variant_id}`;
            const sku = variant?.sku ? ` (${variant.sku})` : "";

            return NextResponse.json(
                { error: `Stock insuficiente para ${name}${sku}. Disponible: ${available}, solicitado: ${item.quantity}` },
                { status: 400 }
            );
        }
    }

    // ── Generate sale number ──

    const saleNumber = `POS-${Date.now().toString(36).toUpperCase()}`;

    // ── Calculate total ──

    const total = items.reduce(
        (sum, item) => sum + item.quantity * item.unit_price,
        0
    );

    // ── Insert sale ──

    const { data: sale, error: saleError } = await supabase
        .from("sales")
        .insert({
            sale_number: saleNumber,
            sale_type: "sale",
            channel: "local",
            total,
            payment_method,
            customer_name: customer_name || null,
            notes: notes || null,
            status: "completed",
        })
        .select()
        .single();

    if (saleError) {
        return NextResponse.json({ error: saleError.message }, { status: 500 });
    }

    // ── Insert sale items ──

    const saleItems = items.map((item) => ({
        sale_id: sale.id,
        variant_id: item.variant_id,
        warehouse_id: item.warehouse_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.quantity * item.unit_price,
    }));

    const { error: itemsError } = await supabase
        .from("sale_items")
        .insert(saleItems);

    if (itemsError) {
        // Rollback sale
        await supabase.from("sales").delete().eq("id", sale.id);
        return NextResponse.json({ error: itemsError.message }, { status: 500 });
    }

    // ── Create stock movements + update stock_levels ──

    for (const item of items) {
        // Insert stock movement (egreso por venta)
        await supabase.from("stock_movements").insert({
            variant_id: item.variant_id,
            source_warehouse_id: item.warehouse_id,
            target_warehouse_id: null,
            movement_type: "venta",
            quantity: item.quantity,
            reference: saleNumber,
            notes: null,
            user_id: user.id,
        });

        // Update stock level
        const { data: existing } = await supabase
            .from("stock_levels")
            .select("id, quantity")
            .eq("variant_id", item.variant_id)
            .eq("warehouse_id", item.warehouse_id)
            .maybeSingle();

        if (existing) {
            const newQty = Math.max(0, existing.quantity - item.quantity);
            await supabase
                .from("stock_levels")
                .update({ quantity: newQty, updated_at: new Date().toISOString() })
                .eq("id", existing.id);
        }

        // ── Enqueue sync (placeholder for F2.x) ──
        try {
            await supabase.from("sync_queue").insert({
                variant_id: item.variant_id,
                action: "update_stock",
                status: "pending",
            });
        } catch {
            // Sync queue is a best-effort operation
            console.warn("Could not enqueue sync for variant", item.variant_id);
        }
    }

    return NextResponse.json(
        {
            sale: {
                ...sale,
                items: saleItems,
            },
        },
        { status: 201 }
    );
}
