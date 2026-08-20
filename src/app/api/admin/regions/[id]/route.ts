import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/admin-guard";
import { isValidOffice } from "@/lib/region-access";

const VALID_STATES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN",
  "IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV",
  "NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN",
  "TX","UT","VT","VA","WA","WV","WI","WY",
]);

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.res;

  const { id } = await params;
  const body = await req.json();
  const update: Record<string, unknown> = {};

  if (typeof body.name === "string" && body.name.trim()) update.name = body.name.trim();
  if ("display_name" in body) {
    const dn = typeof body.display_name === "string" ? body.display_name.trim() : "";
    update.display_name = dn || null;
  }
  if (Array.isArray(body.states)) {
    const invalid = body.states.filter((s: string) => !VALID_STATES.has(s));
    if (invalid.length > 0) {
      return NextResponse.json({ error: `Invalid state codes: ${invalid.join(", ")}` }, { status: 400 });
    }
    update.states = body.states;
    update.slug = body.states.join("-").toLowerCase();
  }
  if (Array.isArray(body.offices)) {
    const invalidOffices = body.offices.filter((o: unknown) => !isValidOffice(o));
    if (invalidOffices.length > 0) {
      return NextResponse.json({ error: `Invalid offices: ${invalidOffices.join(", ")}` }, { status: 400 });
    }
    update.offices = Array.from(new Set(body.offices as string[]));
  }
  if (typeof body.is_active === "boolean") update.is_active = body.is_active;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("psb_regions")
    .update(update)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    actorEmail: guard.email,
    action: "region.update",
    entity: "psb_regions",
    entityId: id,
    diff: update,
  });

  return NextResponse.json({ region: data });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.res;

  const { id } = await params;
  const supabase = createAdminClient();

  const { error } = await supabase.from("psb_regions").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    actorEmail: guard.email,
    action: "region.delete",
    entity: "psb_regions",
    entityId: id,
  });

  return NextResponse.json({ ok: true });
}
