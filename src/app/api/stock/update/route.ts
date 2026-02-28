import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// PATCH /api/stock/update — Upsert stock level
export async function PATCH(request: Request) {
    const supabase = await createClient();

    const body = await request.json();
    const { variant_id, warehouse_id, quantity } = body;

    if (!variant_id || !warehouse_id || quantity === undefined || quantity === null) {
        return NextResponse.json(
            { error: "variant_id, warehouse_id y quantity son obligatorios" },
            { status: 400 }
        );
    }

    if (typeof quantity !== "number" || quantity < 0 || !Number.isInteger(quantity)) {
        return NextResponse.json(
            { error: "La cantidad debe ser un número entero no negativo" },
            { status: 400 }
        );
    }

    // Check if the stock level already exists
    const { data: existing, error: lookupError } = await supabase
        .from("stock_levels")
        .select("id")
        .eq("variant_id", variant_id)
        .eq("warehouse_id", warehouse_id)
        .maybeSingle();

    if (lookupError) {
        return NextResponse.json({ error: lookupError.message }, { status: 500 });
    }

    if (existing) {
        // Update existing
        const { data, error } = await supabase
            .from("stock_levels")
            .update({ quantity, updated_at: new Date().toISOString() })
            .eq("id", existing.id)
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data);
    } else {
        // Insert new
        const { data, error } = await supabase
            .from("stock_levels")
            .insert({ variant_id, warehouse_id, quantity })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        return NextResponse.json(data, { status: 201 });
    }
}
