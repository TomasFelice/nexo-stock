import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

interface RouteContext {
    params: Promise<{ id: string }>;
}

// PUT /api/warehouses/:id — Update a warehouse
export async function PUT(request: Request, context: RouteContext) {
    const { id } = await context.params;
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
            .eq("is_primary", true)
            .neq("id", Number(id));
    }

    const { data, error } = await supabase
        .from("warehouses")
        .update({
            name: name.trim(),
            is_primary: is_primary ?? false,
            syncs_to_web: syncs_to_web ?? true,
            is_virtual: is_virtual ?? false,
            sort_order: sort_order ?? 0,
            updated_at: new Date().toISOString(),
        })
        .eq("id", Number(id))
        .select()
        .single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data);
}

// DELETE /api/warehouses/:id — Soft-delete a warehouse
export async function DELETE(_request: Request, context: RouteContext) {
    const { id } = await context.params;
    const supabase = await createClient();

    // Check if this is the primary warehouse
    const { data: warehouse } = await supabase
        .from("warehouses")
        .select("is_primary")
        .eq("id", Number(id))
        .single();

    if (warehouse?.is_primary) {
        return NextResponse.json(
            { error: "No se puede eliminar el depósito principal. Asigná otro depósito como principal primero." },
            { status: 400 }
        );
    }

    const { error } = await supabase
        .from("warehouses")
        .update({ active: false, updated_at: new Date().toISOString() })
        .eq("id", Number(id));

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
