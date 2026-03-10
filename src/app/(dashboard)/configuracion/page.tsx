import { Settings } from "lucide-react";
import { TiendanubeConnection } from "@/components/settings/tiendanube-connection";
import { CatalogImport } from "@/components/settings/catalog-import";
import { PaymentDiscounts } from "@/components/settings/payment-discounts";

export default function ConfiguracionPage() {
    return (
        <div className="page-container">
            <div className="page-header">
                <div className="page-header-row">
                    <Settings size={24} strokeWidth={1.5} className="page-header-icon" />
                    <h1 className="page-title">Configuración</h1>
                </div>
                <p className="page-subtitle">
                    Gestioná la conexión con Tiendanube, importación de datos y descuentos por medio de pago.
                </p>
            </div>

            <div className="settings-grid">
                <TiendanubeConnection />
                <CatalogImport />
                <PaymentDiscounts />
            </div>
        </div>
    );
}
