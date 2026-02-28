import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export interface StockVariantRow {
    variant_id: number;
    product_id: number;
    product_name: string;
    attribute_values: string[] | null;
    sku: string | null;
    barcode: string | null;
    price: number;
    stock_levels: Record<number, number>; // warehouse_id → quantity
    stock_total: number;
    stock_web: number;
}

export interface StockResponse {
    variants: StockVariantRow[];
    warehouses: {
        id: number;
        name: string;
        syncs_to_web: boolean;
        is_primary: boolean;
        is_virtual: boolean;
    }[];
}

// GET /api/stock — Full stock matrix
export async function GET(request: Request) {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const searchQuery = searchParams.get("search") || "";
    const warehouseFilter = searchParams.get("warehouse_id");

    // 1. Get all active warehouses
    const { data: warehouses, error: whError } = await supabase
        .from("warehouses")
        .select("id, name, syncs_to_web, is_primary, is_virtual")
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

    if (whError) {
        return NextResponse.json({ error: whError.message }, { status: 500 });
    }

    // 2. Get all active variants with their product
    let variantsQuery = supabase
        .from("variants")
        .select(`
            id,
            product_id,
            sku,
            barcode,
            attribute_values,
            price,
            products!inner ( id, name, active )
        `)
        .eq("active", true)
        .eq("products.active", true)
        .order("product_id", { ascending: true })
        .order("id", { ascending: true });

    if (searchQuery) {
        variantsQuery = variantsQuery.ilike("products.name", `%${searchQuery}%`);
    }

    const { data: variants, error: vError } = await variantsQuery;

    if (vError) {
        return NextResponse.json({ error: vError.message }, { status: 500 });
    }

    // 3. Get all stock levels
    const variantIds = (variants || []).map((v: Record<string, unknown>) => v.id as number);

    let stockQuery = supabase
        .from("stock_levels")
        .select("variant_id, warehouse_id, quantity")
        .in("variant_id", variantIds.length > 0 ? variantIds : [0]);

    if (warehouseFilter) {
        stockQuery = stockQuery.eq("warehouse_id", parseInt(warehouseFilter));
    }

    const { data: stockLevels, error: slError } = await stockQuery;

    if (slError) {
        return NextResponse.json({ error: slError.message }, { status: 500 });
    }

    // 4. Build stock map: variant_id → { warehouse_id → quantity }
    const stockMap = new Map<number, Map<number, number>>();
    for (const sl of stockLevels || []) {
        if (!stockMap.has(sl.variant_id)) {
            stockMap.set(sl.variant_id, new Map());
        }
        stockMap.get(sl.variant_id)!.set(sl.warehouse_id, sl.quantity);
    }

    // Web warehouse IDs
    const webWarehouseIds = new Set(
        (warehouses || []).filter((w) => w.syncs_to_web).map((w) => w.id)
    );

    // 5. Build response
    const result: StockVariantRow[] = (variants || []).map((v: Record<string, unknown>) => {
        const product = v.products as Record<string, unknown>;
        const variantStock = stockMap.get(v.id as number) || new Map();

        const stockLevelsObj: Record<number, number> = {};
        let stockTotal = 0;
        let stockWeb = 0;

        for (const wh of warehouses || []) {
            const qty = variantStock.get(wh.id) || 0;
            stockLevelsObj[wh.id] = qty;
            stockTotal += qty;
            if (webWarehouseIds.has(wh.id)) {
                stockWeb += qty;
            }
        }

        return {
            variant_id: v.id as number,
            product_id: v.product_id as number,
            product_name: product.name as string,
            attribute_values: v.attribute_values as string[] | null,
            sku: v.sku as string | null,
            barcode: v.barcode as string | null,
            price: v.price as number,
            stock_levels: stockLevelsObj,
            stock_total: stockTotal,
            stock_web: stockWeb,
        };
    });

    const response: StockResponse = {
        variants: result,
        warehouses: (warehouses || []).map((w) => ({
            id: w.id,
            name: w.name,
            syncs_to_web: w.syncs_to_web,
            is_primary: w.is_primary,
            is_virtual: w.is_virtual,
        })),
    };

    return NextResponse.json(response);
}
