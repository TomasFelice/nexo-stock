// Tiendanube API response types

/** Localized string (TN uses multi-language objects) */
export type TnLocalizedString = Record<string, string>;

/** Variant from TN API */
export interface TnVariant {
    id: number;
    product_id: number;
    sku: string | null;
    barcode: string | null;
    price: string;
    promotional_price: string | null;
    cost: string | null;
    stock_management: boolean;
    stock: number | null;
    values: TnLocalizedString[];
    weight: string | null;
    width: string | null;
    height: string | null;
    depth: string | null;
    created_at: string;
    updated_at: string;
}

/** Product from TN API */
export interface TnProduct {
    id: number;
    name: TnLocalizedString;
    description: TnLocalizedString;
    handle: TnLocalizedString;
    attributes: TnLocalizedString[];
    published: boolean;
    brand: string | null;
    tags: string;
    variants: TnVariant[];
    images: TnProductImage[];
    categories: TnCategory[];
    seo_title: string | null;
    seo_description: string | null;
    video_url: string | null;
    free_shipping: boolean;
    created_at: string;
    updated_at: string;
}

export interface TnProductImage {
    id: number;
    src: string;
    position: number;
    product_id: number;
}

export interface TnCategory {
    id: number;
    name: TnLocalizedString;
    handle: TnLocalizedString;
}

export interface CatalogImportResult {
    productsImported: number;
    variantsImported: number;
    productsSkipped: number;
    errors: string[];
    timestamp: string;
}

export interface TnVariantUpdatePayload {
    stock?: number | null;
    price?: number | string;
    promotional_price?: number | string | null;
    cost?: number | string | null;
    weight?: number | string | null;
    width?: number | string | null;
    height?: number | string | null;
    depth?: number | string | null;
}
