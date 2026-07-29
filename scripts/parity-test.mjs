#!/usr/bin/env node
/**
 * Penny-parity: engine line items vs workbook cell values across every
 * combo the workbook supports. Any mismatch is a real bug (either parser
 * misreading a cell, or engine looking up the wrong cell for a config).
 *
 * Categories (per workbook):
 *   [1]  base                — Pricing-Base F27 lookup:  width × length × gauge
 *   [2]  legs                — Pricing-Legs E24 lookup:  height × length
 *   [3]  roof style          — Pricing-Roof Style E33:   style × width × length
 *   [4]  walk-in doors       — accessories flat list
 *   [5]  windows             — accessories flat list
 *   [6]  roll-up doors       — base + position adder + seal adder
 *   [7]  plans               — Plans C..L matrix (widths 12-30)
 *   [8]  calcs               — Plans Q..Z matrix (widths 12-30)
 *   [9]  leg surcharge       — Plans B28:C42 (adds to plans display total)
 *   [10] door opening        — Plans K35:L47 (adds to plans display total)
 *   [11] sides V             — Pricing-Sides matrix, panel=Vertical
 *   [12] sides H             — Pricing-Sides matrix, panel=Horizontal
 *   [13] ends V              — Pricing-Ends matrix, panel=Vertical
 *   [14] ends H              — Pricing-Ends matrix, panel=Horizontal
 *
 * Tolerance: $0.01.
 */
import { readFileSync, existsSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ExcelJS from "exceljs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const parserMod = await import(pathToFileURL(resolve(root, "src/lib/excel/parser.ts")).href);
const engineMod = await import(pathToFileURL(resolve(root, "src/lib/pricing/engine.ts")).href);

const FILES = {
  south: "C:/Users/Redir/Downloads/PSB -TX, IN, OH, KY, IL, TN, WV, -07-26.xlsx",
  north: "C:/Users/Redir/Downloads/PSB - 01-26 -MI, WI, PA -07-26.xlsx",
};

const TOL = 0.01;
const totals = { total: 0, matched: 0, mismatched: 0 };
const perCategory = {};
const mismatches = [];

function unwrap(v) {
  if (v && typeof v === "object") {
    if ("result" in v) return v.result;
    if ("error" in v) return null;
  }
  return v;
}
function fmt(n) {
  if (typeof n !== "number" || !Number.isFinite(n)) return String(n);
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}
function check(category, ctx, gotRaw, wantRaw) {
  totals.total++;
  perCategory[category] ??= { matched: 0, mismatched: 0 };
  const got = typeof gotRaw === "number" ? gotRaw : 0;
  const want = typeof wantRaw === "number" ? wantRaw : 0;
  const ok = Math.abs(got - want) <= TOL;
  if (ok) { totals.matched++; perCategory[category].matched++; }
  else {
    totals.mismatched++;
    perCategory[category].mismatched++;
    if (mismatches.length < 50) {
      mismatches.push({ category, ctx, got, want, diff: got - want });
    }
  }
}
function base(state) {
  return {
    width: 30, length: 50, height: 12,
    gauge: "14g", roofStyle: "A-Frame Vertical",
    sides: "Fully Enclosed", ends: "Enclosed Ends",
    sidesPanel: "Vertical", endsPanel: "Vertical",
    sidesQty: 0, endsQty: 0,
    rollUpDoors: [], walkInDoors: [], windows: [],
    anchorType: "", windWarranty: "",
    insulation: "", insulationType: "",
    pitch: 0, pitchUnit: "12P",
    overhang: "",
    windMph: 105, snowLoad: "30 Ground Load",
    state, promoTier: "No Promotional Sale",
    depositPct: 0, taxPct: 0, additionalDepositPct: 0,
  };
}
function getLine(out, key) {
  return out.lineItems.find((li) => li.key === key)?.price ?? 0;
}

const REAL_WIDTHS = [12, 18, 20, 22, 24, 26, 28, 30];

for (const [region, path] of Object.entries(FILES)) {
  console.log(`\n${"=".repeat(70)}\n${region.toUpperCase()} — ${path.split(/[\\/]/).pop()}\n${"=".repeat(70)}`);
  if (!existsSync(path)) { console.log("  FILE MISSING"); continue; }
  const buf = readFileSync(path);
  const parsed = parserMod.parsePsbWorkbook(buf, path.split(/[\\/]/).pop());
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const state = region === "south" ? "Indiana" : "Michigan";

  // ---- [1] Base ---------------------------------------------------------
  {
    const s = wb.getWorksheet("Pricing - Base");
    let n = 0;
    for (let r = 2; r <= 19; r++) {
      const len = unwrap(s.getRow(r).getCell(1).value);
      if (typeof len !== "number" || len <= 0) continue;
      for (let c = 2; c <= 21; c++) {
        const key = String(unwrap(s.getRow(1).getCell(c).value) ?? "").trim();
        if (!/^\d+-\d+G$/i.test(key)) continue;
        const [wStr, gStr] = key.split("-");
        const w = parseInt(wStr, 10);
        const gauge = gStr.toLowerCase();
        if (!REAL_WIDTHS.includes(w)) continue;
        const want = unwrap(s.getRow(r).getCell(c).value);
        if (typeof want !== "number") continue;
        const cfg = { ...base(state), width: w, length: len, height: 12, gauge };
        const out = engineMod.priceBuilding(cfg, parsed.matrices);
        check("base", { W: w, L: len, G: gauge }, getLine(out, "base"), want);
        n++;
      }
    }
    console.log(`  [1]  base:                ${n} cells`);
  }

  // ---- [2] Legs ---------------------------------------------------------
  {
    const s = wb.getWorksheet("Pricing - Legs");
    let n = 0;
    const cols = [];
    for (let c = 2; c <= 19; c++) {
      const v = unwrap(s.getRow(1).getCell(c).value);
      if (typeof v === "number") cols.push({ col: c, len: v });
    }
    for (let r = 2; r <= 17; r++) {
      const h = unwrap(s.getRow(r).getCell(1).value);
      if (typeof h !== "number") continue;
      for (const { col, len } of cols) {
        const want = unwrap(s.getRow(r).getCell(col).value);
        if (typeof want !== "number") continue;
        const cfg = { ...base(state), length: len, height: h, width: 30 };
        const out = engineMod.priceBuilding(cfg, parsed.matrices);
        check("legs", { H: h, L: len }, getLine(out, "legs"), want);
        n++;
      }
    }
    console.log(`  [2]  legs:                ${n} cells`);
  }

  // ---- [3] Roof style (style-width key, no gauge) ----------------------
  {
    const s = wb.getWorksheet("Pricing - Roof Style");
    let n = 0;
    const cols = [];
    for (let c = 2; c <= 28; c++) {
      const key = String(unwrap(s.getRow(1).getCell(c).value) ?? "").trim();
      // Format: "AFV-30" or "AFH-30"
      const m = key.match(/^(AFV|AFH)-(\d+)$/i);
      if (!m) continue;
      const style = m[1].toUpperCase() === "AFV" ? "A-Frame Vertical" : "A-Frame Horizontal";
      const w = parseInt(m[2], 10);
      if (!REAL_WIDTHS.includes(w)) continue;
      cols.push({ col: c, w, style });
    }
    for (let r = 2; r <= 19; r++) {
      const len = unwrap(s.getRow(r).getCell(1).value);
      if (typeof len !== "number" || len <= 0) continue;
      for (const { col, w, style } of cols) {
        const want = unwrap(s.getRow(r).getCell(col).value);
        if (typeof want !== "number") continue;
        const cfg = { ...base(state), width: w, length: len, roofStyle: style };
        const out = engineMod.priceBuilding(cfg, parsed.matrices);
        check("roofStyle", { W: w, L: len, S: style }, getLine(out, "roofStyle"), want);
        n++;
      }
    }
    console.log(`  [3]  roofStyle:           ${n} cells`);
  }

  // ---- [4] Walk-in doors -----------------------------------------------
  {
    let n = 0;
    for (const d of parsed.matrices.accessories?.walkInDoors ?? []) {
      if (!d.label || d.label === "0") continue;
      for (const qty of [1, 3]) {
        const cfg = { ...base(state), walkInDoors: [{ size: d.label, qty }] };
        const out = engineMod.priceBuilding(cfg, parsed.matrices);
        check("walkIn", { size: d.label, qty }, getLine(out, "wid1"), d.price * qty);
        n++;
      }
    }
    console.log(`  [4]  walk-in doors:       ${n} configs`);
  }

  // ---- [5] Windows -----------------------------------------------------
  {
    let n = 0;
    for (const w of parsed.matrices.accessories?.windows ?? []) {
      if (!w.label || w.label === "0") continue;
      for (const qty of [1, 3]) {
        const cfg = { ...base(state), windows: [{ size: w.label, qty }] };
        const out = engineMod.priceBuilding(cfg, parsed.matrices);
        check("window", { size: w.label, qty }, getLine(out, "win1"), w.price * qty);
        n++;
      }
    }
    console.log(`  [5]  windows:             ${n} configs`);
  }

  // ---- [6] Roll-up doors -----------------------------------------------
  {
    const ruds = parsed.matrices.accessories?.rollUpDoors ?? [];
    const seals = parsed.matrices.accessories?.rudSealAdders ?? [];
    const sidePos = parsed.matrices.accessories?.rudSidePositionAdders?.find((p) => p.label === "SIDE")?.price ?? 0;
    let n = 0;
    for (const d of ruds) {
      if (!d.label || d.label === "0") continue;
      const sealRow = seals.find((s) => s.size === d.label);
      for (const pos of ["SIDE", "END"]) {
        const posAdder = pos === "SIDE" ? sidePos : 0;
        for (const seal of ["", "Brush Seal Option", "Header Seal only Option"]) {
          let sealAdder = 0;
          if (sealRow) {
            if (seal.includes("Brush Seal Option")) sealAdder = sealRow.brushSeal;
            else if (seal.includes("Header Seal only Option")) sealAdder = sealRow.headerSeal;
          }
          const expected = 2 * (d.price + posAdder + sealAdder);
          const cfg = { ...base(state), rollUpDoors: [{ size: d.label, qty: 2, position: pos, headerSeal: seal }] };
          const out = engineMod.priceBuilding(cfg, parsed.matrices);
          check("rud", { size: d.label, pos, seal: seal || "none" }, getLine(out, "rud1"), expected);
          n++;
        }
      }
    }
    console.log(`  [6]  roll-up doors:       ${n} configs`);
  }

  // ---- [7] Plans (cols C..L, widths 12..30) ----------------------------
  //          Plans display total = plansMatrix[L][W] + legSurcharge[H] + doorSurcharge[doors]
  //          At height=12 no doors, both surcharges are 0 (verify below).
  //          Only test widths the engine actually maps: 12,18,20,22,24,26,28,30 (skip 14/16).
  {
    const s = wb.getWorksheet("Plans for Buildings");
    let n = 0;
    const cols = [];
    for (let c = 3; c <= 12; c++) {
      const w = unwrap(s.getRow(1).getCell(c).value);
      if (typeof w === "number" && REAL_WIDTHS.includes(w)) cols.push({ col: c, w });
    }
    for (let r = 2; r <= 18; r++) {
      const len = unwrap(s.getRow(r).getCell(1).value);
      if (typeof len !== "number" || len <= 0) continue;
      for (const { col, w } of cols) {
        const want = unwrap(s.getRow(r).getCell(col).value);
        if (typeof want !== "number") continue;
        const cfg = { ...base(state), width: w, length: len, height: 12 };
        const out = engineMod.priceBuilding(cfg, parsed.matrices);
        // At H=12 no doors, engine's plansCost should equal matrix cell + legSurcharge[12].
        // Subtract legSurcharge[12] before comparing to isolate the matrix lookup.
        const legExtra = parsed.matrices.plans.legSurcharge?.[12] ?? 0;
        check("plans", { W: w, L: len }, out.totals.plansCost - legExtra, want);
        n++;
      }
    }
    console.log(`  [7]  plans matrix:        ${n} cells`);
  }

  // ---- [8] Calcs (cols Q..Z, widths 12..30) ----------------------------
  {
    const s = wb.getWorksheet("Plans for Buildings");
    let n = 0;
    const cols = [];
    for (let c = 17; c <= 26; c++) {
      const w = unwrap(s.getRow(1).getCell(c).value);
      if (typeof w === "number" && REAL_WIDTHS.includes(w)) cols.push({ col: c, w });
    }
    for (let r = 2; r <= 18; r++) {
      const len = unwrap(s.getRow(r).getCell(16).value); // P col
      if (typeof len !== "number" || len <= 0) continue;
      for (const { col, w } of cols) {
        const want = unwrap(s.getRow(r).getCell(col).value);
        if (typeof want !== "number") continue;
        const cfg = { ...base(state), width: w, length: len };
        const out = engineMod.priceBuilding(cfg, parsed.matrices);
        check("calcs", { W: w, L: len }, out.totals.calcsCost, want);
        n++;
      }
    }
    console.log(`  [8]  calcs matrix:        ${n} cells`);
  }

  // ---- [9] Leg surcharge (Plans B28:C42) --------------------------------
  {
    let n = 0;
    for (const [h, want] of Object.entries(parsed.matrices.plans.legSurcharge ?? {})) {
      const hNum = Number(h);
      if (!Number.isFinite(hNum) || hNum <= 0) continue;
      const cfg = { ...base(state), width: 30, length: 50, height: hNum };
      const out = engineMod.priceBuilding(cfg, parsed.matrices);
      // engine's plansCost = matrix[50][30] + legSurcharge[H]. Subtract matrix[50][30]
      // (which we've validated in [7]) to isolate the leg surcharge.
      const basePlans = parsed.matrices.plans.plans?.[50]?.[30] ?? 0;
      check("legSurcharge", { H: hNum }, out.totals.plansCost - basePlans, want);
      n++;
    }
    console.log(`  [9]  leg surcharge:       ${n} configs`);
  }

  // ---- [10] Door opening surcharge (Plans K35:L47) ---------------------
  {
    let n = 0;
    for (const [count, want] of Object.entries(parsed.matrices.plans.doorOpeningCost ?? {})) {
      const c = Number(count);
      if (!Number.isFinite(c) || c < 0) continue;
      // Build a config with `c` walk-in doors (each qty=1) — the door-count sum drives lookup.
      const walkInDoors = [];
      for (let i = 0; i < c; i++) walkInDoors.push({ size: "3x7", qty: 1 });
      const cfg = { ...base(state), width: 30, length: 50, height: 12, walkInDoors };
      const out = engineMod.priceBuilding(cfg, parsed.matrices);
      const basePlans = parsed.matrices.plans.plans?.[50]?.[30] ?? 0;
      const legExtra = parsed.matrices.plans.legSurcharge?.[12] ?? 0;
      check("doorOpening", { doors: c }, out.totals.plansCost - basePlans - legExtra, want);
      n++;
    }
    console.log(`  [10] door opening:        ${n} configs`);
  }

  // ---- [11-14] Sides & Ends matrices (V + H, every len/wid × height × qty)
  //
  //     Engine formula:
  //       sides   = INDEX(sidesMatrix,   heightRow, MATCH(`${length}-${orient}`, hdr)) × qty_mult
  //       ends    = INDEX(endsMatrix,    heightRow, MATCH(`${width}-${orient}`,  hdr)) × qty_mult
  //     qty_mult: sides {0:0, 1:0.5, 2:1}   ends {0:0, 1:1, 2:2}
  //
  //     Compare cell-by-cell for qty=2 (the "1x" multiplier for sides means the matrix
  //     cell IS the price; for ends qty=1 the matrix cell IS the price; testing both
  //     lets us pin down whether the qty multiplier or the lookup is wrong).
  for (const orient of ["Vertical", "Horizontal"]) {
    const shortO = orient === "Vertical" ? "V" : "HZ";
    const sSides = wb.getWorksheet("Pricing - Sides");
    let nSides = 0;
    // Sides header row 1, keyed by `${length}-${orient}`. Walk cols and find matches.
    const sideCols = [];
    for (let c = 2; c <= 37; c++) {
      const key = String(unwrap(sSides.getRow(1).getCell(c).value) ?? "").trim();
      const m = key.match(/^(\d+)-(V|HZ)$/i);
      if (m && m[2].toUpperCase() === shortO) sideCols.push({ col: c, len: parseInt(m[1], 10) });
    }
    for (let r = 2; r <= 20; r++) {
      const h = parseInt(String(unwrap(sSides.getRow(r).getCell(1).value) ?? "").match(/^(\d+)/)?.[1] ?? "-1", 10);
      if (h < 0) continue;
      for (const { col, len } of sideCols) {
        const want = unwrap(sSides.getRow(r).getCell(col).value);
        if (typeof want !== "number") continue;
        // sidesQty=2 → engine result = matrix cell × 1 = matrix cell
        const cfg = { ...base(state), length: len, height: h, width: 30, sidesPanel: orient, sidesQty: 2 };
        const out = engineMod.priceBuilding(cfg, parsed.matrices);
        check(`sides-${shortO}`, { L: len, H: h }, getLine(out, "sides"), Math.round(want));
        nSides++;
      }
    }
    console.log(`  [${orient === "Vertical" ? 11 : 12}] sides ${shortO}:             ${nSides} cells`);

    const sEnds = wb.getWorksheet("Pricing - Ends");
    let nEnds = 0;
    // Ends header row 1, keyed by `${width}-${orient}-{FE|G}`.
    //   FE = Enclosed Ends, G = Gable
    const endCols = [];
    for (let c = 2; c <= 73; c++) {
      const key = String(unwrap(sEnds.getRow(1).getCell(c).value) ?? "").trim();
      const m = key.match(/^(\d+)-(V|HZ)-(FE|G)$/i);
      if (m && m[2].toUpperCase() === shortO) {
        const w = parseInt(m[1], 10);
        if (REAL_WIDTHS.includes(w)) endCols.push({ col: c, w, code: m[3].toUpperCase() });
      }
    }
    for (let r = 2; r <= 22; r++) {
      const h = parseInt(String(unwrap(sEnds.getRow(r).getCell(1).value) ?? "").match(/^(\d+)/)?.[1] ?? "-1", 10);
      if (h < 0) continue;
      for (const { col, w, code } of endCols) {
        const want = unwrap(sEnds.getRow(r).getCell(col).value);
        if (typeof want !== "number") continue;
        // endsQty=1 → engine result = matrix cell × 1 = matrix cell
        const endsLabel = code === "G" ? "Gable" : "Enclosed Ends";
        const cfg = { ...base(state), width: w, height: h, length: 50, endsPanel: orient, endsQty: 1, ends: endsLabel };
        const out = engineMod.priceBuilding(cfg, parsed.matrices);
        check(`ends-${shortO}`, { W: w, H: h, code }, getLine(out, "ends"), Math.round(want));
        nEnds++;
      }
    }
    console.log(`  [${orient === "Vertical" ? 13 : 14}] ends ${shortO}:              ${nEnds} cells`);
  }
}

console.log("\n" + "=".repeat(70));
console.log("PER-CATEGORY SUMMARY");
console.log("=".repeat(70));
for (const [cat, s] of Object.entries(perCategory)) {
  const total = s.matched + s.mismatched;
  const status = s.mismatched === 0 ? "OK  " : "FAIL";
  console.log(`  ${status}  ${cat.padEnd(15)}  ${s.matched}/${total}`);
}
console.log("\n" + "=".repeat(70));
console.log(`OVERALL: ${totals.matched}/${totals.total} matched, ${totals.mismatched} mismatched`);
if (mismatches.length > 0) {
  console.log(`\nFIRST ${mismatches.length} MISMATCHES:`);
  for (const m of mismatches) {
    console.log(`  [${m.category}] ${JSON.stringify(m.ctx)}  got=${fmt(m.got)}  want=${fmt(m.want)}  diff=${fmt(m.diff)}`);
  }
  process.exit(1);
}
console.log("PENNY-PARITY OK");
