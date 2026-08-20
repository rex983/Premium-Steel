import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessRegion } from "@/lib/region-access";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ regionId: string }> }
) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { regionId } = await params;
  if (!regionId.match(/^[0-9a-f-]{36}$/)) {
    return NextResponse.json({ error: "Invalid region id" }, { status: 400 });
  }
  const supabase = createAdminClient();
  const { searchParams } = new URL(req.url);
  const versionId = searchParams.get("versionId");

  const { data: region } = await supabase
    .from("psb_regions")
    .select("is_active, offices")
    .eq("id", regionId)
    .maybeSingle();
  if (!region?.is_active) {
    return NextResponse.json({ error: "Region not available" }, { status: 404 });
  }
  if (!canAccessRegion(session.user.role, session.user.office, region.offices)) {
    return NextResponse.json({ error: "Region not available" }, { status: 404 });
  }

  let q = supabase
    .from("psb_pricing_data")
    .select("id, region_id, version, is_current, matrices, created_at")
    .eq("region_id", regionId);
  if (versionId) {
    q = q.eq("id", versionId);
  } else {
    q = q.eq("is_current", true);
  }
  const { data, error } = await q.maybeSingle();

  if (error) {
    console.error("Pricing fetch error:", error.message);
    return NextResponse.json({ error: "Failed to load pricing" }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ pricing: null });
  }
  return NextResponse.json({ pricing: data });
}
