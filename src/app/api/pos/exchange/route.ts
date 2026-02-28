import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ─── Types ───────────────────────────────────────────────

interface ReturnedItem {
    sale_item_id: number;
    variant_id: number;
    warehouse_id: number;
    quantity: number;
}

interface NewItem {
    variant_id: number;
    warehouse_id: number;
    quantity: number;
    unit_price: number;
}

interface ExchangeRequest {
    sale_id: number;
    returned_items: ReturnedItem[];
    new_items: NewItem[];
    notes?: string;
}

// ─── POST /api/pos/exchange — Process an exchange ────────

export async function POST(request: Request) {
    const supabase = await createClient();

    // Auth check
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body: ExchangeRequest = await request.json();
    const { sale_id, returned_items, new_items, notes } = body;

    // ── Validation ──

    if (!sale_id) {
        return NextResponse.json(
            { error: "sale_id es obligatorio" },
            { status: 400 }
        );
    }

    if (!returned_items || returned_items.length === 0) {
        return NextResponse.json(
            { error: "Debe seleccionar al menos un producto a devolver" },
            { status: 400 }
        );
    }

    if (!new_items || new_items.length === 0) {
        return NextResponse.json(
            { error: "Debe seleccionar al menos un producto nuevo" },
            { status: 400 }
        );
    }

    for (const item of returned_items) {
        if (!item.variant_id || !item.warehouse_id || !item.quantity || item.quantity <= 0) {
            return NextResponse.json(
                { error: "Cada item devuelto debe tener variant_id, warehouse_id y quantity > 0" },
                { status: 400 }
            );
        }
    }

    for (const item of new_items) {
        if (!item.variant_id || !item.warehouse_id || !item.quantity || item.quantity <= 0) {
            return NextResponse.json(
                { error: "Cada item nuevo debe tener variant_id, warehouse_id y quantity > 0" },
                { status: 400 }
            );
        }
    }

    // ── Verify sale exists ──

    const { data: sale, error: saleError } = await supabase
        .from("sales")
        .select("id, sale_number, status")
        .eq("id", sale_id)
        .single();

    if (saleError || !sale) {
        return NextResponse.json(
            { error: "Venta no encontrada" },
            { status: 404 }
        );
    }

    // ── Check stock availability for new items ──

    for (const item of new_items) {
        const { data: stockLevel } = await supabase
            .from("stock_levels")
            .select("quantity")
            .eq("variant_id", item.variant_id)
            .eq("warehouse_id", item.warehouse_id)
            .maybeSingle();

        const available = stockLevel?.quantity || 0;
        if (available < item.quantity) {
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

    // ── Generate exchange reference ──

    const exchangeRef = `CAMBIO-${sale.sale_number}`;

    // ── Process returned items (increase stock) ──

    for (const item of returned_items) {
        // Create devolucion movement
        const { error: devError } = await supabase.from("stock_movements").insert({
            variant_id: item.variant_id,
            source_warehouse_id: item.warehouse_id,
            target_warehouse_id: null,
            movement_type: "devolucion",
            quantity: item.quantity,
            reference: exchangeRef,
            notes: notes || null,
            user_id: user.id,
        });

        if (devError) {
            return NextResponse.json(
                { error: `Error al registrar devolución: ${devError.message}` },
                { status: 500 }
            );
        }

        // Increase stock
        await upsertStockLevel(supabase, item.variant_id, item.warehouse_id, item.quantity);

        // Enqueue sync
        try {
            await supabase.from("sync_queue").insert({
                variant_id: item.variant_id,
                action: "update_stock",
                status: "pending",
            });
        } catch {
            console.warn("Could not enqueue sync for variant", item.variant_id);
        }
    }

    // ── Process new items (decrease stock) ──

    for (const item of new_items) {
        // Create cambio movement
        const { error: cambioError } = await supabase.from("stock_movements").insert({
            variant_id: item.variant_id,
            source_warehouse_id: item.warehouse_id,
            target_warehouse_id: null,
            movement_type: "cambio",
            quantity: item.quantity,
            reference: exchangeRef,
            notes: notes || null,
            user_id: user.id,
        });

        if (cambioError) {
            return NextResponse.json(
                { error: `Error al registrar cambio: ${cambioError.message}` },
                { status: 500 }
            );
        }

        // Decrease stock
        await upsertStockLevel(supabase, item.variant_id, item.warehouse_id, -item.quantity);

        // Enqueue sync
        try {
            await supabase.from("sync_queue").insert({
                variant_id: item.variant_id,
                action: "update_stock",
                status: "pending",
            });
        } catch {
            console.warn("Could not enqueue sync for variant", item.variant_id);
        }
    }

    return NextResponse.json(
        {
            success: true,
            exchange_ref: exchangeRef,
            returned_count: returned_items.reduce((sum, i) => sum + i.quantity, 0),
            new_count: new_items.reduce((sum, i) => sum + i.quantity, 0),
        },
        { status: 201 }
    );
}

// ─── Helper: Upsert stock level ──────────────────────────

async function upsertStockLevel(
    supabase: Awaited<ReturnType<typeof createClient>>,
    variantId: number,
    warehouseId: number,
    delta: number
) {
    const { data: existing } = await supabase
        .from("stock_levels")
        .select("id, quantity")
        .eq("variant_id", variantId)
        .eq("warehouse_id", warehouseId)
        .maybeSingle();

    if (existing) {
        const newQty = Math.max(0, existing.quantity + delta);
        await supabase
            .from("stock_levels")
            .update({ quantity: newQty, updated_at: new Date().toISOString() })
            .eq("id", existing.id);
    } else if (delta > 0) {
        await supabase
            .from("stock_levels")
            .insert({ variant_id: variantId, warehouse_id: warehouseId, quantity: delta });
    }
}
