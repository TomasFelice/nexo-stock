"use client";

import { useState, useEffect } from "react";
import {
    Warehouse,
    Plus,
    Loader2,
    PackageOpen,
} from "lucide-react";
import { WarehouseCard } from "@/components/warehouses/warehouse-card";
import { WarehouseFormModal } from "@/components/warehouses/warehouse-form-modal";

export interface WarehouseData {
    id: number;
    name: string;
    is_primary: boolean;
    syncs_to_web: boolean;
    is_virtual: boolean;
    sort_order: number;
    active: boolean;
    created_at: string;
    updated_at: string;
}

export default function DepositosPage() {
    const [warehouses, setWarehouses] = useState<WarehouseData[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [modalOpen, setModalOpen] = useState(false);
    const [editing, setEditing] = useState<WarehouseData | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
    const [actionLoading, setActionLoading] = useState(false);

    async function loadWarehouses() {
        try {
            const res = await fetch("/api/warehouses");
            if (!res.ok) throw new Error("Error al cargar depósitos");
            const data = await res.json();
            setWarehouses(data);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error desconocido");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadWarehouses();
    }, []);

    function handleNew() {
        setEditing(null);
        setModalOpen(true);
    }

    function handleEdit(warehouse: WarehouseData) {
        setEditing(warehouse);
        setModalOpen(true);
    }

    async function handleDelete(id: number) {
        setActionLoading(true);
        setError("");
        try {
            const res = await fetch(`/api/warehouses/${id}`, { method: "DELETE" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error al eliminar");
            setDeleteConfirm(null);
            await loadWarehouses();
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error desconocido");
            setDeleteConfirm(null);
        } finally {
            setActionLoading(false);
        }
    }

    async function handleSave(formData: Omit<WarehouseData, "id" | "active" | "created_at" | "updated_at">) {
        setActionLoading(true);
        setError("");
        try {
            const url = editing ? `/api/warehouses/${editing.id}` : "/api/warehouses";
            const method = editing ? "PUT" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Error al guardar");

            setModalOpen(false);
            setEditing(null);
            await loadWarehouses();
        } catch (err) {
            throw err; // Let the modal handle and display it
        } finally {
            setActionLoading(false);
        }
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <div className="page-header-row">
                    <Warehouse size={24} strokeWidth={1.5} className="page-header-icon" />
                    <h1 className="page-title">Depósitos</h1>
                </div>
                <p className="page-subtitle">
                    Gestioná tus depósitos, definí cuál es el principal y cuáles suman stock a la web.
                </p>
            </div>

            {/* Action bar */}
            <div className="wh-action-bar">
                <button className="btn-primary" onClick={handleNew}>
                    <Plus size={16} />
                    Nuevo depósito
                </button>
            </div>

            {/* Error alert */}
            {error && (
                <div className="settings-alert settings-alert-danger">
                    {error}
                </div>
            )}

            {/* Loading */}
            {loading && (
                <div className="wh-loading">
                    <Loader2 size={24} className="spin" />
                </div>
            )}

            {/* Empty state */}
            {!loading && warehouses.length === 0 && (
                <div className="wh-empty">
                    <PackageOpen size={48} strokeWidth={1} />
                    <h2>No hay depósitos</h2>
                    <p>Creá tu primer depósito para empezar a gestionar el stock.</p>
                    <button className="btn-primary" onClick={handleNew} style={{ marginTop: "1rem" }}>
                        <Plus size={16} />
                        Crear depósito
                    </button>
                </div>
            )}

            {/* Cards grid */}
            {!loading && warehouses.length > 0 && (
                <div className="wh-grid">
                    {warehouses.map((wh) => (
                        <WarehouseCard
                            key={wh.id}
                            warehouse={wh}
                            onEdit={() => handleEdit(wh)}
                            onDelete={() => setDeleteConfirm(wh.id)}
                        />
                    ))}
                </div>
            )}

            {/* Delete confirmation modal */}
            {deleteConfirm !== null && (
                <div className="wh-modal-backdrop" onClick={() => setDeleteConfirm(null)}>
                    <div className="wh-modal wh-modal-sm" onClick={(e) => e.stopPropagation()}>
                        <h3 className="wh-modal-title">Eliminar depósito</h3>
                        <p className="wh-modal-text">
                            ¿Estás seguro de que querés eliminar este depósito? Esta acción se puede revertir.
                        </p>
                        <div className="wh-modal-actions">
                            <button
                                className="btn-secondary"
                                onClick={() => setDeleteConfirm(null)}
                                disabled={actionLoading}
                            >
                                Cancelar
                            </button>
                            <button
                                className="btn-danger"
                                onClick={() => handleDelete(deleteConfirm)}
                                disabled={actionLoading}
                            >
                                {actionLoading ? <Loader2 size={16} className="spin" /> : null}
                                Eliminar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Create/Edit modal */}
            {modalOpen && (
                <WarehouseFormModal
                    warehouse={editing}
                    onClose={() => { setModalOpen(false); setEditing(null); }}
                    onSave={handleSave}
                />
            )}
        </div>
    );
}
