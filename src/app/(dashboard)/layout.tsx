import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";

export default async function DashboardLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const supabase = await createClient();
    const {
        data: { user },
    } = await supabase.auth.getUser();

    return (
        <div className="dashboard-layout">
            <Sidebar userEmail={user?.email} />
            <main className="dashboard-main">{children}</main>
        </div>
    );
}
