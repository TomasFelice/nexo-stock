"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
    DollarSign,
    Search,
    Loader2,
    PackageOpen,
    X,
    Check,
    History,
    Percent,
    TrendingUp,
    TrendingDown,
    Tag,
    AlertTriangle,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Calendar,
    Filter,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────

interface VariantPrice {
    id: number;
    sku: string | null;
    barcode: string | null;
    attribute_values: string[] | null;
    price: number;
    compare_at_price: number | null;
    cost: number | null;
    tn_variant_id: number | null;
}

interface ProductGroup {
    id: number;
    name: string;
    tn_product_id: number | null;
    variants: VariantPrice[];
}

interface PriceChange {
    variant_id: number;
    price?: number;
    compare_at_price?: number | null;
    cost?: number | null;
}

interface HistoryEntry {
    id: number;
    variant_id: number;
    field: string;
    old_value: number | null;
    new_value: number;
    change_type: string;
    rule_description: string | null;
    created_at: string;
    product_name: string;
    variant_sku: string | null;
    variant_attrs: string[];
}

// ─── Constants ───────────────────────────────────────────

const FIELD_LABELS: Record<string, string> = {
    price: "Precio",
    compare_at_price: "Precio comparación",
    cost: "Costo",
};

const CHANGE_TYPE_LABELS: Record<string, string> = {
    manual: "Manual",
    rule: "Regla",
    bulk: "Masivo",
};

// ─── Page Component ──────────────────────────────────────

export default function PreciosPage() {
    const [activeTab, setActiveTab] = useState<"editor" | "history">("editor");

    // ── Editor state ──
    const [products, setProducts] = useState<ProductGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState("");
    const [saveSuccess, setSaveSuccess] = useState("");
    const searchTimeout = useRef<NodeJS.Timeout | null>(null);

    // ── Inline editing state ──
    const [editingCell, setEditingCell] = useState<{
        variantId: number;
        field: "price" | "compare_at_price" | "cost";
    } | null>(null);
    const [editValue, setEditValue] = useState("");
    const inputRef = useRef<HTMLInputElement>(null);

    // ── Rule state ──
    const [ruleOpen, setRuleOpen] = useState(false);
    const [ruleType, setRuleType] = useState<"increase" | "decrease" | "fixed">("increase");
    const [ruleValue, setRuleValue] = useState("");
    const [ruleField, setRuleField] = useState<"price" | "compare_at_price" | "cost">("price");
    const [selectedVariants, setSelectedVariants] = useState<Set<number>>(new Set());
    const [previewChanges, setPreviewChanges] = useState<PriceChange[]>([]);
    const [showPreview, setShowPreview] = useState(false);

    // ── History state ──
    const [history, setHistory] = useState<HistoryEntry[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [historyPage, setHistoryPage] = useState(1);
    const [historyPagination, setHistoryPagination] = useState<{
        page: number; limit: number; total: number; totalPages: number;
    } | null>(null);
    const [historyDateFrom, setHistoryDateFrom] = useState("");
    const [historyDateTo, setHistoryDateTo] = useState("");

    // ── Load products ──

    const loadProducts = useCallback(async (search?: string) => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (search) params.set("search", search);
            const res = await fetch(`/api/prices?${params}`);
            if (!res.ok) throw new Error("Error al cargar precios");
            const data = await res.json();
            setProducts(data.products || []);
        } catch {
            setSaveError("Error al cargar productos");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadProducts();
    }, [loadProducts]);

    // Debounced search
    useEffect(() => {
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => loadProducts(searchQuery), 300);
        return () => {
            if (searchTimeout.current) clearTimeout(searchTimeout.current);
        };
    }, [searchQuery, loadProducts]);

    // ── Load history ──

    const loadHistory = useCallback(async () => {
        setHistoryLoading(true);
        try {
            const params = new URLSearchParams();
            if (historyDateFrom) params.set("from", historyDateFrom);
            if (historyDateTo) params.set("to", historyDateTo);
            params.set("page", historyPage.toString());
            params.set("limit", "30");

            const res = await fetch(`/api/prices/history?${params}`);
            if (!res.ok) throw new Error("Error al cargar historial");
            const data = await res.json();
            setHistory(data.history || []);
            setHistoryPagination(data.pagination || null);
        } catch {
            // ignore
        } finally {
            setHistoryLoading(false);
        }
    }, [historyDateFrom, historyDateTo, historyPage]);

    useEffect(() => {
        if (activeTab === "history") loadHistory();
    }, [activeTab, loadHistory]);

    // ── Focus input on edit ──
    useEffect(() => {
        if (editingCell && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editingCell]);

    // ── Inline editing ──

    function startEdit(variantId: number, field: "price" | "compare_at_price" | "cost", currentValue: number | null) {
        setEditingCell({ variantId, field });
        setEditValue(currentValue?.toString() || "");
    }

    async function saveEdit() {
        if (!editingCell) return;
        const numValue = editValue === "" ? null : parseFloat(editValue);
        if (numValue !== null && isNaN(numValue)) {
            setEditingCell(null);
            return;
        }

        // Find current value
        let currentVal: number | null = null;
        for (const p of products) {
            const v = p.variants.find((v) => v.id === editingCell.variantId);
            if (v) {
                currentVal = v[editingCell.field];
                break;
            }
        }

        if (numValue === currentVal || (numValue === null && currentVal === null)) {
            setEditingCell(null);
            return;
        }

        setSaving(true);
        try {
            const res = await fetch("/api/prices", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    changes: [{ variant_id: editingCell.variantId, [editingCell.field]: numValue }],
                    change_type: "manual",
                }),
            });

            if (!res.ok) throw new Error("Error al guardar");

            // Update local state
            setProducts((prev) =>
                prev.map((p) => ({
                    ...p,
                    variants: p.variants.map((v) =>
                        v.id === editingCell!.variantId
                            ? { ...v, [editingCell!.field]: numValue }
                            : v
                    ),
                }))
            );

            setEditingCell(null);
            setSaveSuccess("Precio actualizado");
            setTimeout(() => setSaveSuccess(""), 3000);
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : "Error desconocido");
            setTimeout(() => setSaveError(""), 3000);
        } finally {
            setSaving(false);
        }
    }

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === "Enter") {
            e.preventDefault();
            saveEdit();
        } else if (e.key === "Escape") {
            setEditingCell(null);
        }
    }

    // ── Rule operations ──

    function toggleSelectAll() {
        if (selectedVariants.size === allVariantIds.length) {
            setSelectedVariants(new Set());
        } else {
            setSelectedVariants(new Set(allVariantIds));
        }
    }

    function toggleVariant(id: number) {
        setSelectedVariants((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    function generatePreview() {
        if (!ruleValue || selectedVariants.size === 0) return;

        const val = parseFloat(ruleValue);
        if (isNaN(val)) return;

        const changes: PriceChange[] = [];

        for (const p of products) {
            for (const v of p.variants) {
                if (!selectedVariants.has(v.id)) continue;

                const currentVal = v[ruleField] || 0;
                let newVal: number;

                if (ruleType === "fixed") {
                    newVal = val;
                } else if (ruleType === "increase") {
                    newVal = Math.round(currentVal * (1 + val / 100) * 100) / 100;
                } else {
                    newVal = Math.round(currentVal * (1 - val / 100) * 100) / 100;
                }

                if (newVal !== currentVal) {
                    changes.push({
                        variant_id: v.id,
                        [ruleField]: Math.max(0, newVal),
                    });
                }
            }
        }

        setPreviewChanges(changes);
        setShowPreview(true);
    }

    async function applyRule() {
        if (previewChanges.length === 0) return;

        setSaving(true);
        setSaveError("");

        const ruleDesc =
            ruleType === "fixed"
                ? `Precio fijo $${ruleValue}`
                : ruleType === "increase"
                    ? `+${ruleValue}% en ${FIELD_LABELS[ruleField]}`
                    : `-${ruleValue}% en ${FIELD_LABELS[ruleField]}`;

        try {
            const res = await fetch("/api/prices", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    changes: previewChanges,
                    change_type: "rule",
                    rule_description: ruleDesc,
                }),
            });

            if (!res.ok) throw new Error("Error al aplicar regla");

            const data = await res.json();

            // Refresh data
            await loadProducts(searchQuery);

            setShowPreview(false);
            setPreviewChanges([]);
            setRuleOpen(false);
            setSelectedVariants(new Set());
            setRuleValue("");
            setSaveSuccess(`Regla aplicada: ${data.message}. ${data.synced} en cola de sync.`);
            setTimeout(() => setSaveSuccess(""), 5000);
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : "Error desconocido");
            setTimeout(() => setSaveError(""), 5000);
        } finally {
            setSaving(false);
        }
    }

    // ── Helpers ──

    const allVariantIds = products.flatMap((p) => p.variants.map((v) => v.id));

    function formatCurrency(amount: number | null) {
        if (amount === null || amount === undefined) return "—";
        return new Intl.NumberFormat("es-AR", {
            style: "currency",
            currency: "ARS",
            minimumFractionDigits: 0,
            maximumFractionDigits: 2,
        }).format(amount);
    }

    function formatDate(iso: string) {
        return new Date(iso).toLocaleDateString("es-AR", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
        });
    }

    function formatTime(iso: string) {
        return new Date(iso).toLocaleTimeString("es-AR", {
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    function getPreviewNewValue(variantId: number, field: string): number | null {
        const change = previewChanges.find((c) => c.variant_id === variantId);
        if (!change) return null;
        return (change as any)[field] ?? null;
    }

    // ── Render ──

    return (
        <div className="page-container">
            {/* Header */}
            <div className="page-header">
                <div className="page-header-row">
                    <DollarSign size={24} strokeWidth={1.5} className="page-header-icon" />
                    <h1 className="page-title">Gestión de Precios</h1>
                </div>
                <p className="page-subtitle">
                    Editá precios de forma individual o masiva. Aplicá reglas de aumento/descuento y sincronizá con Tiendanube.
                </p>
            </div>

            {/* Tabs */}
            <div className="prices-tabs">
                <button
                    className={`prices-tab ${activeTab === "editor" ? "prices-tab-active" : ""}`}
                    onClick={() => setActiveTab("editor")}
                >
                    <DollarSign size={16} strokeWidth={1.5} />
                    Editor de Precios
                </button>
                <button
                    className={`prices-tab ${activeTab === "history" ? "prices-tab-active" : ""}`}
                    onClick={() => setActiveTab("history")}
                >
                    <History size={16} strokeWidth={1.5} />
                    Historial
                </button>
            </div>

            {/* ═══ EDITOR TAB ═══ */}
            {activeTab === "editor" && (
                <>
                    {/* Toasts */}
                    {saveSuccess && (
                        <div className="prices-toast prices-toast-success">
                            <CheckCircle2 size={16} strokeWidth={1.5} />
                            <span>{saveSuccess}</span>
                            <button onClick={() => setSaveSuccess("")} className="prices-toast-close">
                                <X size={14} />
                            </button>
                        </div>
                    )}
                    {saveError && (
                        <div className="prices-toast prices-toast-error">
                            <AlertTriangle size={16} strokeWidth={1.5} />
                            <span>{saveError}</span>
                            <button onClick={() => setSaveError("")} className="prices-toast-close">
                                <X size={14} />
                            </button>
                        </div>
                    )}

                    {/* Toolbar */}
                    <div className="prices-toolbar">
                        <div className="prices-search-wrapper">
                            <Search size={16} strokeWidth={1.5} className="prices-search-icon" />
                            <input
                                type="text"
                                className="prices-search-input"
                                placeholder="Buscar por nombre, SKU..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {searchQuery && (
                                <button className="prices-search-clear" onClick={() => setSearchQuery("")}>
                                    <X size={14} />
                                </button>
                            )}
                        </div>

                        <button
                            className={`prices-rule-btn ${ruleOpen ? "prices-rule-btn-active" : ""}`}
                            onClick={() => setRuleOpen(!ruleOpen)}
                        >
                            <Percent size={16} strokeWidth={1.5} />
                            Regla de Precios
                        </button>
                    </div>

                    {/* Rule Panel */}
                    {ruleOpen && (
                        <div className="prices-rule-panel">
                            <div className="prices-rule-header">
                                <h3 className="prices-rule-title">
                                    <Percent size={18} strokeWidth={1.5} />
                                    Aplicar Regla de Precios
                                </h3>
                                <button className="prices-rule-close" onClick={() => { setRuleOpen(false); setShowPreview(false); }}>
                                    <X size={16} />
                                </button>
                            </div>

                            <div className="prices-rule-body">
                                <div className="prices-rule-row">
                                    <div className="prices-rule-field">
                                        <label>Campo</label>
                                        <select
                                            value={ruleField}
                                            onChange={(e) => setRuleField(e.target.value as any)}
                                            className="prices-rule-select"
                                        >
                                            <option value="price">Precio</option>
                                            <option value="compare_at_price">Precio comparación</option>
                                            <option value="cost">Costo</option>
                                        </select>
                                    </div>

                                    <div className="prices-rule-field">
                                        <label>Tipo</label>
                                        <div className="prices-rule-types">
                                            <button
                                                className={`prices-rule-type-btn ${ruleType === "increase" ? "active" : ""}`}
                                                onClick={() => setRuleType("increase")}
                                            >
                                                <TrendingUp size={14} />
                                                Aumento %
                                            </button>
                                            <button
                                                className={`prices-rule-type-btn ${ruleType === "decrease" ? "active" : ""}`}
                                                onClick={() => setRuleType("decrease")}
                                            >
                                                <TrendingDown size={14} />
                                                Descuento %
                                            </button>
                                            <button
                                                className={`prices-rule-type-btn ${ruleType === "fixed" ? "active" : ""}`}
                                                onClick={() => setRuleType("fixed")}
                                            >
                                                <Tag size={14} />
                                                Fijo $
                                            </button>
                                        </div>
                                    </div>

                                    <div className="prices-rule-field">
                                        <label>{ruleType === "fixed" ? "Valor ($)" : "Porcentaje (%)"}</label>
                                        <input
                                            type="number"
                                            min="0"
                                            step={ruleType === "fixed" ? "1" : "0.1"}
                                            className="prices-rule-input"
                                            placeholder={ruleType === "fixed" ? "0.00" : "0"}
                                            value={ruleValue}
                                            onChange={(e) => setRuleValue(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="prices-rule-selection">
                                    <span className="prices-rule-selection-text">
                                        {selectedVariants.size} de {allVariantIds.length} variantes seleccionadas
                                    </span>
                                    <button className="prices-rule-select-all" onClick={toggleSelectAll}>
                                        {selectedVariants.size === allVariantIds.length ? "Deseleccionar todo" : "Seleccionar todo"}
                                    </button>
                                </div>

                                <div className="prices-rule-actions">
                                    <button
                                        className="prices-btn prices-btn-secondary"
                                        onClick={generatePreview}
                                        disabled={!ruleValue || selectedVariants.size === 0}
                                    >
                                        Vista Previa
                                    </button>
                                    {showPreview && previewChanges.length > 0 && (
                                        <button
                                            className="prices-btn prices-btn-primary"
                                            onClick={applyRule}
                                            disabled={saving}
                                        >
                                            {saving ? (
                                                <>
                                                    <Loader2 size={16} className="spin" />
                                                    Aplicando...
                                                </>
                                            ) : (
                                                <>
                                                    <Check size={16} />
                                                    Aplicar ({previewChanges.length} cambios)
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Loading */}
                    {loading && (
                        <div className="wh-loading">
                            <Loader2 size={24} className="spin" />
                        </div>
                    )}

                    {/* Empty */}
                    {!loading && products.length === 0 && (
                        <div className="wh-empty">
                            <PackageOpen size={48} strokeWidth={1} />
                            <h2>No hay productos</h2>
                            <p>
                                {searchQuery
                                    ? "No se encontraron productos con ese criterio."
                                    : "Importá tu catálogo desde Configuración."}
                            </p>
                        </div>
                    )}

                    {/* Price table */}
                    {!loading && products.length > 0 && (
                        <div className="prices-table-container">
                            <table className="prices-table">
                                <thead>
                                    <tr>
                                        {ruleOpen && (
                                            <th className="prices-th prices-th-check">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedVariants.size === allVariantIds.length && allVariantIds.length > 0}
                                                    onChange={toggleSelectAll}
                                                    className="prices-checkbox"
                                                />
                                            </th>
                                        )}
                                        <th className="prices-th prices-th-product">Producto</th>
                                        <th className="prices-th prices-th-variant">Variante</th>
                                        <th className="prices-th prices-th-sku">SKU</th>
                                        <th className="prices-th prices-th-price">Precio</th>
                                        <th className="prices-th prices-th-price">Comparación</th>
                                        <th className="prices-th prices-th-price">Costo</th>
                                        <th className="prices-th prices-th-margin">Margen</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {products.map((product) =>
                                        product.variants.map((v, idx) => {
                                            const margin =
                                                v.cost && v.price
                                                    ? Math.round(((v.price - v.cost) / v.price) * 100)
                                                    : null;

                                            const previewPrice = getPreviewNewValue(v.id, ruleField);
                                            const hasPreview = showPreview && previewPrice !== null;

                                            return (
                                                <tr
                                                    key={v.id}
                                                    className={`prices-row ${idx === 0 ? "prices-row-group-start" : ""} ${hasPreview ? "prices-row-preview" : ""}`}
                                                >
                                                    {ruleOpen && (
                                                        <td className="prices-td prices-td-check">
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedVariants.has(v.id)}
                                                                onChange={() => toggleVariant(v.id)}
                                                                className="prices-checkbox"
                                                            />
                                                        </td>
                                                    )}
                                                    {idx === 0 && (
                                                        <td
                                                            className="prices-td prices-td-product"
                                                            rowSpan={product.variants.length}
                                                        >
                                                            <span className="prices-product-name">
                                                                {product.name}
                                                            </span>
                                                        </td>
                                                    )}
                                                    <td className="prices-td prices-td-variant">
                                                        {v.attribute_values?.join(" / ") || "—"}
                                                    </td>
                                                    <td className="prices-td prices-td-sku">
                                                        <span className="prices-sku">{v.sku || "—"}</span>
                                                    </td>

                                                    {/* Price cell */}
                                                    {renderPriceCell(v.id, "price", v.price, hasPreview && ruleField === "price" ? previewPrice : null)}

                                                    {/* Compare at price cell */}
                                                    {renderPriceCell(v.id, "compare_at_price", v.compare_at_price, hasPreview && ruleField === "compare_at_price" ? previewPrice : null)}

                                                    {/* Cost cell */}
                                                    {renderPriceCell(v.id, "cost", v.cost, hasPreview && ruleField === "cost" ? previewPrice : null)}

                                                    {/* Margin */}
                                                    <td className="prices-td prices-td-margin">
                                                        {margin !== null ? (
                                                            <span
                                                                className={`prices-margin-badge ${margin >= 30
                                                                    ? "prices-margin-high"
                                                                    : margin >= 15
                                                                        ? "prices-margin-mid"
                                                                        : "prices-margin-low"
                                                                    }`}
                                                            >
                                                                {margin}%
                                                            </span>
                                                        ) : (
                                                            <span className="prices-margin-na">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    )}
                </>
            )}

            {/* ═══ HISTORY TAB ═══ */}
            {activeTab === "history" && (
                <>
                    {/* Filters */}
                    <div className="prices-history-filters">
                        <div className="prices-history-date">
                            <Calendar size={14} strokeWidth={1.5} />
                            <input
                                type="date"
                                value={historyDateFrom}
                                onChange={(e) => { setHistoryDateFrom(e.target.value); setHistoryPage(1); }}
                                className="prices-history-date-input"
                            />
                            <span>a</span>
                            <input
                                type="date"
                                value={historyDateTo}
                                onChange={(e) => { setHistoryDateTo(e.target.value); setHistoryPage(1); }}
                                className="prices-history-date-input"
                            />
                        </div>
                        {(historyDateFrom || historyDateTo) && (
                            <button
                                className="prices-history-clear-filters"
                                onClick={() => { setHistoryDateFrom(""); setHistoryDateTo(""); setHistoryPage(1); }}
                            >
                                <X size={14} />
                                Limpiar filtros
                            </button>
                        )}
                    </div>

                    {/* Loading */}
                    {historyLoading && (
                        <div className="wh-loading">
                            <Loader2 size={24} className="spin" />
                        </div>
                    )}

                    {/* Empty */}
                    {!historyLoading && history.length === 0 && (
                        <div className="wh-empty">
                            <History size={48} strokeWidth={1} />
                            <h2>Sin historial</h2>
                            <p>Aún no se registraron cambios de precio.</p>
                        </div>
                    )}

                    {/* History list */}
                    {!historyLoading && history.length > 0 && (
                        <div className="prices-history-list">
                            {history.map((h) => (
                                <div key={h.id} className="prices-history-item">
                                    <div className="prices-history-icon-wrap">
                                        <DollarSign size={16} strokeWidth={1.5} />
                                    </div>
                                    <div className="prices-history-content">
                                        <div className="prices-history-main">
                                            <span className="prices-history-product">
                                                {h.product_name}
                                            </span>
                                            {(h.variant_sku || h.variant_attrs.length > 0) && (
                                                <span className="prices-history-variant">
                                                    {h.variant_attrs.join(" / ")}{h.variant_sku ? ` · ${h.variant_sku}` : ""}
                                                </span>
                                            )}
                                        </div>
                                        <div className="prices-history-detail">
                                            <span className="prices-history-field">
                                                {FIELD_LABELS[h.field] || h.field}
                                            </span>
                                            <span className="prices-history-values">
                                                <span className="prices-history-old">
                                                    {h.old_value !== null ? formatCurrency(h.old_value) : "—"}
                                                </span>
                                                <span className="prices-history-arrow">→</span>
                                                <span className="prices-history-new">
                                                    {formatCurrency(h.new_value)}
                                                </span>
                                            </span>
                                            <span className={`prices-history-badge prices-history-badge-${h.change_type}`}>
                                                {CHANGE_TYPE_LABELS[h.change_type] || h.change_type}
                                            </span>
                                            {h.rule_description && (
                                                <span className="prices-history-rule">{h.rule_description}</span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="prices-history-time">
                                        <span>{formatDate(h.created_at)}</span>
                                        <span>{formatTime(h.created_at)}</span>
                                    </div>
                                </div>
                            ))}

                            {/* Pagination */}
                            {historyPagination && historyPagination.totalPages > 1 && (
                                <div className="prices-pagination">
                                    <button
                                        className="prices-pagination-btn"
                                        onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                                        disabled={historyPage <= 1}
                                    >
                                        <ChevronLeft size={16} />
                                    </button>
                                    <span className="prices-pagination-info">
                                        Página {historyPage} de {historyPagination.totalPages}
                                    </span>
                                    <button
                                        className="prices-pagination-btn"
                                        onClick={() => setHistoryPage((p) => Math.min(historyPagination!.totalPages, p + 1))}
                                        disabled={historyPage >= historyPagination.totalPages}
                                    >
                                        <ChevronRight size={16} />
                                    </button>
                                </div>
                            )}
                        </div>
                    )}
                </>
            )}
        </div>
    );

    // ── Render price cell helper ──

    function renderPriceCell(
        variantId: number,
        field: "price" | "compare_at_price" | "cost",
        currentValue: number | null,
        previewValue: number | null,
    ) {
        const isEditing =
            editingCell?.variantId === variantId && editingCell?.field === field;

        return (
            <td
                className={`prices-td prices-td-price ${isEditing ? "prices-td-editing" : ""} ${previewValue !== null ? "prices-td-preview" : ""}`}
                onClick={() => {
                    if (!isEditing && !saving) startEdit(variantId, field, currentValue);
                }}
            >
                {isEditing ? (
                    <div className="prices-edit-cell">
                        <span className="prices-edit-prefix">$</span>
                        <input
                            ref={inputRef}
                            type="number"
                            min="0"
                            step="0.01"
                            className="prices-edit-input"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={handleKeyDown}
                            onBlur={saveEdit}
                            disabled={saving}
                        />
                    </div>
                ) : previewValue !== null ? (
                    <div className="prices-preview-cell">
                        <span className="prices-preview-old">{formatCurrency(currentValue)}</span>
                        <span className="prices-preview-arrow">→</span>
                        <span className="prices-preview-new">{formatCurrency(previewValue)}</span>
                    </div>
                ) : (
                    <span className="prices-value">{formatCurrency(currentValue)}</span>
                )}
            </td>
        );
    }
}
