import { createClient } from "@/lib/supabase/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const { searchParams } = new URL(req.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const warehouseId = searchParams.get("warehouse_id");
    const channel = searchParams.get("channel");
    const exportCsv = searchParams.get("export") === "csv";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    const supabase = await createClient();

    let query = supabase
        .from("sale_items")
        .select(`
            id,
            quantity,
            unit_price,
            subtotal,
            sales(id, sale_number, created_at, customer_name, payment_method, status, channel),
            variants(sku, attribute_values, products(name)),
            warehouses(name)
        `, { count: "exact" })
        .order("id", { ascending: false });

    if (warehouseId) query = query.eq("warehouse_id", parseInt(warehouseId));
    if (channel) query = query.eq("sales.channel", channel);

    if (from) query = query.gte("sales.created_at", from + "T00:00:00");
    if (to) query = query.lte("sales.created_at", to + "T23:59:59");

    if (!exportCsv) query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const rows = (data || []).map((item: any) => ({
        sale_number: item.sales?.sale_number,
        date: item.sales?.created_at,
        customer: item.sales?.customer_name || "Mostrador",
        payment_method: item.sales?.payment_method,
        channel: item.sales?.channel,
        product: item.variants?.products?.name,
        variant: item.variants?.attribute_values?.join(" / ") || "—",
        sku: item.variants?.sku,
        warehouse: item.warehouses?.name,
        quantity: item.quantity,
        unit_price: item.unit_price,
        subtotal: item.subtotal,
    }));

    if (exportCsv) {
        const headers = ["N° Venta", "Fecha", "Cliente", "Pago", "Canal", "Producto", "Variante", "SKU", "Depósito", "Cantidad", "Precio Unit.", "Subtotal"];
        const csvRows = [
            headers.join(","),
            ...rows.map((r) => [
                r.sale_number, r.date, r.customer, r.payment_method, r.channel,
                `"${r.product}"`, `"${r.variant}"`, r.sku, `"${r.warehouse}"`,
                r.quantity, r.unit_price, r.subtotal,
            ].join(",")),
        ].join("\n");

        return new NextResponse(csvRows, {
            headers: {
                "Content-Type": "text/csv; charset=utf-8",
                "Content-Disposition": `attachment; filename="ventas-${new Date().toISOString().slice(0, 10)}.csv"`,
            },
        });
    }

    return NextResponse.json({ data: rows, total: count ?? 0, page, limit });
}
