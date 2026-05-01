import { NextRequest, NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ regionId: string }> }
) {
  const { regionId } = await params;
  if (!regionId.match(/^[0-9a-f-]{36}$/)) {
    return NextResponse.json({ error: "Invalid region id" }, { status: 400 });
  }
  const supabase = await createServerSupabaseClient();
  const { searchParams } = new URL(req.url);
  const versionId = searchParams.get("versionId");

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
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ pricing: null });
  }
  return NextResponse.json({ pricing: data });
}
