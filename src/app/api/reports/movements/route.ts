import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const type = searchParams.get("type");
    const warehouseId = searchParams.get("warehouse_id");
    const exportCsv = searchParams.get("export") === "csv";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    const supabase = await createClient();

    let query = supabase
        .from("stock_movements")
        .select(`
            id,
            movement_type,
            quantity,
            reference,
            notes,
            created_at,
            variants(sku, attribute_values, products(name)),
            source_warehouse:warehouses!source_warehouse_id(name),
            target_warehouse:warehouses!target_warehouse_id(name)
        `, { count: "exact" })
        .order("created_at", { ascending: false });

    if (from) query = query.gte("created_at", from + "T00:00:00");
    if (to) query = query.lte("created_at", to + "T23:59:59");
    if (type) query = query.eq("movement_type", type);
    if (warehouseId) {
        query = query.or(`source_warehouse_id.eq.${warehouseId},target_warehouse_id.eq.${warehouseId}`);
    }

    if (!exportCsv) query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = (data || []).map((m: any) => ({
        id: m.id,
        date: m.created_at,
        type: m.movement_type,
        product: m.variants?.products?.name || "—",
        variant: m.variants?.attribute_values?.join(" / ") || "—",
        sku: m.variants?.sku || "—",
        quantity: m.quantity,
        source: m.source_warehouse?.name || "—",
        target: m.target_warehouse?.name || "—",
        reference: m.reference || "—",
        notes: m.notes || "—",
    }));

    if (exportCsv) {
        const headers = ["ID", "Fecha", "Tipo", "Producto", "Variante", "SKU", "Cantidad", "Origen", "Destino", "Referencia", "Notas"];
        const csvRows = [
            headers.join(","),
            ...rows.map((r) => [
                r.id, r.date, r.type, `"${r.product}"`, `"${r.variant}"`,
                r.sku, r.quantity, `"${r.source}"`, `"${r.target}"`,
                `"${r.reference}"`, `"${r.notes}"`,
            ].join(",")),
        ].join("\n");

        return new NextResponse(csvRows, {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="movimientos-${new Date().toISOString().slice(0, 10)}.csv"`,
            },
        });
    }

    return NextResponse.json({ data: rows, total: count ?? 0, page, limit });
}
