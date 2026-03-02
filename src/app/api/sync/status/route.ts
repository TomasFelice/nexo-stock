import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Database } from "@/types/database";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const page = parseInt(searchParams.get("page") || "1", 10);
        const limit = 10;
        const offset = (page - 1) * limit;

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const supabase = createClient<Database>(supabaseUrl, supabaseKey);

        const { data: queueData, error: queueError } = await supabase
            .from("sync_queue")
            .select("*"); // need all data to format them in the logs

        if (queueError) throw queueError;

        const pending = queueData?.filter(q => q.status === "pending").length || 0;
        const processing = queueData?.filter(q => q.status === "processing").length || 0;
        const completed = queueData?.filter(q => q.status === "completed").length || 0;
        const failed = queueData?.filter(q => q.status === "failed").length || 0;

        // Extract active queue items (to display in table)
        const activeQueueItems = queueData
            ?.filter(q => q.status === "pending" || q.status === "processing")
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
            .map(q => ({
                id: `q-${q.id}`,
                created_at: q.created_at,
                direction: "outbound",
                event_type: "queue: " + q.action,
                status: q.status,
                error_details: q.error_message,
                payload: { variant_id: q.variant_id, retry_count: q.retry_count }
            })) || [];

        // Fetch paginated logs
        const { data: recentLogs, count: totalLogs, error: logsError } = await supabase
            .from("sync_log")
            .select("*", { count: "exact" })
            .order("created_at", { ascending: false })
            .range(offset, offset + limit - 1);

        if (logsError) throw logsError;

        // If we are on the first page, prepend the active queue items
        const logsData = page === 1 ? [...activeQueueItems, ...(recentLogs || [])] : (recentLogs || []);

        return NextResponse.json({
            stats: {
                pending,
                processing,
                completed,
                failed,
            },
            logs: {
                data: logsData.slice(0, 10), // Ensure we only return roughly a page worth if active queue is huge
                total: totalLogs || 0,
                page,
                totalPages: Math.ceil((totalLogs || 0) / limit)
            }
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
