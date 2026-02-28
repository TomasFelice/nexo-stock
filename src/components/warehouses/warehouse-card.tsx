"use client";

import {
    Star,
    Globe,
    CloudOff,
    Pencil,
    Trash2,
    ArrowUpDown,
} from "lucide-react";

interface WarehouseData {
    id: number;
    name: string;
    is_primary: boolean;
    syncs_to_web: boolean;
    is_virtual: boolean;
    sort_order: number;
}

interface WarehouseCardProps {
    warehouse: WarehouseData;
    onEdit: () => void;
    onDelete: () => void;
}

export function WarehouseCard({ warehouse, onEdit, onDelete }: WarehouseCardProps) {
    return (
        <div className={`wh-card ${warehouse.is_primary ? "wh-card-primary" : ""}`}>
            <div className="wh-card-header">
                <div className="wh-card-name-row">
                    <h3 className="wh-card-name">{warehouse.name}</h3>
                    {warehouse.is_primary && (
                        <Star size={14} strokeWidth={2} className="wh-card-star" />
                    )}
                </div>
                <div className="wh-card-actions">
                    <button
                        className="wh-card-action-btn"
                        onClick={onEdit}
                        aria-label="Editar depósito"
                        title="Editar"
                    >
                        <Pencil size={15} strokeWidth={1.5} />
                    </button>
                    <button
                        className="wh-card-action-btn wh-card-action-danger"
                        onClick={onDelete}
                        aria-label="Eliminar depósito"
                        title="Eliminar"
                    >
                        <Trash2 size={15} strokeWidth={1.5} />
                    </button>
                </div>
            </div>

            <div className="wh-card-badges">
                {warehouse.is_primary && (
                    <span className="wh-badge wh-badge-primary">
                        <Star size={12} /> Principal
                    </span>
                )}
                {warehouse.syncs_to_web ? (
                    <span className="wh-badge wh-badge-success">
                        <Globe size={12} /> Suma a web
                    </span>
                ) : (
                    <span className="wh-badge wh-badge-muted">
                        <CloudOff size={12} /> No sincroniza
                    </span>
                )}
                {warehouse.is_virtual && (
                    <span className="wh-badge wh-badge-warning">
                        Virtual
                    </span>
                )}
            </div>

            <div className="wh-card-meta">
                <ArrowUpDown size={13} strokeWidth={1.5} />
                <span>Prioridad: {warehouse.sort_order}</span>
            </div>
        </div>
    );
}
