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
    RefreshCw,
    Loader2,
    AlertTriangle,
} from "lucide-react";

interface KpiData {
    salesToday: number;
    salesWeek: number;
    salesMonth: number;
    salesByDay: { date: string; label: string; total: number }[];
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

            {/* ── KPI Cards ── */}
            <div className="dashboard-kpi-grid">
                <KpiCard
                    label="Ventas hoy"
                    value={formatCurrency(data.salesToday)}
                    icon={<ShoppingCart size={20} strokeWidth={1.5} />}
                    accent="#3b82f6"
                />
                <KpiCard
                    label="Ventas esta semana"
                    value={formatCurrency(data.salesWeek)}
                    icon={<TrendingUp size={20} strokeWidth={1.5} />}
                    accent="#10b981"
                />
                <KpiCard
                    label="Ventas este mes"
                    value={formatCurrency(data.salesMonth)}
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

            {/* ── Charts Row ── */}
            <div className="dashboard-charts-row">
                {/* Sales trend */}
                <div className="dashboard-chart-card">
                    <div className="dashboard-chart-header">
                        <h2 className="dashboard-chart-title">Ventas — últimos 7 días</h2>
                    </div>
                    <div style={{ height: 220 }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={data.salesByDay} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
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
                                    formatter={(v: unknown) => [formatCurrency(Number(v)), "Ventas"]}
                                    contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #e5e7eb" }}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="total"
                                    stroke="#3b82f6"
                                    strokeWidth={2}
                                    fill="url(#salesGrad)"
                                    dot={{ r: 3, fill: "#3b82f6" }}
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
                        <span className="text-xs text-gray-400">últimas ventas registradas</span>
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

function KpiCard({
    label,
    value,
    icon,
    accent,
}: {
    label: string;
    value: string;
    icon: React.ReactNode;
    accent: string;
}) {
    return (
        <div className="dashboard-kpi-card">
            <div className="dashboard-kpi-icon" style={{ color: accent, background: accent + "15" }}>
                {icon}
            </div>
            <div>
                <div className="dashboard-kpi-label">{label}</div>
                <div className="dashboard-kpi-value">{value}</div>
            </div>
        </div>
    );
}
