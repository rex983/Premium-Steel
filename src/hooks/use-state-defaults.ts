"use client";

import { useEffect, useState } from "react";

export interface StateDefault {
  state_code: string;
  region_id: string | null;
  default_snow_load: string;
  default_wind_mph: number;
}

export function useStateDefaults() {
  const [stateDefaults, setStateDefaults] = useState<StateDefault[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/state-defaults")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) setError(data.error);
        else setStateDefaults(data.stateDefaults);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  return { stateDefaults, loading, error };
}
