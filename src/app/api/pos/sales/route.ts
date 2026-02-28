import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/pos/sales — Sales history with filters and pagination

export async function GET(request: Request) {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const search = searchParams.get("search") || "";
    const statusFilter = searchParams.get("status") || "";
    const dateFrom = searchParams.get("from") || "";
    const dateTo = searchParams.get("to") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "20")));
    const offset = (page - 1) * limit;

    // Build sales query
    let query = supabase
        .from("sales")
        .select(
            `
            id,
            sale_number,
            sale_type,
            channel,
            total,
            payment_method,
            customer_name,
            notes,
            status,
            created_at,
            sale_items (
                id,
                variant_id,
                warehouse_id,
                quantity,
                unit_price,
                subtotal,
                variants (
                    id,
                    sku,
                    attribute_values,
                    products!inner ( id, name )
                ),
                warehouses ( id, name )
            )
        `,
            { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

    // Filters
    if (search) {
        query = query.or(
            `sale_number.ilike.%${search}%,customer_name.ilike.%${search}%`
        );
    }

    if (statusFilter) {
        query = query.eq("status", statusFilter);
    }

    if (dateFrom) {
        query = query.gte("created_at", `${dateFrom}T00:00:00`);
    }

    if (dateTo) {
        const nextDay = new Date(dateTo + "T00:00:00");
        nextDay.setDate(nextDay.getDate() + 1);
        query = query.lt("created_at", nextDay.toISOString());
    }

    const { data: sales, count, error } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Check which sales have exchanges
    const saleNumbers = (sales || []).map((s: Record<string, unknown>) => `CAMBIO-${s.sale_number}`);
    const exchangeRefs = new Set<string>();
    if (saleNumbers.length > 0) {
        const { data: exchangeMovements } = await supabase
            .from("stock_movements")
            .select("reference")
            .in("reference", saleNumbers)
            .eq("movement_type", "cambio");

        if (exchangeMovements) {
            for (const m of exchangeMovements) {
                if (m.reference) exchangeRefs.add(m.reference);
            }
        }
    }

    // Format response
    const formattedSales = (sales || []).map((s: Record<string, unknown>) => {
        const items = (s.sale_items as Record<string, unknown>[]) || [];

        const formattedItems = items.map((item: Record<string, unknown>) => {
            const variant = item.variants as Record<string, unknown> | null;
            const product = variant?.products as Record<string, unknown> | null;
            const warehouse = item.warehouses as Record<string, unknown> | null;

            return {
                id: item.id,
                quantity: item.quantity,
                unit_price: item.unit_price,
                subtotal: item.subtotal,
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

        return {
            id: s.id,
            sale_number: s.sale_number,
            sale_type: s.sale_type,
            channel: s.channel,
            total: s.total,
            payment_method: s.payment_method,
            customer_name: s.customer_name,
            notes: s.notes,
            status: s.status,
            created_at: s.created_at,
            items_count: formattedItems.length,
            items: formattedItems,
            has_exchanges: exchangeRefs.has(`CAMBIO-${s.sale_number}`),
        };
    });

    return NextResponse.json({
        sales: formattedSales,
        pagination: {
            page,
            limit,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limit),
        },
    });
}
