import { createAdminClient } from "@/lib/supabase/admin";

interface AuditEntry {
  actorId?: string | null;
  actorEmail?: string | null;
  action: string;
  entity?: string;
  entityId?: string;
  diff?: Record<string, unknown>;
}

/** Insert an audit log entry. Fire-and-forget — never throws. */
export async function logAudit(entry: AuditEntry) {
  try {
    const supabase = createAdminClient();
    await supabase.from("psb_audit_log").insert({
      actor_id: entry.actorId ?? null,
      actor_email: entry.actorEmail ?? null,
      action: entry.action,
      entity: entry.entity ?? null,
      entity_id: entry.entityId ?? null,
      diff: entry.diff ?? {},
    });
  } catch (err) {
    console.error("Audit logging failed:", err instanceof Error ? err.message : err);
  }
}
