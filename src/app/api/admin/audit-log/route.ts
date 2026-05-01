import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createAdminClient } from "@/lib/supabase/admin";

async function requireAdmin(): Promise<{ ok: true } | { ok: false; res: NextResponse }> {
  const session = await auth();
  const user = session?.user as { role?: string } | undefined;
  if (!user || user.role !== "admin") {
    return { ok: false, res: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { ok: true };
}

export async function GET(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.res;

  const supabase = createAdminClient();
  const entity = req.nextUrl.searchParams.get("entity");

  let q = supabase
    .from("psb_audit_log")
    .select("id, actor_id, actor_email, entity, entity_id, action, diff, created_at")
    .order("created_at", { ascending: false })
    .limit(200);
  if (entity) q = q.eq("entity", entity);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ entries: data ?? [] });
}
