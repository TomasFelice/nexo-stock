"use client";

import { useEffect, useState, useCallback } from "react";
import { RefreshCcw, Database, AlertCircle, CheckCircle2, CloudLightning, Activity, Play, ChevronLeft, ChevronRight } from "lucide-react";

type SyncStats = {
    pending: number;
    processing: number;
    completed: number;
    failed: number;
    deadLetter: number;
};

type SyncLog = {
    id: number | string;
    created_at: string;
    direction: string;
    event_type: string;
    status: string;
    error_details: string | null;
    payload: any;
};

export default function SyncDashboardPage() {
    const [stats, setStats] = useState<SyncStats>({
        pending: 0, processing: 0, completed: 0, failed: 0, deadLetter: 0,
    });
    const [logs, setLogs] = useState<SyncLog[]>([]);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [isSyncing, setIsSyncing] = useState(false);
    const [isTriggeringFull, setIsTriggeringFull] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [lastSuccessfulSync, setLastSuccessfulSync] = useState<string | null>(null);

    const fetchSyncStatus = useCallback(async (currentPage = page) => {
        try {
            const res = await fetch(`/api/sync/status?page=${currentPage}`);
            if (!res.ok) throw new Error("Failed to load status");
            const data = await res.json();
            setStats(data.stats);
            setLogs(data.logs.data);
            setTotalPages(data.logs.totalPages || 1);
            setLastSuccessfulSync(data.lastSuccessfulSync || null);
        } catch (err: any) {
            setError(err.message || "Error al cargar estado de sincronización");
        } finally {
            setLoading(false);
        }
    }, [page]);

    useEffect(() => {
        fetchSyncStatus();
        const interval = setInterval(() => fetchSyncStatus(page), 10000); // Poll every 10 seconds
        return () => clearInterval(interval);
    }, [fetchSyncStatus, page]);

    const handleForceSync = async () => {
        setIsSyncing(true);
        setError(null);
        try {
            const res = await fetch("/api/sync/process", { method: "POST" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to force sync");
            await fetchSyncStatus();
        } catch (err: any) {
            setError(err.message || "Error al forzar sincronización");
        } finally {
            setIsSyncing(false);
        }
    };

    const handleTriggerFullSync = async () => {
        if (!window.confirm("¿Estás seguro de que querés encolar todos los productos para una sincronización completa?")) return;
        setIsTriggeringFull(true);
        setError(null);
        try {
            const res = await fetch("/api/sync/trigger-full", { method: "POST" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to trigger full sync");
            await fetchSyncStatus();
        } catch (err: any) {
            setError(err.message || "Error al desencadenar sincronización completa");
        } finally {
            setIsTriggeringFull(false);
        }
    };

    const handlePrevPage = () => {
        if (page > 1) setPage(p => p - 1);
    };

    const handleNextPage = () => {
        if (page < totalPages) setPage(p => p + 1);
    };

    return (
        <div className="page-container">
            <div className="page-header">
                <div className="page-header-row">
                    <RefreshCcw size={24} strokeWidth={1.5} className="page-header-icon" />
                    <h1 className="page-title">Sincronización NexoStock → Tiendanube</h1>
                </div>
                <p className="page-subtitle">
                    Supervisa y gestiona el flujo de stock desde tus depósitos hacia tu tienda web.
                </p>
                {lastSuccessfulSync && (
                    <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1.5 font-medium">
                        <CheckCircle2 size={13} strokeWidth={2.5} />
                        Última sincronización exitosa: {new Date(lastSuccessfulSync).toLocaleString()}
                    </p>
                )}
            </div>

            <div className="wh-action-bar" style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                    onClick={handleTriggerFullSync}
                    disabled={isTriggeringFull || loading}
                    className="btn-secondary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', opacity: (isTriggeringFull || loading) ? 0.6 : 1 }}
                >
                    <Database size={16} className={isTriggeringFull ? "animate-pulse" : ""} />
                    {isTriggeringFull ? "Encolando..." : "Sincronización Total"}
                </button>
                <button
                    onClick={handleForceSync}
                    disabled={isSyncing || loading || stats.pending === 0}
                    className="btn-primary"
                    style={{ opacity: (isSyncing || loading || stats.pending === 0) ? 0.6 : 1 }}
                >
                    <Play size={16} className={isSyncing ? "animate-pulse" : ""} />
                    {isSyncing ? "Procesando..." : "Forzar Sinc. Pendientes"}
                </button>
            </div>

            {error && (
                <div className="settings-alert settings-alert-danger" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertCircle size={20} className="shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                <StatCard
                    title="Pendientes"
                    value={stats.pending}
                    icon={<CloudLightning size={20} color="#d97706" />}
                    colorClass={stats.pending > 0 ? "bg-amber-50 border-amber-200" : "bg-white border-gray-200"}
                    textColor="#d97706"
                />
                <StatCard
                    title="Procesando"
                    value={stats.processing}
                    icon={<Activity size={20} color="#2563eb" />}
                    colorClass={stats.processing > 0 ? "bg-blue-50 border-blue-200 animate-pulse" : "bg-white border-gray-200"}
                    textColor="#2563eb"
                />
                <StatCard
                    title="Completados"
                    value={stats.completed}
                    icon={<CheckCircle2 size={20} color="#059669" />}
                    colorClass="bg-white border-gray-200"
                    textColor="#111827"
                />
                <StatCard
                    title="Fallidos"
                    value={stats.failed}
                    icon={<AlertCircle size={20} color="#dc2626" />}
                    colorClass={stats.failed > 0 ? "bg-red-50 border-red-200" : "bg-white border-gray-200"}
                    textColor="#dc2626"
                />
                <StatCard
                    title="Irrecuperables"
                    value={stats.deadLetter}
                    icon={<AlertCircle size={20} color="#7c3aed" />}
                    colorClass={stats.deadLetter > 0 ? "bg-violet-50 border-violet-200" : "bg-white border-gray-200"}
                    textColor="#7c3aed"
                />
            </div>

            <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden flex flex-col">
                <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                    <h2 className="text-[0.9375rem] font-semibold text-gray-800 tracking-tight">Actividad Reciente</h2>
                    <button onClick={() => fetchSyncStatus(page)} className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center gap-1 transition-colors">
                        <RefreshCcw size={14} /> Actualizar
                    </button>
                </div>

                {loading && logs.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 animate-pulse text-sm">Cargando métricas...</div>
                ) : logs.length === 0 ? (
                    <div className="p-10 text-center text-gray-500 flex flex-col items-center">
                        <CheckCircle2 size={40} className="text-gray-300 mb-3" />
                        <span className="text-sm font-medium text-gray-600">No se ha registrado actividad de sincronización aún.</span>
                    </div>
                ) : (
                    <div className="flex-1 overflow-x-auto">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="bg-gray-50 text-gray-500 border-b border-gray-200 text-xs font-semibold tracking-wide uppercase">
                                <tr>
                                    <th className="px-6 py-3">Fecha & Hora</th>
                                    <th className="px-6 py-3">Evento</th>
                                    <th className="px-6 py-3">Estado</th>
                                    <th className="px-6 py-3">Variante ID</th>
                                    <th className="px-6 py-3 w-full">Mensaje / Error</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {logs.map((log: any) => (
                                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-3 text-gray-600 font-mono text-xs">
                                            {new Date(log.created_at).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-3 text-gray-800 font-medium text-xs">
                                            {log.event_type}
                                        </td>
                                        <td className="px-6 py-3">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[0.6875rem] font-semibold tracking-wide border ${log.status === "success" ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                                : log.status === "pending" ? "bg-amber-50 text-amber-700 border-amber-200"
                                                    : log.status === "processing" ? "bg-blue-50 text-blue-700 border-blue-200"
                                                        : "bg-red-50 text-red-700 border-red-200"
                                                }`}>
                                                {log.status === "success" && <CheckCircle2 size={12} strokeWidth={2.5} />}
                                                {log.status === "pending" && <CloudLightning size={12} strokeWidth={2.5} />}
                                                {log.status === "processing" && <Activity size={12} strokeWidth={2.5} className="animate-pulse" />}
                                                {(log.status === "error" || log.status === "failed") && <AlertCircle size={12} strokeWidth={2.5} />}
                                                {log.status.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-3 text-gray-500 font-mono text-xs">
                                            {log.payload?.variant_id || '-'}
                                        </td>
                                        <td className="px-6 py-3 text-gray-600 text-xs truncate max-w-sm" title={log.error_details || ''}>
                                            {(log.status === "error" || log.status === "failed") ? (
                                                <span className="text-red-600 font-medium">{log.error_details}</span>
                                            ) : log.status === "pending" || log.status === "processing" ? (
                                                <span className="text-gray-500 italic">En cola de sincronización...</span>
                                            ) : (
                                                <span className="text-gray-500">
                                                    Stock: {log.payload?.new_stock ?? 'N/A'}
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Pagination Controls */}
                {totalPages > 1 && (
                    <div className="px-6 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between text-sm">
                        <span className="text-gray-500 text-xs font-medium">
                            Página {page} de {totalPages}
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={handlePrevPage}
                                disabled={page === 1 || loading}
                                className="p-1 rounded-md text-gray-500 hover:bg-gray-200 hover:text-gray-800 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <button
                                onClick={handleNextPage}
                                disabled={page === totalPages || loading}
                                className="p-1 rounded-md text-gray-500 hover:bg-gray-200 hover:text-gray-800 disabled:opacity-40 disabled:hover:bg-transparent transition-colors"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function StatCard({
    title,
    value,
    icon,
    colorClass,
    textColor
}: {
    title: string;
    value: number;
    icon: React.ReactNode;
    colorClass: string;
    textColor: string;
}) {
    return (
        <div className={`p-5 rounded-xl border shadow-sm flex flex-col justify-center transition-all ${colorClass}`}>
            <div className="flex items-center gap-2 mb-2">
                {icon}
                <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">{title}</span>
            </div>
            <div className="text-3xl font-bold tracking-tight" style={{ color: textColor }}>
                {value}
            </div>
        </div>
    );
}
