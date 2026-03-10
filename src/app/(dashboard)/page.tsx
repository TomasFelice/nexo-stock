"use client";

import { useEffect, useState } from "react";
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Cell,
} from "recharts";
import {
    TrendingUp,
    ShoppingCart,
    Package,
    ArrowLeftRight,
    Loader2,
    AlertTriangle,
    Store,
    Globe,
} from "lucide-react";

interface KpiData {
    salesToday: number;
    salesWeek: number;
    salesMonth: number;
    salesTodayLocal: number;
    salesTodayWeb: number;
    salesWeekLocal: number;
    salesWeekWeb: number;
    salesMonthLocal: number;
    salesMonthWeb: number;
    salesByDay: { date: string; label: string; total: number; local: number; web: number }[];
    topProducts: { name: string; revenue: number; units: number }[];
    stockByWarehouse: { name: string; id: number; total: number }[];
    totalStock: number;
    lastSync: string | null;
    movementsThisMonth: number;
}

const WAREHOUSE_COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];

function formatCurrency(n: number) {
    return new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
}

function formatRelative(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `hace ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `hace ${hrs}h`;
    return new Date(iso).toLocaleDateString("es-AR");
}

export default function DashboardPage() {
    const [data, setData] = useState<KpiData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetch("/api/dashboard/kpis")
            .then((r) => {
                if (!r.ok) throw new Error("Error al cargar KPIs");
                return r.json();
            })
            .then(setData)
            .catch((e) => setError(e.message))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="page-container">
                <div className="page-header">
                    <h1 className="page-title">Dashboard</h1>
                </div>
                <div className="wh-loading">
                    <Loader2 size={24} className="spin" />
                </div>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="page-container">
                <div className="page-header">
                    <h1 className="page-title">Dashboard</h1>
                </div>
                <div className="settings-alert settings-alert-danger">
                    <AlertTriangle size={18} />
                    {error || "No se pudieron cargar los datos del dashboard."}
                </div>
            </div>
        );
    }

    const maxStock = Math.max(...data.stockByWarehouse.map((w) => w.total), 1);

    return (
        <div className="page-container">
            {/* Header */}
            <div className="page-header">
                <div className="page-header-row">
                    <TrendingUp size={24} strokeWidth={1.5} className="page-header-icon" />
                    <h1 className="page-title">Dashboard</h1>
                </div>
                <p className="page-subtitle">
                    Resumen de tu negocio en tiempo real.
                    {data.lastSync && (
                        <span className="text-xs text-emerald-600 ml-2 font-medium">
                            · Última sync {formatRelative(data.lastSync)}
                        </span>
                    )}
                </p>
            </div>

            {/* ── KPI Cards — totales ── */}
            <div className="dashboard-kpi-grid">
                <KpiCard
                    label="Ventas hoy"
                    value={formatCurrency(data.salesToday)}
                    subLocal={formatCurrency(data.salesTodayLocal)}
                    subWeb={formatCurrency(data.salesTodayWeb)}
                    icon={<ShoppingCart size={20} strokeWidth={1.5} />}
                    accent="#3b82f6"
                />
                <KpiCard
                    label="Ventas esta semana"
                    value={formatCurrency(data.salesWeek)}
                    subLocal={formatCurrency(data.salesWeekLocal)}
                    subWeb={formatCurrency(data.salesWeekWeb)}
                    icon={<TrendingUp size={20} strokeWidth={1.5} />}
                    accent="#10b981"
                />
                <KpiCard
                    label="Ventas este mes"
                    value={formatCurrency(data.salesMonth)}
                    subLocal={formatCurrency(data.salesMonthLocal)}
                    subWeb={formatCurrency(data.salesMonthWeb)}
                    icon={<TrendingUp size={20} strokeWidth={1.5} />}
                    accent="#f59e0b"
                />
                <KpiCard
                    label="Stock total"
                    value={data.totalStock.toLocaleString("es-AR") + " u."}
                    icon={<Package size={20} strokeWidth={1.5} />}
                    accent="#8b5cf6"
                />
                <KpiCard
                    label="Movimientos del mes"
                    value={data.movementsThisMonth.toLocaleString("es-AR")}
                    icon={<ArrowLeftRight size={20} strokeWidth={1.5} />}
                    accent="#ec4899"
                />
            </div>

            {/* ── Channel mini-summary ── */}
            {(data.salesMonthLocal > 0 || data.salesMonthWeb > 0) && (
                <div style={{
                    display: "flex", gap: "0.875rem", marginBottom: "1.25rem", flexWrap: "wrap",
                }}>
                    <ChannelPill
                        icon={<Store size={13} />}
                        label="Local"
                        value={formatCurrency(data.salesMonthLocal)}
                        pct={data.salesMonth > 0 ? Math.round((data.salesMonthLocal / data.salesMonth) * 100) : 0}
                        color="#1d4ed8"
                        bg="#dbeafe"
                    />
                    <ChannelPill
                        icon={<Globe size={13} />}
                        label="Tiendanube"
                        value={formatCurrency(data.salesMonthWeb)}
                        pct={data.salesMonth > 0 ? Math.round((data.salesMonthWeb / data.salesMonth) * 100) : 0}
                        color="#6d28d9"
                        bg="#ede9fe"
                    />
                </div>
            )}

            {/* ── Charts Row ── */}
            <div className="dashboard-charts-row">
                {/* Sales trend — stacked by channel */}
                <div className="dashboard-chart-card">
                    <div className="dashboard-chart-header">
                        <h2 className="dashboard-chart-title">Ventas — últimos 7 días</h2>
                        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
                            <LegendDot color="#1d4ed8" label="Local" />
                            <LegendDot color="#7c3aed" label="Tiendanube" />
                        </div>
                    </div>
                    <div style={{ height: 220 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data.salesByDay} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="localGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#1d4ed8" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="#1d4ed8" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id="webGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                                <XAxis
                                    dataKey="label"
                                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <YAxis
                                    tick={{ fontSize: 11, fill: "#9ca3af" }}
                                    axisLine={false}
                                    tickLine={false}
                                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                                    width={48}
                                />
                                <Tooltip
                                    formatter={(v: unknown, name: unknown) => [
                                        formatCurrency(Number(v)),
                                        name === "local" ? "Local" : "Tiendanube",
                                    ]}
                                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="local"
                                    stackId="1"
                                    stroke="#1d4ed8"
                                    strokeWidth={2}
                                    fill="url(#localGrad)"
                                    dot={false}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="web"
                                    stackId="1"
                                    stroke="#7c3aed"
                                    strokeWidth={2}
                                    fill="url(#webGrad)"
                                    dot={false}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Stock by warehouse */}
                <div className="dashboard-chart-card">
                    <div className="dashboard-chart-header">
                        <h2 className="dashboard-chart-title">Stock por depósito</h2>
                    </div>
                    {data.stockByWarehouse.length === 0 ? (
                        <div className="dashboard-chart-empty">Sin datos de stock</div>
                    ) : (
                        <div style={{ height: 220 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                    data={data.stockByWarehouse}
                                    margin={{ top: 8, right: 16, left: 0, bottom: 0 }}
                                    barSize={32}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                                    <XAxis
                                        dataKey="name"
                                        tick={{ fontSize: 11, fill: "#9ca3af" }}
                                        axisLine={false}
                                        tickLine={false}
                                    />
                                    <YAxis
                                        tick={{ fontSize: 11, fill: "#9ca3af" }}
                                        axisLine={false}
                                        tickLine={false}
                                        width={36}
                                    />
                                    <Tooltip
                                        formatter={(v: unknown) => [`${Number(v)} unidades`, "Stock"]}
                                        contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                                    />
                                    <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                                        {data.stockByWarehouse.map((_, i) => (
                                            <Cell
                                                key={i}
                                                fill={WAREHOUSE_COLORS[i % WAREHOUSE_COLORS.length]}
                                            />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    )}
                </div>
            </div>

            {/* ── Top Products ── */}
            {data.topProducts.length > 0 && (
                <div className="dashboard-chart-card" style={{ marginTop: "1.25rem" }}>
                    <div className="dashboard-chart-header">
                        <h2 className="dashboard-chart-title">Productos más vendidos</h2>
                        <span className="text-xs text-gray-400">últimas ventas registradas · todos los canales</span>
                    </div>
                    <div className="dashboard-top-products">
                        {data.topProducts.map((p, i) => (
                            <div key={i} className="dashboard-top-product-row">
                                <span className="dashboard-top-product-rank">#{i + 1}</span>
                                <span className="dashboard-top-product-name">{p.name}</span>
                                <span className="dashboard-top-product-units">{p.units} u.</span>
                                <span className="dashboard-top-product-revenue">{formatCurrency(p.revenue)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// ── Sub-components ──────────────────────────────────────────────────────────

function LegendDot({ color, label }: { color: string; label: string }) {
    return (
        <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", fontSize: "0.75rem", color: "#6b7280" }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
            {label}
        </div>
    );
}

function ChannelPill({
    icon, label, value, pct, color, bg,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
    pct: number;
    color: string;
    bg: string;
}) {
    return (
        <div style={{
            display: "flex", alignItems: "center", gap: "0.5rem",
            background: bg, border: `1px solid ${color}30`,
            borderRadius: "8px", padding: "0.45rem 0.875rem",
        }}>
            <span style={{ color, display: "flex" }}>{icon}</span>
            <span style={{ fontSize: "0.8125rem", fontWeight: 600, color }}>{label}</span>
            <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#111827" }}>{value}</span>
            <span style={{ fontSize: "0.75rem", color: "#6b7280" }}>({pct}%)</span>
        </div>
    );
}

function KpiCard({
    label,
    value,
    subLocal,
    subWeb,
    icon,
    accent,
}: {
    label: string;
    value: string;
    subLocal?: string;
    subWeb?: string;
    icon: React.ReactNode;
    accent: string;
}) {
    return (
        <div className="dashboard-kpi-card">
            <div className="dashboard-kpi-icon" style={{ color: accent, background: accent + "15" }}>
                {icon}
            </div>
            <div style={{ flex: 1 }}>
                <div className="dashboard-kpi-label">{label}</div>
                <div className="dashboard-kpi-value">{value}</div>
                {(subLocal !== undefined || subWeb !== undefined) && (
                    <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.25rem", flexWrap: "wrap" }}>
                        {subLocal !== undefined && (
                            <span style={{ fontSize: "0.7rem", color: "#1d4ed8", background: "#dbeafe", padding: "1px 6px", borderRadius: "999px", fontWeight: 600 }}>
                                Local {subLocal}
                            </span>
                        )}
                        {subWeb !== undefined && (
                            <span style={{ fontSize: "0.7rem", color: "#6d28d9", background: "#ede9fe", padding: "1px 6px", borderRadius: "999px", fontWeight: 600 }}>
                                TN {subWeb}
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
