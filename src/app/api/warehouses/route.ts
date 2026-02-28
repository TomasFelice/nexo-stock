import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// GET /api/warehouses — List all active warehouses
export async function GET() {
    const supabase = await createClient();

    const { data, error } = await supabase
        .from("warehouses")
        .select("*")
        .eq("active", true)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

// POST /api/warehouses — Create a new warehouse
export async function POST(request: Request) {
    const supabase = await createClient();

    const body = await request.json();
    const { name, is_primary, syncs_to_web, is_virtual, sort_order } = body;

    if (!name || !name.trim()) {
        return NextResponse.json(
            { error: "El nombre es obligatorio" },
            { status: 400 }
        );
    }

    // If setting as primary, unset the current primary first
    if (is_primary) {
        await supabase
            .from("warehouses")
            .update({ is_primary: false })
            .eq("is_primary", true);
    }

    const { data, error } = await supabase
        .from("warehouses")
        .insert({
            name: name.trim(),
            is_primary: is_primary ?? false,
            syncs_to_web: syncs_to_web ?? true,
            is_virtual: is_virtual ?? false,
            sort_order: sort_order ?? 0,
        })
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
}
