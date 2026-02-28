import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/pos/search?q=...
// Search variants by SKU, barcode, or product name for POS quick lookup

export async function GET(request: Request) {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const query = (searchParams.get("q") || "").trim();

    // Search variants by SKU, barcode, or product name
    // Try exact barcode/SKU match first, then fuzzy product name search
    let variants;

    if (!query) {
        // Return default list of variants limit 50
        const { data: allVariants } = await supabase
            .from("variants")
            .select(`
                id,
                sku,
                barcode,
                attribute_values,
                price,
                product_id,
                products!inner ( id, name, active )
            `)
            .eq("active", true)
            .eq("products.active", true)
            .order("id", { ascending: false })
            .limit(50);
        variants = allVariants || [];
    } else {
        // Check for exact barcode match
        const { data: barcodeMatch } = await supabase
            .from("variants")
            .select(`
            id,
            sku,
            barcode,
            attribute_values,
            price,
            product_id,
            products!inner ( id, name, active )
        `)
            .eq("active", true)
            .eq("products.active", true)
            .eq("barcode", query)
            .limit(1);

        if (barcodeMatch && barcodeMatch.length > 0) {
            variants = barcodeMatch;
        } else {
            // Check for exact SKU match
            const { data: skuMatch } = await supabase
                .from("variants")
                .select(`
                id,
                sku,
                barcode,
                attribute_values,
                price,
                product_id,
                products!inner ( id, name, active )
            `)
                .eq("active", true)
                .eq("products.active", true)
                .ilike("sku", query)
                .limit(5);

            if (skuMatch && skuMatch.length > 0) {
                variants = skuMatch;
            } else {
                // Fuzzy search by product name
                const { data: nameMatch } = await supabase
                    .from("variants")
                    .select(`
                    id,
                    sku,
                    barcode,
                    attribute_values,
                    price,
                    product_id,
                    products!inner ( id, name, active )
                `)
                    .eq("active", true)
                    .eq("products.active", true)
                    .ilike("products.name", `%${query}%`)
                    .limit(20);

                variants = nameMatch || [];
            }
        }
    }

    // Determine warehouses
    const { data: warehouses } = await supabase
        .from("warehouses")
        .select("id, name, sort_order, syncs_to_web")
        .eq("active", true)
        .eq("is_virtual", false)
        .order("sort_order", { ascending: true });

    // Get stock levels for found variants
    const variantIds = (variants || []).map((v: Record<string, unknown>) => v.id as number);

    const { data: stockLevels } = await supabase
        .from("stock_levels")
        .select("variant_id, warehouse_id, quantity")
        .in("variant_id", variantIds.length > 0 ? variantIds : [0]);

    // Build stock map
    const stockMap = new Map<number, Map<number, number>>();
    for (const sl of stockLevels || []) {
        if (!stockMap.has(sl.variant_id)) {
            stockMap.set(sl.variant_id, new Map());
        }
        stockMap.get(sl.variant_id)!.set(sl.warehouse_id, sl.quantity);
    }

    // Format results
    const results = (variants || []).map((v: Record<string, unknown>) => {
        const product = v.products as Record<string, unknown>;
        const variantStock = stockMap.get(v.id as number) || new Map();

        const stockByWarehouse: Record<number, number> = {};
        let totalStock = 0;

        for (const wh of warehouses || []) {
            const qty = variantStock.get(wh.id) || 0;
            stockByWarehouse[wh.id] = qty;
            totalStock += qty;
        }

        return {
            variant_id: v.id,
            product_id: v.product_id,
            product_name: product.name,
            attribute_values: v.attribute_values,
            sku: v.sku,
            barcode: v.barcode,
            price: v.price,
            stock_by_warehouse: stockByWarehouse,
            total_stock: totalStock,
        };
    });

    return NextResponse.json({
        results,
        warehouses: (warehouses || []).map((w) => ({
            id: w.id,
            name: w.name,
            sort_order: w.sort_order,
        })),
    });
}
