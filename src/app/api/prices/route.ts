import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ─── GET /api/prices ─────────────────────────────────
// Returns all products with their variants and price fields
export async function GET(request: NextRequest) {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search") || "";

    // Fetch products with variants
    let query = supabase
        .from("products")
        .select(`
            id,
            name,
            tn_product_id,
            variants (
                id,
                sku,
                barcode,
                attribute_values,
                price,
                compare_at_price,
                cost,
                tn_variant_id,
                active
            )
        `)
        .eq("active", true)
        .order("name");

    if (search) {
        // Search across product name, variant SKU, or barcode
        query = query.or(
            `name.ilike.%${search}%,variants.sku.ilike.%${search}%,variants.barcode.ilike.%${search}%`
        );
    }

    const { data, error } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Filter out products with no active variants, and filter variants
    const products = (data || [])
        .map((p) => ({
            ...p,
            variants: (p.variants || []).filter((v: any) => v.active),
        }))
        .filter((p) => p.variants.length > 0);

    return NextResponse.json({ products });
}

// ─── PATCH /api/prices ───────────────────────────────
// Bulk update prices for multiple variants
export async function PATCH(request: NextRequest) {
    const supabase = await createClient();

    let body: any;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { changes, change_type, rule_description } = body;

    if (!Array.isArray(changes) || changes.length === 0) {
        return NextResponse.json(
            { error: "Se requiere un array de cambios" },
            { status: 400 }
        );
    }

    // Get current user
    const {
        data: { user },
    } = await supabase.auth.getUser();

    const results: { variant_id: number; success: boolean; error?: string }[] = [];
    const syncVariantIds = new Set<number>();

    for (const change of changes) {
        const { variant_id, price, compare_at_price, cost } = change;

        if (!variant_id) {
            results.push({ variant_id: 0, success: false, error: "variant_id requerido" });
            continue;
        }

        try {
            // Fetch current values
            const { data: current, error: fetchErr } = await supabase
                .from("variants")
                .select("price, compare_at_price, cost")
                .eq("id", variant_id)
                .single();

            if (fetchErr || !current) {
                results.push({ variant_id, success: false, error: "Variante no encontrada" });
                continue;
            }

            // Build update object and history records
            const updateObj: Record<string, any> = { updated_at: new Date().toISOString() };
            const historyRecords: any[] = [];
            let priceChanged = false;

            if (price !== undefined && price !== null && Number(price) !== Number(current.price)) {
                updateObj.price = Number(price);
                historyRecords.push({
                    variant_id,
                    field: "price",
                    old_value: current.price,
                    new_value: Number(price),
                    change_type: change_type || "manual",
                    rule_description: rule_description || null,
                    user_id: user?.id || null,
                });
                priceChanged = true;
            }

            if (
                compare_at_price !== undefined &&
                Number(compare_at_price || 0) !== Number(current.compare_at_price || 0)
            ) {
                updateObj.compare_at_price = compare_at_price === null || compare_at_price === "" ? null : Number(compare_at_price);
                historyRecords.push({
                    variant_id,
                    field: "compare_at_price",
                    old_value: current.compare_at_price,
                    new_value: compare_at_price === null || compare_at_price === "" ? 0 : Number(compare_at_price),
                    change_type: change_type || "manual",
                    rule_description: rule_description || null,
                    user_id: user?.id || null,
                });
                priceChanged = true;
            }

            if (cost !== undefined && Number(cost || 0) !== Number(current.cost || 0)) {
                updateObj.cost = cost === null || cost === "" ? null : Number(cost);
                historyRecords.push({
                    variant_id,
                    field: "cost",
                    old_value: current.cost,
                    new_value: cost === null || cost === "" ? 0 : Number(cost),
                    change_type: change_type || "manual",
                    rule_description: rule_description || null,
                    user_id: user?.id || null,
                });
            }

            if (Object.keys(updateObj).length <= 1) {
                // Only updated_at, no actual changes
                results.push({ variant_id, success: true });
                continue;
            }

            // Update variant
            const { error: updateErr } = await supabase
                .from("variants")
                .update(updateObj)
                .eq("id", variant_id);

            if (updateErr) throw updateErr;

            // Insert history records
            if (historyRecords.length > 0) {
                const { error: histErr } = await supabase
                    .from("price_history")
                    .insert(historyRecords);
                if (histErr) console.error("Error inserting price history:", histErr);
            }

            // Queue sync if price or compare_at_price changed
            if (priceChanged) {
                syncVariantIds.add(variant_id);
            }

            results.push({ variant_id, success: true });
        } catch (err: any) {
            results.push({ variant_id, success: false, error: err.message });
        }
    }

    // Enqueue sync for all changed variants
    if (syncVariantIds.size > 0) {
        const syncItems = Array.from(syncVariantIds).map((vid) => ({
            variant_id: vid,
            action: "update_price" as const,
            status: "pending" as const,
        }));

        const { error: syncErr } = await supabase.from("sync_queue").insert(syncItems);
        if (syncErr) console.error("Error enqueuing price sync:", syncErr);
    }

    const successCount = results.filter((r) => r.success).length;
    const failCount = results.filter((r) => !r.success).length;

    return NextResponse.json({
        message: `${successCount} actualizado(s), ${failCount} error(es)`,
        results,
        synced: syncVariantIds.size,
    });
}
