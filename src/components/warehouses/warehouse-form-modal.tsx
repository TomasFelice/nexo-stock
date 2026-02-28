"use client";

import { useState, useEffect } from "react";
import { X, Save, Loader2, AlertTriangle } from "lucide-react";

interface WarehouseData {
    id: number;
    name: string;
    is_primary: boolean;
    syncs_to_web: boolean;
    is_virtual: boolean;
    sort_order: number;
}

type FormData = Omit<WarehouseData, "id" | "active" | "created_at" | "updated_at">;

interface WarehouseFormModalProps {
    warehouse: WarehouseData | null;
    onClose: () => void;
    onSave: (data: FormData) => Promise<void>;
}

export function WarehouseFormModal({ warehouse, onClose, onSave }: WarehouseFormModalProps) {
    const isEditing = warehouse !== null;

    const [name, setName] = useState(warehouse?.name ?? "");
    const [isPrimary, setIsPrimary] = useState(warehouse?.is_primary ?? false);
    const [syncsToWeb, setSyncsToWeb] = useState(warehouse?.syncs_to_web ?? true);
    const [isVirtual, setIsVirtual] = useState(warehouse?.is_virtual ?? false);
    const [sortOrder, setSortOrder] = useState(warehouse?.sort_order ?? 0);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    // Close on escape
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        document.addEventListener("keydown", handleEsc);
        return () => document.removeEventListener("keydown", handleEsc);
    }, [onClose]);

    // Prevent body scroll
    useEffect(() => {
        document.body.style.overflow = "hidden";
        return () => { document.body.style.overflow = ""; };
    }, []);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setError("");
        setSaving(true);

        try {
            await onSave({
                name,
                is_primary: isPrimary,
                syncs_to_web: syncsToWeb,
                is_virtual: isVirtual,
                sort_order: sortOrder,
            });
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error al guardar");
            setSaving(false);
        }
    }

    return (
        <div className="wh-modal-backdrop" onClick={onClose}>
            <div className="wh-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="wh-modal-header">
                    <h3 className="wh-modal-title">
                        {isEditing ? "Editar depósito" : "Nuevo depósito"}
                    </h3>
                    <button className="wh-modal-close" onClick={onClose} aria-label="Cerrar">
                        <X size={18} />
                    </button>
                </div>

                {/* Error */}
                {error && (
                    <div className="settings-alert settings-alert-danger" style={{ margin: "0 0 1rem" }}>
                        {error}
                    </div>
                )}

                {/* Form */}
                <form className="wh-form" onSubmit={handleSubmit}>
                    {/* Name field */}
                    <div className="settings-field">
                        <label htmlFor="wh-name">Nombre del depósito</label>
                        <input
                            id="wh-name"
                            type="text"
                            placeholder="Ej: Depósito Central"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            disabled={saving}
                            autoFocus
                            required
                        />
                    </div>

                    {/* Toggles */}
                    <div className="wh-toggles">
                        <label className="wh-toggle-row">
                            <div className="wh-toggle-info">
                                <span className="wh-toggle-label">Depósito principal</span>
                                <span className="wh-toggle-desc">
                                    Prioridad de descuento al vender. Solo uno puede ser principal.
                                </span>
                            </div>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={isPrimary}
                                className={`wh-toggle-switch ${isPrimary ? "active" : ""}`}
                                onClick={() => setIsPrimary(!isPrimary)}
                                disabled={saving}
                            >
                                <span className="wh-toggle-knob" />
                            </button>
                        </label>

                        {isPrimary && !warehouse?.is_primary && (
                            <div className="settings-callout settings-callout-warning" style={{ margin: "0 0 0.25rem" }}>
                                <AlertTriangle size={16} />
                                <span>Si ya existe un depósito principal, será reemplazado por este.</span>
                            </div>
                        )}

                        <label className="wh-toggle-row">
                            <div className="wh-toggle-info">
                                <span className="wh-toggle-label">Suma a web</span>
                                <span className="wh-toggle-desc">
                                    El stock de este depósito se sincroniza con Tiendanube.
                                </span>
                            </div>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={syncsToWeb}
                                className={`wh-toggle-switch ${syncsToWeb ? "active" : ""}`}
                                onClick={() => setSyncsToWeb(!syncsToWeb)}
                                disabled={saving}
                            >
                                <span className="wh-toggle-knob" />
                            </button>
                        </label>

                        <label className="wh-toggle-row">
                            <div className="wh-toggle-info">
                                <span className="wh-toggle-label">Depósito virtual</span>
                                <span className="wh-toggle-desc">
                                    Depósito para mercadería en tránsito o en producción.
                                </span>
                            </div>
                            <button
                                type="button"
                                role="switch"
                                aria-checked={isVirtual}
                                className={`wh-toggle-switch ${isVirtual ? "active" : ""}`}
                                onClick={() => setIsVirtual(!isVirtual)}
                                disabled={saving}
                            >
                                <span className="wh-toggle-knob" />
                            </button>
                        </label>
                    </div>

                    {/* Sort order */}
                    <div className="settings-field">
                        <label htmlFor="wh-sort">Prioridad de descuento</label>
                        <input
                            id="wh-sort"
                            type="number"
                            min="0"
                            placeholder="0"
                            value={sortOrder}
                            onChange={(e) => setSortOrder(Number(e.target.value))}
                            disabled={saving}
                        />
                        <span className="settings-field-hint">
                            Menor número = mayor prioridad al descontar stock en ventas.
                        </span>
                    </div>

                    {/* Actions */}
                    <div className="wh-modal-actions">
                        <button
                            type="button"
                            className="btn-secondary"
                            onClick={onClose}
                            disabled={saving}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="btn-primary"
                            disabled={saving || !name.trim()}
                        >
                            {saving ? <Loader2 size={16} className="spin" /> : <Save size={16} />}
                            {isEditing ? "Guardar cambios" : "Crear depósito"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
