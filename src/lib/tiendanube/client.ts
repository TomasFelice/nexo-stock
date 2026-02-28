import { TnProduct } from "./types";

const TN_API_BASE = "https://api.tiendanube.com/v1";
const DEFAULT_PER_PAGE = 200;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

export class TiendanubeClient {
    private accessToken: string;
    private storeId: string;
    private baseUrl: string;

    constructor(accessToken: string, storeId: string) {
        this.accessToken = accessToken;
        this.storeId = storeId;
        this.baseUrl = `${TN_API_BASE}/${storeId}`;
    }

    private async request<T>(
        path: string,
        retryCount = 0
    ): Promise<T> {
        const url = `${this.baseUrl}${path}`;

        const res = await fetch(url, {
            headers: {
                Authentication: `bearer ${this.accessToken}`,
                "Content-Type": "application/json",
                "User-Agent": "NexoStock/1.0 (benai.cpy@gmail.com)",
            },
        });

        // Handle rate limiting (429)
        if (res.status === 429 && retryCount < MAX_RETRIES) {
            const backoff =
                INITIAL_BACKOFF_MS * Math.pow(2, retryCount);
            await new Promise((resolve) => setTimeout(resolve, backoff));
            return this.request<T>(path, retryCount + 1);
        }

        if (!res.ok) {
            const body = await res.text().catch(() => "");
            throw new Error(
                `Tiendanube API error ${res.status}: ${res.statusText}. ${body}`
            );
        }

        return res.json() as Promise<T>;
    }

    /**
     * Fetches a single page of products to test the connection.
     * Returns the count of products found.
     */
    async testConnection(): Promise<{ ok: boolean; productCount?: number; error?: string }> {
        try {
            const products = await this.request<TnProduct[]>(
                `/products?per_page=1`
            );
            return { ok: true, productCount: products.length };
        } catch (err) {
            return {
                ok: false,
                error: err instanceof Error ? err.message : "Error desconocido",
            };
        }
    }

    /**
     * Fetches ALL products with pagination.
     * The TN API returns up to `per_page` items per request (max 200).
     * We iterate until we get fewer items than `per_page`.
     */
    async fetchAllProducts(): Promise<TnProduct[]> {
        const allProducts: TnProduct[] = [];
        let page = 1;

        while (true) {
            const products = await this.request<TnProduct[]>(
                `/products?per_page=${DEFAULT_PER_PAGE}&page=${page}`
            );

            allProducts.push(...products);

            // If we received fewer than per_page, we've reached the last page
            if (products.length < DEFAULT_PER_PAGE) {
                break;
            }

            page++;
        }

        return allProducts;
    }
}
