import * as dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

// verifico que sea entorno local
if (process.env.NODE_ENV !== "development") {
    console.error("This script can only be run in development mode.");
    process.exit(1);
}

dotenv.config({ path: ".env.local" });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function registerWebhooks() {
    const { data: settings } = await supabase
        .from("app_settings")
        .select("key, value")
        .in("key", ["tn_access_token", "tn_store_id"]);

    let tnToken = settings?.find((s) => s.key === "tn_access_token")?.value;
    let tnStoreId = settings?.find((s) => s.key === "tn_store_id")?.value;

    if (!tnToken || !tnStoreId) {
        // Try the alternative keys used in syncLogic.ts
        tnToken = settings?.find((s) => s.key === "tn_access_token")?.value || tnToken;
        tnStoreId = settings?.find((s) => s.key === "tn_store_id")?.value || tnStoreId;
    }

    if (!tnToken || !tnStoreId) {
        console.error("Missing Tiendanube credentials in app_settings table.");
        // We can fetch using supabase directly if keys are mismatch
        const { data: allSettings } = await supabase.from("app_settings").select("*");
        console.log("Available settings:", allSettings?.map(s => s.key));
        return;
    }

    const TARGET_URL = "https://disallowable-prediastolic-shila.ngrok-free.dev/api/webhooks/tiendanube";
    const EVENTS = ["order/paid", "order/created", "order/cancelled"];

    console.log(`Registering webhooks for Store ID: ${tnStoreId} to URL: ${TARGET_URL}`);

    for (const event of EVENTS) {
        const payload = { event, url: TARGET_URL };

        try {
            console.log(`Creating webhook for ${event}...`);
            const res = await fetch(`https://api.tiendanube.com/v1/${tnStoreId}/webhooks`, {
                method: "POST",
                headers: {
                    Authentication: `bearer ${tnToken}`,
                    "Content-Type": "application/json",
                    "User-Agent": "NexoStock/1.0 (benai.cpy@gmail.com)"
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                const data = await res.json();
                console.log(`✅ Successfully registered webhook for ${event}`);
                console.log(data);
            } else {
                const text = await res.text();
                // If it already exists it may return 422
                if (res.status === 422 && text.includes("taken")) {
                    console.log(`⚠️ Webhook for ${event} and URL already exists.`);
                } else {
                    console.error(`❌ Failed to register for ${event}: ${res.status} - ${text}`);
                }
            }
        } catch (error) {
            console.error(`Error registering ${event}:`, error);
        }
    }
}

registerWebhooks();
