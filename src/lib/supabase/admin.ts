import { createClient } from "@supabase/supabase-js";
import { auditFetch } from "@/lib/launcher-kit/audit";

export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      // Tags writes with who made them (edit/audit log, launcher migration 060).
      global: { fetch: auditFetch("PSB Pricing") },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}
