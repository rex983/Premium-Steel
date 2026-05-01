import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/admin-guard";

export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.res;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("psb_config")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ config: data });
}

export async function PATCH(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.res;

  const body = await req.json();
  const update: Record<string, unknown> = {};
  if (typeof body.deposit_default_pct === "number" && body.deposit_default_pct >= 0 && body.deposit_default_pct <= 1) {
    update.deposit_default_pct = body.deposit_default_pct;
  }
  if (typeof body.tax_default_pct === "number" && body.tax_default_pct >= 0 && body.tax_default_pct <= 0.5) {
    update.tax_default_pct = body.tax_default_pct;
  }
  for (const k of ["contact_phone", "contact_email", "contact_address"] as const) {
    if (typeof body[k] === "string") update[k] = body[k];
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const supabase = createAdminClient();
  // Update the single config row (most recently updated)
  const { data: existing } = await supabase
    .from("psb_config")
    .select("id")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!existing) return NextResponse.json({ error: "No config row to update" }, { status: 500 });

  const { data, error } = await supabase
    .from("psb_config")
    .update(update)
    .eq("id", existing.id)
    .select()
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    actorEmail: guard.email,
    action: "config.update",
    entity: "psb_config",
    entityId: existing.id,
    diff: update,
  });

  return NextResponse.json({ config: data });
}
