"use client";

import { useState, useEffect } from "react";
import {
    Percent,
    Banknote,
    CreditCard,
    ArrowLeftRight,
    DollarSign,
    Loader2,
    Save,
    CheckCircle2,
} from "lucide-react";

interface DiscountRule {
    enabled: boolean;
    percentage: number;
}

type PaymentDiscounts = Record<string, DiscountRule>;

const DEFAULT_DISCOUNTS: PaymentDiscounts = {
    efectivo: { enabled: false, percentage: 0 },
    tarjeta: { enabled: false, percentage: 0 },
    transferencia: { enabled: false, percentage: 0 },
    otro: { enabled: false, percentage: 0 },
};

const PAYMENT_INFO = [
    { key: "efectivo", label: "Efectivo", icon: Banknote },
    { key: "tarjeta", label: "Tarjeta", icon: CreditCard },
    { key: "transferencia", label: "Transferencia", icon: ArrowLeftRight },
    { key: "otro", label: "Otro", icon: DollarSign },
];

export function PaymentDiscounts() {
    const [discounts, setDiscounts] = useState<PaymentDiscounts>(DEFAULT_DISCOUNTS);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [error, setError] = useState("");

    useEffect(() => {
        async function load() {
            try {
                const res = await fetch("/api/settings/payment-discounts");
                if (!res.ok) return;
                const data = await res.json();
                if (data.discounts) setDiscounts(data.discounts);
            } catch {
                // use defaults
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    function updateRule(key: string, field: "enabled" | "percentage", value: boolean | number) {
        setDiscounts((prev) => ({
            ...prev,
            [key]: { ...prev[key], [field]: value },
        }));
        setSaved(false);
    }

    async function handleSave() {
        setSaving(true);
        setError("");
        setSaved(false);

        try {
            const res = await fetch("/api/settings/payment-discounts", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ discounts }),
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.error || "Error al guardar");
            }

            setSaved(true);
            setTimeout(() => setSaved(false), 3000);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error desconocido");
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return (
            <div className="settings-card">
                <div className="settings-card-header">
                    <Percent size={20} strokeWidth={1.5} className="settings-card-icon" />
                    <h2 className="settings-card-title">Descuentos por Medio de Pago</h2>
                </div>
                <div className="settings-card-body" style={{ display: "flex", justifyContent: "center", padding: "2rem" }}>
                    <Loader2 size={24} className="spin" />
                </div>
            </div>
        );
    }

    return (
        <div className="settings-card">
            <div className="settings-card-header">
                <Percent size={20} strokeWidth={1.5} className="settings-card-icon" />
                <h2 className="settings-card-title">Descuentos por Medio de Pago</h2>
            </div>

            <div className="settings-card-body">
                <p className="pmd-description">
                    Configurá descuentos automáticos que se aplican en el Punto de Venta según el medio de pago.
                    Replicá aquí las mismas reglas que tenés en Tiendanube.
                </p>

                <div className="pmd-list">
                    {PAYMENT_INFO.map((pm) => {
                        const rule = discounts[pm.key] || { enabled: false, percentage: 0 };
                        const Icon = pm.icon;

                        return (
                            <div
                                key={pm.key}
                                className={`pmd-item ${rule.enabled ? "pmd-item-active" : ""}`}
                            >
                                <div className="pmd-item-left">
                                    <div className="pmd-item-icon-wrap">
                                        <Icon size={18} strokeWidth={1.5} />
                                    </div>
                                    <span className="pmd-item-label">{pm.label}</span>
                                </div>

                                <div className="pmd-item-right">
                                    <div className="pmd-pct-wrapper">
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            step="0.5"
                                            className="pmd-pct-input"
                                            value={rule.percentage}
                                            onChange={(e) =>
                                                updateRule(pm.key, "percentage", parseFloat(e.target.value) || 0)
                                            }
                                            disabled={!rule.enabled}
                                        />
                                        <span className="pmd-pct-suffix">%</span>
                                    </div>

                                    <label className="pmd-toggle">
                                        <input
                                            type="checkbox"
                                            checked={rule.enabled}
                                            onChange={(e) => updateRule(pm.key, "enabled", e.target.checked)}
                                        />
                                        <span className="pmd-toggle-slider" />
                                    </label>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {error && (
                    <div className="pmd-error">{error}</div>
                )}

                <button
                    className="pmd-save-btn"
                    onClick={handleSave}
                    disabled={saving}
                >
                    {saving ? (
                        <>
                            <Loader2 size={16} className="spin" />
                            Guardando...
                        </>
                    ) : saved ? (
                        <>
                            <CheckCircle2 size={16} />
                            Guardado
                        </>
                    ) : (
                        <>
                            <Save size={16} />
                            Guardar Descuentos
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
