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

  useEffect(() => {
    if (!regionId) {
      setPricing(null);
      return;
    }
    setLoading(true);
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
