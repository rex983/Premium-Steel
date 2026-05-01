import type { WorkSheet } from "xlsx";
import type { PlansMatrix } from "@/types/pricing";
import { getNumber } from "./utils";

/**
 * Plans for Buildings — Plans + Calcs cost by W×L, plus leg-height upcharge and door-opening upcharge.
 *
 * Layout:
 *   Plans matrix:  rows 2..18 (length 20..100), cols C..L (width 12..30) → C2:L18
 *   Calcs matrix:  rows 2..18 (length 20..100), cols Q..Z (width 12..30) → Q2:Z18
 *   Leg-height upcharge:  B28:C42 (legHeight → cost)
 *   Door-opening cost:    K35:L47 (doorCount → cost)
 */
export function readPlans(sheet: WorkSheet): PlansMatrix {
  const lengths: number[] = [];
  for (let r = 2; r <= 18; r++) {
    lengths.push(getNumber(sheet, `A${r}`));
  }

  const widths: number[] = [];
  for (let c = 3; c <= 12; c++) {
    widths.push(getNumber(sheet, colToLetter(c) + "1"));
  }

  const plans: Record<number, Record<number, number>> = {};
  for (let r = 2; r <= 18; r++) {
    const len = getNumber(sheet, `A${r}`);
    plans[len] = {};
    for (let c = 3; c <= 12; c++) {
      const w = getNumber(sheet, colToLetter(c) + "1");
      plans[len][w] = getNumber(sheet, colToLetter(c) + r);
    }
  }

  const calcs: Record<number, Record<number, number>> = {};
  for (let r = 2; r <= 18; r++) {
    const len = getNumber(sheet, `P${r}`);
    if (len <= 0) continue;
    calcs[len] = {};
    for (let c = 17; c <= 26; c++) {
      const w = getNumber(sheet, colToLetter(c) + "1");
      calcs[len][w] = getNumber(sheet, colToLetter(c) + r);
    }
  }

  const legSurcharge: Record<number, number> = {};
  for (let r = 28; r <= 42; r++) {
    const lh = getNumber(sheet, `B${r}`);
    if (lh <= 0) continue;
    legSurcharge[lh] = getNumber(sheet, `C${r}`);
  }

  const doorOpeningCost: Record<number, number> = {};
  for (let r = 35; r <= 47; r++) {
    const dc = getNumber(sheet, `K${r}`);
    if (dc < 0) continue;
    doorOpeningCost[dc] = getNumber(sheet, `L${r}`);
  }

  return { plans, calcs, legSurcharge, doorOpeningCost };
}

function colToLetter(col: number): string {
  let s = "";
  while (col > 0) {
    const rem = (col - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    col = Math.floor((col - 1) / 26);
  }
  return s;
}
