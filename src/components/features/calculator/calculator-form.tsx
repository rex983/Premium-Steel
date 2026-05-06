"use client";

import { useEffect, useMemo, useState } from "react";
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
import { ChevronDown, Eye } from "lucide-react";
import {
  GAUGE_OPTIONS, ROOF_STYLES, SIDE_OPTIONS, END_OPTIONS,
  PANEL_ORIENTATIONS, PITCH_OPTIONS, SNOW_LOAD_OPTIONS,
} from "@/lib/pricing/constants";

const NONE = "__none__";

function Section({
  title,
  defaultOpen = true,
  contentClassName = "",
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  contentClassName?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none py-3"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">{title}</h3>
          <ChevronDown
            className={`h-4 w-4 text-muted-foreground transition-transform ${
              open ? "" : "-rotate-90"
            }`}
          />
        </div>
      </CardHeader>
      {open && <CardContent className={contentClassName}>{children}</CardContent>}
    </Card>
  );
}

export interface CalculatorFormProps {
  matrices: PSBPricingMatrices;
  regionId: string;
  defaultState?: string;
  taxPct?: number;
  onDepositPctChange?: (pct: number) => void;
}

const defaultConfig = (m: PSBPricingMatrices, state?: string): BuildingConfig => ({
  width: 12,
  length: 20,
  height: 8,
  gauge: "14g",
  roofStyle: "A-Frame Vertical",
  sides: "Fully Enclosed",
  ends: "Enclosed Ends",
  sidesPanel: "Horizontal",
  endsPanel: "Horizontal",
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
  windMph: 105,
  snowLoad: "30 Ground Load",
  state: state ?? m.meta.defaultStateLabel ?? "",
  promoTier: "No Promotional Sale",
  taxPct: 0,
  baseTrim: "0",
});

export function CalculatorForm({
  matrices,
  regionId,
  defaultState,
  taxPct,
  onDepositPctChange,
}: CalculatorFormProps) {
  const [config, setConfig] = useState<BuildingConfig>(() =>
    defaultConfig(matrices, defaultState)
  );

  const result = useMemo(
    () => priceBuilding({ ...config, taxPct: taxPct ?? config.taxPct ?? 0 }, matrices),
    [config, taxPct, matrices]
  );
  useEffect(() => {
    onDepositPctChange?.(result.totals.depositPct);
  }, [result.totals.depositPct, onDepositPctChange]);

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

  type RudEntry = BuildingConfig["rollUpDoors"][number];
  type DoorEntry = BuildingConfig["walkInDoors"][number];
  type WindowEntry = BuildingConfig["windows"][number];

  const setRud = (idx: number, patch: Partial<RudEntry>) => {
    setConfig((prev) => {
      const arr: RudEntry[] = [...prev.rollUpDoors];
      while (arr.length <= idx) arr.push({ size: "", qty: 0, position: "SIDE" });
      arr[idx] = { ...arr[idx], ...patch };
      return { ...prev, rollUpDoors: arr };
    });
  };
  const setWid = (idx: number, patch: Partial<DoorEntry>) => {
    setConfig((prev) => {
      const arr: DoorEntry[] = [...prev.walkInDoors];
      while (arr.length <= idx) arr.push({ size: "", qty: 0 });
      arr[idx] = { ...arr[idx], ...patch };
      return { ...prev, walkInDoors: arr };
    });
  };
  const setWin = (idx: number, patch: Partial<WindowEntry>) => {
    setConfig((prev) => {
      const arr: WindowEntry[] = [...prev.windows];
      while (arr.length <= idx) arr.push({ size: "", qty: 0 });
      arr[idx] = { ...arr[idx], ...patch };
      return { ...prev, windows: arr };
    });
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
        <Section title="Building Geometry" contentClassName="grid grid-cols-2 md:grid-cols-4 gap-3">
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
                {PITCH_OPTIONS.map((p) => (
                  <SelectItem key={p} value={String(p)}>
                    {p === 0 ? "Standard" : `${p}/12P`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs">Roof Overhang</Label>
            <Select
              value={config.overhang || NONE}
              onValueChange={(v) => update("overhang", v === NONE ? "" : v)}
            >
              <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                {(matrices.meta.overhangOptions ?? []).filter(Boolean).map((o) => (
                  <SelectItem key={o} value={o}>{o}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Section>

        <Section title="Walls" contentClassName="grid grid-cols-2 md:grid-cols-3 gap-3">
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

            <div className="space-y-1">
              <Label className="text-xs">Wainscot (Side)</Label>
              <Select
                value={config.wainscotSide || NONE}
                onValueChange={(v) =>
                  update("wainscotSide", v === NONE ? "" : v)
                }
              >
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  <SelectItem value="Side Wall">Side Wall</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Wainscot Side Qty</Label>
              <Select
                value={String(config.wainscotSideQty ?? 0)}
                onValueChange={(v) =>
                  update("wainscotSideQty", Number(v) as 0 | 1 | 2)
                }
                disabled={!config.wainscotSide}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0, 1, 2].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div />

            <div className="space-y-1">
              <Label className="text-xs">Wainscot (End)</Label>
              <Select
                value={config.wainscotEnd || NONE}
                onValueChange={(v) =>
                  update("wainscotEnd", v === NONE ? "" : v)
                }
              >
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  <SelectItem value="End Wall">End Wall</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Wainscot End Qty</Label>
              <Select
                value={String(config.wainscotEndQty ?? 0)}
                onValueChange={(v) =>
                  update("wainscotEndQty", Number(v) as 0 | 1 | 2)
                }
                disabled={!config.wainscotEnd}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0, 1, 2].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div />

            <div className="space-y-1 md:col-span-3">
              <Label className="text-xs">Base Trim</Label>
              <Select
                value={config.baseTrim || "0"}
                onValueChange={(v) => update("baseTrim", v)}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(matrices.accessories.baseTrim ?? [])
                    .filter((b) => b.label)
                    .map((b) => (
                      <SelectItem key={b.label} value={b.label}>{b.label}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
        </Section>

        <Section title="Roll Up Doors" contentClassName="space-y-3">
          {[0, 1, 2].map((idx) => {
            const entry = config.rollUpDoors[idx];
            const size = entry?.size ?? "";
            return (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-5 space-y-1">
                  <Label className="text-xs">Size</Label>
                  <Select
                    value={size || NONE}
                    onValueChange={(v) => setRud(idx, { size: v === NONE ? "" : v })}
                  >
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>—</SelectItem>
                      {matrices.accessories.rollUpDoors.map((d) => (
                        <SelectItem key={d.label} value={d.label}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-3 space-y-1">
                  <Label className="text-xs">Qty</Label>
                  <Input
                    type="number"
                    min={0}
                    value={entry?.qty ?? 0}
                    onChange={(e) => setRud(idx, { qty: Number(e.target.value) || 0 })}
                    disabled={!size}
                  />
                </div>
                <div className="col-span-4 space-y-1">
                  <Label className="text-xs">Position</Label>
                  <Select
                    value={entry?.position ?? "SIDE"}
                    onValueChange={(v) => setRud(idx, { position: v as "SIDE" | "END" })}
                    disabled={!size}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SIDE">Side</SelectItem>
                      <SelectItem value="END">End</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
        </Section>

        <Section title="Walk-In Doors & Windows" contentClassName="space-y-3">
          <div className="text-xs text-muted-foreground">Walk-In Doors</div>
          {[0, 1].map((idx) => {
            const entry = config.walkInDoors[idx];
            const size = entry?.size ?? "";
            return (
              <div key={`wid-${idx}`} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-8 space-y-1">
                  <Label className="text-xs">Size</Label>
                  <Select
                    value={size || NONE}
                    onValueChange={(v) => setWid(idx, { size: v === NONE ? "" : v })}
                  >
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>—</SelectItem>
                      {matrices.accessories.walkInDoors.map((d) => (
                        <SelectItem key={d.label} value={d.label}>{d.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-4 space-y-1">
                  <Label className="text-xs">Qty</Label>
                  <Input
                    type="number"
                    min={0}
                    value={entry?.qty ?? 0}
                    onChange={(e) => setWid(idx, { qty: Number(e.target.value) || 0 })}
                    disabled={!size}
                  />
                </div>
              </div>
            );
          })}

          <Separator />

          <div className="text-xs text-muted-foreground">Windows</div>
          {[0, 1].map((idx) => {
            const entry = config.windows[idx];
            const size = entry?.size ?? "";
            return (
              <div key={`win-${idx}`} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-8 space-y-1">
                  <Label className="text-xs">Size</Label>
                  <Select
                    value={size || NONE}
                    onValueChange={(v) => setWin(idx, { size: v === NONE ? "" : v })}
                  >
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>—</SelectItem>
                      {matrices.accessories.windows.map((w) => (
                        <SelectItem key={w.label} value={w.label}>{w.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-4 space-y-1">
                  <Label className="text-xs">Qty</Label>
                  <Input
                    type="number"
                    min={0}
                    value={entry?.qty ?? 0}
                    onChange={(e) => setWin(idx, { qty: Number(e.target.value) || 0 })}
                    disabled={!size}
                  />
                </div>
              </div>
            );
          })}
        </Section>

        <Section title="Anchors & Insulation" contentClassName="grid grid-cols-2 gap-3">
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
        </Section>

        <Section title="Engineering" contentClassName="grid grid-cols-2 gap-3">
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
        </Section>
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
