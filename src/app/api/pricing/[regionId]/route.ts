import { NextRequest, NextResponse } from "next/server";
import { getActiveIdentity } from "@/lib/session/active-identity";
import { createAdminClient } from "@/lib/supabase/admin";
import { canAccessRegion } from "@/lib/region-access";
import { getCurrentPricingData } from "@/lib/pricing-data-cache";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ regionId: string }> }
) {
  const identity = await getActiveIdentity();
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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
  if (!canAccessRegion(identity.role, identity.office, region.offices)) {
    return NextResponse.json({ error: "Region not available" }, { status: 404 });
  }

  let data;
  try {
    if (versionId) {
      const res = await supabase
        .from("psb_pricing_data")
        .select("id, region_id, version, is_current, matrices, created_at")
        .eq("region_id", regionId)
        .eq("id", versionId)
        .maybeSingle();
      if (res.error) throw new Error(res.error.message);
      data = res.data;
    } else {
      data = await getCurrentPricingData(regionId);
    }
  } catch (e) {
    console.error("Pricing fetch error:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Failed to load pricing" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ pricing: null });
  }
  return NextResponse.json({ pricing: data });
}
