import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";

export const dynamic = 'force-dynamic';

export async function POST() {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const supabase = createClient<Database>(supabaseUrl, supabaseKey);

        // Fetch all active variants that have a tn_variant_id
        const { data: variants, error: fetchError } = await supabase
            .from("variants")
            .select("id")
            .eq("active", true)
            .not("tn_variant_id", "is", null);

        if (fetchError || !variants) {
            throw fetchError || new Error("Failed to fetch variants");
        }

        if (variants.length === 0) {
            return NextResponse.json({ message: "No variants connected to Tiendanube" });
        }

        // Insert into sync_queue
        const payload = variants.map(v => ({
            variant_id: v.id,
            action: 'update_stock',
            status: 'pending',
            retry_count: 0
        }));

        // Delete any pending ones so we don't have duplicates, or just insert (and maybe have dups unless we handle it)
        // Since we are enqueueing everything, let's just insert. If there are duplicates, the processSyncQueue will process them eventually.
        const { error: insertError } = await supabase
            .from("sync_queue")
            .insert(payload);

        if (insertError) {
            throw insertError;
        }

        return NextResponse.json({
            message: `Successfully enqueued ${variants.length} variants for sync.`,
            enqueuedCount: variants.length
        });
    } catch (error: any) {
        console.error("Trigger full sync error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to trigger full sync" },
            { status: 500 }
        );
    }
}
