import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { TiendanubeClient } from "@/lib/tiendanube/client";

export async function POST() {
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

    const token = settings?.find((s) => s.key === "tn_access_token")?.value?.trim();
    const storeId = settings?.find((s) => s.key === "tn_store_id")?.value?.trim();

    if (!token || !storeId) {
        return NextResponse.json(
            { error: "Credenciales de Tiendanube no configuradas" },
            { status: 400 }
        );
    }

    const client = new TiendanubeClient(token, storeId);
    const result = await client.testConnection();

    return NextResponse.json(result);
}
