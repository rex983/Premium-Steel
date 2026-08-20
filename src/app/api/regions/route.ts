import { NextResponse } from "next/server";
import { getActiveIdentity } from "@/lib/session/active-identity";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const identity = await getActiveIdentity();
  if (!identity) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { role, office } = identity;
  const supabase = createAdminClient();

  let query = supabase
    .from("psb_regions")
    .select("id, name, display_name, slug, states, is_active, offices")
    .eq("is_active", true)
    .order("name");

  if (role !== "admin") {
    if (!office) return NextResponse.json({ regions: [] });
    query = query.contains("offices", [office]);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ regions: data ?? [] });
}
