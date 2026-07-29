#!/usr/bin/env node
/**
 * Full engine + parser smoke suite against the 07-26 workbook batch.
 *
 * For each region:
 *   1. Parse the workbook, confirm validation ok + parserVersion current
 *   2. Sweep dozens of building configs
 *   3. Check per-config invariants (no NaN, deposit math, tax math, non-neg)
 *   4. Check cross-config invariants (bigger > smaller, 12g > 14g, enclosed > open)
 *   5. Exercise all promo tiers + manualDiscount + additionalDepositPct
 *
 * Reports FAIL for any invariant break with the exact config triggering it,
 * exits non-zero on any failure.
 */
import { readFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const FILES = {
  south: "C:/Users/Redir/Downloads/PSB -TX, IN, OH, KY, IL, TN, WV, -07-26.xlsx",
  north: "C:/Users/Redir/Downloads/PSB - 01-26 -MI, WI, PA -07-26.xlsx",
};

const STATES_BY_REGION = {
  south: ["Indiana", "Ohio", "Kentucky", "Illinois", "Tennessee", "West Virginia", "Texas"],
  north: ["Michigan", "Wisconsin", "Pennsylvania"],
};

const parserMod = await import(pathToFileURL(resolve(root, "src/lib/excel/parser.ts")).href);
const engineMod = await import(pathToFileURL(resolve(root, "src/lib/pricing/engine.ts")).href);

let failures = 0;
const failList = [];
function fail(desc, ctx) {
  failures++;
  failList.push({ desc, ctx });
  console.log(`  FAIL  ${desc}`);
  if (ctx) console.log(`         ${JSON.stringify(ctx)}`);
}
function ok(desc) {
  console.log(`  PASS  ${desc}`);
}
function fmt(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return String(n);
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** Base config template — small building, minimal accessories. */
function base(state, region) {
  const isNorth = region === "north";
  return {
    width: 30, length: 50, height: 12,
    gauge: "14g", roofStyle: "A-Frame Vertical",
    sides: "Fully Enclosed", ends: "Enclosed Ends",
    sidesPanel: "Vertical", endsPanel: "Vertical",
    sidesQty: 2, endsQty: 2,
    rollUpDoors: [], walkInDoors: [], windows: [],
    anchorType: "Concrete", windWarranty: "105 MPH Wind Warranty",
    insulation: "", insulationType: "",
    pitch: 0, pitchUnit: "12P",
    overhang: "",
    windMph: 105, snowLoad: isNorth ? "30 Ground Load" : "60 Ground Load",
    state,
    promoTier: "No Promotional Sale",
    depositPct: 0.10, taxPct: 0.07,
  };
}

/** Check per-config invariants — return count of new failures. */
function checkInvariants(label, cfg, out) {
  const t = out.totals;
  const before = failures;

  // No NaN / non-finite
  const scan = { ...t, ...out.engineeringBreakdown };
  for (const [k, v] of Object.entries(scan)) {
    if (typeof v === "number" && !Number.isFinite(v)) fail(`${label}: ${k} is not finite (${v})`, { cfg });
  }
  for (const li of out.lineItems) {
    if (!Number.isFinite(li.price)) fail(`${label}: line ${li.key} has non-finite price`, { cfg });
    if (li.price < 0 && li.key !== "promo") fail(`${label}: line ${li.key} negative (${li.price})`, { cfg });
  }

  // Deposit math: deposit == taxable × depositPct (within $0.02)
  const expectedDep = Math.round(t.totalTaxableSale * cfg.depositPct * 100) / 100;
  if (Math.abs(t.depositAmount - expectedDep) > 0.02) {
    fail(`${label}: deposit ${fmt(t.depositAmount)} != taxable×${cfg.depositPct} = ${fmt(expectedDep)}`, { cfg });
  }

  // Tax math: subtotal == taxable × (1 + taxPct)
  const expectedSub = Math.round(t.totalTaxableSale * (1 + cfg.taxPct) * 100) / 100;
  if (Math.abs(t.subtotal - expectedSub) > 0.02) {
    fail(`${label}: subtotal ${fmt(t.subtotal)} != expected ${fmt(expectedSub)}`, { cfg });
  }

  // Balance = total - deposit - additionalDeposit
  const addlDep = t.additionalDepositAmount ?? 0;
  const expectedBal = Math.round((t.total - t.depositAmount - addlDep) * 100) / 100;
  if (Math.abs(t.balanceDue - expectedBal) > 0.02) {
    fail(`${label}: balance ${fmt(t.balanceDue)} != expected ${fmt(expectedBal)}`, { cfg });
  }

  // Taxable > 0 for any non-empty build
  if (t.totalTaxableSale <= 0) {
    fail(`${label}: taxable is 0 or negative`, { cfg });
  }

  return failures - before;
}

for (const [region, path] of Object.entries(FILES)) {
  console.log(`\n${"=".repeat(70)}\n${region.toUpperCase()}\n${"=".repeat(70)}`);
  if (!existsSync(path)) { fail(`workbook missing: ${path}`); continue; }
  const buf = readFileSync(path);
  const parsed = parserMod.parsePsbWorkbook(buf, path.split(/[\\/]/).pop());

  // ---- 1. Parser sanity ----
  console.log("\n[1] Parser sanity");
  if (!parsed.validation.ok) fail("parser validation errors", parsed.validation.errors);
  else ok("validation ok");
  if (parsed.matrices.parserVersion !== "0.6.0") fail(`parserVersion ${parsed.matrices.parserVersion} != 0.6.0`);
  else ok("parserVersion = 0.6.0");
  if (parsed.matrices.region !== region) fail(`region ${parsed.matrices.region} != ${region}`);
  else ok(`region correctly detected as ${region}`);

  const promos = parsed.matrices.promotions.tiers.map((t) => t.label);
  const expectedPromos = ["PSB-August Promotion 20%", "PSB - Exclusive discount 25%", "No Promotional Sale", "Manual Discount"];
  for (const p of expectedPromos) {
    if (!promos.includes(p)) fail(`missing promo tier: ${p}`);
  }
  const manual = parsed.matrices.promotions.tiers.find((t) => t.label === "Manual Discount");
  if (!manual?.isManual) fail("Manual Discount not flagged isManual");
  else ok("Manual Discount flagged isManual");

  // ---- 2. Per-state sanity ----
  console.log("\n[2] Per-state basic run");
  for (const state of STATES_BY_REGION[region]) {
    const cfg = base(state, region);
    const out = engineMod.priceBuilding(cfg, parsed.matrices);
    checkInvariants(`${region}/${state}`, cfg, out);
    console.log(`     ${state.padEnd(15)} → taxable=${fmt(out.totals.totalTaxableSale)}  total=${fmt(out.totals.total)}  eng=${fmt(out.engineeringBreakdown.totalEngineering)}  labor=${fmt(out.totals.equipmentLabor)}`);
  }

  // ---- 3. Geometry sweep — only WIDTHS supported by the workbook (12-30 in the
  //          Pricing - Base header row). Widths outside this range have no base
  //          price and would silently zero-fill; that's a separate concern (see [12]).
  console.log("\n[3] Geometry sweep (width × length × height, IN)");
  const geoState = region === "south" ? "Indiana" : "Michigan";
  const widths = [12, 20, 30];
  const lengths = [20, 50, 100];
  const heights = [6, 10, 15, 20];
  const results = [];
  for (const w of widths) for (const l of lengths) for (const h of heights) {
    const cfg = { ...base(geoState, region), width: w, length: l, height: h };
    const out = engineMod.priceBuilding(cfg, parsed.matrices);
    checkInvariants(`geo ${w}×${l}×${h}`, cfg, out);
    results.push({ w, l, h, taxable: out.totals.totalTaxableSale });
  }
  ok(`${results.length} geometry configs priced without invariant break`);

  // Monotonicity: at fixed L/H, wider building should cost more
  const monoFailsBefore = failures;
  for (const l of lengths) for (const h of heights) {
    const slice = results.filter((r) => r.l === l && r.h === h).sort((a, b) => a.w - b.w);
    for (let i = 1; i < slice.length; i++) {
      if (slice[i].taxable < slice[i - 1].taxable) {
        fail(`width monotonicity broken at L=${l} H=${h}: W=${slice[i - 1].w}→${slice[i].w} taxable dropped ${fmt(slice[i - 1].taxable)}→${fmt(slice[i].taxable)}`);
      }
    }
  }
  if (failures === monoFailsBefore) ok("width monotonicity (bigger width → higher taxable) holds across all L/H");

  // ---- 4. Gauge + roof style + panel orientations ----
  console.log("\n[4] Gauge + roof style + panels");
  const c14 = engineMod.priceBuilding({ ...base(geoState, region), gauge: "14g" }, parsed.matrices);
  const c12 = engineMod.priceBuilding({ ...base(geoState, region), gauge: "12g" }, parsed.matrices);
  if (c12.totals.totalTaxableSale <= c14.totals.totalTaxableSale) fail("12g not more expensive than 14g", { c14: c14.totals.totalTaxableSale, c12: c12.totals.totalTaxableSale });
  else ok(`12g > 14g by ${fmt(c12.totals.totalTaxableSale - c14.totals.totalTaxableSale)}`);

  const rV = engineMod.priceBuilding({ ...base(geoState, region), roofStyle: "A-Frame Vertical" }, parsed.matrices);
  const rH = engineMod.priceBuilding({ ...base(geoState, region), roofStyle: "A-Frame Horizontal" }, parsed.matrices);
  checkInvariants("roofstyle V", base(geoState, region), rV);
  checkInvariants("roofstyle H", base(geoState, region), rH);
  ok(`roof styles priced: V=${fmt(rV.totals.total)} H=${fmt(rH.totals.total)}`);

  // ---- 5. Sides / Ends variants — engine reads sidesQty (0/1/2), not the sides
  //          string, so we vary qty to exercise the price ladder.
  console.log("\n[5] Sides / Ends variants (via qty 0/1/2)");
  const both = engineMod.priceBuilding({ ...base(geoState, region), sidesQty: 2 }, parsed.matrices);
  const one = engineMod.priceBuilding({ ...base(geoState, region), sidesQty: 1 }, parsed.matrices);
  const zero = engineMod.priceBuilding({ ...base(geoState, region), sidesQty: 0 }, parsed.matrices);
  if (!(both.totals.totalTaxableSale > one.totals.totalTaxableSale && one.totals.totalTaxableSale > zero.totals.totalTaxableSale)) {
    fail("sidesQty price ladder broken", {
      qty2: both.totals.totalTaxableSale,
      qty1: one.totals.totalTaxableSale,
      qty0: zero.totals.totalTaxableSale,
    });
  } else {
    ok(`qty=2 > qty=1 > qty=0: ${fmt(both.totals.totalTaxableSale)} > ${fmt(one.totals.totalTaxableSale)} > ${fmt(zero.totals.totalTaxableSale)}`);
  }

  // ---- 6. Roll-up doors sweep ----
  console.log("\n[6] Roll-up doors");
  for (const size of ["6x6", "8x8", "10x10", "12x12"]) {
    for (const position of ["SIDE", "END"]) {
      const cfg = { ...base(geoState, region), rollUpDoors: [{ size, qty: 2, position, headerSeal: "Header Seal only Option" }] };
      const out = engineMod.priceBuilding(cfg, parsed.matrices);
      checkInvariants(`rud ${size} ${position}`, cfg, out);
    }
  }
  ok("all RUD sizes × positions priced without invariant break");

  // ---- 7. Anchors + insulation ----
  console.log("\n[7] Anchors + insulation");
  const anchorTypes = (parsed.matrices.anchors?.packages ?? []).map((a) => a.label).filter(Boolean);
  for (const at of anchorTypes.slice(0, 5)) {
    const cfg = { ...base(geoState, region), anchorType: at };
    const out = engineMod.priceBuilding(cfg, parsed.matrices);
    checkInvariants(`anchor ${at}`, cfg, out);
  }
  if (anchorTypes.length === 0) fail("no anchor types parsed");
  else ok(`priced ${Math.min(5, anchorTypes.length)} anchor types (of ${anchorTypes.length})`);

  const cfgIns = { ...base(geoState, region), insulation: '2" Fiberglass Insulation', insulationType: "Fully Insulated-Vertical" };
  const noIns = engineMod.priceBuilding(base(geoState, region), parsed.matrices);
  const withIns = engineMod.priceBuilding(cfgIns, parsed.matrices);
  checkInvariants("insulation", cfgIns, withIns);
  if (withIns.totals.totalTaxableSale <= noIns.totals.totalTaxableSale) {
    fail("insulation didn't increase price", { no: noIns.totals.totalTaxableSale, yes: withIns.totals.totalTaxableSale });
  } else ok(`insulation adds ${fmt(withIns.totals.totalTaxableSale - noIns.totals.totalTaxableSale)}`);

  // ---- 8. Snow load sweep (drives engineering) ----
  console.log("\n[8] Snow load sweep");
  const snowLoads = ["30 Ground Load", "60 Ground Load", "90 Ground Load"];
  const engResults = [];
  for (const sl of snowLoads) {
    const cfg = { ...base(geoState, region), snowLoad: sl, height: 15 };
    const out = engineMod.priceBuilding(cfg, parsed.matrices);
    checkInvariants(`snow ${sl}`, cfg, out);
    engResults.push({ sl, eng: out.engineeringBreakdown.totalEngineering });
    console.log(`     ${sl.padEnd(20)} → engineering=${fmt(out.engineeringBreakdown.totalEngineering)}`);
  }
  // Engineering should generally increase with snow load
  for (let i = 1; i < engResults.length; i++) {
    if (engResults[i].eng < engResults[i - 1].eng) {
      console.log(`     WARN engineering not monotone: ${engResults[i - 1].sl} $${engResults[i - 1].eng} → ${engResults[i].sl} $${engResults[i].eng}`);
    }
  }

  // ---- 9. Promo tiers ----
  console.log("\n[9] Promo tiers");
  const bigCfg = { ...base(geoState, region), width: 40, length: 100, height: 15 }; // big build for >$20k
  const noPromo = engineMod.priceBuilding({ ...bigCfg, promoTier: "No Promotional Sale" }, parsed.matrices);
  for (const p of ["PSB-August Promotion 20%", "PSB - Exclusive discount 25%"]) {
    const withP = engineMod.priceBuilding({ ...bigCfg, promoTier: p }, parsed.matrices);
    if (withP.totals.totalTaxableSale >= noPromo.totals.totalTaxableSale) {
      fail(`promo "${p}" did not reduce taxable`, { no: noPromo.totals.totalTaxableSale, yes: withP.totals.totalTaxableSale });
    } else {
      ok(`promo "${p}": taxable dropped by ${fmt(noPromo.totals.totalTaxableSale - withP.totals.totalTaxableSale)}`);
    }
  }
  // Manual discount
  for (const md of [0.05, 0.15]) {
    const withMD = engineMod.priceBuilding({ ...bigCfg, promoTier: "Manual Discount", manualDiscount: md }, parsed.matrices);
    if (withMD.totals.totalTaxableSale >= noPromo.totals.totalTaxableSale) {
      fail(`Manual Discount ${md * 100}% did not reduce taxable`);
    } else {
      ok(`Manual Discount ${(md * 100).toFixed(0)}%: taxable dropped by ${fmt(noPromo.totals.totalTaxableSale - withMD.totals.totalTaxableSale)}`);
    }
  }
  // Manual discount = 0 should equal no promo
  const md0 = engineMod.priceBuilding({ ...bigCfg, promoTier: "Manual Discount", manualDiscount: 0 }, parsed.matrices);
  if (Math.abs(md0.totals.totalTaxableSale - noPromo.totals.totalTaxableSale) > 0.02) {
    fail("Manual Discount 0% didn't equal No Promo", { md0: md0.totals.totalTaxableSale, noPromo: noPromo.totals.totalTaxableSale });
  } else ok("Manual Discount 0% == No Promotional Sale");

  // ---- 10. Additional deposit toggle ----
  console.log("\n[10] Additional deposit");
  const noAddl = engineMod.priceBuilding(base(geoState, region), parsed.matrices);
  const withAddl = engineMod.priceBuilding({ ...base(geoState, region), additionalDepositPct: 0.25 }, parsed.matrices);
  const expectedAddl = Math.round(noAddl.totals.totalTaxableSale * 0.25 * 100) / 100;
  if (Math.abs(withAddl.totals.additionalDepositAmount - expectedAddl) > 0.02) {
    fail("additional deposit math wrong", { got: withAddl.totals.additionalDepositAmount, want: expectedAddl });
  } else {
    ok(`additional deposit 25% = ${fmt(withAddl.totals.additionalDepositAmount)} (taxable × 0.25)`);
  }
  const expectedBalWithAddl = Math.round((withAddl.totals.total - withAddl.totals.depositAmount - withAddl.totals.additionalDepositAmount) * 100) / 100;
  if (Math.abs(withAddl.totals.balanceDue - expectedBalWithAddl) > 0.02) {
    fail("balance with additional deposit wrong");
  } else ok("balance = total - deposit - additionalDeposit");

  // ---- 12. Out-of-range widths (documented current behavior: base price = $0) ----
  console.log("\n[12] Out-of-range widths (documenting silent-zero)");
  for (const w of [40, 50]) {
    const cfg = { ...base(geoState, region), width: w };
    const out = engineMod.priceBuilding(cfg, parsed.matrices);
    const baseLine = out.lineItems.find((l) => l.key === "base");
    console.log(`     width=${w}: base line = ${fmt(baseLine?.price ?? 0)}  taxable=${fmt(out.totals.totalTaxableSale)}`);
    if ((baseLine?.price ?? 0) !== 0) {
      console.log(`     NOTE: width=${w} now has a base price — spreadsheet coverage expanded?`);
    }
  }
  console.log("     (Engine silently returns $0 for unsupported widths — UI should validate.)");

  // ---- 11. Edge cases ----
  console.log("\n[11] Edge cases");
  // Minimum config: 12×20×6, no accessories
  const tiny = { ...base(geoState, region), width: 12, length: 20, height: 6, sides: "Open", ends: "Gable", sidesQty: 0, endsQty: 0 };
  const tinyOut = engineMod.priceBuilding(tiny, parsed.matrices);
  checkInvariants("tiny build", tiny, tinyOut);
  ok(`tiny 12×20×6 open: total=${fmt(tinyOut.totals.total)}`);

  // Zero-tax
  const zeroTax = engineMod.priceBuilding({ ...base(geoState, region), taxPct: 0 }, parsed.matrices);
  if (Math.abs(zeroTax.totals.taxAmount) > 0.01) fail("zero-tax config yielded nonzero tax");
  else ok("taxPct=0 → taxAmount=0");

  // Zero-deposit
  const zeroDep = engineMod.priceBuilding({ ...base(geoState, region), depositPct: 0 }, parsed.matrices);
  if (Math.abs(zeroDep.totals.depositAmount) > 0.01) fail("zero-deposit config yielded nonzero deposit");
  else ok("depositPct=0 → depositAmount=0");
}

console.log("\n" + "=".repeat(70));
if (failures === 0) {
  console.log(`ALL SMOKE CHECKS PASSED`);
} else {
  console.log(`SMOKE FAILED — ${failures} failure(s)`);
  for (const f of failList) console.log(`  - ${f.desc}`);
  process.exit(1);
}
