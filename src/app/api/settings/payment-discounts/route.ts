"use server";

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const SETTINGS_KEY = "payment_discounts";

export interface PaymentDiscountRule {
    enabled: boolean;
    percentage: number;
}

export type PaymentDiscounts = Record<string, PaymentDiscountRule>;

const DEFAULT_DISCOUNTS: PaymentDiscounts = {
    efectivo: { enabled: false, percentage: 0 },
    tarjeta: { enabled: false, percentage: 0 },
    transferencia: { enabled: false, percentage: 0 },
    otro: { enabled: false, percentage: 0 },
};

// ── GET — Read payment discount rules ──

export async function GET() {
    try {
        const { data, error } = await supabase
            .from("app_settings")
            .select("value")
            .eq("key", SETTINGS_KEY)
            .maybeSingle();

        if (error) throw error;

        const discounts: PaymentDiscounts = data?.value
            ? JSON.parse(data.value)
            : DEFAULT_DISCOUNTS;

        return NextResponse.json({ discounts });
    } catch (err) {
        console.error("Error reading payment discounts:", err);
        return NextResponse.json(
            { error: "Error al leer los descuentos" },
            { status: 500 }
        );
    }
}

// ── PUT — Save payment discount rules ──

export async function PUT(request: NextRequest) {
    try {
        const body = await request.json();
        const { discounts } = body as { discounts: PaymentDiscounts };

        if (!discounts || typeof discounts !== "object") {
            return NextResponse.json(
                { error: "Formato inválido" },
                { status: 400 }
            );
        }

        // Validate each rule
        for (const [key, rule] of Object.entries(discounts)) {
            if (typeof rule.enabled !== "boolean") {
                return NextResponse.json(
                    { error: `Campo 'enabled' inválido para ${key}` },
                    { status: 400 }
                );
            }
            if (typeof rule.percentage !== "number" || rule.percentage < 0 || rule.percentage > 100) {
                return NextResponse.json(
                    { error: `Porcentaje inválido para ${key} (debe ser 0-100)` },
                    { status: 400 }
                );
            }
        }

        const { error } = await supabase
            .from("app_settings")
            .upsert(
                {
                    key: SETTINGS_KEY,
                    value: JSON.stringify(discounts),
                    updated_at: new Date().toISOString(),
                },
                { onConflict: "key" }
            );

        if (error) throw error;

        return NextResponse.json({ ok: true, discounts });
    } catch (err) {
        console.error("Error saving payment discounts:", err);
        return NextResponse.json(
            { error: "Error al guardar los descuentos" },
            { status: 500 }
        );
    }
}
