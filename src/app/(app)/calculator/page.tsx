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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function CalculatorPage() {
  const { regions, loading: regionsLoading, error: regionsError } = useRegions();
  const { stateDefaults, loading: stateLoading } = useStateDefaults();
  const [regionId, setRegionId] = useState<string | null>(null);
  const [stateCode, setStateCode] = useState<string>("");
  const [taxPct, setTaxPct] = useState<number>(0);
  const [depositPct, setDepositPct] = useState<number>(0.2);
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

  // Only show states belonging to the selected region.
  const visibleStateDefaults = regionId
    ? stateDefaults.filter((s) => s.region_id === regionId)
    : stateDefaults;

  // If the user switches region and the current state no longer belongs to it,
  // drop the stale stateCode so the picker doesn't show a phantom selection.
  useEffect(() => {
    if (!stateCode) return;
    if (!visibleStateDefaults.some((s) => s.state_code === stateCode)) {
      setStateCode("");
    }
  }, [regionId, visibleStateDefaults, stateCode]);

  const stateDefault = stateDefaults.find((s) => s.state_code === stateCode);

  return (
    <>
      <AppHeader title="Calculator" />
      <main className="flex-1 p-6 space-y-4">
        <Card>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6">
            <RegionPicker
              regions={regions}
              selectedRegionId={regionId}
              onChange={setRegionId}
            />
            <StatePicker
              states={visibleStateDefaults}
              value={stateCode}
              onChange={setStateCode}
            />
            <div className="space-y-1 max-w-sm">
              <Label htmlFor="taxPct" className="text-xs">Sales Tax (%)</Label>
              <Input
                id="taxPct"
                type="number"
                step={0.001}
                min={0}
                value={Number((taxPct * 100).toFixed(4))}
                onChange={(e) => {
                  const pct = Number(e.target.value);
                  setTaxPct(Number.isFinite(pct) ? pct / 100 : 0);
                }}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Deposit</Label>
              <p className="text-sm pt-2 font-medium">
                {(depositPct * 100).toFixed(0)}%
              </p>
              <p className="text-[10px] text-muted-foreground leading-tight">
                Auto-tiered: 20% under $30,000 · 22% at $30,000+
              </p>
            </div>
            {pricing && (
              <div className="col-span-2 md:col-span-4 text-xs text-muted-foreground -mt-1">
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
            taxPct={taxPct}
            onDepositPctChange={setDepositPct}
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
