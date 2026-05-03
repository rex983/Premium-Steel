import type { WorkSheet } from "xlsx";
import type { SnowChangersMatrix, SnowStateConstants } from "@/types/pricing";
import { getString, getNumber } from "./utils";
import { colToLetter } from "./_raw-grid";

/**
 * Snow - Changers — input routing + per-state engineering constants.
 *
 * What we extract here is the *raw lookup data*, NOT the cached output cells.
 * The engine reproduces the spreadsheet's INDEX/MATCH chain at request time
 * against runtime BuildingConfig.
 *
 * Source ranges:
 *   B9:P9   long snow-load names      (e.g. "60 Ground Load")
 *   B10:P10 short snow-load codes     (e.g. "60GL")
 *   B26:V26 leg-height integer axis   (1..12, 0, 13..20 — note the "0" in N26)
 *   B27:V27 leg-height symbol         (S/M/T)
 *   B28:V28 tubing-feet-used          (per leg height)
 *   B17:BJ17 HC raw width axis        (0..60)
 *   B18:BJ18 HC bucketed width        (36/42/48/54/60)
 *   B49:AF49 truss raw width axis     (0..30)
 *   B50:AF50 truss bucketed width     (12/18/20/22/24/26/28/30)
 *   B58:R58 long state-name row       ("Michigan", ..., "Louisiana")
 *   B59:R59 state-code row            ("MI", "IN", "TX", ...)
 *   B60:R67 truss price by width × state-col (8 widths × 17 state cols)
 *   B68:R68 leg-height multiplier per state-col
 *   B69:R69 channel price/ft per state-col
 *   B70:R70 tubing price/ft per state-col
 *   A81:A89 F94 width-axis            (12,18,20,22,24,26,28,30,0)
 *   B80:P80 F94 snow-code header      (15 snow-load codes)
 *   B81:P89 F94 leg-height adjustment table
 *   N73:N77 distinct state codes (UI dropdown)
 */
export function readSnowChangers(sheet: WorkSheet): SnowChangersMatrix {
  // --- Snow-load name → code (rows 9–10, cols B..P)
  const snowLoadNameToCode: Record<string, string> = {};
  const snowLoadCodeOrder: string[] = [];
  const snowLoadsLong: string[] = [];
  for (let c = 2; c <= 16; c++) {
    const long = getString(sheet, colToLetter(c) + "9");
    const code = getString(sheet, colToLetter(c) + "10");
    if (code) snowLoadCodeOrder.push(code);
    if (long && long !== "0") {
      snowLoadsLong.push(long);
      if (code) snowLoadNameToCode[long] = code;
    }
  }

  // --- Leg-height axis (row 26) → symbol (row 27) + tubing feet (row 28)
  const legHeightSymbol: Record<number, string> = {};
  const legHeightTubingFeet: Record<number, number> = {};
  for (let c = 2; c <= 22; c++) {
    const lh = getNumber(sheet, colToLetter(c) + "26");
    if (lh > 0) {
      const sym = getString(sheet, colToLetter(c) + "27");
      const feet = getNumber(sheet, colToLetter(c) + "28");
      if (sym) legHeightSymbol[lh] = sym;
      legHeightTubingFeet[lh] = feet;
    }
  }

  // --- HC width bucket (row 17 → row 18)
  const hcWidthBucket: Record<number, number> = {};
  for (let c = 2; c <= 62; c++) {
    const raw = getNumber(sheet, colToLetter(c) + "17");
    const bucket = getNumber(sheet, colToLetter(c) + "18");
    if (bucket > 0) hcWidthBucket[raw] = bucket;
  }

  // --- Truss width bucket (row 49 → row 50)
  const trussWidthBucket: Record<number, number> = {};
  for (let c = 2; c <= 32; c++) {
    const raw = getNumber(sheet, colToLetter(c) + "49");
    const bucket = getNumber(sheet, colToLetter(c) + "50");
    if (bucket > 0) trussWidthBucket[raw] = bucket;
  }

  // --- Per-state engineering constants (rows 58–70, cols B..R)
  const TRUSS_WIDTH_ROWS: Array<[number, number]> = [
    [60, 12], [61, 18], [62, 20], [63, 22], [64, 24], [65, 26], [66, 28], [67, 30],
  ];
  const byStateName: Record<string, SnowStateConstants> = {};
  for (let c = 2; c <= 18; c++) {
    const colL = colToLetter(c);
    const longName = getString(sheet, `${colL}58`);
    if (!longName) continue;
    const code = getString(sheet, `${colL}59`);
    const trussPriceByWidth: Record<number, number> = {};
    for (const [r, w] of TRUSS_WIDTH_ROWS) {
      const v = getNumber(sheet, `${colL}${r}`);
      if (v > 0) trussPriceByWidth[w] = v;
    }
    byStateName[longName] = {
      code,
      trussPriceByWidth,
      legHeightMult: getNumber(sheet, `${colL}68`),
      channelPricePerFt: getNumber(sheet, `${colL}69`),
      tubingPricePerFt: getNumber(sheet, `${colL}70`),
    };
  }

  // --- F94 leg-height-adjustment table (rows 81–89, cols B..P).
  //     Row axis (A81:A89): truss width buckets (12,18,20,22,24,26,28,30,0).
  //     Col axis (B80:P80): snow-load codes used specifically for F94.
  //     NOTE: row 80 differs from row 10 at column I (row 10 = "30GL", row 80
  //     = "20LL"). Row 10 is the snow-name → code mapping; row 80 is the
  //     actual axis the F94 INDEX/MATCH uses. Read the axis from row 80.
  const f94CodeAxis: string[] = [];
  for (let c = 2; c <= 16; c++) {
    f94CodeAxis.push(getString(sheet, `${colToLetter(c)}80`));
  }
  // The F94 axis (row 80) repeats "30GL" at both B80 and P80. Excel's MATCH
  // returns the FIRST occurrence, so we mirror that — only record the first
  // column for any given code.
  const legHeightAdjust: Record<number, Record<string, number>> = {};
  for (let r = 81; r <= 89; r++) {
    const widthKey = getNumber(sheet, `A${r}`);
    const inner: Record<string, number> = {};
    for (let c = 2; c <= 16; c++) {
      const code = f94CodeAxis[c - 2];
      if (!code || code in inner) continue;
      inner[code] = getNumber(sheet, `${colToLetter(c)}${r}`);
    }
    legHeightAdjust[widthKey] = inner;
  }

  // --- UI dropdowns: distinct state codes from N73:N77
  const states: string[] = [];
  for (let r = 73; r <= 77; r++) {
    const v = getString(sheet, `N${r}`);
    if (v) states.push(v);
  }

  // --- Wind options (row 2 cols B..) — same as before
  const windOptions: number[] = [];
  for (let c = 2; c <= 60; c++) {
    const v = getNumber(sheet, colToLetter(c) + "2");
    if (v > 0 && !windOptions.includes(v)) windOptions.push(v);
  }

  return {
    snowLoadNameToCode,
    snowLoadCodeOrder,
    legHeightSymbol,
    legHeightTubingFeet,
    hcWidthBucket,
    trussWidthBucket,
    byStateName,
    legHeightAdjust,
    states,
    snowLoads: snowLoadsLong,
    windOptions,
  };
}
