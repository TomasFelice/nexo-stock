// NexoStock — Utility functions
// Add shared utilities here as the project grows.

/**
 * Formats a number as Argentine peso currency.
 */
export function formatCurrency(value: number): string {
    return new Intl.NumberFormat("es-AR", {
        style: "currency",
        currency: "ARS",
        minimumFractionDigits: 0,
    }).format(value);
}

/**
 * Generates a short sale number like NXS-0001.
 */
export function generateSaleNumber(seq: number): string {
    return `NXS-${String(seq).padStart(4, "0")}`;
}

/**
 * cn — merge class names (simple join, no clsx needed yet).
 */
export function cn(...classes: (string | false | null | undefined)[]): string {
    return classes.filter(Boolean).join(" ");
}
