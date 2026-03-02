import { NextResponse } from "next/server";
import { processSyncQueue } from "@/lib/sync/syncLogic";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const token = searchParams.get("token");

        // Simple authorization check
        const expectedToken = process.env.CRON_SECRET;
        if (expectedToken && token !== expectedToken) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const result = await processSyncQueue(30);
        return NextResponse.json(result);
    } catch (error: any) {
        console.error("Cron sync error:", error);
        return NextResponse.json(
            { error: error.message || "Failed to process sync queue" },
            { status: 500 }
        );
    }
}
