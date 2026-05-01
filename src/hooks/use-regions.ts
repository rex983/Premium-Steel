"use client";

import { useEffect, useState } from "react";

export interface Region {
  id: string;
  name: string;
  slug: string;
  states: string[];
  is_active: boolean;
}

export function useRegions() {
  const [regions, setRegions] = useState<Region[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/regions")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setRegions(data.regions);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return { regions, loading, error };
}
