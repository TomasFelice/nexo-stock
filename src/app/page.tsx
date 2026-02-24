"use client";

import { Package, ArrowRight } from "lucide-react";

export default function Home() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem",
        background: "var(--color-background)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "1.5rem",
          maxWidth: "28rem",
          textAlign: "center",
        }}
      >
        {/* Logo mark */}
        <div
          style={{
            width: "4rem",
            height: "4rem",
            borderRadius: "var(--radius-lg)",
            background: "var(--color-primary)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <Package size={28} color="white" strokeWidth={1.5} />
        </div>

        {/* Title */}
        <div>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 600,
              color: "var(--color-text-primary)",
              marginBottom: "0.5rem",
            }}
          >
            NexoStock
          </h1>
          <p
            style={{
              fontSize: "0.875rem",
              color: "var(--color-text-muted)",
              lineHeight: 1.6,
            }}
          >
            Sistema de gestión de inventario multi-depósito con sincronización
            Tiendanube.
          </p>
        </div>

        {/* CTA */}
        <a
          href="/login"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.5rem",
            padding: "0.625rem 1.25rem",
            borderRadius: "var(--radius-sm)",
            background: "var(--color-primary)",
            color: "var(--color-text-on-primary)",
            fontSize: "0.875rem",
            fontWeight: 500,
            textDecoration: "none",
            transition: "background 150ms ease",
          }}
          onMouseOver={(e) =>
            (e.currentTarget.style.background = "var(--color-primary-hover)")
          }
          onMouseOut={(e) =>
            (e.currentTarget.style.background = "var(--color-primary)")
          }
        >
          Iniciar sesión
          <ArrowRight size={16} strokeWidth={2} />
        </a>
      </div>
    </div>
  );
}
