import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const warehouseId = searchParams.get("warehouse_id");
    const exportCsv = searchParams.get("export") === "csv";

    const supabase = await createClient();

    let query = supabase
        .from("stock_levels")
        .select(`
            id,
            quantity,
            updated_at,
            variants(sku, attribute_values, stock_control, products(name)),
            warehouses(name, id)
        `)
        .gt("quantity", 0)
        .order("quantity", { ascending: false });

    if (warehouseId) query = query.eq("warehouse_id", parseInt(warehouseId));

    const { data, error } = await query;

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = (data || []).map((sl: any) => ({
        product: sl.variants?.products?.name || "—",
        variant: sl.variants?.attribute_values?.join(" / ") || "—",
        sku: sl.variants?.sku || "—",
        warehouse: sl.warehouses?.name || "—",
        quantity: sl.quantity,
        updated_at: sl.updated_at,
    }));

    if (exportCsv) {
        const headers = ["Producto", "Variante", "SKU", "Depósito", "Cantidad", "Última actualización"];
        const csvRows = [
            headers.join(","),
            ...rows.map((r) => [
                `"${r.product}"`, `"${r.variant}"`, r.sku,
                `"${r.warehouse}"`, r.quantity, r.updated_at,
            ].join(",")),
        ].join("\n");

        return new NextResponse(csvRows, {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="stock-${new Date().toISOString().slice(0, 10)}.csv"`,
            },
        });
    }

    return NextResponse.json({ data: rows, total: rows.length });
}
