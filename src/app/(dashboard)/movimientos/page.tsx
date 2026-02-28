"use client";

import { useState, useEffect, useCallback } from "react";
import {
    ArrowLeftRight,
    Loader2,
    PackageOpen,
    Search,
    Filter,
    X,
    Plus,
    ArrowDownToLine,
    ArrowUpFromLine,
    SlidersHorizontal,
    RotateCcw,
    ShoppingCart,
    ArrowRightLeft,
    Calendar,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────

interface MovementVariant {
    id: number;
    sku: string | null;
    attribute_values: string[] | null;
    product_name: string;
}

interface WarehouseRef {
    id: number;
    name: string;
}

interface Movement {
    id: number;
    movement_type: string;
    quantity: number;
    reference: string | null;
    notes: string | null;
    user_id: string | null;
    created_at: string;
    variant: MovementVariant;
    source_warehouse: WarehouseRef | null;
    target_warehouse: WarehouseRef | null;
}

interface StockVariantOption {
    variant_id: number;
    product_name: string;
    attribute_values: string[] | null;
    sku: string | null;
}

interface MovementsResponse {
    movements: Movement[];
    warehouses: WarehouseRef[];
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
    };
}

// ─── Constants ───────────────────────────────────────────

const MOVEMENT_TYPES = [
    { value: "ingreso", label: "Ingreso", icon: ArrowDownToLine },
    { value: "egreso", label: "Egreso", icon: ArrowUpFromLine },
    { value: "ajuste", label: "Ajuste", icon: SlidersHorizontal },
    { value: "venta", label: "Venta", icon: ShoppingCart },
    { value: "devolucion", label: "Devolución", icon: RotateCcw },
    { value: "transferencia", label: "Transferencia", icon: ArrowRightLeft },
    { value: "cambio", label: "Cambio", icon: RefreshCw },
];

const TYPE_BADGE_CLASS: Record<string, string> = {
    ingreso: "mv-badge-ingreso",
    egreso: "mv-badge-egreso",
    ajuste: "mv-badge-ajuste",
    venta: "mv-badge-venta",
    devolucion: "mv-badge-devolucion",
    transferencia: "mv-badge-transferencia",
    cambio: "mv-badge-cambio",
};

// ─── Page Component ──────────────────────────────────────

export default function MovimientosPage() {
    // State
    const [data, setData] = useState<MovementsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [searchQuery, setSearchQuery] = useState("");
    const [typeFilter, setTypeFilter] = useState("");
    const [warehouseFilter, setWarehouseFilter] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [page, setPage] = useState(1);

    // Modal state
    const [modalOpen, setModalOpen] = useState(false);
    const [formType, setFormType] = useState("ingreso");
    const [formVariantId, setFormVariantId] = useState("");
    const [formSourceWarehouse, setFormSourceWarehouse] = useState("");
    const [formTargetWarehouse, setFormTargetWarehouse] = useState("");
    const [formQuantity, setFormQuantity] = useState("");
    const [formReference, setFormReference] = useState("");
    const [formNotes, setFormNotes] = useState("");
    const [submitting, setSubmitting] = useState(false);
    const [formError, setFormError] = useState("");

    // Variant options for the modal
    const [variantOptions, setVariantOptions] = useState<StockVariantOption[]>([]);
    const [variantSearch, setVariantSearch] = useState("");
    const [loadingVariants, setLoadingVariants] = useState(false);

    // ─── Data loading ────────────────────────────────────

    const loadMovements = useCallback(async () => {
        try {
            const params = new URLSearchParams();
            if (searchQuery) params.set("search", searchQuery);
            if (typeFilter) params.set("type", typeFilter);
            if (warehouseFilter) params.set("warehouse_id", warehouseFilter);
            if (dateFrom) params.set("from", dateFrom);
            if (dateTo) params.set("to", dateTo);
            params.set("page", page.toString());
            params.set("limit", "20");

            const res = await fetch(`/api/stock/movements?${params.toString()}`);
            if (!res.ok) throw new Error("Error al cargar movimientos");
            const json: MovementsResponse = await res.json();
            setData(json);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error desconocido");
        } finally {
            setLoading(false);
        }
    }, [searchQuery, typeFilter, warehouseFilter, dateFrom, dateTo, page]);

    useEffect(() => {
        setLoading(true);
        loadMovements();
    }, [loadMovements]);

    // Search variants for modal
    const searchVariants = useCallback(async (query: string) => {
        setLoadingVariants(true);
        try {
            const res = await fetch(`/api/stock?search=${encodeURIComponent(query)}`);
            if (!res.ok) return;
            const json = await res.json();
            setVariantOptions(
                (json.variants || []).map((v: Record<string, unknown>) => ({
                    variant_id: v.variant_id,
                    product_name: v.product_name,
                    attribute_values: v.attribute_values,
                    sku: v.sku,
                }))
            );
        } catch {
            // ignore
        } finally {
            setLoadingVariants(false);
        }
    }, []);

    // Load variants when modal opens
    useEffect(() => {
        if (modalOpen) {
            searchVariants(variantSearch);
        }
    }, [modalOpen, variantSearch, searchVariants]);

    // ─── Handlers ────────────────────────────────────────

    function resetFilters() {
        setSearchQuery("");
        setTypeFilter("");
        setWarehouseFilter("");
        setDateFrom("");
        setDateTo("");
        setPage(1);
    }

    function openModal() {
        setFormType("ingreso");
        setFormVariantId("");
        setFormSourceWarehouse("");
        setFormTargetWarehouse("");
        setFormQuantity("");
        setFormReference("");
        setFormNotes("");
        setFormError("");
        setVariantSearch("");
        setModalOpen(true);
    }

    function closeModal() {
        setModalOpen(false);
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setFormError("");

        if (!formVariantId) {
            setFormError("Seleccioná un producto/variante");
            return;
        }
        if (!formQuantity || parseInt(formQuantity) <= 0) {
            setFormError("La cantidad debe ser mayor a 0");
            return;
        }

        // Warehouse validations per type
        if (formType === "transferencia") {
            if (!formSourceWarehouse || !formTargetWarehouse) {
                setFormError("Seleccioná depósito origen y destino");
                return;
            }
            if (formSourceWarehouse === formTargetWarehouse) {
                setFormError("Los depósitos origen y destino no pueden ser iguales");
                return;
            }
        } else if (["egreso", "venta", "ajuste", "devolucion"].includes(formType)) {
            if (!formSourceWarehouse) {
                setFormError("Seleccioná un depósito");
                return;
            }
        }

        setSubmitting(true);
        try {
            const body: Record<string, unknown> = {
                variant_id: parseInt(formVariantId),
                movement_type: formType,
                quantity: parseInt(formQuantity),
                reference: formReference || null,
                notes: formNotes || null,
            };

            if (formSourceWarehouse) {
                body.source_warehouse_id = parseInt(formSourceWarehouse);
            }
            if (formType === "transferencia" && formTargetWarehouse) {
                body.target_warehouse_id = parseInt(formTargetWarehouse);
            }

            const res = await fetch("/api/stock/movements", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || "Error al crear movimiento");
            }

            closeModal();
            setPage(1);
            setLoading(true);
            loadMovements();
        } catch (err) {
            setFormError(err instanceof Error ? err.message : "Error desconocido");
        } finally {
            setSubmitting(false);
        }
    }

    // ─── Formatting helpers ──────────────────────────────

    function formatDate(iso: string) {
        const d = new Date(iso);
        return d.toLocaleDateString("es-AR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });
    }

    function formatTime(iso: string) {
        const d = new Date(iso);
        return d.toLocaleTimeString("es-AR", {
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    function getTypeName(type: string) {
        return MOVEMENT_TYPES.find((t) => t.value === type)?.label || type;
    }

    function getWarehouseDisplay(m: Movement) {
        if (m.movement_type === "transferencia") {
            return `${m.source_warehouse?.name || "—"} → ${m.target_warehouse?.name || "—"}`;
        }
        return m.source_warehouse?.name || m.target_warehouse?.name || "—";
    }

    function getQuantityDisplay(m: Movement) {
        switch (m.movement_type) {
            case "ingreso":
            case "devolucion":
                return `+${m.quantity}`;
            case "egreso":
            case "venta":
            case "cambio":
                return `-${m.quantity}`;
            case "transferencia":
                return `↔ ${m.quantity}`;
            case "ajuste":
                return `= ${m.quantity}`;
            default:
                return m.quantity.toString();
        }
    }

    function getQuantityClass(m: Movement) {
        switch (m.movement_type) {
            case "ingreso":
            case "devolucion":
                return "mv-qty-positive";
            case "egreso":
            case "venta":
            case "cambio":
                return "mv-qty-negative";
            default:
                return "mv-qty-neutral";
        }
    }

    // ─── Active filters check ────────────────────────────

    const hasActiveFilters = searchQuery || typeFilter || warehouseFilter || dateFrom || dateTo;
    const warehouses = data?.warehouses || [];
    const pagination = data?.pagination;

    // ─── Render ──────────────────────────────────────────

    return (
        <div className="page-container">
            {/* Header */}
            <div className="page-header">
                <div className="page-header-row">
                    <ArrowLeftRight size={24} strokeWidth={1.5} className="page-header-icon" />
                    <h1 className="page-title">Movimientos de Stock</h1>
                    <button className="btn-primary mv-new-btn" onClick={openModal}>
                        <Plus size={16} strokeWidth={2} />
                        Nuevo Movimiento
                    </button>
                </div>
                <p className="page-subtitle">
                    Historial de todos los cambios de stock: ingresos, egresos, ajustes, ventas, devoluciones y transferencias.
                </p>
            </div>

            {/* Filter bar */}
            <div className="mv-filter-bar">
                <div className="mv-filter-row">
                    <div className="stock-search-wrapper">
                        <Search size={16} strokeWidth={1.5} className="stock-search-icon" />
                        <input
                            type="text"
                            className="stock-search-input"
                            placeholder="Buscar producto..."
                            value={searchQuery}
                            onChange={(e) => {
                                setSearchQuery(e.target.value);
                                setPage(1);
                            }}
                        />
                        {searchQuery && (
                            <button
                                className="stock-search-clear"
                                onClick={() => {
                                    setSearchQuery("");
                                    setPage(1);
                                }}
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
                            value={typeFilter}
                            onChange={(e) => {
                                setTypeFilter(e.target.value);
                                setPage(1);
                            }}
                        >
                            <option value="">Todos los tipos</option>
                            {MOVEMENT_TYPES.map((t) => (
                                <option key={t.value} value={t.value}>
                                    {t.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="stock-filter-wrapper">
                        <Filter size={16} strokeWidth={1.5} className="stock-filter-icon" />
                        <select
                            className="stock-filter-select"
                            value={warehouseFilter}
                            onChange={(e) => {
                                setWarehouseFilter(e.target.value);
                                setPage(1);
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

                <div className="mv-filter-row">
                    <div className="mv-date-wrapper">
                        <Calendar size={16} strokeWidth={1.5} className="mv-date-icon" />
                        <input
                            type="date"
                            className="mv-date-input"
                            value={dateFrom}
                            onChange={(e) => {
                                setDateFrom(e.target.value);
                                setPage(1);
                            }}
                            placeholder="Desde"
                        />
                        <span className="mv-date-sep">—</span>
                        <input
                            type="date"
                            className="mv-date-input"
                            value={dateTo}
                            onChange={(e) => {
                                setDateTo(e.target.value);
                                setPage(1);
                            }}
                            placeholder="Hasta"
                        />
                    </div>

                    {hasActiveFilters && (
                        <button className="mv-clear-filters" onClick={resetFilters}>
                            <X size={14} />
                            Limpiar filtros
                        </button>
                    )}
                </div>
            </div>

            {/* Error */}
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
            {!loading && (!data || data.movements.length === 0) && (
                <div className="wh-empty">
                    <PackageOpen size={48} strokeWidth={1} />
                    <h2>No hay movimientos</h2>
                    <p>
                        {hasActiveFilters
                            ? "No se encontraron movimientos con esos filtros."
                            : "Registrá tu primer movimiento de stock con el botón \"Nuevo Movimiento\"."}
                    </p>
                </div>
            )}

            {/* Movements table */}
            {!loading && data && data.movements.length > 0 && (
                <>
                    <div className="stock-table-container">
                        <table className="stock-table mv-table">
                            <thead>
                                <tr>
                                    <th className="stock-th">Fecha</th>
                                    <th className="stock-th">Tipo</th>
                                    <th className="stock-th">Producto</th>
                                    <th className="stock-th">Variante</th>
                                    <th className="stock-th">Depósito</th>
                                    <th className="stock-th mv-th-qty">Cantidad</th>
                                    <th className="stock-th">Referencia</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.movements.map((m) => (
                                    <tr key={m.id} className="stock-row">
                                        <td className="stock-td mv-td-date">
                                            <span className="mv-date-primary">{formatDate(m.created_at)}</span>
                                            <span className="mv-date-secondary">{formatTime(m.created_at)}</span>
                                        </td>
                                        <td className="stock-td">
                                            <span className={`mv-type-badge ${TYPE_BADGE_CLASS[m.movement_type] || ""}`}>
                                                {getTypeName(m.movement_type)}
                                            </span>
                                        </td>
                                        <td className="stock-td">
                                            <span className="stock-product-name">{m.variant.product_name}</span>
                                        </td>
                                        <td className="stock-td">
                                            <span className="mv-variant-text">
                                                {m.variant.attribute_values?.join(" / ") || "—"}
                                            </span>
                                            {m.variant.sku && (
                                                <span className="mv-sku-text">{m.variant.sku}</span>
                                            )}
                                        </td>
                                        <td className="stock-td">
                                            <span className="mv-warehouse-text">{getWarehouseDisplay(m)}</span>
                                        </td>
                                        <td className={`stock-td mv-td-qty ${getQuantityClass(m)}`}>
                                            {getQuantityDisplay(m)}
                                        </td>
                                        <td className="stock-td">
                                            <span className="mv-ref-text">{m.reference || "—"}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    {pagination && pagination.totalPages > 1 && (
                        <div className="mv-pagination">
                            <span className="mv-pagination-info">
                                Mostrando {(pagination.page - 1) * pagination.limit + 1}–
                                {Math.min(pagination.page * pagination.limit, pagination.total)} de{" "}
                                {pagination.total}
                            </span>
                            <div className="mv-pagination-buttons">
                                <button
                                    className="mv-pagination-btn"
                                    disabled={page <= 1}
                                    onClick={() => setPage((p) => p - 1)}
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <span className="mv-pagination-current">
                                    {pagination.page} / {pagination.totalPages}
                                </span>
                                <button
                                    className="mv-pagination-btn"
                                    disabled={page >= pagination.totalPages}
                                    onClick={() => setPage((p) => p + 1)}
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* ─── Creation Modal ─── */}
            {modalOpen && (
                <div className="mv-modal-overlay" onClick={closeModal}>
                    <div className="mv-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="mv-modal-header">
                            <h2 className="mv-modal-title">Nuevo Movimiento</h2>
                            <button className="mv-modal-close" onClick={closeModal}>
                                <X size={18} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="mv-modal-form">
                            {formError && (
                                <div className="mv-form-error">{formError}</div>
                            )}

                            {/* Type selector */}
                            <div className="mv-form-field">
                                <label>Tipo de movimiento</label>
                                <div className="mv-type-selector">
                                    {MOVEMENT_TYPES.map((t) => (
                                        <button
                                            key={t.value}
                                            type="button"
                                            className={`mv-type-option ${formType === t.value ? "mv-type-active" : ""}`}
                                            onClick={() => setFormType(t.value)}
                                        >
                                            <t.icon size={16} strokeWidth={1.5} />
                                            <span>{t.label}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Variant selector */}
                            <div className="mv-form-field">
                                <label>Producto / Variante</label>
                                <input
                                    type="text"
                                    className="settings-field-input mv-variant-search"
                                    placeholder="Buscar por nombre o SKU..."
                                    value={variantSearch}
                                    onChange={(e) => setVariantSearch(e.target.value)}
                                />
                                <div className="mv-variant-list">
                                    {loadingVariants && (
                                        <div className="mv-variant-loading">
                                            <Loader2 size={16} className="spin" />
                                        </div>
                                    )}
                                    {!loadingVariants && variantOptions.length === 0 && (
                                        <div className="mv-variant-empty">No hay productos</div>
                                    )}
                                    {!loadingVariants &&
                                        variantOptions.map((v) => (
                                            <button
                                                key={v.variant_id}
                                                type="button"
                                                className={`mv-variant-option ${formVariantId === v.variant_id.toString() ? "mv-variant-selected" : ""}`}
                                                onClick={() => setFormVariantId(v.variant_id.toString())}
                                            >
                                                <span className="mv-variant-option-name">{v.product_name}</span>
                                                <span className="mv-variant-option-detail">
                                                    {v.attribute_values?.join(" / ") || ""}
                                                    {v.sku ? ` · ${v.sku}` : ""}
                                                </span>
                                            </button>
                                        ))}
                                </div>
                            </div>

                            {/* Warehouse selectors */}
                            <div className="mv-form-row">
                                <div className="mv-form-field">
                                    <label>
                                        {formType === "transferencia" ? "Depósito origen" : "Depósito"}
                                    </label>
                                    <select
                                        className="stock-filter-select mv-form-select"
                                        value={formSourceWarehouse}
                                        onChange={(e) => setFormSourceWarehouse(e.target.value)}
                                    >
                                        <option value="">Seleccionar...</option>
                                        {warehouses.map((wh) => (
                                            <option key={wh.id} value={wh.id.toString()}>
                                                {wh.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {formType === "transferencia" && (
                                    <div className="mv-form-field">
                                        <label>Depósito destino</label>
                                        <select
                                            className="stock-filter-select mv-form-select"
                                            value={formTargetWarehouse}
                                            onChange={(e) => setFormTargetWarehouse(e.target.value)}
                                        >
                                            <option value="">Seleccionar...</option>
                                            {warehouses.map((wh) => (
                                                <option key={wh.id} value={wh.id.toString()}>
                                                    {wh.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            {/* Quantity */}
                            <div className="mv-form-field">
                                <label>
                                    {formType === "ajuste" ? "Nueva cantidad (absoluta)" : "Cantidad"}
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    className="settings-field-input"
                                    placeholder="0"
                                    value={formQuantity}
                                    onChange={(e) => setFormQuantity(e.target.value)}
                                />
                            </div>

                            {/* Reference */}
                            <div className="mv-form-field">
                                <label>Referencia <span className="mv-optional">(opcional)</span></label>
                                <input
                                    type="text"
                                    className="settings-field-input"
                                    placeholder="Nro. factura, remito, etc."
                                    value={formReference}
                                    onChange={(e) => setFormReference(e.target.value)}
                                />
                            </div>

                            {/* Notes */}
                            <div className="mv-form-field">
                                <label>Notas <span className="mv-optional">(opcional)</span></label>
                                <textarea
                                    className="mv-form-textarea"
                                    placeholder="Notas adicionales..."
                                    value={formNotes}
                                    onChange={(e) => setFormNotes(e.target.value)}
                                    rows={2}
                                />
                            </div>

                            {/* Actions */}
                            <div className="mv-modal-actions">
                                <button
                                    type="button"
                                    className="btn-secondary"
                                    onClick={closeModal}
                                    disabled={submitting}
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="btn-primary"
                                    disabled={submitting}
                                >
                                    {submitting ? (
                                        <>
                                            <Loader2 size={16} className="spin" />
                                            Guardando...
                                        </>
                                    ) : (
                                        <>
                                            <Plus size={16} />
                                            Registrar Movimiento
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
