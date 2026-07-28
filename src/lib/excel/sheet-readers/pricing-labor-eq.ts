import type { WorkSheet } from "xlsx";
import type { LaborEquipmentMatrix } from "@/types/pricing";
import { rawGrid, type RawGrid } from "./_raw-grid";

const CATEGORY_ROW_START = 23; // B23:I37 — category matrix rows
const CATEGORY_ROW_END = 37;
const CATEGORY_COL_START = 2;  // B
const CATEGORY_COL_END = 9;    // I

const RATE_ROW_START = 2;      // B2:Y18 — rate matrix rows
const RATE_ROW_END = 18;
const RATE_COL_START = 2;      // B
const RATE_COL_END = 25;       // Y

/**
 * Pricing - Labor-EQ — extracts the state/width category matrix (B23:I37) and the
 * length/(width+cat) rate matrix (B2:Y18) that drive PSB-Quote AC36 = N29.
 *
 * See LaborEquipmentMatrix docstring in @/types/pricing for formula details.
 *
 * Note: N29 depends on the region's state — a single workbook covers all states
 * in its region, so the category matrix already encodes that.
 */
export function readLaborEquipment(sheet: WorkSheet): LaborEquipmentMatrix {
  const grid = rawGrid(sheet, 42, 25);

  // Widths: B22:I22
  const widths: number[] = [];
  for (let c = CATEGORY_COL_START; c <= CATEGORY_COL_END; c++) {
    const v = grid[22]?.[colLetter(c)];
    widths.push(typeof v === "number" ? v : Number(v) || 0);
  }

  // Heights: A23:A37
  const heights: number[] = [];
  for (let r = CATEGORY_ROW_START; r <= CATEGORY_ROW_END; r++) {
    const v = grid[r]?.["A"];
    heights.push(typeof v === "number" ? v : Number(v) || 0);
  }

  // Category matrix: B23:I37
  const categoryMatrix: ("S" | "T" | "ET")[][] = [];
  for (let r = CATEGORY_ROW_START; r <= CATEGORY_ROW_END; r++) {
    const row: ("S" | "T" | "ET")[] = [];
    for (let c = CATEGORY_COL_START; c <= CATEGORY_COL_END; c++) {
      const v = String(grid[r]?.[colLetter(c)] ?? "").trim().toUpperCase();
      row.push(v === "T" ? "T" : v === "ET" ? "ET" : "S");
    }
    categoryMatrix.push(row);
  }

  // Lengths: A2:A18
  const lengths: number[] = [];
  for (let r = RATE_ROW_START; r <= RATE_ROW_END; r++) {
    const v = grid[r]?.["A"];
    lengths.push(typeof v === "number" ? v : Number(v) || 0);
  }

  // Rate headers: B1:Y1 (e.g. "12S","18S",...,"30ET")
  const rateHeaders: string[] = [];
  for (let c = RATE_COL_START; c <= RATE_COL_END; c++) {
    rateHeaders.push(String(grid[1]?.[colLetter(c)] ?? "").trim());
  }

  // Rate matrix: B2:Y18
  const rateMatrix: number[][] = [];
  for (let r = RATE_ROW_START; r <= RATE_ROW_END; r++) {
    const row: number[] = [];
    for (let c = RATE_COL_START; c <= RATE_COL_END; c++) {
      const v = grid[r]?.[colLetter(c)];
      row.push(typeof v === "number" ? v : Number(v) || 0);
    }
    rateMatrix.push(row);
  }

  return {
    laborOptions: [],
    equipmentOptions: [],
    widths,
    heights,
    categoryMatrix,
    lengths,
    rateHeaders,
    rateMatrix,
    raw: grid,
  } as LaborEquipmentMatrix & { raw: RawGrid };
}

function colLetter(col: number): string {
  let s = "";
  while (col > 0) {
    const rem = (col - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    col = Math.floor((col - 1) / 26);
  }
  return s;
}
