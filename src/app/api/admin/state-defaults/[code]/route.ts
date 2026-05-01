import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/admin-guard";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.res;

  const { code } = await params;
  const body = await req.json();
  const update: Record<string, unknown> = {};

  if (typeof body.default_snow_load === "string" && body.default_snow_load.trim()) {
    update.default_snow_load = body.default_snow_load;
  }
  if (typeof body.default_wind_mph === "number" && body.default_wind_mph > 0 && body.default_wind_mph < 300) {
    update.default_wind_mph = body.default_wind_mph;
  }
  if (typeof body.region_id === "string") {
    update.region_id = body.region_id;
  }
  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("psb_state_defaults")
    .update(update)
    .eq("state_code", code)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAudit({
    actorEmail: guard.email,
    action: "state_default.update",
    entity: "psb_state_defaults",
    entityId: code,
    diff: update,
  });

  return NextResponse.json({ stateDefault: data });
}
