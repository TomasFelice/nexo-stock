"use client";

import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
    LayoutDashboard,
    Package,
    Warehouse,
    ArrowLeftRight,
    ShoppingCart,
    RefreshCw,
    BarChart3,
    Settings,
    LogOut,
    X,
    Menu,
    Bell,
    DollarSign,
} from "lucide-react";
import { useState, useEffect } from "react";

const NAV_ITEMS = [
    { label: "Dashboard", icon: LayoutDashboard, href: "/" },
    { label: "Productos", icon: Package, href: "/productos" },
    { label: "Precios", icon: DollarSign, href: "/precios" },
    { label: "Depósitos", icon: Warehouse, href: "/depositos" },
    { label: "Movimientos", icon: ArrowLeftRight, href: "/movimientos" },
    { label: "Punto de Venta", icon: ShoppingCart, href: "/pos" },
    { label: "Sincronización", icon: RefreshCw, href: "/sync" },
    { label: "Alertas", icon: Bell, href: "/alertas", badgeKey: "alerts" },
    { label: "Reportes", icon: BarChart3, href: "/reportes" },
];

const BOTTOM_NAV_ITEMS = [
    { label: "Configuración", icon: Settings, href: "/configuracion" },
];

interface SidebarProps {
    userEmail: string | undefined;
}

export function Sidebar({ userEmail }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [mobileOpen, setMobileOpen] = useState(false);
    const [alertCount, setAlertCount] = useState(0);

    // Close mobile sidebar on route change
    useEffect(() => {
        setMobileOpen(false);
    }, [pathname]);

    // Fetch alert count
    useEffect(() => {
        fetch("/api/stock/alerts")
            .then((r) => r.ok ? r.json() : null)
            .then((d) => d && setAlertCount(d.totalAlerts || 0))
            .catch(() => { });
    }, []);

    // Close on escape key
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") setMobileOpen(false);
        };
        document.addEventListener("keydown", handleEsc);
        return () => document.removeEventListener("keydown", handleEsc);
    }, []);

    // Prevent body scroll when mobile sidebar is open
    useEffect(() => {
        document.body.style.overflow = mobileOpen ? "hidden" : "";
        return () => {
            document.body.style.overflow = "";
        };
    }, [mobileOpen]);

    async function handleLogout() {
        const supabase = createClient();
        await supabase.auth.signOut();
        router.push("/login");
    }

    function isActive(href: string) {
        if (href === "/") return pathname === "/";
        return pathname.startsWith(href);
    }

    const sidebarContent = (
        <>
            {/* ── Logo ── */}
            <div className="sidebar-logo">
                <span className="sidebar-logo-text"><strong>nexo</strong>stock</span>

                {/* Mobile close button */}
                <button
                    className="sidebar-close-btn"
                    onClick={() => setMobileOpen(false)}
                    aria-label="Cerrar menú"
                >
                    <X size={20} />
                </button>
            </div>

            {/* ── Navigation ── */}
            <nav className="sidebar-nav">
                {NAV_ITEMS.map((item) => {
                    const active = isActive(item.href);
                    const badge = item.badgeKey === "alerts" ? alertCount : 0;
                    return (
                        <a
                            key={item.href}
                            href={item.href}
                            className={`sidebar-nav-item ${active ? "active" : ""}`}
                            onClick={(e) => {
                                e.preventDefault();
                                router.push(item.href);
                            }}
                        >
                            <item.icon size={20} strokeWidth={1.5} />
                            <span>{item.label}</span>
                            {badge > 0 && (
                                <span className="alert-badge">{badge > 99 ? "99+" : badge}</span>
                            )}
                        </a>
                    );
                })}

                <div className="sidebar-nav-divider" />

                {BOTTOM_NAV_ITEMS.map((item) => {
                    const active = isActive(item.href);
                    return (
                        <a
                            key={item.href}
                            href={item.href}
                            className={`sidebar-nav-item ${active ? "active" : ""}`}
                            onClick={(e) => {
                                e.preventDefault();
                                router.push(item.href);
                            }}
                        >
                            <item.icon size={20} strokeWidth={1.5} />
                            <span>{item.label}</span>
                        </a>
                    );
                })}
            </nav>

            {/* ── User section ── */}
            <div className="sidebar-user">
                <div className="sidebar-user-info">
                    <div className="sidebar-user-avatar">
                        {userEmail ? userEmail[0].toUpperCase() : "?"}
                    </div>
                    <span className="sidebar-user-email" title={userEmail}>
                        {userEmail || "Usuario"}
                    </span>
                </div>
                <button
                    onClick={handleLogout}
                    className="sidebar-logout-btn"
                    aria-label="Cerrar sesión"
                    title="Cerrar sesión"
                >
                    <LogOut size={18} strokeWidth={1.5} />
                </button>
            </div>

            {/* ── Benai Agency credit ── */}
            <div className="sidebar-footer">
                <span>Hecho por</span>
                <a
                    href="https://benai-bice.vercel.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sidebar-footer-link"
                >
                    Benai Agency
                </a>
            </div>
        </>
    );

    return (
        <>
            {/* ── Mobile hamburger button ── */}
            <button
                className="sidebar-hamburger"
                onClick={() => setMobileOpen(true)}
                aria-label="Abrir menú"
            >
                <Menu size={22} strokeWidth={1.5} />
            </button>

            {/* ── Backdrop (mobile) ── */}
            {mobileOpen && (
                <div
                    className="sidebar-backdrop"
                    onClick={() => setMobileOpen(false)}
                />
            )}

            {/* ── Sidebar panel ── */}
            <aside className={`sidebar ${mobileOpen ? "open" : ""}`}>
                {sidebarContent}
            </aside>
        </>
    );
}
