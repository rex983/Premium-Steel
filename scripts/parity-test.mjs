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
// Workbook cells keep cents (e.g. $6,512.50 for 26ga upgrade); match the
// engine's round2 to preserve them instead of collapsing to whole dollars.
const round2 = (n) => Math.round(n * 100) / 100;
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
        check(`sides-${shortO}`, { L: len, H: h }, getLine(out, "sides"), round2(want));
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
        check(`ends-${shortO}`, { W: w, H: h, code }, getLine(out, "ends"), round2(want));
        nEnds++;
      }
    }
    console.log(`  [${orient === "Vertical" ? 13 : 14}] ends ${shortO}:              ${nEnds} cells`);
  }

  // ---- [15] Base Trim ---------------------------------------------------
  //     Engine: baseTrim === "Full Perimeter Base Trim" ? (W+L)*2 * bt : 0
  {
    const bt = parsed.matrices.accessories?.bt ?? 0;
    let n = 0;
    for (const w of REAL_WIDTHS) for (const l of [20, 40, 60, 80, 100]) {
      const expected = round2((w + l) * 2 * bt);
      const cfg = { ...base(state), width: w, length: l, baseTrim: "Full Perimeter Base Trim" };
      const out = engineMod.priceBuilding(cfg, parsed.matrices);
      check("baseTrim", { W: w, L: l }, getLine(out, "baseTrim"), expected);
      n++;
    }
    console.log(`  [15] base trim:           ${n} configs (bt rate = ${bt})`);
  }

  // ---- [16] Foam Closure — every length in matrices.foamClosure.byLength
  {
    const foam = parsed.matrices.accessories?.foamClosure;
    let n = 0;
    if (foam && foam.byLength.length > 0) {
      for (const row of foam.byLength) {
        const cfg = { ...base(state), length: row.length, foamClosure: foam.label };
        const out = engineMod.priceBuilding(cfg, parsed.matrices);
        check("foamClosure", { L: row.length }, getLine(out, "foam"), row.price);
        n++;
      }
    }
    console.log(`  [16] foam closure:        ${n} configs`);
  }

  // ---- [17] Sheet metal + J-Trim + Extras + Interior walls (qty × price)
  {
    let n = 0;
    for (const item of parsed.matrices.accessories?.sheetMetal ?? []) {
      if (!item.label || item.label === "0" || !item.price) continue;
      for (const qty of [1, 5]) {
        const cfg = { ...base(state), extraSheetMetal: item.label, extraSheetMetalQty: qty };
        const out = engineMod.priceBuilding(cfg, parsed.matrices);
        check("sheetMetal", { label: item.label, qty }, getLine(out, "extraSheet"), round2(item.price * qty));
        n++;
      }
    }
    for (const item of parsed.matrices.accessories?.jtrim ?? []) {
      if (!item.label || item.label === "0" || !item.price) continue;
      for (const qty of [1, 5]) {
        const cfg = { ...base(state), jtrim: item.label, jtrimQty: qty };
        const out = engineMod.priceBuilding(cfg, parsed.matrices);
        check("jtrim", { label: item.label, qty }, getLine(out, "jtrim"), round2(item.price * qty));
        n++;
      }
    }
    for (const item of parsed.matrices.accessories?.extras ?? []) {
      if (!item.label || item.label === "0" || !item.price) continue;
      for (const qty of [1, 3]) {
        const cfg = { ...base(state), extras: [{ label: item.label, qty }] };
        const out = engineMod.priceBuilding(cfg, parsed.matrices);
        check("extras", { label: item.label, qty }, getLine(out, "extras1"), item.price * qty);
        n++;
      }
    }
    for (const item of parsed.matrices.accessories?.interiorWalls ?? []) {
      if (!item.label || item.label === "0" || !item.price) continue;
      for (const qty of [1, 3]) {
        const cfg = { ...base(state), interiorWalls: { label: item.label, qty } };
        const out = engineMod.priceBuilding(cfg, parsed.matrices);
        check("interiorWalls", { label: item.label, qty }, getLine(out, "interior"), item.price * qty);
        n++;
      }
    }
    console.log(`  [17] flat accessories:    ${n} configs (sheet/jtrim/extras/interior)`);
  }

  // ---- [18] Labor Fees — labelIdx × lengthIdx matrix
  {
    const lf = parsed.matrices.accessories?.laborFees;
    let n = 0;
    if (lf) {
      for (let li = 0; li < lf.labels.length; li++) {
        const label = lf.labels[li];
        if (!label || label === "0") continue;
        for (const ln of lf.lengths) {
          const want = round2(lf.prices[li]?.[lf.lengths.indexOf(ln)] ?? 0);
          const cfg = { ...base(state), length: ln, laborFees: [label] };
          const out = engineMod.priceBuilding(cfg, parsed.matrices);
          check("laborFee", { label, L: ln }, getLine(out, "laborFee1"), want);
          n++;
        }
      }
    }
    console.log(`  [18] labor fees:          ${n} configs`);
  }

  // ---- [19] Frame outs — (base + sideAdder) × qty
  {
    const fo = parsed.matrices.accessories?.frameOuts;
    let n = 0;
    if (fo) {
      for (let hi = 0; hi < fo.heights.length; hi++) {
        for (let wi = 0; wi < fo.widths.length; wi++) {
          const priceCell = fo.prices[hi]?.[wi] ?? 0;
          if (!priceCell) continue;
          for (const pos of ["SIDE", "END"]) {
            const sideAdder = pos === "SIDE" ? (fo.sideAdderByWidth[wi] ?? 0) : 0;
            for (const qty of [1, 2]) {
              const expected = round2((priceCell + sideAdder) * qty);
              const cfg = { ...base(state), frameOuts: { width: fo.widths[wi], height: fo.heights[hi], qty, position: pos } };
              const out = engineMod.priceBuilding(cfg, parsed.matrices);
              check("frameOuts", { H: fo.heights[hi], W: fo.widths[wi], pos, qty }, getLine(out, "frameOuts"), expected);
              n++;
            }
          }
        }
      }
    }
    console.log(`  [19] frame outs:          ${n} configs`);
  }

  // ---- [20] Wainscot End (matrix at Pricing-Ends B30:T31, keyed {W}-{code}-{orient})
  {
    const sEnds = wb.getWorksheet("Pricing - Ends");
    let n = 0;
    for (let c = 2; c <= 20; c++) {
      const key = String(unwrap(sEnds.getRow(30).getCell(c).value) ?? "").trim();
      const m = key.match(/^(\d+)-(EW|0)-(V|HZ)$/i);
      if (!m) continue;
      const w = parseInt(m[1], 10);
      const code = m[2].toUpperCase();
      const orient = m[3].toUpperCase() === "V" ? "Vertical" : "Horizontal";
      if (!REAL_WIDTHS.includes(w)) continue;
      if (code !== "EW") continue; // engine only prices when wainscotEnd matches "End Wall"
      const want = unwrap(sEnds.getRow(31).getCell(c).value);
      if (typeof want !== "number") continue;
      for (const qty of [1, 2]) {
        const cfg = { ...base(state), width: w, endsPanel: orient, wainscotEnd: "End Wall", wainscotEndQty: qty };
        const out = engineMod.priceBuilding(cfg, parsed.matrices);
        check("wainscotEnd", { W: w, orient, qty }, getLine(out, "wainscotEnd"), round2(want * qty));
        n++;
      }
    }
    console.log(`  [20] wainscot end:        ${n} configs`);
  }

  // ---- [21] Wainscot Side (matrix at Pricing-Sides H36:AQ37, keyed {L}-{orient})
  {
    const sSides = wb.getWorksheet("Pricing - Sides");
    let n = 0;
    for (let c = 8; c <= 43; c++) { // H..AQ
      const key = String(unwrap(sSides.getRow(36).getCell(c).value) ?? "").trim();
      const m = key.match(/^(\d+)-(V|HZ)$/i);
      if (!m) continue;
      const len = parseInt(m[1], 10);
      const orient = m[2].toUpperCase() === "V" ? "Vertical" : "Horizontal";
      const want = unwrap(sSides.getRow(37).getCell(c).value);
      if (typeof want !== "number") continue;
      for (const qty of [1, 2]) {
        // sides qty multiplier: 1 → 0.5×, 2 → 1×
        const mult = qty === 2 ? 1 : 0.5;
        const cfg = { ...base(state), length: len, sidesPanel: orient, wainscotSide: "Sidewall", wainscotSideQty: qty };
        const out = engineMod.priceBuilding(cfg, parsed.matrices);
        check("wainscotSide", { L: len, orient, qty }, getLine(out, "wainscotSide"), round2(want * mult));
        n++;
      }
    }
    console.log(`  [21] wainscot side:       ${n} configs`);
  }

  // ---- [22] Roof Pitch — every (pitchKey, width) × [several lengths] ----
  //     Engine: multiplier × basePrice, where basePrice depends on (W, L, G)
  {
    const rp = parsed.matrices.roofPitch ?? {};
    let n = 0;
    for (const key of Object.keys(rp)) {
      const m = key.match(/^(\d+)-12P$/);
      if (!m) continue;
      const pitch = parseInt(m[1], 10);
      if (![0, 4, 5, 6].includes(pitch)) continue;
      const widthRow = rp[key];
      for (const w of Object.keys(widthRow)) {
        const wNum = Number(w);
        if (!REAL_WIDTHS.includes(wNum)) continue;
        const mult = widthRow[wNum];
        for (const l of [20, 50, 100]) {
          const cfg = { ...base(state), width: wNum, length: l, pitch, pitchUnit: "12P" };
          const out = engineMod.priceBuilding(cfg, parsed.matrices);
          const basePrice = getLine(out, "base");
          const expected = round2(mult * basePrice);
          check("roofPitch", { pitch, W: wNum, L: l }, getLine(out, "pitch"), expected);
          n++;
        }
      }
    }
    console.log(`  [22] roof pitch:          ${n} configs`);
  }

  // ---- [23] Overhang — every (label, length) × [several widths] --------
  {
    const oh = parsed.matrices.overhang ?? {};
    let n = 0;
    for (const label of Object.keys(oh)) {
      if (!label) continue;
      const lenRow = oh[label];
      for (const l of Object.keys(lenRow)) {
        const lNum = Number(l);
        if (!Number.isFinite(lNum) || lNum <= 0) continue;
        const mult = lenRow[lNum];
        for (const w of [20, 30]) {
          const cfg = { ...base(state), width: w, length: lNum, overhang: label };
          const out = engineMod.priceBuilding(cfg, parsed.matrices);
          const basePrice = getLine(out, "base");
          const expected = round2(mult * basePrice);
          check("overhang", { label, L: lNum, W: w }, getLine(out, "overhang"), expected);
          n++;
        }
      }
    }
    console.log(`  [23] overhang:            ${n} configs`);
  }

  // ---- [24] 26ga Upgrade — rate × (base | base+sides+ends) --------------
  //     For coverage = "Roof Only" → rate × basePrice
  //     For coverage = "Fully Enclosed" → rate × (basePrice + sidesPrice + endsPrice)
  {
    const rates = parsed.matrices.accessories?.upgrade26ga ?? [];
    let n = 0;
    for (const r of rates) {
      if (!r.label || r.rate <= 0) continue;
      for (const coverage of ["Roof Only", "Fully Enclosed"]) {
        const cfg = { ...base(state), sidesQty: 2, endsQty: 2, upgrade26ga: r.label, upgrade26gaCoverage: coverage };
        const out = engineMod.priceBuilding(cfg, parsed.matrices);
        const bp = getLine(out, "base");
        const sp = getLine(out, "sides");
        const ep = getLine(out, "ends");
        const expected = coverage === "Fully Enclosed" ? round2((bp + sp + ep) * r.rate) : round2(bp * r.rate);
        check("26gaUpgrade", { label: r.label, coverage }, getLine(out, "26ga"), expected);
        n++;
      }
    }
    console.log(`  [24] 26ga upgrade:        ${n} configs`);
  }

  // ---- [25] Premium Colors — same shape as 26ga ------------------------
  {
    const rates = parsed.matrices.accessories?.premiumColors ?? [];
    let n = 0;
    for (const r of rates) {
      if (!r.label || r.rate <= 0) continue;
      for (const coverage of ["Roof Only", "Fully Enclosed"]) {
        const cfg = { ...base(state), sidesQty: 2, endsQty: 2, premiumColor: r.label, premiumColorCoverage: coverage };
        const out = engineMod.priceBuilding(cfg, parsed.matrices);
        const bp = getLine(out, "base");
        const sp = getLine(out, "sides");
        const ep = getLine(out, "ends");
        const expected = coverage === "Fully Enclosed" ? round2((bp + sp + ep) * r.rate) : round2(bp * r.rate);
        check("premiumColors", { label: r.label, coverage }, getLine(out, "premium"), expected);
        n++;
      }
    }
    console.log(`  [25] premium colors:      ${n} configs`);
  }

  // ---- [26] Color Screws — coverage encoded in label -------------------
  {
    const rates = parsed.matrices.accessories?.colorScrews ?? [];
    let n = 0;
    for (const r of rates) {
      if (!r.label || r.rate <= 0) continue;
      const cfg = { ...base(state), sidesQty: 2, endsQty: 2, colorScrews: r.label };
      const out = engineMod.priceBuilding(cfg, parsed.matrices);
      const bp = getLine(out, "base");
      const sp = getLine(out, "sides");
      const ep = getLine(out, "ends");
      const coverage = /Fully Enclosed/i.test(r.label) ? "Fully Enclosed" : "Roof Only";
      const expected = coverage === "Fully Enclosed" ? round2((bp + sp + ep) * r.rate) : round2(bp * r.rate);
      check("colorScrews", { label: r.label }, getLine(out, "colorScrews"), expected);
      n++;
    }
    console.log(`  [26] color screws:        ${n} configs`);
  }

  // ---- [27] Gutter — computed formula --------------------------------
  //     AA25 = length × mult + 2.5
  //     AA26 = (height + 1.75) × (length / 25) × mult
  //     lf = AA25 + AA26
  //     price = round(lf × ratePerLf)
  {
    const g = parsed.matrices.accessories?.gutter;
    let n = 0;
    if (g && g.ratePerLf > 0) {
      for (const side of g.sides) {
        if (!side.label || side.multiplier <= 0) continue;
        for (const l of [30, 50, 100]) {
          for (const h of [8, 12, 20]) {
            const aa25 = l * side.multiplier + 2.5;
            const aa26 = (h + 1.75) * (l / 25) * side.multiplier;
            const lf = aa25 + aa26;
            const expected = round2(lf * g.ratePerLf);
            const cfg = { ...base(state), length: l, height: h, width: 30, gutterSide: side.label };
            const out = engineMod.priceBuilding(cfg, parsed.matrices);
            check("gutter", { side: side.label, L: l, H: h }, getLine(out, "gutter"), expected);
            n++;
          }
        }
      }
    }
    console.log(`  [27] gutter:              ${n} configs`);
  }

  // ---- [28] Insulation — computed formula (rate × surface areas) -------
  //     roof  = roundUp10((W+3) * L * rate)
  //     sides = roundUp10((H+2) * L * sidesQty * rate) — only when Fully Insulated-Vertical
  //     ends  = roundUp10((H+3) * W * endsQty * rate)  — only when Fully Insulated-Vertical
  {
    const materials = parsed.matrices.insulation?.materials ?? [];
    const material = materials.find((m) => m.rate > 0);
    let n = 0;
    if (material) {
      const roundUp10 = (x) => Math.ceil(x / 10) * 10;
      for (const coverage of ["Vertical Roof Only", "Fully Insulated-Vertical"]) {
        for (const w of [20, 24, 30]) for (const l of [30, 50, 100]) for (const h of [8, 12, 15]) {
          const roof = roundUp10((w + 3) * l * material.rate);
          const sides = roundUp10((h + 2) * l * 2 * material.rate);
          const ends = roundUp10((h + 3) * w * 2 * material.rate);
          const expected = /Fully Insulated-Vertical/i.test(coverage) ? roof + sides + ends : roof;
          const cfg = { ...base(state), width: w, length: l, height: h, sidesQty: 2, endsQty: 2, insulation: material.label, insulationType: coverage };
          const out = engineMod.priceBuilding(cfg, parsed.matrices);
          check("insulation", { label: material.label, coverage, W: w, L: l, H: h }, getLine(out, "insulation"), expected);
          n++;
        }
      }
    }
    console.log(`  [28] insulation:          ${n} configs`);
  }

  // ---- [29] Anchors "Anchors Only" mode (unitPrice × user qty) --------
  {
    const unitPrices = parsed.matrices.anchors?.unitPrices ?? [];
    let n = 0;
    for (const u of unitPrices) {
      if (!u.label || u.price <= 0) continue;
      for (const qty of [1, 5, 10]) {
        const cfg = { ...base(state), anchorType: u.label, windWarranty: "Anchors Only", anchorQty: qty };
        const out = engineMod.priceBuilding(cfg, parsed.matrices);
        check("anchors-user", { type: u.label, qty }, getLine(out, "anchors"), round2(u.price * qty));
        n++;
      }
    }
    console.log(`  [29] anchors (Anchors Only): ${n} configs`);
  }

  // ---- [30] Anchors "105 MPH Wind Warranty" mode (auto-count) ---------
  //     For each (anchorType, width, length, endsQty, totalRuds) — the engine
  //     computes autoQty = perEnd[`${W}x${sideMod}`] × 2 × mult
  //                       + sidesAnchorsByTypeAndLength[type][length]
  //     with mult=0 for "Ground Concrete Supports", else 1;
  //     sideMod = min(3, ceil(totalRuds / endsQty)) when ends="Enclosed Ends" & endsQty>0.
  {
    const unitPrices = parsed.matrices.anchors?.unitPrices ?? [];
    const perEnd = parsed.matrices.anchors?.perEndCounts ?? {};
    const sidesByT = parsed.matrices.anchors?.sidesAnchorsByTypeAndLength ?? {};
    let n = 0;
    for (const u of unitPrices) {
      if (!u.label || u.price <= 0) continue;
      const mult = /Ground Concrete Supports/i.test(u.label) ? 0 : 1;
      for (const w of [20, 30]) {
        for (const l of [30, 50, 100]) {
          for (const rudQty of [0, 1, 3, 6]) {
            const sideMod = Math.min(3, Math.ceil(rudQty / 2));
            const perEndCount = perEnd[`${w}x${sideMod}`] ?? 0;
            const endsAnchors = perEndCount * 2 * mult;
            // Sides anchors by nearest-length rounding
            let sidesAnchors = 0;
            const row = sidesByT[u.label];
            if (row) {
              if (row[l] !== undefined) sidesAnchors = row[l];
              else {
                const under = Object.keys(row).map(Number).filter((n) => n <= l).sort((a, b) => a - b);
                if (under.length > 0) sidesAnchors = row[under[under.length - 1]];
              }
            }
            const expected = round2(u.price * (endsAnchors + sidesAnchors));
            const cfg = {
              ...base(state),
              width: w, length: l, endsQty: 2, ends: "Enclosed Ends",
              anchorType: u.label, windWarranty: "105 MPH Wind Warranty",
              rollUpDoors: rudQty > 0 ? [{ size: "10x10", qty: rudQty, position: "END" }] : [],
            };
            const out = engineMod.priceBuilding(cfg, parsed.matrices);
            check("anchors-auto", { type: u.label, W: w, L: l, RUD: rudQty }, getLine(out, "anchors"), expected);
            n++;
          }
        }
      }
    }
    console.log(`  [30] anchors (105 MPH auto): ${n} configs`);
  }

  // ---- [31-38] Snow engineering — parser parity for all 8 lookup tables
  //     For each parsed matrix cell, read the corresponding workbook cell
  //     directly and assert equality. This validates the pipeline that feeds
  //     the engine's spacing/count lookups; engine-output parity is covered
  //     by the golden case in `npm test` + snow monotonicity in `npm smoke`.
  {
    const snow = parsed.matrices.snow;

    // [31] Truss Spacing (rows A2:A43, cols B1:HQ1)
    if (snow?.trussSpacing?.spacingTable) {
      const s = wb.getWorksheet("Snow - Truss Spacing");
      let n = 0;
      for (let i = 0; i < snow.trussSpacing.rowKeys.length; i++) {
        for (let j = 0; j < snow.trussSpacing.colKeys.length; j++) {
          const parsedVal = snow.trussSpacing.spacingTable[i]?.[j] ?? 0;
          const row = i + 2; // row 2 = first data row
          const col = j + 2; // col B = first data col
          const raw = unwrap(s.getRow(row).getCell(col).value);
          if (typeof raw !== "number") continue;
          check("snow-trussSpacing", { i, j }, parsedVal, raw);
          n++;
        }
      }
      console.log(`  [31] snow truss spacing:  ${n} cells`);
    }

    // [32] Trusses (original counts) — B2:BE101 keyed by width-state col × length row
    if (snow?.trusses?.counts) {
      const s = wb.getWorksheet("Snow - Trusses ");
      let n = 0;
      for (let i = 0; i < Math.min(snow.trusses.lengths.length, snow.trusses.counts.length); i++) {
        for (let j = 0; j < snow.trusses.colKeys.length; j++) {
          const parsedVal = snow.trusses.counts[i]?.[j] ?? 0;
          const row = i + 2;
          const col = j + 2;
          const raw = unwrap(s.getRow(row).getCell(col).value);
          if (typeof raw !== "number") continue;
          check("snow-trussCounts", { i, j }, parsedVal, raw);
          n++;
        }
      }
      console.log(`  [32] snow truss counts:   ${n} cells`);
    }

    // [33] Hat channel spacing — B2:H71
    if (snow?.hatChannels?.spacingTable) {
      const s = wb.getWorksheet("Snow - Hat Channels");
      let n = 0;
      for (let i = 0; i < snow.hatChannels.rowKeys.length; i++) {
        for (let j = 0; j < snow.hatChannels.windHeader.length; j++) {
          const parsedVal = snow.hatChannels.spacingTable[i]?.[j] ?? 0;
          const raw = unwrap(s.getRow(i + 2).getCell(j + 2).value);
          if (typeof raw !== "number") continue;
          check("snow-hatSpacing", { i, j }, parsedVal, raw);
          n++;
        }
      }
      console.log(`  [33] snow hat spacing:    ${n} cells`);
    }

    // [34] Hat channel original counts — S2:Z8 (per state × width)
    if (snow?.hatChannels?.originalCounts) {
      const s = wb.getWorksheet("Snow - Hat Channels");
      let n = 0;
      for (let i = 0; i < snow.hatChannels.stateCodes.length; i++) {
        for (let j = 0; j < snow.hatChannels.widthHeader.length; j++) {
          const parsedVal = snow.hatChannels.originalCounts[i]?.[j] ?? 0;
          const raw = unwrap(s.getRow(i + 2).getCell(19 + j).value); // col S = 19
          if (typeof raw !== "number") continue;
          check("snow-hatCounts", { i, j }, parsedVal, raw);
          n++;
        }
      }
      console.log(`  [34] snow hat counts:     ${n} cells`);
    }

    // [35] Girt spacing — B2:H6
    if (snow?.girts?.spacingTable) {
      const s = wb.getWorksheet("Snow - Girts ");
      let n = 0;
      for (let i = 0; i < snow.girts.girtRowKeys.length; i++) {
        for (let j = 0; j < snow.girts.windHeader.length; j++) {
          const parsedVal = snow.girts.spacingTable[i]?.[j] ?? 0;
          const raw = unwrap(s.getRow(i + 2).getCell(j + 2).value);
          if (typeof raw !== "number") continue;
          check("snow-girtSpacing", { i, j }, parsedVal, raw);
          n++;
        }
      }
      console.log(`  [35] snow girt spacing:   ${n} cells`);
    }

    // [36] Girt original counts — M2:M22 (per leg height)
    if (snow?.girts?.originalCol) {
      const s = wb.getWorksheet("Snow - Girts ");
      let n = 0;
      for (let i = 0; i < snow.girts.legHeightCol.length; i++) {
        const parsedVal = snow.girts.originalCol[i] ?? 0;
        const raw = unwrap(s.getRow(i + 2).getCell(13).value); // col M = 13
        if (typeof raw !== "number") continue;
        check("snow-girtCounts", { i }, parsedVal, raw);
        n++;
      }
      console.log(`  [36] snow girt counts:    ${n} cells`);
    }

    // [37] Vertical spacing — B2:V8
    if (snow?.verticals?.spacingTable) {
      const s = wb.getWorksheet("Snow - Verticals");
      let n = 0;
      for (let i = 0; i < snow.verticals.windCol.length; i++) {
        for (let j = 0; j < snow.verticals.legHeightHeader.length; j++) {
          const parsedVal = snow.verticals.spacingTable[i]?.[j] ?? 0;
          const raw = unwrap(s.getRow(i + 2).getCell(j + 2).value);
          if (typeof raw !== "number") continue;
          check("snow-vertSpacing", { i, j }, parsedVal, raw);
          n++;
        }
      }
      console.log(`  [37] snow vert spacing:   ${n} cells`);
    }

    // [38] Vertical original counts — B14:I14 (per width)
    if (snow?.verticals?.originalRow) {
      const s = wb.getWorksheet("Snow - Verticals");
      let n = 0;
      for (let i = 0; i < snow.verticals.widthHeader.length; i++) {
        const parsedVal = snow.verticals.originalRow[i] ?? 0;
        const raw = unwrap(s.getRow(14).getCell(i + 2).value);
        if (typeof raw !== "number") continue;
        check("snow-vertCounts", { i }, parsedVal, raw);
        n++;
      }
      console.log(`  [38] snow vert counts:    ${n} cells`);
    }
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
