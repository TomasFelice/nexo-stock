import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ─── GET /api/prices/history ─────────────────────────
// Returns price change history with optional filters
export async function GET(request: NextRequest) {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const variantId = searchParams.get("variant_id");
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = Math.min(parseInt(searchParams.get("limit") || "50"), 100);
    const offset = (page - 1) * limit;

    let query = supabase
        .from("price_history")
        .select(
            `
            id,
            variant_id,
            field,
            old_value,
            new_value,
            change_type,
            rule_description,
            created_at,
            variants!inner (
                id,
                sku,
                attribute_values,
                products!inner (
                    id,
                    name
                )
            )
        `,
            { count: "exact" }
        )
        .order("created_at", { ascending: false });

    if (variantId) {
        query = query.eq("variant_id", parseInt(variantId));
    }

    if (from) {
        query = query.gte("created_at", `${from}T00:00:00`);
    }

    if (to) {
        query = query.lte("created_at", `${to}T23:59:59`);
    }

    query = query.range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Transform for frontend
    const history = (data || []).map((h: any) => {
        const variant = Array.isArray(h.variants) ? h.variants[0] : h.variants;
        const product = variant
            ? Array.isArray(variant.products)
                ? variant.products[0]
                : variant.products
            : null;

        return {
            id: h.id,
            variant_id: h.variant_id,
            field: h.field,
            old_value: h.old_value,
            new_value: h.new_value,
            change_type: h.change_type,
            rule_description: h.rule_description,
            created_at: h.created_at,
            product_name: product?.name || "—",
            variant_sku: variant?.sku || null,
            variant_attrs: variant?.attribute_values || [],
        };
    });

    return NextResponse.json({
        history,
        pagination: {
            page,
            limit,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limit),
        },
    });
}
