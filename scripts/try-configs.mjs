#!/usr/bin/env node
/**
 * Ad-hoc: price a handful of configs against both workbooks and print
 * a compact table you can eyeball against the browser calculator.
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const WORKBOOKS = {
  north: "C:/Users/Redir/Downloads/PSB - 01-26 -MI, WI, PA -07-26.xlsx",
  south: "C:/Users/Redir/Downloads/PSB -TX, IN, OH, KY, IL, TN, WV, -07-26.xlsx",
};

const BASE = {
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
  promoTier: "No Promotional Sale",
  depositPct: 0.10,
  taxPct: 0,
  baseTrim: "0",
};

const CASES = [
  { label: "A · 24×30×14 north 30GL",
    region: "north", state: "Michigan",
    over: { width: 24, length: 30, height: 14, snowLoad: "30 Ground Load" } },
  { label: "B · 30×40×18 north 30GL",
    region: "north", state: "Michigan",
    over: { width: 30, length: 40, height: 18, snowLoad: "30 Ground Load" } },
  { label: "C · 30×50×15 south 60GL",
    region: "south", state: "Indiana",
    over: { width: 30, length: 50, height: 15, snowLoad: "60 Ground Load" } },
  { label: "D · 26×60×12 south 40GL",
    region: "south", state: "Texas",
    over: { width: 26, length: 60, height: 12, snowLoad: "40 Ground Load" } },
  { label: "E · 30×20×16 north 30GL (regression)",
    region: "north", state: "Michigan",
    over: { width: 30, length: 20, height: 16, snowLoad: "30 Ground Load" } },
];

const parserMod = await import(pathToFileURL(resolve(root, "src/lib/excel/parser.ts")).href);
const engineMod = await import(pathToFileURL(resolve(root, "src/lib/pricing/engine.ts")).href);

const cache = {};
for (const [region, path] of Object.entries(WORKBOOKS)) {
  if (!existsSync(path)) { console.log(`MISSING: ${path}`); continue; }
  const parsed = parserMod.parsePsbWorkbook(readFileSync(path), path.split(/[\\/]/).pop());
  cache[region] = parsed.matrices;
}

const fmt = (n) => (n == null ? "—" : `$${Number(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const pad = (s, n) => String(s).padEnd(n);

for (const c of CASES) {
  const m = cache[c.region];
  if (!m) continue;
  const cfg = { ...BASE, ...c.over, state: c.state };
  const r = engineMod.priceBuilding(cfg, m);
  const e = r.engineeringBreakdown;
  const t = r.totals;
  console.log(`\n=== ${c.label} ===`);
  console.log(`  Config: ${cfg.width}×${cfg.length}×${cfg.height} · ${cfg.gauge.toUpperCase()} · ${cfg.snowLoad} · ${cfg.windMph}mph`);
  console.log(`  Sides: ${cfg.sides} (${cfg.sidesQty}) ${cfg.sidesPanel}   Ends: ${cfg.ends} (${cfg.endsQty}) ${cfg.endsPanel}`);
  console.log("  Engineering:");
  console.log(`    Trusses      +${e.extraTrussesNeeded} @ ${e.trussSpacing}   ${fmt(e.trussPrice)}`);
  console.log(`    Hat Channels +${e.extraChannelsNeeded} @ ${e.hatChannelSpacing}   ${fmt(e.hatChannelPrice)}`);
  console.log(`    Girts        +${e.extraGirtsNeeded} @ ${e.girtSpacing}   ${fmt(e.girtPrice)}`);
  console.log(`    Verticals    +${e.extraVerticalsNeeded} @ ${e.verticalSpacing}   ${fmt(e.verticalPrice)}`);
  console.log(`    TOTAL ENG:    ${fmt(e.totalEngineering)}`);
  console.log("  Totals:");
  console.log(`    Taxable:      ${fmt(t.totalTaxableSale)}`);
  console.log(`    Total:        ${fmt(t.total)}`);
  console.log(`    Deposit 10%:  ${fmt(t.depositAmount)}`);
  console.log(`    Balance:      ${fmt(t.balanceDue)}`);
}
