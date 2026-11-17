import { redirect } from "next/navigation";
import { getActiveIdentity } from "@/lib/session/active-identity";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Region } from "@/hooks/use-regions";
import type { StateDefault } from "@/hooks/use-state-defaults";
import { CalculatorClient } from "./calculator-client";

// Loads what /api/regions and /api/state-defaults return, with the same
// access rule: admins see every active region, everyone else only the
// regions their office is listed on (no office, no regions). Pricing itself
// is still fetched through /api/pricing/[regionId], which checks access again.
export default async function CalculatorPage() {
  const identity = await getActiveIdentity();
  if (!identity) redirect("/login");

  const supabase = createAdminClient();
  let regionQuery = supabase
    .from("psb_regions")
    .select("id, name, display_name, slug, states, is_active, offices")
    .eq("is_active", true)
    .order("name");
  const noOffice = identity.role !== "admin" && !identity.office;
  if (identity.role !== "admin" && identity.office) {
    regionQuery = regionQuery.contains("offices", [identity.office]);
  }

  const [regionRes, stateRes] = await Promise.all([
    noOffice ? Promise.resolve({ data: [], error: null }) : regionQuery,
    supabase
      .from("psb_state_defaults")
      .select("state_code, region_id, default_snow_load, default_wind_mph")
      .order("state_code"),
  ]);
  if (stateRes.error) console.error("State defaults list error:", stateRes.error.message);

  return (
    <CalculatorClient
      regions={(regionRes.data ?? []) as Region[]}
      stateDefaults={(stateRes.data ?? []) as StateDefault[]}
      regionsError={regionRes.error?.message ?? null}
    />
  );
}
