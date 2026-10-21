"use client";

import { useEffect, useState } from "react";
import type { PSBPricingMatrices } from "@/types/pricing";

export interface PricingSnapshot {
  id: string;
  region_id: string;
  version: number;
  is_current: boolean;
  matrices: PSBPricingMatrices;
  created_at: string;
}

export function usePricing(regionId: string | null, versionId?: string) {
  const [pricing, setPricing] = useState<PricingSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset/flag-loading synchronously when the inputs change (adjusting state
  // during render instead of in the effect). The sentinel makes this also run
  // on the first render, like the old effect did on mount.
  const [prevArgs, setPrevArgs] = useState<{ regionId: string | null; versionId?: string } | null>(null);
  if (prevArgs === null || prevArgs.regionId !== regionId || prevArgs.versionId !== versionId) {
    setPrevArgs({ regionId, versionId });
    if (!regionId) setPricing(null);
    else setLoading(true);
  }

  useEffect(() => {
    if (!regionId) return;
    const url = versionId
      ? `/api/pricing/${regionId}?versionId=${versionId}`
      : `/api/pricing/${regionId}`;
    fetch(url)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setPricing(data.pricing);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [regionId, versionId]);

  return { pricing, loading, error };
}
