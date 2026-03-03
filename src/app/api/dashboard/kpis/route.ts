import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
    const supabase = await createClient();

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).toISOString();

    const [
        salesTodayRes,
        salesWeekRes,
        salesMonthRes,
        salesByDayRes,
        topProductsRes,
        stockByWarehouseRes,
        totalStockRes,
        lastSyncRes,
        movementsMonthRes,
        // TN webhook sales
        tnSalesTodayRes,
        tnSalesWeekRes,
        tnSalesMonthRes,
        tnSalesByDayRes,
    ] = await Promise.all([
        // Sales today (POS)
        supabase
            .from("sales")
            .select("total")
            .eq("status", "completed")
            .gte("created_at", startOfToday),

        // Sales this week (POS)
        supabase
            .from("sales")
            .select("total")
            .eq("status", "completed")
            .gte("created_at", startOfWeek),

        // Sales this month (POS)
        supabase
            .from("sales")
            .select("total")
            .eq("status", "completed")
            .gte("created_at", startOfMonth),

        // Sales by day last 7 days (POS)
        supabase
            .from("sales")
            .select("created_at, total")
            .eq("status", "completed")
            .gte("created_at", sevenDaysAgo)
            .order("created_at", { ascending: true }),

        // Top 5 products by revenue
        supabase
            .from("sale_items")
            .select("variant_id, quantity, subtotal, variants(sku, attribute_values, products(name))")
            .order("subtotal", { ascending: false })
            .limit(50),

        // Stock by warehouse
        supabase
            .from("stock_levels")
            .select("quantity, warehouses(name, id)")
            .gt("quantity", 0),

        // Total stock
        supabase
            .from("stock_levels")
            .select("quantity"),

        // Last sync log entry
        supabase
            .from("sync_log")
            .select("created_at, status")
            .eq("status", "success")
            .order("created_at", { ascending: false })
            .limit(1),

        // Movements this month count
        supabase
            .from("stock_movements")
            .select("id", { count: "exact", head: true })
            .gte("created_at", startOfMonth),

        // TN webhook sales today
        supabase
            .from("stock_movements")
            .select("quantity, variants(price)")
            .eq("movement_type", "venta")
            .like("reference", "TN Order #%")
            .gte("created_at", startOfToday),

        // TN webhook sales this week
        supabase
            .from("stock_movements")
            .select("quantity, variants(price)")
            .eq("movement_type", "venta")
            .like("reference", "TN Order #%")
            .gte("created_at", startOfWeek),

        // TN webhook sales this month
        supabase
            .from("stock_movements")
            .select("quantity, variants(price)")
            .eq("movement_type", "venta")
            .like("reference", "TN Order #%")
            .gte("created_at", startOfMonth),

        // TN webhook sales by day (last 7 days)
        supabase
            .from("stock_movements")
            .select("created_at, quantity, variants(price)")
            .eq("movement_type", "venta")
            .like("reference", "TN Order #%")
            .gte("created_at", sevenDaysAgo)
            .order("created_at", { ascending: true }),
    ]);

    /** Sum TN movements as revenue: quantity × variant.price */
    function sumTnRevenue(rows: { quantity: number; variants: unknown }[] | null) {
        return (rows || []).reduce((acc, row) => {
            const price = Number((row.variants as any)?.price ?? 0);
            return acc + row.quantity * price;
        }, 0);
    }

    // Aggregate sales totals (POS + TN webhook)
    const salesToday =
        (salesTodayRes.data || []).reduce((s, r) => s + Number(r.total), 0) +
        sumTnRevenue(tnSalesTodayRes.data as any);
    const salesWeek =
        (salesWeekRes.data || []).reduce((s, r) => s + Number(r.total), 0) +
        sumTnRevenue(tnSalesWeekRes.data as any);
    const salesMonth =
        (salesMonthRes.data || []).reduce((s, r) => s + Number(r.total), 0) +
        sumTnRevenue(tnSalesMonthRes.data as any);

    // Build sales by day — seed all 7 days with 0
    const dayMap: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        dayMap[key] = 0;
    }
    // Add POS sales
    for (const sale of salesByDayRes.data || []) {
        const key = sale.created_at.slice(0, 10);
        if (key in dayMap) dayMap[key] += Number(sale.total);
    }
    // Add TN webhook sales
    for (const mov of (tnSalesByDayRes.data as any) || []) {
        const key = (mov.created_at as string).slice(0, 10);
        if (key in dayMap) {
            const price = Number((mov.variants as any)?.price ?? 0);
            dayMap[key] += mov.quantity * price;
        }
    }
    const salesByDay = Object.entries(dayMap).map(([date, total]) => ({
        date,
        label: new Date(date + "T12:00:00").toLocaleDateString("es-AR", { weekday: "short", day: "numeric" }),
        total,
    }));

    // Aggregate top products
    const productMap: Record<string, { name: string; revenue: number; units: number }> = {};
    for (const item of topProductsRes.data || []) {
        const v = item.variants as any;
        const name = v?.products?.name || "Producto desconocido";
        const variant = v?.attribute_values?.join(" / ") || "";
        const key = `${name}${variant ? " — " + variant : ""}`;
        if (!productMap[key]) productMap[key] = { name: key, revenue: 0, units: 0 };
        productMap[key].revenue += Number(item.subtotal);
        productMap[key].units += item.quantity;
    }
    const topProducts = Object.values(productMap)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

    // Stock by warehouse
    const warehouseMap: Record<string, { name: string; id: number; total: number }> = {};
    for (const sl of stockByWarehouseRes.data || []) {
        const wh = sl.warehouses as any;
        if (!wh) continue;
        const key = String(wh.id);
        if (!warehouseMap[key]) warehouseMap[key] = { name: wh.name, id: wh.id, total: 0 };
        warehouseMap[key].total += sl.quantity;
    }
    const stockByWarehouse = Object.values(warehouseMap).sort((a, b) => b.total - a.total);

    const totalStock = (totalStockRes.data || []).reduce((s, r) => s + r.quantity, 0);
    const lastSync = lastSyncRes.data?.[0]?.created_at || null;
    const movementsThisMonth = movementsMonthRes.count || 0;

    return NextResponse.json({
        salesToday,
        salesWeek,
        salesMonth,
        salesByDay,
        topProducts,
        stockByWarehouse,
        totalStock,
        lastSync,
        movementsThisMonth,
    });
}
