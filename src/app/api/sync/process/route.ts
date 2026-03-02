import { NextResponse } from "next/server";
import { processSyncQueue } from "@/lib/sync/syncLogic";

export const dynamic = 'force-dynamic';

export async function POST() {
    try {
        const result = await processSyncQueue(50); // Maybe process a bit more when triggered manually
        return NextResponse.json(result);
    } catch (error: any) {
        console.error("Manual sync process error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to process sync queue manually" },
            { status: 500 }
        );
    }
}
