import type { WorkSheet } from "xlsx";
import type {
  AccessoriesMatrix, AccessoryItem, DoorOption, RudSealAdder,
  FoamClosureMatrix, FrameOutsMatrix, LaborFeeMatrix,
} from "@/types/pricing";
import { getString, getNumber, num, str } from "./utils";
import { rawGrid, type RawGrid } from "./_raw-grid";

/**
 * Pricing - Accessories — the heaviest accessory sheet (68×52, 178 formulas, 16
 * back-references from the quote sheet).
 *
 * Defined-name source ranges (from analysis):
 *   - Window     A2:A10    (window options)
 *   - WID        H2:H11    (walk-in doors)
 *   - RUD        P2:P25    (roll-up doors with their sizes)
 *   - extras*    A24:A35   (extras)
 *   - extrasheet1 A37:A39  (extra sheet metal)
 *   - jtrim1     C37:C39
 *   - laborfee12 O38:O40
 *   - seal       P31:P32
 *   - bt         H16
 *   - baset      H16:H17
 *   - fcp        AG2
 *
 * For Phase 2 we capture the labeled lists. Per-sheet refinement continues.
 */
export function readAccessories(sheet: WorkSheet): AccessoriesMatrix {
  return {
    walkInDoors: readLabelPriceList(sheet, "H", 2, 11, "I"),
    windows: readLabelPriceList(sheet, "A", 2, 10, "B"),
    rollUpDoors: readRollUpDoors(sheet),
    rudSidePositionAdders: readRudSidePositionAdders(sheet),
    rudSealAdders: readRudSealAdders(sheet),
    windowsExtras: [],
    jtrim: readLabelPriceList(sheet, "C", 37, 39, "D"),
    baseTrim: readBaseTrimOptions(sheet),
    extras: readLabelPriceList(sheet, "A", 24, 35, "B"),
    interiorWalls: readLabelPriceList(sheet, "A", 27, 28, "B"),
    headerSeal: readLabelPriceList(sheet, "P", 31, 32, "Q"),
    sheetMetal: readLabelPriceList(sheet, "A", 37, 40, "B"),
    foamClosure: readFoamClosure(sheet),
    frameOuts: readFrameOuts(sheet),
    laborFees: readLaborFees(sheet),
    bt: getNumber(sheet, "G16"),
    fcp: getNumber(sheet, "AG2"),
    raw: rawGrid(sheet, 68, 52),
  } as AccessoriesMatrix & { raw: RawGrid };
}

/**
 * Foam closure package — header AI2:AT2 (length in 5-ft steps from 20 to 75),
 * prices AI3:AT3. The dropdown label (AS5) is the user-facing "Foam Closure
 * Package" string.
 */
function readFoamClosure(sheet: WorkSheet): FoamClosureMatrix {
  const cols = ["AI","AJ","AK","AL","AM","AN","AO","AP","AQ","AR","AS","AT"];
  const byLength: { length: number; price: number }[] = [];
  for (const c of cols) {
    const length = num(sheet[`${c}2`]?.v);
    const price = num(sheet[`${c}3`]?.v);
    if (length > 0 && price > 0) byLength.push({ length, price });
  }
  byLength.sort((a, b) => a.length - b.length);
  const label = str(sheet["AS5"]?.v).trim() || "Foam Closure Package";
  return { byLength, label };
}

/**
 * Frame outs — 2D matrix.
 *   O53:O62 = heights (7,8,9,10,11,12,14,16,18,20)
 *   Q52:U52 = widths  (4,8,12,16,20) — column P52 = "0" (placeholder)
 *   Q53:U62 = prices[height][width]
 *   O66:U67 = side/end adder by width
 */
function readFrameOuts(sheet: WorkSheet): FrameOutsMatrix {
  const widthCols = ["Q","R","S","T","U"];
  const widths: number[] = widthCols.map((c) => num(sheet[`${c}52`]?.v));
  const heightRows = [53,54,55,56,57,58,59,60,61,62];
  const heights: number[] = [];
  const prices: number[][] = [];
  for (const r of heightRows) {
    const h = num(sheet[`O${r}`]?.v);
    if (h <= 0) continue;
    heights.push(h);
    prices.push(widthCols.map((c) => num(sheet[`${c}${r}`]?.v)));
  }
  // Side adder row 66 (END at row 67 is always 0).
  const sideAdderByWidth = widthCols.map((c) => num(sheet[`${c}66`]?.v));
  return { heights, widths, prices, sideAdderByWidth };
}

/**
 * Labor fees — labels in O38:O40, lengths in P37:Z37, prices in P38:Z40.
 *   Lengths: 20,25,30,35,40,45,50,55,60,65,70
 *   Labels: "Side Connection Fee Per Side", "Build Over Fee", "Cut Legs On Site"
 */
function readLaborFees(sheet: WorkSheet): LaborFeeMatrix {
  const lengthCols = ["P","Q","R","S","T","U","V","W","X","Y","Z"];
  const lengths = lengthCols.map((c) => num(sheet[`${c}37`]?.v));
  const labelRows = [38, 39, 40];
  const labels: string[] = [];
  const prices: number[][] = [];
  for (const r of labelRows) {
    const label = str(sheet[`O${r}`]?.v).trim();
    if (!label || label === "0") continue;
    labels.push(label);
    prices.push(lengthCols.map((c) => num(sheet[`${c}${r}`]?.v)));
  }
  return { labels, lengths, prices };
}

/**
 * Base trim options — H16:I17. Only "Full Perimeter Base Trim" has a real price
 * (computed dynamically from perimeter × G16 rate).
 */
function readBaseTrimOptions(sheet: WorkSheet): AccessoryItem[] {
  const items: AccessoryItem[] = [];
  for (let r = 16; r <= 17; r++) {
    const label = str(sheet[`H${r}`]?.v);
    if (!label) continue;
    items.push({ label, price: 0 }); // engine computes dynamic price
  }
  return items;
}

/**
 * Read a label/price pair from two adjacent columns.
 * Stops on empty label.
 */
function readLabelPriceList(
  sheet: WorkSheet,
  labelCol: string,
  startRow: number,
  endRow: number,
  priceCol: string
): AccessoryItem[] {
  const items: AccessoryItem[] = [];
  for (let r = startRow; r <= endRow; r++) {
    const label = getString(sheet, `${labelCol}${r}`);
    if (!label) continue;
    const price = num(sheet[`${priceCol}${r}`]?.v);
    items.push({ label, price });
  }
  return items;
}

/**
 * RUD — roll-up doors. Source range P2:P25.
 * Adjacent columns hold the prices per side/end.
 * For Phase 2 first-pass, return label + price-from-adjacent column.
 */
function readRollUpDoors(sheet: WorkSheet): DoorOption[] {
  const items: DoorOption[] = [];
  for (let r = 2; r <= 25; r++) {
    const label = str(sheet[`P${r}`]?.v);
    if (!label) continue;
    const price = num(sheet[`Q${r}`]?.v);
    items.push({ label, price });
  }
  return items;
}

/**
 * Roll-up door side/end position adder. Spreadsheet stores it at W5:X6:
 *   W5 "Type"   X5 "10' Header"
 *   W6 "SIDE"   X6 280
 * The quote uses VLOOKUP(position, W5:X6, 2, FALSE) wrapped in IFERROR(...,"0"),
 * so any non-SIDE position (e.g. END) returns 0.
 */
function readRudSidePositionAdders(sheet: WorkSheet): AccessoryItem[] {
  const items: AccessoryItem[] = [];
  for (let r = 5; r <= 10; r++) {
    const label = str(sheet[`W${r}`]?.v);
    if (!label || label.toLowerCase() === "type") continue;
    const price = num(sheet[`X${r}`]?.v);
    items.push({ label, price });
  }
  return items;
}

/**
 * Roll-up door seal adder. Spreadsheet R1:T25 with R = size, S = "Brush Seal Option",
 * T = "Header Seal only Option". Quote uses VLOOKUP(size, R1:T25, col, FALSE) where
 * col = 2 for Brush Seal, 3 for Header Seal only.
 */
function readRudSealAdders(sheet: WorkSheet): RudSealAdder[] {
  const items: RudSealAdder[] = [];
  for (let r = 2; r <= 25; r++) {
    const size = str(sheet[`R${r}`]?.v);
    if (!size) continue;
    items.push({
      size,
      brushSeal: num(sheet[`S${r}`]?.v),
      headerSeal: num(sheet[`T${r}`]?.v),
    });
  }
  return items;
}
