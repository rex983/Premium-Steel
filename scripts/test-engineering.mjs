#!/usr/bin/env node
/**
 * Targeted test of the snow-engineering lookups.
 *
 * Runs several input combinations against both workbooks and prints the
 * resulting engineering breakdown so we can compare against the spreadsheet.
 *
 *   1. South @ saved cached state (60GL/IN/30×50×15) — should match cached F52=36
 *      and ~$4371.50 engineering.
 *   2. South @ 30GL/30×50×15 — user's repro: F52=60, engineering=$0.
 *   3. South @ 60GL/IN/40×50×15 — wider building.
 *   4. South @ 30GL/IN/30×50×12 — shorter leg.
 *   5. North @ 30GL/MI/24×50×12 — saved cached state (north).
 *   6. North @ 60GL/MI/24×50×12 — flip snow load high.
 *
 * Usage: npx tsx scripts/test-engineering.mjs
 */
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const FILES = {
  south: "C:/Users/Redir/Downloads/IN OH KY IL TN WV MO 1_26_26.xlsx",
  north: "C:/Users/Redir/Downloads/MI WI PA MN 1_26_26.xlsx",
};

const baseConfig = {
  gauge: "14g", roofStyle: "A-Frame Vertical",
  sides: "Fully Enclosed", ends: "Enclosed Ends",
  sidesPanel: "Vertical", endsPanel: "Vertical",
  sidesQty: 2, endsQty: 2,
  rollUpDoors: [], walkInDoors: [], windows: [],
  anchorType: "Concrete", windWarranty: "105 MPH Wind Warranty",
  insulation: "", insulationType: "",
  pitch: 0, pitchUnit: "12P",
  overhang: "",
  windMph: 105,
  promoTier: "No Promotional Sale",
  taxPct: 0.07,
};

const CASES = {
  south: [
    { label: "saved-cache (60GL, IN, 30×50×15)",     config: { ...baseConfig, width: 30, length: 50, height: 15, snowLoad: "60 Ground Load", state: "Indiana" } },
    { label: "user-repro (30GL, IN, 30×50×15)",      config: { ...baseConfig, width: 30, length: 50, height: 15, snowLoad: "30 Ground Load", state: "Indiana" } },
    { label: "wider (60GL, IN, 40×50×15)",            config: { ...baseConfig, width: 40, length: 50, height: 15, snowLoad: "60 Ground Load", state: "Indiana" } },
    { label: "short-leg (30GL, IN, 30×50×12)",        config: { ...baseConfig, width: 30, length: 50, height: 12, snowLoad: "30 Ground Load", state: "Indiana" } },
  ],
  north: [
    { label: "saved-cache (30GL, MI, 24×50×12)",     config: { ...baseConfig, width: 24, length: 50, height: 12, snowLoad: "30 Ground Load", state: "Michigan" } },
    { label: "elevated-snow (60GL, MI, 24×50×12)",    config: { ...baseConfig, width: 24, length: 50, height: 12, snowLoad: "60 Ground Load", state: "Michigan" } },
  ],
};

async function main() {
  const parserMod = await import(pathToFileURL(resolve(root, "src/lib/excel/parser.ts")).href);
  const engineMod = await import(pathToFileURL(resolve(root, "src/lib/pricing/engine.ts")).href);

  for (const [label, path] of Object.entries(FILES)) {
    if (!existsSync(path)) {
      console.log(`[${label}] FILE NOT FOUND at ${path}`);
      continue;
    }
    console.log(`\n=== ${label.toUpperCase()} (${path.split(/[\\/]/).pop()}) ===`);
    const buf = readFileSync(path);
    const parsed = parserMod.parsePsbWorkbook(buf, path.split(/[\\/]/).pop());
    if (!parsed.validation.ok) {
      console.log("  Parser FAILED:", parsed.validation.errors);
      continue;
    }
    console.log(`  Parsed OK · region=${parsed.matrices.region} · parserVersion=${parsed.matrices.parserVersion}`);

    for (const c of CASES[label] ?? []) {
      const result = engineMod.priceBuilding(c.config, parsed.matrices);
      const e = result.engineeringBreakdown;
      const t = result.totals;
      console.log(`\n  [${c.label}]`);
      console.log(`    Trusses     ${e.trussSpacing.padEnd(6)} orig=${String(e.originalTrusses).padStart(3)} extra=${String(e.extraTrussesNeeded).padStart(3)}  ${fmt(e.trussPrice)}`);
      console.log(`    HatChannels ${e.hatChannelSpacing.padEnd(6)} orig=${String(e.originalHatChannels).padStart(3)} extra=${String(e.extraChannelsNeeded).padStart(3)}  ${fmt(e.hatChannelPrice)}`);
      console.log(`    Girts       ${e.girtSpacing.padEnd(6)} orig=${String(e.originalGirts).padStart(3)} extra=${String(e.extraGirtsNeeded).padStart(3)}  ${fmt(e.girtPrice)}`);
      console.log(`    Verticals   ${e.verticalSpacing.padEnd(6)} orig=${String(e.originalVerticals).padStart(3)} extra=${String(e.extraVerticalsNeeded).padStart(3)}  ${fmt(e.verticalPrice)}`);
      console.log(`    => engineering=${fmt(e.totalEngineering)}  taxable=${fmt(t.totalTaxableSale)}  total=${fmt(t.total)}`);
    }
  }
}

function fmt(n) {
  if (typeof n !== "number") return String(n);
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

main().catch((err) => { console.error(err); process.exit(1); });
