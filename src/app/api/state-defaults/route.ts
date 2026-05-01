import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from("psb_state_defaults")
    .select("state_code, region_id, default_snow_load, default_wind_mph")
    .order("state_code");
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ stateDefaults: data ?? [] });
}
