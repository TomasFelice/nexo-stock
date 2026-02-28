"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
    Package,
    Loader2,
    PackageOpen,
    Search,
    Filter,
    X,
} from "lucide-react";

interface StockVariantRow {
    variant_id: number;
    product_id: number;
    product_name: string;
    attribute_values: string[] | null;
    sku: string | null;
    barcode: string | null;
    price: number;
    stock_levels: Record<number, number>;
    stock_total: number;
    stock_web: number;
}

interface WarehouseInfo {
    id: number;
    name: string;
    syncs_to_web: boolean;
    is_primary: boolean;
    is_virtual: boolean;
}

interface StockResponse {
    variants: StockVariantRow[];
    warehouses: WarehouseInfo[];
}

const LOW_STOCK_THRESHOLD = 3;

export default function ProductosPage() {
    const [data, setData] = useState<StockResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [warehouseFilter, setWarehouseFilter] = useState<string>("");
    const [editingCell, setEditingCell] = useState<{ variantId: number; warehouseId: number } | null>(null);
    const [editValue, setEditValue] = useState("");
    const [saving, setSaving] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

    const loadStock = useCallback(async (search?: string) => {
        try {
            const params = new URLSearchParams();
            if (search) params.set("search", search);
            if (warehouseFilter) params.set("warehouse_id", warehouseFilter);

            const res = await fetch(`/api/stock?${params.toString()}`);
            if (!res.ok) throw new Error("Error al cargar stock");
            const json: StockResponse = await res.json();
            setData(json);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error desconocido");
        } finally {
            setLoading(false);
        }
    }, [warehouseFilter]);

    useEffect(() => {
        setLoading(true);
        loadStock(searchQuery);
    }, [loadStock, searchQuery]);

    // Debounced search
    function handleSearchChange(value: string) {
        setSearchQuery(value);
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => {
            setLoading(true);
            loadStock(value);
        }, 300);
    }

    // Focus input when editing starts
    useEffect(() => {
        if (editingCell && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editingCell]);

    function startEdit(variantId: number, warehouseId: number, currentValue: number) {
        setEditingCell({ variantId, warehouseId });
        setEditValue(currentValue.toString());
    }

    async function saveEdit() {
        if (!editingCell) return;

        const quantity = parseInt(editValue);
        if (isNaN(quantity) || quantity < 0) {
            setEditingCell(null);
            return;
        }

        // Check if value actually changed
        const currentQuantity = data?.variants.find(
            (v) => v.variant_id === editingCell.variantId
        )?.stock_levels[editingCell.warehouseId] || 0;

        if (quantity === currentQuantity) {
            setEditingCell(null);
            return;
        }

        setSaving(true);
        try {
            const res = await fetch("/api/stock/update", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    variant_id: editingCell.variantId,
                    warehouse_id: editingCell.warehouseId,
                    quantity,
                }),
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "Error al actualizar");
            }

            // Update local state optimistically
            setData((prev) => {
                if (!prev) return prev;
                const warehouses = prev.warehouses;
                const webWarehouseIds = new Set(warehouses.filter((w) => w.syncs_to_web).map((w) => w.id));

                return {
                    ...prev,
                    variants: prev.variants.map((v) => {
                        if (v.variant_id !== editingCell.variantId) return v;

                        const newStockLevels = { ...v.stock_levels, [editingCell.warehouseId]: quantity };
                        let newTotal = 0;
                        let newWeb = 0;
                        for (const [whId, qty] of Object.entries(newStockLevels)) {
                            newTotal += qty;
                            if (webWarehouseIds.has(Number(whId))) newWeb += qty;
                        }

                        return {
                            ...v,
                            stock_levels: newStockLevels,
                            stock_total: newTotal,
                            stock_web: newWeb,
                        };
                    }),
                };
            });

            setEditingCell(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error desconocido");
        } finally {
            setSaving(false);
        }
    }

    function cancelEdit() {
        setEditingCell(null);
    }

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === "Enter") {
            e.preventDefault();
            saveEdit();
        } else if (e.key === "Escape") {
            cancelEdit();
        }
    }

    // Group variants by product
    function getGroupedVariants(): Map<number, StockVariantRow[]> {
        const map = new Map<number, StockVariantRow[]>();
        for (const v of data?.variants || []) {
            if (!map.has(v.product_id)) map.set(v.product_id, []);
            map.get(v.product_id)!.push(v);
        }
        return map;
    }

    function getStockBadge(total: number) {
        if (total === 0) return <span className="stock-badge stock-badge-danger">Sin stock</span>;
        if (total <= LOW_STOCK_THRESHOLD)
            return <span className="stock-badge stock-badge-warning">Stock bajo</span>;
        return <span className="stock-badge stock-badge-success">{total}</span>;
    }

    const grouped = getGroupedVariants();
    const warehouses = data?.warehouses || [];

    return (
        <div className="page-container">
            <div className="page-header">
                <div className="page-header-row">
                    <Package size={24} strokeWidth={1.5} className="page-header-icon" />
                    <h1 className="page-title">Productos y Stock</h1>
                </div>
                <p className="page-subtitle">
                    Vista consolidada de stock por variante y depósito. Hacé click en una celda para editar la cantidad.
                </p>
            </div>

            {/* Filter bar */}
            <div className="stock-filter-bar">
                <div className="stock-search-wrapper">
                    <Search size={16} strokeWidth={1.5} className="stock-search-icon" />
                    <input
                        type="text"
                        className="stock-search-input"
                        placeholder="Buscar producto..."
                        value={searchQuery}
                        onChange={(e) => handleSearchChange(e.target.value)}
                    />
                    {searchQuery && (
                        <button
                            className="stock-search-clear"
                            onClick={() => handleSearchChange("")}
                            aria-label="Limpiar búsqueda"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>

                <div className="stock-filter-wrapper">
                    <Filter size={16} strokeWidth={1.5} className="stock-filter-icon" />
                    <select
                        className="stock-filter-select"
                        value={warehouseFilter}
                        onChange={(e) => {
                            setWarehouseFilter(e.target.value);
                        }}
                    >
                        <option value="">Todos los depósitos</option>
                        {warehouses.map((wh) => (
                            <option key={wh.id} value={wh.id.toString()}>
                                {wh.name}
                            </option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Error alert */}
            {error && (
                <div className="settings-alert settings-alert-danger" style={{ marginBottom: "1rem" }}>
                    {error}
                    <button
                        onClick={() => setError("")}
                        style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "inherit" }}
                    >
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="wh-loading">
                    <Loader2 size={24} className="spin" />
                </div>
            )}

            {/* Empty state */}
            {!loading && (!data || data.variants.length === 0) && (
                <div className="wh-empty">
                    <PackageOpen size={48} strokeWidth={1} />
                    <h2>No hay productos</h2>
                    <p>
                        {searchQuery
                            ? "No se encontraron productos con ese nombre."
                            : "Importá tu catálogo desde Configuración para ver el stock."}
                    </p>
                </div>
            )}

            {/* Stock table */}
            {!loading && data && data.variants.length > 0 && (
                <div className="stock-table-container">
                    <table className="stock-table">
                        <thead>
                            <tr>
                                <th className="stock-th stock-th-product">Producto</th>
                                <th className="stock-th stock-th-variant">Variante</th>
                                <th className="stock-th stock-th-sku">SKU</th>
                                <th className="stock-th stock-th-total">
                                    Stock Total
                                </th>
                                <th className="stock-th stock-th-web">
                                    Stock Web
                                </th>
                                {warehouses.map((wh) => (
                                    <th key={wh.id} className="stock-th stock-th-warehouse">
                                        <span className="stock-th-wh-name">{wh.name}</span>
                                        {wh.syncs_to_web && (
                                            <span className="stock-th-web-badge" title="Sincroniza a web">
                                                🌐
                                            </span>
                                        )}
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {Array.from(grouped.entries()).map(([productId, variants]) =>
                                variants.map((v, idx) => (
                                    <tr
                                        key={v.variant_id}
                                        className={`stock-row ${idx === 0 ? "stock-row-group-start" : ""}`}
                                    >
                                        {idx === 0 && (
                                            <td
                                                className="stock-td stock-td-product"
                                                rowSpan={variants.length}
                                            >
                                                <span className="stock-product-name">{v.product_name}</span>
                                            </td>
                                        )}
                                        <td className="stock-td stock-td-variant">
                                            {v.attribute_values && v.attribute_values.length > 0
                                                ? v.attribute_values.join(" / ")
                                                : "—"}
                                        </td>
                                        <td className="stock-td stock-td-sku">
                                            <span className="stock-sku-text">{v.sku || "—"}</span>
                                        </td>
                                        <td className="stock-td stock-td-total">
                                            {getStockBadge(v.stock_total)}
                                        </td>
                                        <td className="stock-td stock-td-web">
                                            <span className={`stock-web-count ${v.stock_web === 0 ? "stock-web-zero" : ""}`}>
                                                {v.stock_web}
                                            </span>
                                        </td>
                                        {warehouses.map((wh) => {
                                            const qty = v.stock_levels[wh.id] ?? 0;
                                            const isEditing =
                                                editingCell?.variantId === v.variant_id &&
                                                editingCell?.warehouseId === wh.id;

                                            return (
                                                <td
                                                    key={wh.id}
                                                    className={`stock-td stock-td-quantity ${isEditing ? "stock-td-editing" : ""} ${qty === 0 ? "stock-td-zero" : ""}`}
                                                    onClick={() => {
                                                        if (!isEditing && !saving)
                                                            startEdit(v.variant_id, wh.id, qty);
                                                    }}
                                                >
                                                    {isEditing ? (
                                                        <div className="stock-edit-cell">
                                                            <input
                                                                ref={inputRef}
                                                                type="number"
                                                                min="0"
                                                                className="stock-edit-input"
                                                                value={editValue}
                                                                onChange={(e) => setEditValue(e.target.value)}
                                                                onKeyDown={handleKeyDown}
                                                                onBlur={saveEdit}
                                                                disabled={saving}
                                                            />
                                                        </div>
                                                    ) : (
                                                        <span className="stock-qty-display">{qty}</span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
