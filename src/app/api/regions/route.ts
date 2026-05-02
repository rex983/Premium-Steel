import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("psb_regions")
    .select("id, name, slug, states, is_active")
    .eq("is_active", true)
    .order("name");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ regions: data ?? [] });
}
