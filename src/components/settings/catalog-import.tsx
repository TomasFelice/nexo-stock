"use client";

import { useState, useEffect } from "react";
import {
    Download,
    Loader2,
    CheckCircle2,
    AlertTriangle,
    XCircle,
    Clock,
    Package,
    Layers,
    Info,
} from "lucide-react";
import type { CatalogImportResult } from "@/lib/tiendanube/types";

type ImportStatus = "idle" | "importing" | "success" | "error";

export function CatalogImport() {
    const [status, setStatus] = useState<ImportStatus>("idle");
    const [result, setResult] = useState<CatalogImportResult | null>(null);
    const [error, setError] = useState("");
    const [lastImport, setLastImport] = useState<string | null>(null);
    const [configured, setConfigured] = useState(false);
    const [loading, setLoading] = useState(true);

    // Check if TN is configured and load last import timestamp
    useEffect(() => {
        async function load() {
            try {
                const res = await fetch("/api/settings/tiendanube");
                if (res.ok) {
                    const data = await res.json();
                    setConfigured(data.configured);
                }
            } catch {
                // ignore
            }
            setLoading(false);
        }
        load();
    }, []);

    useEffect(() => {
        async function loadLastImport() {
            try {
                // We'll read from the result if we just imported,
                // otherwise this is a placeholder for future enhancement
            } catch {
                // ignore
            }
        }
        loadLastImport();
    }, []);

    async function handleImport() {
        setStatus("importing");
        setError("");
        setResult(null);

        try {
            const res = await fetch("/api/import/catalog", { method: "POST" });
            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Error al importar catálogo");
            }

            setResult(data as CatalogImportResult);
            setLastImport(data.timestamp);
            setStatus(data.errors?.length > 0 ? "error" : "success");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error desconocido");
            setStatus("error");
        }
    }

    function formatDate(isoStr: string) {
        return new Intl.DateTimeFormat("es-AR", {
            dateStyle: "medium",
            timeStyle: "short",
        }).format(new Date(isoStr));
    }

    if (loading) {
        return (
            <div className="settings-card">
                <div className="settings-card-loading">
                    <Loader2 size={20} className="spin" />
                </div>
            </div>
        );
    }

    return (
        <div className="settings-card">
            <div className="settings-card-header">
                <div className="settings-card-icon">
                    <Download size={20} strokeWidth={1.5} />
                </div>
                <div>
                    <h2 className="settings-card-title">Importar Catálogo</h2>
                    <p className="settings-card-desc">
                        Importá productos y variantes desde Tiendanube.
                    </p>
                </div>
            </div>

            {/* Info callout */}
            <div className="settings-callout settings-callout-info">
                <Info size={16} />
                <div>
                    Se importarán <strong>productos</strong>, <strong>variantes</strong> (talles, colores),
                    SKU, códigos de barra y precios. Si los productos ya existen se actualizarán.
                </div>
            </div>

            <div className="settings-callout settings-callout-warning">
                <AlertTriangle size={16} />
                <div>
                    <strong>No se importarán cantidades de stock</strong> para preservar
                    el stock existente en <strong>nexo</strong>stock.
                </div>
            </div>

            {/* Error message */}
            {status === "error" && error && (
                <div className="settings-alert settings-alert-danger">
                    <XCircle size={16} />
                    {error}
                </div>
            )}

            {/* Success result */}
            {result && (
                <div className="settings-import-result">
                    <div className={`settings-import-result-header ${result.errors.length > 0 ? "partial" : "success"}`}>
                        {result.errors.length > 0 ? (
                            <AlertTriangle size={18} />
                        ) : (
                            <CheckCircle2 size={18} />
                        )}
                        <span>
                            {result.errors.length > 0
                                ? "Importación completada con advertencias"
                                : "Importación completada exitosamente"}
                        </span>
                    </div>

                    <div className="settings-import-stats">
                        <div className="settings-import-stat">
                            <Package size={18} />
                            <div>
                                <span className="settings-import-stat-value">
                                    {result.productsImported}
                                </span>
                                <span className="settings-import-stat-label">
                                    Productos
                                </span>
                            </div>
                        </div>
                        <div className="settings-import-stat">
                            <Layers size={18} />
                            <div>
                                <span className="settings-import-stat-value">
                                    {result.variantsImported}
                                </span>
                                <span className="settings-import-stat-label">
                                    Variantes
                                </span>
                            </div>
                        </div>
                        <div className="settings-import-stat">
                            <Clock size={18} />
                            <div>
                                <span className="settings-import-stat-value">
                                    {formatDate(result.timestamp)}
                                </span>
                                <span className="settings-import-stat-label">
                                    Fecha
                                </span>
                            </div>
                        </div>
                    </div>

                    {result.errors.length > 0 && (
                        <div className="settings-import-errors">
                            <p className="settings-import-errors-title">
                                Errores ({result.errors.length}):
                            </p>
                            <ul>
                                {result.errors.slice(0, 10).map((err, i) => (
                                    <li key={i}>{err}</li>
                                ))}
                                {result.errors.length > 10 && (
                                    <li>...y {result.errors.length - 10} más</li>
                                )}
                            </ul>
                        </div>
                    )}
                </div>
            )}

            {/* Last import timestamp */}
            {lastImport && status === "idle" && (
                <div className="settings-last-import">
                    <Clock size={14} />
                    <span>Última importación: {formatDate(lastImport)}</span>
                </div>
            )}

            {/* Actions */}
            <div className="settings-actions">
                <button
                    className="btn-primary"
                    onClick={handleImport}
                    disabled={!configured || status === "importing"}
                >
                    {status === "importing" ? (
                        <>
                            <Loader2 size={16} className="spin" />
                            Importando catálogo...
                        </>
                    ) : (
                        <>
                            <Download size={16} />
                            Importar Catálogo desde Tiendanube
                        </>
                    )}
                </button>

                {!configured && (
                    <p className="settings-field-hint" style={{ marginTop: "0.5rem" }}>
                        Configurá la conexión a Tiendanube primero.
                    </p>
                )}
            </div>
        </div>
    );
}
