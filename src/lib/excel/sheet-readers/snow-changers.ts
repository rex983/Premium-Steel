import type { WorkSheet } from "xlsx";
import type { SnowChangersMatrix } from "@/types/pricing";
import { getString, getNumber } from "./utils";
import { rawGrid, type RawGrid } from "./_raw-grid";

/**
 * Snow - Changers — state config + snow-load options + key engineering constants.
 *
 * Defined-name sources & key cells:
 *   - Snow      B9:P9    (snow load options 30..90 GL + 20..61 RL)
 *   - WInd      B1:FZ1   (wind options — 105 default)
 *   - State     N73:N77  (state list)
 *   - C102                = 1 if (wind > 130 OR snow != 30GL), else 0
 *   - G76                 truss price ($/ft)
 *   - J72                 leg-height price multiplier
 *   - J75                 channel price per foot
 *   - J76                 vertical tubing price per foot
 *   - D74                 default state code (e.g. "IN" or "MI")
 */
export function readSnowChangers(sheet: WorkSheet): SnowChangersMatrix {
  // Snow loads B9:P9 (cols 2..16)
  const snowLoads: string[] = [];
  for (let c = 2; c <= 16; c++) {
    const v = getString(sheet, colToLetter(c) + "9");
    if (v && v !== "0") snowLoads.push(v);
  }

  // Wind: typically 105 only seen in default; capture row 2 col B onward
  const windOptions: number[] = [];
  for (let c = 2; c <= 60; c++) {
    const v = getNumber(sheet, colToLetter(c) + "2");
    if (v > 0 && !windOptions.includes(v)) windOptions.push(v);
  }

  // States from N73:N77
  const states: string[] = [];
  for (let r = 73; r <= 77; r++) {
    const v = getString(sheet, `N${r}`);
    if (v) states.push(v);
  }

  return {
    states,
    snowLoads,
    windOptions,
    trussPrice: getNumber(sheet, "G76"),
    legHeightPrice: getNumber(sheet, "J72"),
    pricePerFoot: getNumber(sheet, "J75"),
    tubingPricePerFt: getNumber(sheet, "J76"),
    raw: rawGrid(sheet, 105, 182),
  } as SnowChangersMatrix & { raw: RawGrid };
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
