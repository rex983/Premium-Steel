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
import { ChevronDown, Eye } from "lucide-react";
import {
  GAUGE_OPTIONS, ROOF_STYLES, SIDE_OPTIONS, END_OPTIONS,
  PANEL_ORIENTATIONS, PITCH_OPTIONS, SNOW_LOAD_OPTIONS,
  WIDTH_OPTIONS, LENGTH_OPTIONS, HEIGHT_OPTIONS, SIDES_TO_QTY,
} from "@/lib/pricing/constants";

const NONE = "__none__";
const WIND_MPH_OPTIONS = Array.from({ length: 181 }, (_, w) => w);

function Section({
  title,
  defaultOpen = true,
  contentClassName = "",
  summary,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  contentClassName?: string;
  /** One-line recap shown under the title when collapsed. Blank string hides it. */
  summary?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card>
      <CardHeader
        className="cursor-pointer select-none py-3"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold">{title}</h3>
            {!open && summary && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{summary}</p>
            )}
          </div>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${
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
  /** User-picked promo tier label; overrides config.promoTier when provided. */
  promoTier?: string;
  /** Manual-discount % (0-1). Only consumed when promoTier is flagged isManual. */
  manualDiscount?: number;
  /** Deposit %. Overrides config.depositPct when provided. */
  depositPct?: number;
  /** Additional 25% deposit for special orders. Overrides config value when provided. */
  additionalDepositPct?: number;
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
  promoTier,
  manualDiscount,
  depositPct,
  additionalDepositPct,
}: CalculatorFormProps) {
  const [config, setConfig] = useState<BuildingConfig>(() =>
    defaultConfig(matrices, defaultState)
  );

  const result = useMemo(
    () => priceBuilding({
      ...config,
      taxPct: taxPct ?? config.taxPct ?? 0,
      promoTier: promoTier ?? config.promoTier,
      manualDiscount: manualDiscount ?? config.manualDiscount,
      depositPct: depositPct ?? config.depositPct,
      additionalDepositPct: additionalDepositPct ?? config.additionalDepositPct,
    }, matrices),
    [config, taxPct, promoTier, manualDiscount, depositPct, additionalDepositPct, matrices]
  );

  const [previewing, setPreviewing] = useState(false);

  const handlePreview = async () => {
    setPreviewing(true);
    const tab = window.open("", "_blank");
    if (tab) {
      tab.document.write(
        "<title>Generating preview…</title><p style='font-family:sans-serif;padding:24px'>Generating preview…</p>"
      );
    }
    try {
      const res = await fetch("/api/quotes/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ result }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        tab?.close();
        alert(j.error ?? "Failed to generate preview");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      if (tab) {
        tab.location.href = url;
      } else {
        const a = document.createElement("a");
        a.href = url;
        a.download = "quote-preview.pdf";
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } finally {
      setPreviewing(false);
    }
  };

  const update = <K extends keyof BuildingConfig>(key: K, value: BuildingConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const summaries = useMemo(() => {
    const s: Record<string, string> = {};

    const geo = [
      `${config.width}'W × ${config.length}'L × ${config.height}'H`,
      config.gauge?.toUpperCase(),
      config.roofStyle,
    ];
    if (config.pitch) geo.push(`${config.pitch}/12P`);
    if (config.overhang) geo.push(config.overhang);
    s.geometry = geo.filter(Boolean).join(" · ");

    const walls = [
      `${config.sides} (${config.sidesQty})`,
      `${config.ends} (${config.endsQty})`,
    ];
    if (config.wainscotSide) walls.push(`Wainscot Side ×${config.wainscotSideQty ?? 0}`);
    if (config.wainscotEnd) walls.push(`Wainscot End ×${config.wainscotEndQty ?? 0}`);
    if (config.baseTrim && config.baseTrim !== "0") walls.push(`Base ${config.baseTrim}`);
    s.walls = walls.join(" · ");

    const rud: string[] = [];
    config.rollUpDoors.forEach((d) => {
      if (d.qty > 0 && d.size) {
        rud.push(`${d.qty}× ${d.size} ${d.position === "END" ? "End" : "Side"}`);
      }
    });
    if (
      config.frameOuts &&
      config.frameOuts.qty > 0 &&
      config.frameOuts.width &&
      config.frameOuts.height
    ) {
      rud.push(
        `Frame Out ${config.frameOuts.qty}× ${config.frameOuts.width}'×${config.frameOuts.height}'`
      );
    }
    s.rud = rud.join(" · ");

    const wdw: string[] = [];
    config.walkInDoors.forEach((d) => {
      if (d.qty > 0 && d.size) wdw.push(`${d.qty}× WID ${d.size}`);
    });
    config.windows.forEach((w) => {
      if (w.qty > 0 && w.size) wdw.push(`${w.qty}× WIN ${w.size}`);
    });
    s.wdw = wdw.join(" · ");

    const anch = [config.anchorType, config.windWarranty].filter(Boolean) as string[];
    if (config.insulation) {
      anch.push(
        config.insulationType
          ? `${config.insulation} · ${config.insulationType}`
          : config.insulation
      );
    }
    s.anchors = anch.join(" · ");

    const upg: string[] = [];
    if (config.upgrade26ga) {
      upg.push(`26ga ${config.upgrade26gaCoverage ?? ""}`.trim());
    }
    if (config.premiumColor) {
      upg.push(`${config.premiumColor} ${config.premiumColorCoverage ?? ""}`.trim());
    }
    if (config.colorScrews) upg.push(config.colorScrews);
    s.upgrades = upg.join(" · ");

    s.gutter = config.gutterSide
      ? [config.gutterSide, config.gutterColor].filter(Boolean).join(" · ")
      : "";

    const trim: string[] = [];
    if (config.foamClosure) trim.push(config.foamClosure);
    if (config.extraSheetMetal && (config.extraSheetMetalQty ?? 0) > 0) {
      trim.push(`${config.extraSheetMetalQty}× ${config.extraSheetMetal}`);
    }
    if (config.jtrim && (config.jtrimQty ?? 0) > 0) {
      trim.push(`${config.jtrimQty}× ${config.jtrim}`);
    }
    s.trim = trim.join(" · ");

    s.labor = (config.laborFees ?? []).filter(Boolean).join(" · ");

    s.engineering = `${config.snowLoad} · ${config.windMph} MPH`;

    return s;
  }, [config]);

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
        <Section
          title="Building Geometry"
          contentClassName="grid grid-cols-2 md:grid-cols-4 gap-3"
          summary={summaries.geometry}
        >
          <div className="space-y-1">
            <Label className="text-xs">Width (ft)</Label>
            <Select
              value={String(config.width)}
              onValueChange={(v) => update("width", Number(v))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {WIDTH_OPTIONS.map((w) => (
                  <SelectItem key={w} value={String(w)}>{w}&apos;</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Length (ft)</Label>
            <Select
              value={String(config.length)}
              onValueChange={(v) => update("length", Number(v))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {LENGTH_OPTIONS.map((l) => (
                  <SelectItem key={l} value={String(l)}>{l}&apos;</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Leg Height (ft)</Label>
            <Select
              value={String(config.height)}
              onValueChange={(v) => update("height", Number(v))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {HEIGHT_OPTIONS.map((h) => (
                  <SelectItem key={h} value={String(h)}>{h}&apos;</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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

        <Section
          title="Walls"
          contentClassName="grid grid-cols-2 md:grid-cols-3 gap-3"
          defaultOpen={false}
          summary={summaries.walls}
        >
            <div className="space-y-1">
              <Label className="text-xs">Sides</Label>
              <Select
                value={config.sides}
                onValueChange={(v) => {
                  // Auto-couple sidesQty so "Open" doesn't accidentally price as
                  // fully enclosed if the user forgets to also flip qty to 0.
                  const qty = SIDES_TO_QTY[v] ?? config.sidesQty;
                  setConfig((prev) => ({ ...prev, sides: v, sidesQty: qty }));
                }}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SIDE_OPTIONS.map((o) => (
                    <SelectItem key={o} value={o}>{o}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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

        <Section
          title="Roll Up Doors & Frame Outs"
          contentClassName="space-y-3"
          defaultOpen={false}
          summary={summaries.rud}
        >
          <div className="text-xs text-muted-foreground">Roll Up Doors</div>
          {[0, 1, 2].map((idx) => {
            const entry = config.rollUpDoors[idx];
            const size = entry?.size ?? "";
            return (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end">
                <div className="col-span-4 space-y-1">
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
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Qty</Label>
                  <Input
                    type="number"
                    min={0}
                    value={entry?.qty ?? 0}
                    onChange={(e) => setRud(idx, { qty: Number(e.target.value) || 0 })}
                    disabled={!size}
                  />
                </div>
                <div className="col-span-3 space-y-1">
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
                <div className="col-span-3 space-y-1">
                  <Label className="text-xs">Seal</Label>
                  <Select
                    value={entry?.headerSeal || NONE}
                    onValueChange={(v) => setRud(idx, { headerSeal: v === NONE ? "" : v })}
                    disabled={!size}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>None</SelectItem>
                      <SelectItem value="Brush Seal Option">Brush</SelectItem>
                      <SelectItem value="Header Seal only Option">Header Only</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}

          <Separator />

          <div className="text-xs text-muted-foreground">Frame Outs</div>
          <div className="grid grid-cols-12 gap-2 items-end">
            <div className="col-span-3 space-y-1">
              <Label className="text-xs">Width</Label>
              <Select
                value={String(config.frameOuts?.width ?? "")}
                onValueChange={(v) => update("frameOuts", { ...(config.frameOuts ?? { width: 0, height: 0, qty: 0, position: "SIDE" }), width: Number(v) })}
              >
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {(matrices.accessories.frameOuts?.widths ?? []).filter((w) => w > 0).map((w) => (
                    <SelectItem key={w} value={String(w)}>{w}&apos;</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-3 space-y-1">
              <Label className="text-xs">Height</Label>
              <Select
                value={String(config.frameOuts?.height ?? "")}
                onValueChange={(v) => update("frameOuts", { ...(config.frameOuts ?? { width: 0, height: 0, qty: 0, position: "SIDE" }), height: Number(v) })}
                disabled={!config.frameOuts?.width}
              >
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {(matrices.accessories.frameOuts?.heights ?? []).map((h) => (
                    <SelectItem key={h} value={String(h)}>{h}&apos;</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs">Qty</Label>
              <Input
                type="number"
                min={0}
                value={config.frameOuts?.qty ?? 0}
                onChange={(e) => update("frameOuts", { ...(config.frameOuts ?? { width: 0, height: 0, qty: 0, position: "SIDE" }), qty: Number(e.target.value) || 0 })}
                disabled={!config.frameOuts?.width || !config.frameOuts?.height}
              />
            </div>
            <div className="col-span-4 space-y-1">
              <Label className="text-xs">Position</Label>
              <Select
                value={config.frameOuts?.position ?? "SIDE"}
                onValueChange={(v) => update("frameOuts", { ...(config.frameOuts ?? { width: 0, height: 0, qty: 0, position: "SIDE" }), position: v as "SIDE" | "END" })}
                disabled={!config.frameOuts?.qty}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="SIDE">Side</SelectItem>
                  <SelectItem value="END">End</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </Section>

        <Section
          title="Walk-In Doors & Windows"
          contentClassName="space-y-3"
          defaultOpen={false}
          summary={summaries.wdw}
        >
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

        <Section
          title="Anchors & Insulation"
          contentClassName="grid grid-cols-2 gap-3"
          defaultOpen={false}
          summary={summaries.anchors}
        >
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
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">
                Anchor Qty {/Anchors\s*Only/i.test(config.windWarranty ?? "")
                  ? "(applied)"
                  : "(auto-calculated by wind warranty mode)"}
              </Label>
              <Input
                type="number"
                min={0}
                value={config.anchorQty ?? 0}
                onChange={(e) => update("anchorQty", Number(e.target.value) || 0)}
                disabled={!/Anchors\s*Only/i.test(config.windWarranty ?? "")}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Insulation Material</Label>
              <Select
                value={config.insulation || NONE}
                onValueChange={(v) => update("insulation", v === NONE ? "" : v)}
              >
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {(matrices.insulation.materials ?? []).map((m) => (
                    <SelectItem key={m.label} value={m.label}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          <div className="space-y-1">
            <Label className="text-xs">Insulation Coverage</Label>
            <Select
              value={config.insulationType || NONE}
              onValueChange={(v) => update("insulationType", v === NONE ? "" : v)}
              disabled={!config.insulation}
            >
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>—</SelectItem>
                <SelectItem value="Vertical Roof Only">Vertical Roof Only</SelectItem>
                <SelectItem value="Fully Insulated-Vertical">Fully Insulated-Vertical</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </Section>

        <Section
          title="Upgrades"
          contentClassName="grid grid-cols-2 gap-3"
          defaultOpen={false}
          summary={summaries.upgrades}
        >
            <div className="space-y-1">
              <Label className="text-xs">26ga Panel Upgrade</Label>
              <Select
                value={config.upgrade26ga || NONE}
                onValueChange={(v) => update("upgrade26ga", v === NONE ? "" : v)}
              >
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {(matrices.accessories.upgrade26ga ?? []).map((p) => (
                    <SelectItem key={p.label} value={p.label}>{p.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">26ga Coverage</Label>
              <Select
                value={config.upgrade26gaCoverage || NONE}
                onValueChange={(v) => update("upgrade26gaCoverage", v === NONE ? "" : v)}
                disabled={!config.upgrade26ga}
              >
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  <SelectItem value="Roof Only">Roof Only</SelectItem>
                  <SelectItem value="Fully Enclosed">Fully Enclosed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Premium Color</Label>
              <Select
                value={config.premiumColor || NONE}
                onValueChange={(v) => update("premiumColor", v === NONE ? "" : v)}
              >
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {(matrices.accessories.premiumColors ?? []).map((c) => (
                    <SelectItem key={c.label} value={c.label}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Premium Color Coverage</Label>
              <Select
                value={config.premiumColorCoverage || NONE}
                onValueChange={(v) => update("premiumColorCoverage", v === NONE ? "" : v)}
                disabled={!config.premiumColor}
              >
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  <SelectItem value="Roof Only">Roof Only</SelectItem>
                  <SelectItem value="Fully Enclosed">Fully Enclosed</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Color Screws</Label>
              <Select
                value={config.colorScrews || NONE}
                onValueChange={(v) => update("colorScrews", v === NONE ? "" : v)}
              >
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {(matrices.accessories.colorScrews ?? []).map((c) => (
                    <SelectItem key={c.label} value={c.label}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
        </Section>

        <Section
          title='6&quot; K-style Gutter'
          contentClassName="grid grid-cols-2 gap-3"
          defaultOpen={false}
          summary={summaries.gutter}
        >
            <div className="space-y-1">
              <Label className="text-xs">Side</Label>
              <Select
                value={config.gutterSide || NONE}
                onValueChange={(v) => update("gutterSide", v === NONE ? "" : v)}
              >
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {(matrices.accessories.gutter?.sides ?? []).map((s) => (
                    <SelectItem key={s.label} value={s.label}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Color (display)</Label>
              <Select
                value={config.gutterColor || NONE}
                onValueChange={(v) => update("gutterColor", v === NONE ? "" : v)}
                disabled={!config.gutterSide}
              >
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>—</SelectItem>
                  {(matrices.accessories.gutter?.colors ?? []).map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
        </Section>

        <Section
          title="Trim & Closure"
          contentClassName="grid grid-cols-2 gap-3"
          defaultOpen={false}
          summary={summaries.trim}
        >
            <div className="space-y-1 col-span-2">
              <Label className="text-xs">Foam Closure</Label>
              <Select
                value={config.foamClosure || NONE}
                onValueChange={(v) => update("foamClosure", v === NONE ? "" : v)}
              >
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {matrices.accessories.foamClosure?.label && (
                    <SelectItem value={matrices.accessories.foamClosure.label}>
                      {matrices.accessories.foamClosure.label}
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Extra Sheet Metal</Label>
              <Select
                value={config.extraSheetMetal || NONE}
                onValueChange={(v) => update("extraSheetMetal", v === NONE ? "" : v)}
              >
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {(matrices.accessories.sheetMetal ?? []).filter((s) => s.price > 0).map((s) => (
                    <SelectItem key={s.label} value={s.label}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Sheet Metal Qty</Label>
              <Input
                type="number"
                min={0}
                value={config.extraSheetMetalQty ?? 0}
                onChange={(e) => update("extraSheetMetalQty", Number(e.target.value) || 0)}
                disabled={!config.extraSheetMetal}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">J-Trim</Label>
              <Select
                value={config.jtrim || NONE}
                onValueChange={(v) => update("jtrim", v === NONE ? "" : v)}
              >
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {(matrices.accessories.jtrim ?? []).filter((s) => s.price > 0).map((s) => (
                    <SelectItem key={s.label} value={s.label}>{s.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">J-Trim Qty</Label>
              <Input
                type="number"
                min={0}
                value={config.jtrimQty ?? 0}
                onChange={(e) => update("jtrimQty", Number(e.target.value) || 0)}
                disabled={!config.jtrim}
              />
            </div>
        </Section>

        <Section
          title="Labor Fees"
          contentClassName="space-y-3"
          defaultOpen={false}
          summary={summaries.labor}
        >
          {[0, 1].map((idx) => (
            <div key={idx} className="space-y-1">
              <Label className="text-xs">Labor Fee {idx + 1}</Label>
              <Select
                value={(config.laborFees?.[idx] ?? "") || NONE}
                onValueChange={(v) => {
                  const arr = [...(config.laborFees ?? [])];
                  while (arr.length <= idx) arr.push("");
                  arr[idx] = v === NONE ? "" : v;
                  update("laborFees", arr);
                }}
              >
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>None</SelectItem>
                  {(matrices.accessories.laborFees?.labels ?? []).map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </Section>

        <Section
          title="Engineering"
          contentClassName="grid grid-cols-2 gap-3"
          defaultOpen={false}
          summary={summaries.engineering}
        >
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
          <div className="space-y-1">
            <Label className="text-xs">Wind (MPH)</Label>
            <Select
              value={String(config.windMph)}
              onValueChange={(v) => update("windMph", Number(v))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {WIND_MPH_OPTIONS.map((w) => (
                  <SelectItem key={w} value={String(w)}>{w}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </Section>
      </div>

      <div className="space-y-4 lg:sticky lg:top-4 lg:self-start lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
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
