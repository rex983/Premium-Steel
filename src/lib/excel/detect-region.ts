import type { WorkBook } from "xlsx";
import { getCell, findSheet } from "./sheet-readers/utils";
import type { Region } from "@/types/pricing";

// Detection accepts old and new region membership so re-uploads of prior
// workbook versions still classify correctly.
const SOUTH_STATE_NAMES = new Set([
  "Indiana", "Ohio", "Illinois", "Kentucky", "Tennessee", "West Virginia", "West Virgina",
  "Texas", // added 2026-07-26 batch
  "Missouri", // removed 2026-07-26 batch but retained for legacy uploads
]);
const NORTH_STATE_NAMES = new Set([
  "Michigan", "Wisconsin", "Pennsylvania",
  "Minnesota", // removed 2026-07-26 batch but retained for legacy uploads
]);

const SOUTH_STATE_CODES = ["IN", "OH", "KY", "IL", "TN", "WV", "TX", "MO"];
const NORTH_STATE_CODES = ["MI", "WI", "PA", "MN"];

const VALID_STATES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN",
  "IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV",
  "NH","NJ","NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN",
  "TX","UT","VT","VA","WA","WV","WI","WY",
]);

export interface RegionDetection {
  region: Region;
  states: string[];          // 2-letter codes derived from filename
  defaultStateLabel: string; // "Indiana", "Michigan", ...
  sheetCount: number;
  confidence: "high" | "medium" | "low";
  reasons: string[];
}

/**
 * Detect whether a workbook is the South or North variant.
 *
 * Signals (in order of strength):
 *   1. Filename state codes — "IN OH KY ..." → south, "MI WI PA MN" → north
 *   2. PSB-Quote Sheet Z10 default state name
 *   3. Snow - Changers D74 (default state code "IN" / "MI")
 */
export function detectRegion(workbook: WorkBook, filename?: string): RegionDetection {
  const reasons: string[] = [];
  const sheetCount = workbook.SheetNames.length;

  // 1. Filename
  const filenameStates = filename ? extractStatesFromFilename(filename) : [];
  let regionFromFile: Region | null = null;
  if (filenameStates.length > 0) {
    // Pick region by majority of matched states (handles new "TX, IN, OH…" format
    // where the first token might be a state not in the historical region set).
    let southHits = 0, northHits = 0;
    for (const s of filenameStates) {
      if (SOUTH_STATE_CODES.includes(s)) southHits++;
      if (NORTH_STATE_CODES.includes(s)) northHits++;
    }
    if (southHits > northHits) regionFromFile = "south";
    else if (northHits > southHits) regionFromFile = "north";
    reasons.push(`filename states = ${JSON.stringify(filenameStates)}`);
  }

  // 2. PSB-Quote Sheet Z10
  const quoteSheet = findSheet(workbook, "PSB-Quote Sheet");
  let defaultStateLabel = "";
  let regionFromZ10: Region | null = null;
  if (quoteSheet) {
    const z10 = String(getCell(quoteSheet, "Z10") ?? "");
    defaultStateLabel = z10;
    if (SOUTH_STATE_NAMES.has(z10)) regionFromZ10 = "south";
    if (NORTH_STATE_NAMES.has(z10)) regionFromZ10 = "north";
    if (z10) reasons.push(`PSB-Quote Sheet Z10 = "${z10}"`);
  }

  // 3. Snow - Changers D74 (state code default)
  const snowChangers = findSheet(workbook, "Snow - Changers");
  let regionFromSnow: Region | null = null;
  if (snowChangers) {
    const d74 = String(getCell(snowChangers, "D74") ?? "").toUpperCase();
    if (SOUTH_STATE_CODES.includes(d74)) regionFromSnow = "south";
    if (NORTH_STATE_CODES.includes(d74)) regionFromSnow = "north";
    if (d74) reasons.push(`Snow - Changers D74 = "${d74}"`);
  }

  // Pick best signal
  const signals = [regionFromFile, regionFromZ10, regionFromSnow].filter(Boolean) as Region[];
  let region: Region;
  let confidence: "high" | "medium" | "low";

  if (signals.length === 0) {
    region = "south";
    confidence = "low";
    reasons.push("No region signals found — defaulting to south");
  } else {
    const counts = signals.reduce<Record<string, number>>((acc, s) => {
      acc[s] = (acc[s] || 0) + 1;
      return acc;
    }, {});
    region = (counts.south || 0) >= (counts.north || 0) ? "south" : "north";
    if (signals.length === 3 && signals.every((s) => s === region)) confidence = "high";
    else if (signals.length >= 2) confidence = "medium";
    else confidence = "low";
  }

  return {
    region,
    states: filenameStates,
    defaultStateLabel,
    sheetCount,
    confidence,
    reasons,
  };
}

function extractStatesFromFilename(filename: string): string[] {
  // Handles both the old format
  //   "IN OH KY IL TN WV MO 1_26_26.xlsx"          (space/underscore-separated)
  // and the new 07-26 format
  //   "PSB -TX, IN, OH, KY, IL, TN, WV, -07-26.xlsx" (comma-separated with dashes)
  const name = filename.replace(/\.[^.]+$/, "");
  const parts = name.split(/[-\s_,]+/);
  const states: string[] = [];
  for (const part of parts) {
    const up = part.toUpperCase();
    if (VALID_STATES.has(up)) {
      if (!states.includes(up)) states.push(up);
    }
    // Don't `break` on numerics — new filenames have "07-26" between state codes
    // and the date isn't a stop signal since dashes already split tokens.
  }
  return states;
}
