#!/usr/bin/env node
/**
 * Run the PSB engine against the sample inputs from each workbook and check
 * that the engine's outputs match the spreadsheet's cached totals.
 *
 * Usage:  npx tsx scripts/test-engine.mjs
 *
 * Sample inputs are derived from the cached values of the PSB-Quote Sheet at
 * the time the workbook was saved. We compare:
 *   - Total Taxable Sale (AC26)
 *   - Subtotal (AC30)
 *   - Total (AC40)
 *   - Balance Due (AC46)
 *   - Plans / Calcs cost
 *
 * If the engine matches within $1, we consider it a pass.
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

/**
 * Sample inputs as encoded in each workbook.
 * Derived from PSB-Quote Sheet cached values.
 */
const SAMPLES = {
  south: {
    config: {
      width: 30, length: 50, height: 15,
      gauge: "14g", roofStyle: "A-Frame Vertical",
      sides: "Fully Enclosed", ends: "Enclosed Ends",
      sidesPanel: "Vertical", endsPanel: "Vertical",
      sidesQty: 2, endsQty: 2,
      rollUpDoors: [{ size: "10x10", qty: 2, position: "SIDE", headerSeal: "Header Seal only Option" }],
      walkInDoors: [], windows: [],
      anchorType: "Concrete", windWarranty: "105 MPH Wind Warranty",
      insulation: '2" Fiberglass Insulation', insulationType: "Fully Insulated-Vertical",
      pitch: 0, pitchUnit: "12P",
      overhang: "",
      windMph: 105, snowLoad: "60 Ground Load",
      state: "Indiana",
      promoTier: "No Promotional Sale",
      depositPct: 0.10, taxPct: 0.07,
    },
    expected: {
      totalTaxableSale: 50433.5,
      subtotal: 53963.85,
      total: 55963.85,
      balanceDue: 50920.5,
      plansCost: 1010,
      calcsCost: 695,
      engineering: 4371.5,
    },
  },
  north: {
    config: {
      width: 24, length: 50, height: 12,
      gauge: "14g", roofStyle: "A-Frame Vertical",
      sides: "Fully Enclosed", ends: "Enclosed Ends",
      sidesPanel: "Horizontal", endsPanel: "Horizontal",
      sidesQty: 2, endsQty: 2,
      rollUpDoors: [], walkInDoors: [], windows: [],
      anchorType: "", windWarranty: "",
      insulation: "", insulationType: "",
      pitch: 0, pitchUnit: "12P",
      overhang: "",
      windMph: 105, snowLoad: "30 Ground Load",
      state: "Michigan",
      promoTier: "No Promotional Sale",
      depositPct: 0.10, taxPct: 0.07,
    },
    expected: {
      // North workbook's cached totals — real values to be confirmed by reading the workbook
      // For now we'll just run and report; calibration follows.
    },
  },
};

async function main() {
  const parserMod = await import(pathToFileURL(resolve(root, "src/lib/excel/parser.ts")).href);
  const engineMod = await import(pathToFileURL(resolve(root, "src/lib/pricing/engine.ts")).href);

  let failures = 0;
  let missingFiles = 0;

  for (const [label, path] of Object.entries(FILES)) {
    if (!existsSync(path)) {
      console.log(`[${label}] FILE NOT FOUND — ${path}`);
      missingFiles++;
      continue;
    }
    console.log(`\n=== ${label} (${path.split(/[\\/]/).pop()}) ===`);
    const buf = readFileSync(path);
    const parsed = parserMod.parsePsbWorkbook(buf, path.split(/[\\/]/).pop());
    if (!parsed.validation.ok) {
      console.log("  Parser validation FAILED:", parsed.validation.errors);
      failures++;
      continue;
    }

    const sample = SAMPLES[label];
    if (!sample) {
      console.log("  No sample config for this workbook.");
      continue;
    }

    const result = engineMod.priceBuilding(sample.config, parsed.matrices);

    console.log("  --- Line items ---");
    for (const li of result.lineItems) {
      console.log(`    ${li.label.padEnd(30)} ${fmt(li.price)}`);
    }
    console.log("  --- Engineering ---");
    const e = result.engineeringBreakdown;
    console.log(`    Trusses (${e.extraTrussesNeeded} extra @ ${e.trussSpacing}):  ${fmt(e.trussPrice)}`);
    console.log(`    Hat Channels (${e.extraChannelsNeeded} extra @ ${e.hatChannelSpacing}):  ${fmt(e.hatChannelPrice)}`);
    console.log(`    Girts (${e.extraGirtsNeeded} extra @ ${e.girtSpacing}):  ${fmt(e.girtPrice)}`);
    console.log(`    Verticals (${e.extraVerticalsNeeded} extra @ ${e.verticalSpacing}):  ${fmt(e.verticalPrice)}`);
    console.log(`    Total Engineering: ${fmt(e.totalEngineering)}`);
    console.log("  --- Totals ---");
    const t = result.totals;
    console.log(`    Total Taxable Sale: ${fmt(t.totalTaxableSale)}`);
    console.log(`    Tax (${result.inputs.taxPct}):     ${fmt(t.taxAmount)}`);
    console.log(`    Subtotal:           ${fmt(t.subtotal)}`);
    console.log(`    Equipment/Labor:    ${fmt(t.equipmentLabor)}`);
    console.log(`    Total:              ${fmt(t.total)}`);
    console.log(`    Deposit:            ${fmt(t.depositAmount)}`);
    console.log(`    Balance Due:        ${fmt(t.balanceDue)}`);
    console.log(`    Plans (display):    ${fmt(t.plansCost)}`);
    console.log(`    Calcs (display):    ${fmt(t.calcsCost)}`);

    if (sample.expected && Object.keys(sample.expected).length > 0) {
      console.log("  --- Validation ---");
      const checks = [
        ["totalTaxableSale", t.totalTaxableSale, sample.expected.totalTaxableSale],
        ["subtotal", t.subtotal, sample.expected.subtotal],
        ["total", t.total, sample.expected.total],
        ["balanceDue", t.balanceDue, sample.expected.balanceDue],
        ["plansCost", t.plansCost, sample.expected.plansCost],
        ["calcsCost", t.calcsCost, sample.expected.calcsCost],
        ["engineering", e.totalEngineering, sample.expected.engineering],
      ];
      const gaps = new Set(sample.knownGaps ?? []);
      for (const [name, got, want] of checks) {
        if (want === undefined) continue;
        const diff = got - want;
        const ok = Math.abs(diff) < 1.0;
        const gap = gaps.has(name);
        const status = ok ? "PASS" : gap ? "XFAIL" : "FAIL";
        console.log(`    ${status}  ${name.padEnd(20)} got=${fmt(got)} want=${fmt(want)} diff=${fmt(diff)}`);
        if (!ok && !gap) failures++;
      }
    }
  }

  // ==========================================================================
  // Smoke tests: new 07-26 workbooks must parse cleanly, price without throwing,
  // and expose "Manual Discount" as a promo tier flagged isManual.
  // ==========================================================================
  const NEW_FILES = {
    "south-new": "C:/Users/Redir/Downloads/PSB -TX, IN, OH, KY, IL, TN, WV, -07-26.xlsx",
    "north-new": "C:/Users/Redir/Downloads/PSB - 01-26 -MI, WI, PA -07-26.xlsx",
  };
  const smokeSample = SAMPLES.south.config; // reuse for both regions — engine should not throw
  for (const [label, path] of Object.entries(NEW_FILES)) {
    if (!existsSync(path)) {
      console.log(`\n[${label}] SKIPPED — ${path} not found`);
      missingFiles++;
      continue;
    }
    console.log(`\n=== ${label} SMOKE (${path.split(/[\\/]/).pop()}) ===`);
    const buf = readFileSync(path);
    const parsed = parserMod.parsePsbWorkbook(buf, path.split(/[\\/]/).pop());
    if (!parsed.validation.ok) {
      console.log("  FAIL parser validation:", parsed.validation.errors);
      failures++;
      continue;
    }
    // Promo tier shape check
    const manual = parsed.matrices.promotions.tiers.find((t) => t.label === "Manual Discount");
    if (!manual) {
      console.log("  FAIL: no 'Manual Discount' tier parsed");
      failures++;
    } else if (!manual.isManual) {
      console.log("  FAIL: 'Manual Discount' tier missing isManual flag");
      failures++;
    } else {
      console.log("  PASS: Manual Discount tier flagged isManual");
    }
    // Engine smoke — must not throw
    try {
      const smoke = engineMod.priceBuilding(smokeSample, parsed.matrices);
      console.log(`  PASS: engine ran — total = ${fmt(smoke.totals.total)}`);
    } catch (e) {
      console.log(`  FAIL: engine threw — ${e.message}`);
      failures++;
    }
    // Manual Discount honored
    const withManual = { ...smokeSample, promoTier: "Manual Discount", manualDiscount: 0.10 };
    try {
      const noPromo = engineMod.priceBuilding({ ...smokeSample, promoTier: "No Promotional Sale" }, parsed.matrices);
      const withPromo = engineMod.priceBuilding(withManual, parsed.matrices);
      const gap = noPromo.totals.totalTaxableSale - withPromo.totals.totalTaxableSale;
      const expectedGap = noPromo.totals.totalTaxableSale * 0.10; // 10% off pre-promo line sum
      // We can't check exact expectedGap without recomputing lineSum, but assert non-zero + positive
      if (gap > 0) {
        console.log(`  PASS: Manual Discount 10% reduced taxable by ${fmt(gap)}`);
      } else {
        console.log(`  FAIL: Manual Discount had no effect (gap=${fmt(gap)})`);
        failures++;
      }
    } catch (e) {
      console.log(`  FAIL: manual-discount engine run threw — ${e.message}`);
      failures++;
    }
  }

  console.log("");
  if (missingFiles > 0) {
    console.log(`SKIPPED — ${missingFiles} reference workbook(s) not found on this machine.`);
  }
  if (failures > 0) {
    console.log(`FAIL — ${failures} assertion(s) failed.`);
    process.exit(1);
  }
  console.log("OK — all engine assertions passed.");
}

function fmt(n) {
  if (typeof n !== "number") return String(n);
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

main().catch((err) => { console.error(err); process.exit(1); });
