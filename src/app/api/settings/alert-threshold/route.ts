import { createClient } from "@/lib/supabase/server";
import { NextResponse, NextRequest } from "next/server";

// GET /api/settings/alert-threshold
export async function GET() {
    const supabase = await createClient();
    const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "global_stock_alert_threshold")
        .single();
    return NextResponse.json({ threshold: data?.value ?? null });
}

// POST /api/settings/alert-threshold  { threshold: number | null }
export async function POST(req: NextRequest) {
    const supabase = await createClient();
    const body = await req.json();
    const value = body.threshold === null || body.threshold === ""
        ? null
        : String(parseInt(body.threshold));

    const { error } = await supabase
        .from("app_settings")
        .upsert({ key: "global_stock_alert_threshold", value, updated_at: new Date().toISOString() }, { onConflict: "key" });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
}
