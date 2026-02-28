import { LayoutDashboard } from "lucide-react";

export default function DashboardPage() {
    return (
        <div className="page-container">
            <div className="page-header">
                <h1 className="page-title">Dashboard</h1>
            </div>

            <div className="dashboard-placeholder">
                <div className="dashboard-placeholder-icon">
                    <LayoutDashboard size={48} strokeWidth={1} />
                </div>
                <h2>Bienvenido a NexoStock</h2>
                <p>
                    Tu sistema de gestión de inventario multi-depósito.
                    <br />
                    Los KPIs y reportes estarán disponibles próximamente.
                </p>
            </div>
        </div>
    );
}
