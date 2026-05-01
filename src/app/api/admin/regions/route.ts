import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { logAudit } from "@/lib/audit";
import { requireAdmin } from "@/lib/admin-guard";

const VALID_STATES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN",
  "IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV",
  "NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN",
  "TX","UT","VT","VA","WA","WV","WI","WY",
]);

/** GET — list all regions (active + inactive) with current pricing version + last upload */
export async function GET() {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.res;

  const supabase = createAdminClient();

  const [{ data: regions, error: regError }, { data: pricingStatus }, { data: uploads }] =
    await Promise.all([
      supabase.from("psb_regions").select("*").order("name"),
      supabase.from("psb_pricing_data")
        .select("region_id, version, created_at").eq("is_current", true),
      supabase.from("psb_uploads")
        .select("region_id, filename, status, created_at")
        .eq("status", "success").order("created_at", { ascending: false }),
    ]);

  if (regError) return NextResponse.json({ error: regError.message }, { status: 500 });

  const pricingMap: Record<string, { version: number; uploadedAt: string }> = {};
  for (const p of pricingStatus ?? []) {
    pricingMap[p.region_id] = { version: p.version, uploadedAt: p.created_at };
  }
  const uploadMap: Record<string, { filename: string; uploadedAt: string }> = {};
  for (const u of uploads ?? []) {
    if (!uploadMap[u.region_id]) {
      uploadMap[u.region_id] = { filename: u.filename, uploadedAt: u.created_at };
    }
  }

  const enriched = (regions ?? []).map((r) => ({
    ...r,
    currentPricing: pricingMap[r.id] ?? null,
    lastUpload: uploadMap[r.id] ?? null,
  }));

  return NextResponse.json({ regions: enriched });
}

/** POST — create a new region */
export async function POST(req: NextRequest) {
  const guard = await requireAdmin();
  if (!guard.ok) return guard.res;

  const body = await req.json();
  const { name, states } = body as { name: string; states: string[] };

  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
  if (!Array.isArray(states) || states.length === 0) {
    return NextResponse.json({ error: "At least one state is required" }, { status: 400 });
  }
  const invalid = states.filter((s) => !VALID_STATES.has(s));
  if (invalid.length > 0) {
    return NextResponse.json({ error: `Invalid state codes: ${invalid.join(", ")}` }, { status: 400 });
  }

  const slug = states.join("-").toLowerCase();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("psb_regions")
    .insert({ name: name.trim(), slug, states, is_active: true })
    .select()
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "A region with this state combination already exists" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await logAudit({
    actorEmail: guard.email,
    action: "region.create",
    entity: "psb_regions",
    entityId: data.id,
    diff: { name: data.name, states: data.states },
  });

  return NextResponse.json({ region: data });
}
