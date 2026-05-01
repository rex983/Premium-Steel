"use client";

import { useEffect, useState } from "react";
import { AppHeader } from "@/components/layout/app-header";
import { useRegions } from "@/hooks/use-regions";
import { useStateDefaults } from "@/hooks/use-state-defaults";
import { usePricing } from "@/hooks/use-pricing";
import { CalculatorForm } from "@/components/features/calculator/calculator-form";
import { RegionPicker } from "@/components/features/calculator/region-picker";
import { StatePicker } from "@/components/features/calculator/state-picker";
import { Card, CardContent } from "@/components/ui/card";

export default function CalculatorPage() {
  const { regions, loading: regionsLoading, error: regionsError } = useRegions();
  const { stateDefaults, loading: stateLoading } = useStateDefaults();
  const [regionId, setRegionId] = useState<string | null>(null);
  const [stateCode, setStateCode] = useState<string>("");
  const { pricing, loading: pricingLoading, error: pricingError } = usePricing(regionId);

  // Auto-pick first region once regions load
  useEffect(() => {
    if (!regionId && regions.length > 0) setRegionId(regions[0].id);
  }, [regionId, regions]);

  // When state changes, ensure the region matches
  useEffect(() => {
    if (!stateCode) return;
    const sd = stateDefaults.find((s) => s.state_code === stateCode);
    if (sd?.region_id && sd.region_id !== regionId) setRegionId(sd.region_id);
  }, [stateCode, stateDefaults, regionId]);

  const stateDefault = stateDefaults.find((s) => s.state_code === stateCode);

  return (
    <>
      <AppHeader title="Calculator" />
      <main className="flex-1 p-6 space-y-4">
        <Card>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-6">
            <RegionPicker
              regions={regions}
              selectedRegionId={regionId}
              onChange={setRegionId}
            />
            <StatePicker
              states={stateDefaults}
              value={stateCode}
              onChange={setStateCode}
            />
            {pricing && (
              <div className="text-xs text-muted-foreground self-end pb-2">
                Pricing version {pricing.version} loaded
              </div>
            )}
          </CardContent>
        </Card>

        {regionsError && <ErrorBox msg={regionsError} hint="Could not load regions. Did you apply the migration and seed data?" />}
        {pricingError && <ErrorBox msg={pricingError} hint="Could not load pricing." />}
        {regionId && !pricing && !pricingLoading && (
          <ErrorBox
            msg="No pricing snapshot for this region."
            hint="Upload a PSB workbook for this region in Admin → Upload Pricing."
          />
        )}

        {pricing && pricing.matrices && regionId && (
          <CalculatorForm
            matrices={pricing.matrices}
            regionId={regionId}
            defaultState={stateDefault ? stateLabel(stateDefault.state_code) : undefined}
            defaultSnowLoad={stateDefault?.default_snow_load}
            defaultWindMph={stateDefault?.default_wind_mph}
            // Force a remount when region/state changes so defaults reset cleanly
            key={`${regionId}|${stateCode}|${pricing.id}`}
          />
        )}

        {(regionsLoading || stateLoading || pricingLoading) && !pricing && (
          <div className="text-sm text-muted-foreground">Loading…</div>
        )}
      </main>
    </>
  );
}

function ErrorBox({ msg, hint }: { msg: string; hint?: string }) {
  return (
    <div className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm">
      <div className="font-medium text-destructive">{msg}</div>
      {hint && <div className="text-muted-foreground mt-1">{hint}</div>}
    </div>
  );
}

function stateLabel(code: string): string {
  const map: Record<string, string> = {
    IN: "Indiana", OH: "Ohio", IL: "Illinois", KY: "Kentucky", TN: "Tennessee",
    MO: "Missouri", WV: "West Virginia",
    MI: "Michigan", WI: "Wisconsin", PA: "Pennsylvania", MN: "Minnesota",
  };
  return map[code] ?? code;
}
