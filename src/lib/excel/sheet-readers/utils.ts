import type { WorkSheet, WorkBook } from "xlsx";
import { utils as XLSXUtils } from "xlsx";

/** Get the cached value of a cell, or `undefined`. Numbers come through as numbers. */
export function getCell(sheet: WorkSheet, address: string): unknown {
  const cell = sheet[address];
  return cell?.v;
}

export function getNumber(sheet: WorkSheet, address: string): number {
  const v = getCell(sheet, address);
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    if (!isNaN(n)) return n;
  }
  return 0;
}

export function getString(sheet: WorkSheet, address: string): string {
  const v = getCell(sheet, address);
  return v == null ? "" : String(v);
}

/**
 * Read a 2D rectangular range of values into a matrix.
 * Returns { headers: row[0], rows: row[1..] }.
 */
export function readRange(
  sheet: WorkSheet,
  startCol: string,
  startRow: number,
  endCol: string,
  endRow: number
): unknown[][] {
  const rows: unknown[][] = [];
  const startC = XLSXUtils.decode_col(startCol);
  const endC = XLSXUtils.decode_col(endCol);
  for (let r = startRow; r <= endRow; r++) {
    const row: unknown[] = [];
    for (let c = startC; c <= endC; c++) {
      const addr = XLSXUtils.encode_cell({ r: r - 1, c });
      row.push(sheet[addr]?.v ?? null);
    }
    rows.push(row);
  }
  return rows;
}

/**
 * Find a sheet by name, tolerating trailing spaces (e.g. "Snow - Trusses ").
 */
export function findSheet(workbook: WorkBook, name: string): WorkSheet | null {
  if (workbook.Sheets[name]) return workbook.Sheets[name];
  if (workbook.Sheets[name + " "]) return workbook.Sheets[name + " "];
  const trimmed = name.trim();
  if (workbook.Sheets[trimmed]) return workbook.Sheets[trimmed];
  for (const key of Object.keys(workbook.Sheets)) {
    if (key.trim() === trimmed) return workbook.Sheets[key];
  }
  return null;
}

export function getSheet(workbook: WorkBook, name: string): WorkSheet {
  const ws = findSheet(workbook, name);
  if (!ws) throw new Error(`Sheet "${name}" not found in workbook`);
  return ws;
}

export function tryGetSheet(workbook: WorkBook, name: string): WorkSheet | null {
  return findSheet(workbook, name);
}

/** Coerce something that might be string/number/null to a number, defaulting to 0. */
export function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    if (!isNaN(n)) return n;
  }
  return 0;
}

/** Coerce to string, defaulting to "". */
export function str(v: unknown): string {
  return v == null ? "" : String(v);
}
