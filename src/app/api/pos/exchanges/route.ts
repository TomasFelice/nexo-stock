import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/pos/exchanges?sale_number=XXX — Get exchange history for a sale

export async function GET(request: Request) {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const saleNumber = searchParams.get("sale_number");

    if (!saleNumber) {
        return NextResponse.json(
            { error: "sale_number es obligatorio" },
            { status: 400 }
        );
    }

    const exchangeRef = `CAMBIO-${saleNumber}`;

    const { data: movements, error } = await supabase
        .from("stock_movements")
        .select(
            `
            id,
            movement_type,
            quantity,
            reference,
            notes,
            created_at,
            source_warehouse_id,
            variants!inner (
                id,
                sku,
                attribute_values,
                products!inner ( id, name )
            ),
            source_warehouse:warehouses!stock_movements_source_warehouse_id_fkey ( id, name )
        `
        )
        .eq("reference", exchangeRef)
        .in("movement_type", ["devolucion", "cambio"])
        .order("created_at", { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const formatted = (movements || []).map((m: Record<string, unknown>) => {
        const variant = m.variants as Record<string, unknown>;
        const product = variant?.products as Record<string, unknown>;
        const warehouse = m.source_warehouse as Record<string, unknown> | null;

        return {
            id: m.id,
            movement_type: m.movement_type,
            quantity: m.quantity,
            notes: m.notes,
            created_at: m.created_at,
            variant: {
                id: variant?.id,
                sku: variant?.sku,
                attribute_values: variant?.attribute_values,
                product_name: product?.name || "—",
            },
            warehouse: warehouse
                ? { id: warehouse.id, name: warehouse.name }
                : null,
        };
    });

    const returned = formatted.filter((m) => m.movement_type === "devolucion");
    const exchanged = formatted.filter((m) => m.movement_type === "cambio");

    return NextResponse.json({
        reference: exchangeRef,
        sale_number: saleNumber,
        returned_items: returned,
        new_items: exchanged,
        date: formatted.length > 0 ? formatted[0].created_at : null,
        notes: formatted.length > 0 ? formatted[0].notes : null,
    });
}
