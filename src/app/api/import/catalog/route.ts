import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TiendanubeClient } from "@/lib/tiendanube/client";
import type { TnProduct } from "@/lib/tiendanube/types";
import type { CatalogImportResult } from "@/lib/tiendanube/types";

/**
 * Extract a plain text value from a TN localized string object.
 * Prefers "es", falls back to first key available.
 */
function localized(obj: Record<string, string> | null | undefined): string {
    if (!obj) return "";
    if (obj.es) return obj.es;
    const keys = Object.keys(obj);
    return keys.length > 0 ? obj[keys[0]] : "";
}

/**
 * Strip HTML tags from a string.
 */
function stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, "").trim();
}

/**
 * Safely parse a numeric string, returning null if invalid.
 */
function parseNum(val: string | null | undefined): number | null {
    if (val == null || val === "") return null;
    const n = parseFloat(val);
    return isNaN(n) ? null : n;
}

export async function POST() {
    const supabase = await createClient();

    // 1. Read credentials
    const { data: settings, error: settingsErr } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["tn_access_token", "tn_store_id"]);

    if (settingsErr) {
        return NextResponse.json(
            { error: "Error al leer configuración" },
            { status: 500 }
        );
    }

    const token = settings?.find((s) => s.key === "tn_access_token")?.value;
    const storeId = settings?.find((s) => s.key === "tn_store_id")?.value;

    if (!token || !storeId) {
        return NextResponse.json(
            { error: "Credenciales de Tiendanube no configuradas" },
            { status: 400 }
        );
    }

    // 2. Fetch all products from Tiendanube
    const client = new TiendanubeClient(token, storeId);
    let tnProducts: TnProduct[];

    try {
        tnProducts = await client.fetchAllProducts();
    } catch (err) {
        return NextResponse.json(
            {
                error: `Error al obtener productos de Tiendanube: ${err instanceof Error ? err.message : "Error desconocido"}`,
            },
            { status: 502 }
        );
    }

    // 3. Upsert into DB
    const result: CatalogImportResult = {
        productsImported: 0,
        variantsImported: 0,
        productsSkipped: 0,
        errors: [],
        timestamp: new Date().toISOString(),
    };

    for (const tnProduct of tnProducts) {
        // 3a. Upsert product
        const productData = {
            tn_product_id: tnProduct.id,
            name: localized(tnProduct.name) || `Producto TN #${tnProduct.id}`,
            description: stripHtml(localized(tnProduct.description)),
            active: tnProduct.published ?? true,
            tn_metadata: {
                handle: localized(tnProduct.handle),
                tags: tnProduct.tags,
                brand: tnProduct.brand,
                published: tnProduct.published,
                attributes: tnProduct.attributes?.map((a) => localized(a)) ?? [],
            },
            updated_at: new Date().toISOString(),
        };

        const { data: productRow, error: productErr } = await supabase
            .from("products")
            .upsert(productData, { onConflict: "tn_product_id" })
            .select("id")
            .single();

        if (productErr || !productRow) {
            result.errors.push(
                `Producto TN#${tnProduct.id}: ${productErr?.message ?? "sin ID"}`
            );
            result.productsSkipped++;
            continue;
        }

        result.productsImported++;
        const localProductId = productRow.id;

        // 3b. Upsert variants
        for (const tnVariant of tnProduct.variants) {
            const variantValues = tnVariant.values?.map((v) => localized(v)) ?? [];

            const variantData = {
                product_id: localProductId,
                tn_variant_id: tnVariant.id,
                sku: tnVariant.sku ?? null,
                barcode: tnVariant.barcode ?? null,
                attribute_values: variantValues,
                price: parseNum(tnVariant.price) ?? 0,
                compare_at_price: parseNum(tnVariant.promotional_price),
                cost: parseNum(tnVariant.cost),
                stock_control: tnVariant.stock_management ?? true,
                active: true,
                updated_at: new Date().toISOString(),
            };

            const { error: variantErr } = await supabase
                .from("variants")
                .upsert(variantData, { onConflict: "tn_variant_id" });

            if (variantErr) {
                result.errors.push(
                    `Variante TN#${tnVariant.id} (Prod TN#${tnProduct.id}): ${variantErr.message}`
                );
            } else {
                result.variantsImported++;
            }
        }
    }

    // 4. Save last import timestamp
    await supabase
        .from("app_settings")
        .upsert(
            {
                key: "last_catalog_import",
                value: result.timestamp,
                updated_at: result.timestamp,
            },
            { onConflict: "key" }
        );

    // 5. Log to sync_log
    await supabase.from("sync_log").insert({
        direction: "tn_to_local",
        event_type: "catalog_import",
        status: result.errors.length > 0 ? "partial" : "success",
        payload: JSON.parse(JSON.stringify(result)),
    });

    return NextResponse.json(result);
}
