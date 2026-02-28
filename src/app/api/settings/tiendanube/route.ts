import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
    const supabase = await createClient();

    const { data: settings, error } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["tn_access_token", "tn_store_id"]);

    if (error) {
        return NextResponse.json(
            { error: "Error al leer configuración" },
            { status: 500 }
        );
    }

    const tokenRow = settings?.find((s) => s.key === "tn_access_token");
    const storeRow = settings?.find((s) => s.key === "tn_store_id");

    const raw = tokenRow?.value ?? "";
    const maskedToken = raw.length > 4
        ? "•".repeat(raw.length - 4) + raw.slice(-4)
        : raw ? "••••" : "";

    return NextResponse.json({
        storeId: storeRow?.value ?? "",
        accessToken: maskedToken,
        configured: Boolean(tokenRow?.value && storeRow?.value),
    });
}

export async function PUT(request: Request) {
    const supabase = await createClient();

    let body: { storeId?: string; accessToken?: string };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { error: "Cuerpo de la solicitud inválido" },
            { status: 400 }
        );
    }

    const { storeId, accessToken } = body;

    if (!storeId || !accessToken) {
        return NextResponse.json(
            { error: "Store ID y Access Token son requeridos" },
            { status: 400 }
        );
    }

    const now = new Date().toISOString();

    const { error: e1 } = await supabase
        .from("app_settings")
        .upsert(
            { key: "tn_store_id", value: storeId.trim(), updated_at: now },
            { onConflict: "key" }
        );

    const { error: e2 } = await supabase
        .from("app_settings")
        .upsert(
            { key: "tn_access_token", value: accessToken.trim(), updated_at: now },
            { onConflict: "key" }
        );

    if (e1 || e2) {
        return NextResponse.json(
            { error: "Error al guardar configuración" },
            { status: 500 }
        );
    }

    return NextResponse.json({ ok: true });
}
