"use client";

import { useEffect, useState, useCallback } from "react";
import {
    Bell,
    AlertTriangle,
    PackageOpen,
    Loader2,
    Settings,
    Plus,
    Check,
    X,
    ChevronDown,
    ChevronUp,
} from "lucide-react";

interface AlertItem {
    variant_id: number;
    sku: string | null;
    attribute_values: string[] | null;
    product_name: string;
    total_stock: number;
    threshold: number;
    is_variant_threshold: boolean;
}

interface AlertsData {
    alerts: AlertItem[];
    totalAlerts: number;
    globalThreshold: number | null;
}

export default function AlertasPage() {
    const [data, setData] = useState<AlertsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Global threshold editing
    const [globalThresholdInput, setGlobalThresholdInput] = useState("");
    const [savingGlobal, setSavingGlobal] = useState(false);

    // Per-variant inline editing
    const [editingVariant, setEditingVariant] = useState<number | null>(null);
    const [editingValue, setEditingValue] = useState("");
    const [savingVariant, setSavingVariant] = useState<number | null>(null);

    const fetchAlerts = useCallback(async () => {
        try {
            const res = await fetch("/api/stock/alerts");
            if (!res.ok) throw new Error("Error al cargar alertas");
            const json = await res.json();
            setData(json);
            setGlobalThresholdInput(json.globalThreshold?.toString() || "");
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchAlerts();
    }, [fetchAlerts]);

    async function saveGlobalThreshold() {
        setSavingGlobal(true);
        try {
            const res = await fetch("/api/settings/alert-threshold", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ threshold: globalThresholdInput === "" ? null : parseInt(globalThresholdInput) }),
            });
            if (!res.ok) throw new Error("Error al guardar");
            await fetchAlerts();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSavingGlobal(false);
        }
    }

    async function saveVariantThreshold(variantId: number) {
        setSavingVariant(variantId);
        try {
            const res = await fetch("/api/stock/alerts", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ variant_id: variantId, threshold: editingValue === "" ? null : editingValue }),
            });
            if (!res.ok) throw new Error("Error al guardar");
            setEditingVariant(null);
            await fetchAlerts();
        } catch (e: any) {
            setError(e.message);
        } finally {
            setSavingVariant(null);
        }
    }

    function getStockClass(stock: number, threshold: number) {
        const ratio = stock / threshold;
        if (ratio <= 0) return "alert-stock-critical";
        if (ratio < 0.5) return "alert-stock-warn";
        return "alert-stock-ok";
    }

    return (
        <div className="page-container">
            {/* Header */}
            <div className="page-header">
                <div className="page-header-row">
                    <Bell size={24} strokeWidth={1.5} className="page-header-icon" />
                    <h1 className="page-title">Alertas de Stock Bajo</h1>
                </div>
                <p className="page-subtitle">
                    Configurá umbrales mínimos de stock para recibir alertas cuando las variantes bajen del límite.
                </p>
            </div>

            {/* Error */}
            {error && (
                <div className="settings-alert settings-alert-danger" style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
                    <AlertTriangle size={18} />
                    <span>{error}</span>
                    <button onClick={() => setError(null)} style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer" }}>
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Global threshold config */}
            <div className="alerts-global-config">
                <Settings size={18} strokeWidth={1.5} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />
                <label>Umbral global de stock mínimo:</label>
                <input
                    type="number"
                    min="0"
                    value={globalThresholdInput}
                    onChange={(e) => setGlobalThresholdInput(e.target.value)}
                    placeholder="—"
                />
                <button
                    className="btn-primary"
                    style={{ padding: "0.375rem 0.875rem", fontSize: "0.8125rem" }}
                    onClick={saveGlobalThreshold}
                    disabled={savingGlobal}
                >
                    {savingGlobal ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                    Guardar
                </button>
                <span className="alerts-global-config-hint">
                    Aplica a todas las variantes sin umbral específico. Dejá vacío para desactivar alertas globales.
                </span>
            </div>

            {/* Summary banner */}
            {!loading && data && data.totalAlerts > 0 && (
                <div className="alerts-summary-banner">
                    <AlertTriangle size={20} />
                    <span>
                        <strong>{data.totalAlerts} {data.totalAlerts === 1 ? "variante" : "variantes"}</strong>{" "}
                        {data.totalAlerts === 1 ? "está" : "están"} por debajo del umbral de stock mínimo.
                    </span>
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="wh-loading">
                    <Loader2 size={24} className="spin" />
                </div>
            )}

            {/* Empty state */}
            {!loading && data && data.totalAlerts === 0 && (
                <div className="wh-empty">
                    <PackageOpen size={48} strokeWidth={1} />
                    <h2>Sin alertas activas</h2>
                    <p>
                        {data.globalThreshold === null
                            ? "Configura un umbral global arriba para empezar a recibir alertas."
                            : "¡Excelente! Todos los productos tienen stock suficiente."}
                    </p>
                </div>
            )}

            {/* Alerts table */}
            {!loading && data && data.alerts.length > 0 && (
                <div className="stock-table-container">
                    <table className="stock-table">
                        <thead>
                            <tr>
                                <th className="stock-th">Producto</th>
                                <th className="stock-th">Variante / SKU</th>
                                <th className="stock-th" style={{ textAlign: "center" }}>Stock Actual</th>
                                <th className="stock-th" style={{ textAlign: "center" }}>Umbral</th>
                                <th className="stock-th" style={{ textAlign: "center" }}>Déficit</th>
                                <th className="stock-th">Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.alerts.map((item) => (
                                <tr key={item.variant_id} className="stock-row">
                                    <td className="stock-td">
                                        <span className="stock-product-name">{item.product_name}</span>
                                    </td>
                                    <td className="stock-td">
                                        <span style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
                                            {item.attribute_values?.join(" / ") || "—"}
                                        </span>
                                        {item.sku && (
                                            <span className="mv-sku-text">{item.sku}</span>
                                        )}
                                    </td>
                                    <td className="stock-td" style={{ textAlign: "center" }}>
                                        <span className={`text-lg font-bold ${getStockClass(item.total_stock, item.threshold)}`}>
                                            {item.total_stock}
                                        </span>
                                    </td>
                                    <td className="stock-td" style={{ textAlign: "center" }}>
                                        {editingVariant === item.variant_id ? (
                                            <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", justifyContent: "center" }}>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={editingValue}
                                                    onChange={(e) => setEditingValue(e.target.value)}
                                                    style={{ width: "4rem", padding: "0.25rem 0.375rem", border: "1px solid var(--color-border)", borderRadius: "4px", fontSize: "0.875rem", textAlign: "center" }}
                                                    autoFocus
                                                />
                                                <button
                                                    onClick={() => saveVariantThreshold(item.variant_id)}
                                                    disabled={savingVariant === item.variant_id}
                                                    style={{ padding: "0.25rem", background: "none", border: "none", cursor: "pointer", color: "#059669" }}
                                                >
                                                    {savingVariant === item.variant_id ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                                                </button>
                                                <button
                                                    onClick={() => setEditingVariant(null)}
                                                    style={{ padding: "0.25rem", background: "none", border: "none", cursor: "pointer", color: "#6b7280" }}
                                                >
                                                    <X size={14} />
                                                </button>
                                            </div>
                                        ) : (
                                            <button
                                                onClick={() => {
                                                    setEditingVariant(item.variant_id);
                                                    setEditingValue(item.is_variant_threshold ? String(item.threshold) : "");
                                                }}
                                                style={{ background: "none", border: "none", cursor: "pointer", fontSize: "0.875rem", color: "var(--color-text-secondary)", display: "flex", alignItems: "center", gap: "0.25rem", margin: "0 auto" }}
                                                title="Editar umbral"
                                            >
                                                {item.threshold}
                                                {!item.is_variant_threshold && (
                                                    <span style={{ fontSize: "0.625rem", color: "var(--color-text-muted)", background: "var(--neutral-100)", padding: "0 4px", borderRadius: "999px" }}>G</span>
                                                )}
                                            </button>
                                        )}
                                    </td>
                                    <td className="stock-td" style={{ textAlign: "center" }}>
                                        <span style={{ color: "#dc2626", fontWeight: 700, fontSize: "0.9375rem" }}>
                                            {item.total_stock - item.threshold}
                                        </span>
                                    </td>
                                    <td className="stock-td">
                                        <a
                                            href="/movimientos"
                                            className="btn-secondary"
                                            style={{ padding: "0.375rem 0.75rem", fontSize: "0.8125rem", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: "0.375rem" }}
                                        >
                                            <Plus size={14} />
                                            Ingreso
                                        </a>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
