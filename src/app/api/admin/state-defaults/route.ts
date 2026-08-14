import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/admin-guard";
import { VALID_STATES } from "@/lib/us-states";

export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.res;

  const body = await req.json();
  const code = typeof body.state_code === "string" ? body.state_code.toUpperCase() : "";
  if (!VALID_STATES.has(code)) {
    return NextResponse.json({ error: "Invalid state code" }, { status: 400 });
  }

  const insert: Record<string, unknown> = { state_code: code };
  if (typeof body.region_id === "string" && body.region_id) insert.region_id = body.region_id;
  if (typeof body.default_snow_load === "string" && body.default_snow_load.trim()) {
    insert.default_snow_load = body.default_snow_load;
  }
  if (typeof body.default_wind_mph === "number" && body.default_wind_mph > 0 && body.default_wind_mph < 300) {
    insert.default_wind_mph = body.default_wind_mph;
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("psb_state_defaults")
    .insert(insert)
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: `${code} is already in the list` }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAudit({
    actorEmail: guard.email,
    action: "state_default.create",
    entity: "psb_state_defaults",
    entityId: code,
    diff: insert,
  });

  return NextResponse.json({ stateDefault: data });
}
