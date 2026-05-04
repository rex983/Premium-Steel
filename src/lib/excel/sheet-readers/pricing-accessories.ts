import type { WorkSheet } from "xlsx";
import type { AccessoriesMatrix, AccessoryItem, DoorOption, RudSealAdder } from "@/types/pricing";
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
    frameOuts: [],
    jtrim: readLabelPriceList(sheet, "C", 37, 39, "D"),
    baseTrim: readBaseTrimOptions(sheet),
    foamClosure: [],
    extras: readLabelPriceList(sheet, "A", 24, 35, "B"),
    interiorWalls: readLabelPriceList(sheet, "A", 27, 28, "B"),
    laborFees: readLabelPriceList(sheet, "O", 38, 40, "P"),
    headerSeal: readLabelPriceList(sheet, "P", 31, 32, "Q"),
    bt: getNumber(sheet, "G16"),
    fcp: getNumber(sheet, "AG2"),
    raw: rawGrid(sheet, 68, 52),
  } as AccessoriesMatrix & { raw: RawGrid };
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
