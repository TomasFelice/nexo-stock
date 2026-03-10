"use client";

import { useEffect, useState, useCallback } from "react";
import {
    BarChart3,
    Download,
    Loader2,
    AlertTriangle,
    ShoppingCart,
    ArrowLeftRight,
    Package,
    ChevronLeft,
    ChevronRight,
    Filter,
} from "lucide-react";

type Tab = "ventas" | "movimientos" | "stock";

const MOVEMENT_TYPES = [
    { value: "", label: "Todos los tipos" },
    { value: "ingreso", label: "Ingreso" },
    { value: "egreso", label: "Egreso" },
    { value: "ajuste", label: "Ajuste" },
    { value: "venta", label: "Venta" },
    { value: "devolucion", label: "Devolución" },
    { value: "cancelacion", label: "Cancelación" },
    { value: "transferencia", label: "Transferencia" },
];

interface Warehouse { id: number; name: string; }

export default function ReportesPage() {
    const [tab, setTab] = useState<Tab>("ventas");
    const [warehouses, setWarehouses] = useState<Warehouse[]>([]);

    // Shared filters
    const [fromDate, setFromDate] = useState("");
    const [toDate, setToDate] = useState("");
    const [warehouseId, setWarehouseId] = useState("");
    const [movType, setMovType] = useState("");
    const [channel, setChannel] = useState("");

    // Data & pagination
    const [data, setData] = useState<any[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const LIMIT = 50;

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [exporting, setExporting] = useState(false);

    // Fetch warehouses for filter
    useEffect(() => {
        fetch("/api/warehouses")
            .then((r) => r.ok ? r.json() : null)
            .then((d) => d && setWarehouses(Array.isArray(d) ? d : d.warehouses || []))
            .catch(() => { });
    }, []);

    const buildUrl = useCallback((tabName: Tab, exportCsv = false) => {
        const params = new URLSearchParams();
        if (fromDate) params.set("from", fromDate);
        if (toDate) params.set("to", toDate);
        if (warehouseId) params.set("warehouse_id", warehouseId);
        if (tabName === "movimientos" && movType) params.set("type", movType);
        if (tabName === "ventas" && channel) params.set("channel", channel);
        if (exportCsv) params.set("export", "csv");
        if (!exportCsv) {
            params.set("page", String(page));
            params.set("limit", String(LIMIT));
        }

        const endpoints: Record<Tab, string> = {
            ventas: `/api/reports/sales`,
            movimientos: `/api/reports/movements`,
            stock: `/api/reports/stock`,
        };
        return `${endpoints[tabName]}?${params.toString()}`;
    }, [fromDate, toDate, warehouseId, movType, channel, page]);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(buildUrl(tab));
            if (!res.ok) throw new Error("Error al cargar datos");
            const json = await res.json();
            setData(json.data || []);
            setTotal(json.total || 0);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setLoading(false);
        }
    }, [tab, buildUrl]);

    useEffect(() => { fetchData(); }, [fetchData]);

    function handleTabChange(t: Tab) {
        setTab(t);
        setPage(1);
        setData([]);
    }

    function handleFilter() {
        setPage(1);
        fetchData();
    }

    async function handleExport() {
        setExporting(true);
        try {
            const res = await fetch(buildUrl(tab, true));
            if (!res.ok) throw new Error("Export failed");
            const blob = await res.blob();
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${tab}-${new Date().toISOString().slice(0, 10)}.csv`;
            a.click();
            URL.revokeObjectURL(url);
        } catch (e: any) {
            setError(e.message);
        } finally {
            setExporting(false);
        }
    }

    const totalPages = Math.max(1, Math.ceil(total / LIMIT));

    return (
        <div className="page-container">
            {/* Header */}
            <div className="page-header">
                <div className="page-header-row">
                    <BarChart3 size={24} strokeWidth={1.5} className="page-header-icon" />
                    <h1 className="page-title">Reportes</h1>
                </div>
                <p className="page-subtitle">Analizá ventas, movimientos de stock e inventario actual.</p>
            </div>

            {/* Tabs */}
            <div className="reports-tabs">
                <button
                    className={`reports-tab ${tab === "ventas" ? "active" : ""}`}
                    onClick={() => handleTabChange("ventas")}
                >
                    <ShoppingCart size={16} strokeWidth={1.5} /> Ventas
                </button>
                <button
                    className={`reports-tab ${tab === "movimientos" ? "active" : ""}`}
                    onClick={() => handleTabChange("movimientos")}
                >
                    <ArrowLeftRight size={16} strokeWidth={1.5} /> Movimientos
                </button>
                <button
                    className={`reports-tab ${tab === "stock" ? "active" : ""}`}
                    onClick={() => handleTabChange("stock")}
                >
                    <Package size={16} strokeWidth={1.5} /> Stock
                </button>
            </div>

            {/* Filters */}
            <div className="reports-filter-bar">
                <Filter size={16} strokeWidth={1.5} style={{ color: "var(--color-text-muted)", flexShrink: 0 }} />

                {tab !== "stock" && (
                    <>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                            <label style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>Desde</label>
                            <input
                                type="date"
                                value={fromDate}
                                onChange={(e) => setFromDate(e.target.value)}
                                style={{ fontSize: "0.8125rem", padding: "0.375rem 0.5rem", border: "1px solid var(--color-border)", borderRadius: "6px", fontFamily: "inherit" }}
                            />
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem" }}>
                            <label style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>Hasta</label>
                            <input
                                type="date"
                                value={toDate}
                                onChange={(e) => setToDate(e.target.value)}
                                style={{ fontSize: "0.8125rem", padding: "0.375rem 0.5rem", border: "1px solid var(--color-border)", borderRadius: "6px", fontFamily: "inherit" }}
                            />
                        </div>
                    </>
                )}

                <select
                    value={warehouseId}
                    onChange={(e) => setWarehouseId(e.target.value)}
                    style={{ fontSize: "0.8125rem", padding: "0.375rem 0.5rem", border: "1px solid var(--color-border)", borderRadius: "6px", fontFamily: "inherit", background: "white" }}
                >
                    <option value="">Todos los depósitos</option>
                    {warehouses.map((w) => (
                        <option key={w.id} value={w.id}>{w.name}</option>
                    ))}
                </select>

                {tab === "ventas" && (
                    <select
                        value={channel}
                        onChange={(e) => setChannel(e.target.value)}
                        style={{ fontSize: "0.8125rem", padding: "0.375rem 0.5rem", border: "1px solid var(--color-border)", borderRadius: "6px", fontFamily: "inherit", background: "white" }}
                    >
                        <option value="">Todos los canales</option>
                        <option value="local">Local (POS)</option>
                        <option value="web">Tiendanube</option>
                    </select>
                )}

                {tab === "movimientos" && (
                    <select
                        value={movType}
                        onChange={(e) => setMovType(e.target.value)}
                        style={{ fontSize: "0.8125rem", padding: "0.375rem 0.5rem", border: "1px solid var(--color-border)", borderRadius: "6px", fontFamily: "inherit", background: "white" }}
                    >
                        {MOVEMENT_TYPES.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                        ))}
                    </select>
                )}

                <button
                    className="btn-primary"
                    style={{ padding: "0.375rem 0.875rem", fontSize: "0.8125rem" }}
                    onClick={handleFilter}
                    disabled={loading}
                >
                    {loading ? <Loader2 size={14} className="spin" /> : null}
                    Filtrar
                </button>

                <button
                    className="reports-export-btn"
                    onClick={handleExport}
                    disabled={exporting}
                >
                    {exporting ? <Loader2 size={14} className="spin" /> : <Download size={14} />}
                    Exportar CSV
                </button>
            </div>

            {/* Error */}
            {error && (
                <div style={{ padding: "0.75rem 1rem", borderRadius: "8px", background: "#fef2f2", color: "#991b1b", fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
                    <AlertTriangle size={16} />
                    {error}
                </div>
            )}

            {/* Summary */}
            {!loading && data.length > 0 && (
                <div style={{ fontSize: "0.8125rem", color: "var(--color-text-muted)", marginBottom: "0.75rem" }}>
                    {tab !== "stock"
                        ? `Mostrando ${(page - 1) * LIMIT + 1}–${Math.min(page * LIMIT, total)} de ${total} registros`
                        : `${total} líneas de stock`}
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="wh-loading"><Loader2 size={24} className="spin" /></div>
            )}

            {/* Empty */}
            {!loading && data.length === 0 && (
                <div className="reports-empty">
                    <BarChart3 size={40} strokeWidth={1} />
                    <span>Sin datos para los filtros seleccionados.</span>
                </div>
            )}

            {/* Table */}
            {!loading && data.length > 0 && (
                <div className="stock-table-container">
                    {tab === "ventas" && <SalesTable rows={data} />}
                    {tab === "movimientos" && <MovementsTable rows={data} />}
                    {tab === "stock" && <StockTable rows={data} />}
                </div>
            )}

            {/* Pagination (ventas & movimientos) */}
            {!loading && tab !== "stock" && totalPages > 1 && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", marginTop: "1.25rem" }}>
                    <button
                        className="btn-secondary"
                        style={{ padding: "0.375rem 0.625rem" }}
                        disabled={page === 1}
                        onClick={() => setPage(p => p - 1)}
                    >
                        <ChevronLeft size={16} />
                    </button>
                    <span style={{ fontSize: "0.875rem", color: "var(--color-text-secondary)" }}>
                        Página {page} de {totalPages}
                    </span>
                    <button
                        className="btn-secondary"
                        style={{ padding: "0.375rem 0.625rem" }}
                        disabled={page === totalPages}
                        onClick={() => setPage(p => p + 1)}
                    >
                        <ChevronRight size={16} />
                    </button>
                </div>
            )}
        </div>
    );
}

// ── Sub-tables ──

function formatCurrency(n: number) {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
}
function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const CHANNEL_BADGE: Record<string, { label: string; color: string; bg: string }> = {
    local: { label: "Local", color: "#1d4ed8", bg: "#dbeafe" },
    web: { label: "Tiendanube", color: "#6d28d9", bg: "#ede9fe" },
};

function ChannelBadge({ channel }: { channel?: string }) {
    const cfg = CHANNEL_BADGE[channel ?? ""] ?? { label: channel || "—", color: "#6b7280", bg: "#f3f4f6" };
    return (
        <span style={{
            fontSize: "0.7rem", fontWeight: 600,
            color: cfg.color, background: cfg.bg,
            padding: "2px 8px", borderRadius: "999px",
            whiteSpace: "nowrap",
        }}>
            {cfg.label}
        </span>
    );
}

function SalesTable({ rows }: { rows: any[] }) {
    return (
        <table className="stock-table">
            <thead>
                <tr>
                    <th className="stock-th">N° Venta</th>
                    <th className="stock-th">Fecha</th>
                    <th className="stock-th">Canal</th>
                    <th className="stock-th">Cliente</th>
                    <th className="stock-th">Producto</th>
                    <th className="stock-th">Variante</th>
                    <th className="stock-th">Depósito</th>
                    <th className="stock-th" style={{ textAlign: "right" }}>Cant.</th>
                    <th className="stock-th" style={{ textAlign: "right" }}>P. Unit.</th>
                    <th className="stock-th" style={{ textAlign: "right" }}>Subtotal</th>
                </tr>
            </thead>
            <tbody>
                {rows.map((r, i) => (
                    <tr key={i} className="stock-row">
                        <td className="stock-td"><code style={{ fontSize: "0.75rem" }}>{r.sale_number}</code></td>
                        <td className="stock-td" style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>{r.date ? formatDate(r.date) : "—"}</td>
                        <td className="stock-td"><ChannelBadge channel={r.channel} /></td>
                        <td className="stock-td">{r.customer}</td>
                        <td className="stock-td stock-product-name">{r.product}</td>
                        <td className="stock-td" style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>{r.variant}</td>
                        <td className="stock-td" style={{ fontSize: "0.8125rem" }}>{r.warehouse}</td>
                        <td className="stock-td" style={{ textAlign: "right", fontWeight: 600 }}>{r.quantity}</td>
                        <td className="stock-td" style={{ textAlign: "right", fontSize: "0.8125rem" }}>{formatCurrency(r.unit_price)}</td>
                        <td className="stock-td" style={{ textAlign: "right", fontWeight: 600 }}>{formatCurrency(r.subtotal)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

const MOV_COLORS: Record<string, string> = {
    ingreso: "#059669", egreso: "#dc2626", ajuste: "#d97706",
    venta: "#3b82f6", devolucion: "#7c3aed", cancelacion: "#6b7280",
    transferencia: "#0891b2", cambio: "#c2410c",
};

function MovementsTable({ rows }: { rows: any[] }) {
    return (
        <table className="stock-table">
            <thead>
                <tr>
                    <th className="stock-th">ID</th>
                    <th className="stock-th">Fecha</th>
                    <th className="stock-th">Tipo</th>
                    <th className="stock-th">Producto</th>
                    <th className="stock-th">Variante</th>
                    <th className="stock-th" style={{ textAlign: "center" }}>Cantidad</th>
                    <th className="stock-th">Origen</th>
                    <th className="stock-th">Destino</th>
                    <th className="stock-th">Referencia</th>
                </tr>
            </thead>
            <tbody>
                {rows.map((r, i) => (
                    <tr key={i} className="stock-row">
                        <td className="stock-td" style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>#{r.id}</td>
                        <td className="stock-td" style={{ fontSize: "0.75rem", color: "var(--color-text-muted)", whiteSpace: "nowrap" }}>{r.date ? formatDate(r.date) : "—"}</td>
                        <td className="stock-td">
                            <span style={{
                                fontSize: "0.75rem", fontWeight: 600, textTransform: "capitalize",
                                color: MOV_COLORS[r.type] || "#6b7280",
                                background: (MOV_COLORS[r.type] || "#6b7280") + "15",
                                padding: "2px 8px", borderRadius: "999px",
                            }}>
                                {r.type}
                            </span>
                        </td>
                        <td className="stock-td stock-product-name">{r.product}</td>
                        <td className="stock-td" style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>{r.variant}</td>
                        <td className="stock-td" style={{ textAlign: "center", fontWeight: 700, color: r.quantity >= 0 ? "#059669" : "#dc2626" }}>
                            {r.quantity >= 0 ? "+" : ""}{r.quantity}
                        </td>
                        <td className="stock-td" style={{ fontSize: "0.8125rem" }}>{r.source}</td>
                        <td className="stock-td" style={{ fontSize: "0.8125rem" }}>{r.target}</td>
                        <td className="stock-td" style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>{r.reference}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}

function StockTable({ rows }: { rows: any[] }) {
    return (
        <table className="stock-table">
            <thead>
                <tr>
                    <th className="stock-th">Producto</th>
                    <th className="stock-th">Variante</th>
                    <th className="stock-th">SKU</th>
                    <th className="stock-th">Depósito</th>
                    <th className="stock-th" style={{ textAlign: "center" }}>Cantidad</th>
                    <th className="stock-th">Última actualización</th>
                </tr>
            </thead>
            <tbody>
                {rows.map((r, i) => (
                    <tr key={i} className="stock-row">
                        <td className="stock-td stock-product-name">{r.product}</td>
                        <td className="stock-td" style={{ fontSize: "0.8125rem", color: "var(--color-text-secondary)" }}>{r.variant}</td>
                        <td className="stock-td"><span className="mv-sku-text">{r.sku}</span></td>
                        <td className="stock-td" style={{ fontSize: "0.8125rem" }}>{r.warehouse}</td>
                        <td className="stock-td" style={{ textAlign: "center", fontWeight: 700, color: "var(--color-text-primary)", fontSize: "1rem" }}>{r.quantity}</td>
                        <td className="stock-td" style={{ fontSize: "0.75rem", color: "var(--color-text-muted)" }}>{r.updated_at ? formatDate(r.updated_at) : "—"}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    );
}
