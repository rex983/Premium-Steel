import { revalidateTag, unstable_cache } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Cached read of a region's current pricing snapshot (psb_pricing_data).
 * The matrices blob is large and only changes on admin upload, so every
 * calculator load / quote save was re-downloading it. Entries are tagged and
 * dropped by invalidatePricingDataCache() from the routes that change pricing;
 * the hourly revalidate is only a safety net.
 *
 * Errors throw (unstable_cache does not cache thrown results).
 */
export const PRICING_DATA_TAG = "psb-pricing-data";

export interface CurrentPricingRow {
  id: string;
  region_id: string;
  version: number;
  is_current: boolean;
  matrices: unknown;
  created_at: string;
}

export const getCurrentPricingData = unstable_cache(
  async (regionId: string): Promise<CurrentPricingRow | null> => {
    const { data, error } = await createAdminClient()
      .from("psb_pricing_data")
      .select("id, region_id, version, is_current, matrices, created_at")
      .eq("region_id", regionId)
      .eq("is_current", true)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (data as CurrentPricingRow | null) ?? null;
  },
  ["psb-pricing-data-current"],
  { tags: [PRICING_DATA_TAG], revalidate: 3600 },
);

/** Expire every cached pricing snapshot immediately. */
export function invalidatePricingDataCache(): void {
  revalidateTag(PRICING_DATA_TAG, { expire: 0 });
}
