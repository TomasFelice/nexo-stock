import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// ─── Types ───────────────────────────────────────────────

const MOVEMENT_TYPES = [
    "ingreso",
    "egreso",
    "ajuste",
    "venta",
    "devolucion",
    "cancelacion",
    "transferencia",
    "cambio",
] as const;

type MovementType = (typeof MOVEMENT_TYPES)[number];

// ─── GET /api/stock/movements ────────────────────────────

export async function GET(request: Request) {
    const supabase = await createClient();
    const { searchParams } = new URL(request.url);

    const typeFilter = searchParams.get("type") || "";
    const search = searchParams.get("search") || "";
    const warehouseId = searchParams.get("warehouse_id") || "";
    const dateFrom = searchParams.get("from") || "";
    const dateTo = searchParams.get("to") || "";
    const page = Math.max(1, parseInt(searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") || "25")));
    const offset = (page - 1) * limit;

    // Build the query
    let query = supabase
        .from("stock_movements")
        .select(
            `
            id,
            variant_id,
            source_warehouse_id,
            target_warehouse_id,
            movement_type,
            quantity,
            reference,
            notes,
            user_id,
            created_at,
            variants!inner (
                id,
                sku,
                attribute_values,
                product_id,
                products!inner ( id, name )
            ),
            source_warehouse:warehouses!stock_movements_source_warehouse_id_fkey ( id, name ),
            target_warehouse:warehouses!stock_movements_target_warehouse_id_fkey ( id, name )
        `,
            { count: "exact" }
        )
        .order("created_at", { ascending: false })
        .range(offset, offset + limit - 1);

    // Filters
    if (typeFilter && MOVEMENT_TYPES.includes(typeFilter as MovementType)) {
        query = query.eq("movement_type", typeFilter);
    }

    if (search) {
        query = query.ilike("variants.products.name", `%${search}%`);
    }

    if (warehouseId) {
        const whId = parseInt(warehouseId);
        query = query.or(`source_warehouse_id.eq.${whId},target_warehouse_id.eq.${whId}`);
    }

    if (dateFrom) {
        query = query.gte("created_at", `${dateFrom}T00:00:00`);
    }

    if (dateTo) {
        // Use start of next day (exclusive) to include the entire selected day
        const nextDay = new Date(dateTo + "T00:00:00");
        nextDay.setDate(nextDay.getDate() + 1);
        query = query.lt("created_at", nextDay.toISOString());
    }

    const { data: movements, count, error } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Get warehouses for filter dropdown
    const { data: warehouses } = await supabase
        .from("warehouses")
        .select("id, name")
        .eq("active", true)
        .order("sort_order", { ascending: true });

    // Format response
    const formattedMovements = (movements || []).map((m: Record<string, unknown>) => {
        const variant = m.variants as Record<string, unknown>;
        const product = variant?.products as Record<string, unknown>;
        const srcWh = m.source_warehouse as Record<string, unknown> | null;
        const tgtWh = m.target_warehouse as Record<string, unknown> | null;

        return {
            id: m.id,
            movement_type: m.movement_type,
            quantity: m.quantity,
            reference: m.reference,
            notes: m.notes,
            user_id: m.user_id,
            created_at: m.created_at,
            variant: {
                id: variant?.id,
                sku: variant?.sku,
                attribute_values: variant?.attribute_values,
                product_name: product?.name || "—",
            },
            source_warehouse: srcWh ? { id: srcWh.id, name: srcWh.name } : null,
            target_warehouse: tgtWh ? { id: tgtWh.id, name: tgtWh.name } : null,
        };
    });

    return NextResponse.json({
        movements: formattedMovements,
        warehouses: warehouses || [],
        pagination: {
            page,
            limit,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limit),
        },
    });
}

// ─── POST /api/stock/movements ───────────────────────────

export async function POST(request: Request) {
    const supabase = await createClient();

    // Get current user
    const {
        data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const body = await request.json();
    const {
        variant_id,
        source_warehouse_id,
        target_warehouse_id,
        movement_type,
        quantity,
        reference,
        notes,
    } = body;

    // ── Validation ──

    if (!variant_id || !movement_type || !quantity) {
        return NextResponse.json(
            { error: "variant_id, movement_type y quantity son obligatorios" },
            { status: 400 }
        );
    }

    if (!MOVEMENT_TYPES.includes(movement_type)) {
        return NextResponse.json(
            { error: `Tipo inválido. Opciones: ${MOVEMENT_TYPES.join(", ")}` },
            { status: 400 }
        );
    }

    if (typeof quantity !== "number" || quantity <= 0 || !Number.isInteger(quantity)) {
        return NextResponse.json(
            { error: "La cantidad debe ser un número entero positivo" },
            { status: 400 }
        );
    }

    if (movement_type === "transferencia") {
        if (!source_warehouse_id || !target_warehouse_id) {
            return NextResponse.json(
                { error: "Transferencia requiere depósito origen y destino" },
                { status: 400 }
            );
        }
        if (source_warehouse_id === target_warehouse_id) {
            return NextResponse.json(
                { error: "Depósito origen y destino no pueden ser iguales" },
                { status: 400 }
            );
        }
    }

    // For egreso, venta, ajuste, devolucion, cambio — need source_warehouse_id
    if (["egreso", "venta", "ajuste", "devolucion", "cambio"].includes(movement_type) && !source_warehouse_id) {
        return NextResponse.json(
            { error: "Este tipo de movimiento requiere un depósito" },
            { status: 400 }
        );
    }

    // ── Insert movement ──

    const { data: movement, error: insertError } = await supabase
        .from("stock_movements")
        .insert({
            variant_id,
            source_warehouse_id: source_warehouse_id || null,
            target_warehouse_id: movement_type === "transferencia" ? target_warehouse_id : null,
            movement_type,
            quantity,
            reference: reference || null,
            notes: notes || null,
            user_id: user.id,
        })
        .select()
        .single();

    if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    // ── Update stock_levels based on movement type ──

    try {
        switch (movement_type) {
            case "ingreso": {
                // Increase stock at source (or target) warehouse
                const whId = source_warehouse_id || target_warehouse_id;
                if (whId) {
                    await upsertStockLevel(supabase, variant_id, whId, quantity);
                }
                break;
            }
            case "egreso":
            case "venta":
            case "cambio": {
                // Decrease stock at source warehouse
                await upsertStockLevel(supabase, variant_id, source_warehouse_id, -quantity);
                break;
            }
            case "devolucion":
            case "cancelacion": {
                // Increase stock at source warehouse (return / cancellation)
                await upsertStockLevel(supabase, variant_id, source_warehouse_id, quantity);
                break;
            }
            case "ajuste": {
                // Set absolute quantity — calculate delta
                const { data: current } = await supabase
                    .from("stock_levels")
                    .select("quantity")
                    .eq("variant_id", variant_id)
                    .eq("warehouse_id", source_warehouse_id)
                    .maybeSingle();

                const currentQty = current?.quantity || 0;
                const delta = quantity - currentQty;
                await upsertStockLevel(supabase, variant_id, source_warehouse_id, delta);
                break;
            }
            case "transferencia": {
                // Decrease source, increase target
                await upsertStockLevel(supabase, variant_id, source_warehouse_id, -quantity);
                await upsertStockLevel(supabase, variant_id, target_warehouse_id, quantity);
                break;
            }
        }
    } catch (err) {
        // Log but don't fail — movement is already recorded
        console.error("Error updating stock_levels:", err);
    }

    return NextResponse.json(movement, { status: 201 });
}

// ─── Helper: Upsert stock level ──────────────────────────

async function upsertStockLevel(
    supabase: Awaited<ReturnType<typeof createClient>>,
    variantId: number,
    warehouseId: number,
    delta: number
) {
    const { data: existing } = await supabase
        .from("stock_levels")
        .select("id, quantity")
        .eq("variant_id", variantId)
        .eq("warehouse_id", warehouseId)
        .maybeSingle();

    if (existing) {
        const newQty = Math.max(0, existing.quantity + delta);
        await supabase
            .from("stock_levels")
            .update({ quantity: newQty, updated_at: new Date().toISOString() })
            .eq("id", existing.id);
    } else if (delta > 0) {
        await supabase
            .from("stock_levels")
            .insert({ variant_id: variantId, warehouse_id: warehouseId, quantity: delta });
    }
}
