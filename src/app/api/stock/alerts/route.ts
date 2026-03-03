import { createClient } from "@/lib/supabase/server";
import { NextResponse, NextRequest } from "next/server";

// GET /api/stock/alerts
// Returns variants where total stock < threshold (variant-level or global)
export async function GET() {
    const supabase = await createClient();

    // Get global threshold from app_settings
    const { data: setting } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "global_stock_alert_threshold")
        .single();
    const globalThreshold = setting?.value ? parseInt(setting.value) : null;

    // Get all variants with their stock levels and alert thresholds
    const { data: variants, error } = await supabase
        .from("variants")
        .select(`
            id,
            sku,
            attribute_values,
            stock_alert_threshold,
            products(name),
            stock_levels(quantity, warehouses(name, id))
        `)
        .eq("active", true)
        .eq("stock_control", true);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const alerts = [];
    let totalAlerts = 0;

    for (const v of variants || []) {
        const totalStock = ((v.stock_levels as any[]) || []).reduce(
            (s: number, sl: any) => s + sl.quantity,
            0
        );
        const threshold = v.stock_alert_threshold ?? globalThreshold;

        if (threshold !== null && totalStock < threshold) {
            totalAlerts++;
            alerts.push({
                variant_id: v.id,
                sku: v.sku,
                attribute_values: v.attribute_values,
                product_name: (v.products as any)?.name || "Desconocido",
                total_stock: totalStock,
                threshold,
                is_variant_threshold: v.stock_alert_threshold !== null,
                stock_by_warehouse: ((v.stock_levels as any[]) || []).map((sl: any) => ({
                    warehouse_id: sl.warehouses?.id,
                    warehouse_name: sl.warehouses?.name,
                    quantity: sl.quantity,
                })),
            });
        }
    }

    // Sort by how far below threshold (most critical first)
    alerts.sort((a, b) => (a.total_stock - a.threshold) - (b.total_stock - b.threshold));

    return NextResponse.json({
        alerts,
        totalAlerts,
        globalThreshold,
    });
}

// PATCH /api/stock/alerts
// Update stock_alert_threshold for a specific variant
export async function PATCH(req: NextRequest) {
    const supabase = await createClient();
    const body = await req.json();
    const { variant_id, threshold } = body;

    if (!variant_id) {
        return NextResponse.json({ error: "variant_id requerido" }, { status: 400 });
    }

    const { error } = await supabase
        .from("variants")
        .update({ stock_alert_threshold: threshold === "" || threshold === null ? null : parseInt(threshold) })
        .eq("id", variant_id);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
}
