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
    ] = await Promise.all([
        // Sales today (all channels)
        supabase
            .from("sales")
            .select("total, channel")
            .eq("status", "completed")
            .gte("created_at", startOfToday),

        // Sales this week (all channels)
        supabase
            .from("sales")
            .select("total, channel")
            .eq("status", "completed")
            .gte("created_at", startOfWeek),

        // Sales this month (all channels)
        supabase
            .from("sales")
            .select("total, channel")
            .eq("status", "completed")
            .gte("created_at", startOfMonth),

        // Sales by day last 7 days (all channels)
        supabase
            .from("sales")
            .select("created_at, total, channel")
            .eq("status", "completed")
            .gte("created_at", sevenDaysAgo)
            .order("created_at", { ascending: true }),

        // Top 5 products by revenue (all sale_items — POS + TN)
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
    ]);

    // ── Helper: sum totals by channel ──────────────────────────────────────
    function sumByChannel(rows: { total: unknown; channel: string }[] | null) {
        let local = 0, web = 0;
        for (const r of rows || []) {
            const v = Number(r.total);
            if (r.channel === "web") web += v;
            else local += v;
        }
        return { total: local + web, local, web };
    }

    const today = sumByChannel(salesTodayRes.data as any);
    const week = sumByChannel(salesWeekRes.data as any);
    const month = sumByChannel(salesMonthRes.data as any);

    // ── Sales trend by day, split by channel ──────────────────────────────
    const dayMapLocal: Record<string, number> = {};
    const dayMapWeb: Record<string, number> = {};
    for (let i = 6; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        dayMapLocal[key] = 0;
        dayMapWeb[key] = 0;
    }
    for (const sale of (salesByDayRes.data as any) || []) {
        const key = (sale.created_at as string).slice(0, 10);
        if (!(key in dayMapLocal)) continue;
        const v = Number(sale.total);
        if (sale.channel === "web") dayMapWeb[key] += v;
        else dayMapLocal[key] += v;
    }
    const salesByDay = Object.keys(dayMapLocal).map((date) => ({
        date,
        label: new Date(date + "T12:00:00").toLocaleDateString("es-AR", { weekday: "short", day: "numeric" }),
        total: dayMapLocal[date] + dayMapWeb[date],
        local: dayMapLocal[date],
        web: dayMapWeb[date],
    }));

    // ── Top products (from sale_items — includes both POS and TN) ─────────
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

    // ── Stock by warehouse ─────────────────────────────────────────────────
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
        // Combined totals
        salesToday: today.total,
        salesWeek: week.total,
        salesMonth: month.total,
        // Channel breakdown
        salesTodayLocal: today.local,
        salesTodayWeb: today.web,
        salesWeekLocal: week.local,
        salesWeekWeb: week.web,
        salesMonthLocal: month.local,
        salesMonthWeb: month.web,
        // Charts
        salesByDay,
        topProducts,
        stockByWarehouse,
        totalStock,
        lastSync,
        movementsThisMonth,
    });
}
