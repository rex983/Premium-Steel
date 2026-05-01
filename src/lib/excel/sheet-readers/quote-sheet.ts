import type { WorkSheet } from "xlsx";
import type { QuoteSheetMeta } from "@/types/pricing";
import { getString, getNumber } from "./utils";

/**
 * The PSB-Quote Sheet has many dropdown lists — most reference defined names
 * stored on the workbook. For UI purposes we mostly need the default values
 * (so the calculator renders sensible defaults) and a few hard-coded option lists.
 *
 * The dropdown sources are documented in `bbd-pricer-analysis/quote_sheet_dropdowns.json`.
 */
export function readQuoteSheetMeta(sheet: WorkSheet): QuoteSheetMeta {
  return {
    // Hard-coded inline options from the validation rules:
    buildingTypes: ["Triple Wide", "Commercial", "Garage", "Custom", "RV Cover", "Agricultural Building", "Carport"],
    roofStyles: ["A-Frame Vertical", "A-Frame Horizontal"],
    gaugeOptions: ["14g", "14G", "12g", "12G"],
    sideOptions: ["Fully Enclosed", "Partial Sides", "Open"],
    endOptions: ["Gable", "Enclosed Ends", "Extended Gable"],
    panelOrientations: ["Vertical", "Horizontal"],
    pitchOptions: [0, 4, 5, 6],
    overhangOptions: ["", "12\" Overhang (Vertical Roof ONLY)", "18\" Overhang  (Vertical Roof ONLY)"],
    rudSizes: [], // populated from RUD named-range in accessories parser
    widSizes: [], // populated from WID named-range in accessories parser
    windowSizes: [], // populated from Window named-range in accessories parser
    premiumColors: [], // populated from premiumcolor named-range
    gutterColors: [], // populated from guttercolor named-range
    defaultStateLabel: getString(sheet, "Z10"),
    defaultSnowLoad: getString(sheet, "N55"),
    defaultWindMph: getNumber(sheet, "J55") || 105,
  };
}
