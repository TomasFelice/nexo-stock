"use client";

import { useState, useEffect } from "react";
import { Store, Save, Loader2, CheckCircle2, XCircle, Plug } from "lucide-react";

interface ConnectionState {
    storeId: string;
    accessToken: string;
    configured: boolean;
}

type Status = "idle" | "loading" | "saved" | "error" | "testing" | "connected" | "disconnected";

export function TiendanubeConnection() {
    const [storeId, setStoreId] = useState("");
    const [accessToken, setAccessToken] = useState("");
    const [configured, setConfigured] = useState(false);
    const [status, setStatus] = useState<Status>("loading");
    const [errorMsg, setErrorMsg] = useState("");

    // Load current settings
    useEffect(() => {
        async function load() {
            try {
                const res = await fetch("/api/settings/tiendanube");
                if (!res.ok) throw new Error();
                const data: ConnectionState = await res.json();
                setStoreId(data.storeId);
                setAccessToken(data.accessToken);
                setConfigured(data.configured);
                setStatus("idle");
            } catch {
                setStatus("idle");
            }
        }
        load();
    }, []);

    async function handleSave() {
        setStatus("loading");
        setErrorMsg("");

        try {
            const res = await fetch("/api/settings/tiendanube", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ storeId, accessToken }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Error al guardar");
            }

            setConfigured(true);
            setStatus("saved");

            // Reload to get masked token
            const reload = await fetch("/api/settings/tiendanube");
            if (reload.ok) {
                const data: ConnectionState = await reload.json();
                setAccessToken(data.accessToken);
            }

            setTimeout(() => setStatus("idle"), 3000);
        } catch (err) {
            setErrorMsg(err instanceof Error ? err.message : "Error desconocido");
            setStatus("error");
        }
    }

    async function handleTest() {
        setStatus("testing");
        setErrorMsg("");

        try {
            const res = await fetch("/api/settings/tiendanube/test", {
                method: "POST",
            });
            const data = await res.json();

            if (data.ok) {
                setStatus("connected");
                setTimeout(() => setStatus("idle"), 4000);
            } else {
                setErrorMsg(data.error || "No se pudo conectar");
                setStatus("disconnected");
            }
        } catch {
            setErrorMsg("Error de red al probar conexión");
            setStatus("disconnected");
        }
    }

    const isLoading = status === "loading" || status === "testing";

    return (
        <div className="settings-card">
            <div className="settings-card-header">
                <div className="settings-card-icon">
                    <Store size={20} strokeWidth={1.5} />
                </div>
                <div>
                    <h2 className="settings-card-title">Conexión Tiendanube</h2>
                    <p className="settings-card-desc">
                        Configurá las credenciales para conectar tu tienda.
                    </p>
                </div>
                <div className="settings-card-badge-area">
                    {status === "connected" && (
                        <span className="settings-badge settings-badge-success">
                            <CheckCircle2 size={14} /> Conectado
                        </span>
                    )}
                    {status === "disconnected" && (
                        <span className="settings-badge settings-badge-danger">
                            <XCircle size={14} /> Error
                        </span>
                    )}
                    {status === "saved" && (
                        <span className="settings-badge settings-badge-success">
                            <CheckCircle2 size={14} /> Guardado
                        </span>
                    )}
                    {configured && status === "idle" && (
                        <span className="settings-badge settings-badge-primary">
                            Configurado
                        </span>
                    )}
                    {!configured && status === "idle" && (
                        <span className="settings-badge settings-badge-muted">
                            Sin configurar
                        </span>
                    )}
                </div>
            </div>

            {(status === "error" || status === "disconnected") && errorMsg && (
                <div className="settings-alert settings-alert-danger">
                    {errorMsg}
                </div>
            )}

            <div className="settings-form">
                <div className="settings-field">
                    <label htmlFor="tn-store-id">Store ID</label>
                    <input
                        id="tn-store-id"
                        type="text"
                        inputMode="numeric"
                        placeholder="Ej: 1234567"
                        value={storeId}
                        onChange={(e) => setStoreId(e.target.value)}
                        disabled={isLoading}
                    />
                </div>

                <div className="settings-field">
                    <label htmlFor="tn-access-token">Access Token</label>
                    <input
                        id="tn-access-token"
                        type="text"
                        placeholder={configured ? "Ya configurado (ingresar nuevo para cambiar)" : "Ingresá tu access token"}
                        value={accessToken}
                        onChange={(e) => setAccessToken(e.target.value)}
                        disabled={isLoading}
                    />
                    {configured && (
                        <span className="settings-field-hint">
                            El token se muestra enmascarado por seguridad.
                        </span>
                    )}
                </div>
            </div>

            <div className="settings-actions">
                <button
                    className="btn-primary"
                    onClick={handleSave}
                    disabled={isLoading || !storeId || !accessToken}
                >
                    {status === "loading" ? (
                        <Loader2 size={16} className="spin" />
                    ) : (
                        <Save size={16} />
                    )}
                    Guardar
                </button>

                {configured && (
                    <button
                        className="btn-secondary"
                        onClick={handleTest}
                        disabled={isLoading}
                    >
                        {status === "testing" ? (
                            <Loader2 size={16} className="spin" />
                        ) : (
                            <Plug size={16} />
                        )}
                        Probar Conexión
                    </button>
                )}
            </div>
        </div>
    );
}
