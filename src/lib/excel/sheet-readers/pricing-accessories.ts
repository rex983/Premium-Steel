import type { WorkSheet } from "xlsx";
import type { AccessoriesMatrix, AccessoryItem, DoorOption } from "@/types/pricing";
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
    windowsExtras: [],
    frameOuts: [],
    jtrim: readLabelPriceList(sheet, "C", 37, 39, "D"),
    baseTrim: [],
    foamClosure: [],
    extras: readLabelPriceList(sheet, "A", 24, 35, "B"),
    interiorWalls: readLabelPriceList(sheet, "A", 27, 28, "B"),
    laborFees: readLabelPriceList(sheet, "O", 38, 40, "P"),
    headerSeal: readLabelPriceList(sheet, "P", 31, 32, "Q"),
    bt: getNumber(sheet, "H16"),
    fcp: getNumber(sheet, "AG2"),
    raw: rawGrid(sheet, 68, 52),
  } as AccessoriesMatrix & { raw: RawGrid };
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
