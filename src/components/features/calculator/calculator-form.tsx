"use client";

import { useMemo, useState } from "react";
import type { BuildingConfig } from "@/lib/pricing/types";
import type { PSBPricingMatrices } from "@/types/pricing";
import { priceBuilding } from "@/lib/pricing/engine";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { TotalsPanel } from "./totals-panel";
import { EngineeringBreakdownPanel } from "./engineering-breakdown";
import { SaveQuoteDialog } from "./save-quote-dialog";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import {
  GAUGE_OPTIONS, ROOF_STYLES, SIDE_OPTIONS, END_OPTIONS,
  PANEL_ORIENTATIONS, PITCH_OPTIONS, SNOW_LOAD_OPTIONS, DEFAULT_WIND_MPH,
} from "@/lib/pricing/constants";

const NONE = "__none__";

export interface CalculatorFormProps {
  matrices: PSBPricingMatrices;
  regionId: string;
  defaultState?: string;
  defaultSnowLoad?: string;
  defaultWindMph?: number;
}

const defaultConfig = (m: PSBPricingMatrices, state?: string, snowLoad?: string, wind?: number): BuildingConfig => ({
  width: 30,
  length: 50,
  height: 15,
  gauge: "14g",
  roofStyle: "A-Frame Vertical",
  sides: "Fully Enclosed",
  ends: "Enclosed Ends",
  sidesPanel: "Vertical",
  endsPanel: "Vertical",
  sidesQty: 2,
  endsQty: 2,
  rollUpDoors: [],
  walkInDoors: [],
  windows: [],
  anchorType: "Concrete",
  windWarranty: "105 MPH Wind Warranty",
  insulation: "",
  insulationType: "",
  pitch: 0,
  pitchUnit: "12P",
  overhang: "",
  windMph: wind ?? m.meta.defaultWindMph ?? DEFAULT_WIND_MPH,
  snowLoad: snowLoad ?? m.meta.defaultSnowLoad ?? "30 Ground Load",
  state: state ?? m.meta.defaultStateLabel ?? "",
  promoTier: "No Promotional Sale",
  depositPct: 0.10,
  taxPct: 0.07,
});

export function CalculatorForm({ matrices, regionId, defaultState, defaultSnowLoad, defaultWindMph }: CalculatorFormProps) {
  const [config, setConfig] = useState<BuildingConfig>(() =>
    defaultConfig(matrices, defaultState, defaultSnowLoad, defaultWindMph)
  );

  const result = useMemo(() => priceBuilding(config, matrices), [config, matrices]);
  const [previewing, setPreviewing] = useState(false);

  const handlePreview = async () => {
    setPreviewing(true);
    try {
      const res = await fetch("/api/quotes/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        alert(j.error ?? "Failed to generate preview");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } finally {
      setPreviewing(false);
    }
  };

  const update = <K extends keyof BuildingConfig>(key: K, value: BuildingConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const numField = (key: keyof BuildingConfig, label: string, step = 1) => (
    <div className="space-y-1">
      <Label htmlFor={String(key)} className="text-xs">{label}</Label>
      <Input
        id={String(key)}
        type="number"
        step={step}
        value={String(config[key] ?? "")}
        onChange={(e) => update(key, Number(e.target.value) as BuildingConfig[typeof key])}
      />
    </div>
  );

  const selectField = <T extends string>(
    key: keyof BuildingConfig,
    label: string,
    options: readonly T[]
  ) => (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Select
        value={String(config[key] ?? "")}
        onValueChange={(v) => update(key, v as BuildingConfig[typeof key])}
      >
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>{o}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold">Building Geometry</h3>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {numField("width", "Width (ft)")}
            {numField("length", "Length (ft)")}
            {numField("height", "Leg Height (ft)")}
            {selectField("gauge", "Gauge", GAUGE_OPTIONS)}
            {selectField("roofStyle", "Roof Style", ROOF_STYLES)}
            <div className="space-y-1">
              <Label className="text-xs">Pitch</Label>
              <Select
                value={String(config.pitch)}
                onValueChange={(v) => update("pitch", Number(v) as BuildingConfig["pitch"])}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PITCH_OPTIONS.map((p) => <SelectItem key={p} value={String(p)}>{p}/12P</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold">Walls</h3>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {selectField("sides", "Sides", SIDE_OPTIONS)}
            {selectField("sidesPanel", "Sides Panel", PANEL_ORIENTATIONS)}
            <div className="space-y-1">
              <Label className="text-xs">Sides Qty</Label>
              <Select
                value={String(config.sidesQty)}
                onValueChange={(v) => update("sidesQty", Number(v) as 0 | 1 | 2)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0, 1, 2].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {selectField("ends", "Ends", END_OPTIONS)}
            {selectField("endsPanel", "Ends Panel", PANEL_ORIENTATIONS)}
            <div className="space-y-1">
              <Label className="text-xs">Ends Qty</Label>
              <Select
                value={String(config.endsQty)}
                onValueChange={(v) => update("endsQty", Number(v) as 0 | 1 | 2)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0, 1, 2].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold">Anchors & Insulation</h3>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Anchor Type</Label>
              <Select
                value={config.anchorType}
                onValueChange={(v) => update("anchorType", v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {matrices.anchors.packages.map((p) => (
                    <SelectItem key={p.label} value={p.label}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Wind Warranty</Label>
              <Select
                value={config.windWarranty}
                onValueChange={(v) => update("windWarranty", v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {matrices.anchors.windWarranties.map((p) => (
                    <SelectItem key={p.label} value={p.label}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Insulation</Label>
              <Select
                value={config.insulation || NONE}
                onValueChange={(v) => update("insulation", v === NONE ? "" : v)}
              >
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {Array.from(new Set(matrices.insulation.options.map((o) => o.label))).map((label) => (
                    <SelectItem key={label} value={label}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Insulation Coverage</Label>
              <Select
                value={config.insulationType || NONE}
                onValueChange={(v) => update("insulationType", v === NONE ? "" : v)}
              >
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  <SelectItem value="Roof Only">Roof Only</SelectItem>
                  <SelectItem value="Fully Insulated-Vertical">Fully Insulated</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="text-base font-semibold">Engineering</h3>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Snow Load</Label>
              <Select
                value={config.snowLoad}
                onValueChange={(v) => update("snowLoad", v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SNOW_LOAD_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {numField("windMph", "Wind (MPH)")}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <TotalsPanel result={result} />
        <EngineeringBreakdownPanel breakdown={result.engineeringBreakdown} />
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePreview} disabled={previewing}>
            <Eye className="h-4 w-4 mr-1" />
            {previewing ? "Generating…" : "Preview Quote"}
          </Button>
          <SaveQuoteDialog
            regionId={regionId}
            config={config}
            defaultCustomerState={config.state}
          />
        </div>
      </div>
    </div>
  );
}
