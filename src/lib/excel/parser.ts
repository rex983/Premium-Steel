import * as XLSX from "xlsx";
import type { PSBPricingMatrices } from "@/types/pricing";
import { detectRegion, type RegionDetection } from "./detect-region";
import { getSheet, tryGetSheet } from "./sheet-readers/utils";
import { readQuoteSheetMeta } from "./sheet-readers/quote-sheet";
import { readBase, readRoofPitch, readOverhang } from "./sheet-readers/pricing-base";
import { readRoofStyle } from "./sheet-readers/pricing-roof-style";
import { readLegs } from "./sheet-readers/pricing-legs";
import { readSides } from "./sheet-readers/pricing-sides";
import { readEnds } from "./sheet-readers/pricing-ends";
import { readAccessories } from "./sheet-readers/pricing-accessories";
import { readAnchors } from "./sheet-readers/pricing-anchors";
import { readInsulation } from "./sheet-readers/pricing-insulated";
import { readLaborEquipment } from "./sheet-readers/pricing-labor-eq";
import { readPromotions } from "./sheet-readers/promotions";
import { readPlans } from "./sheet-readers/plans-for-buildings";
import { readChangers } from "./sheet-readers/pricing-changers";
import { readSnowChangers } from "./sheet-readers/snow-changers";
import { readSnowTrusses } from "./sheet-readers/snow-trusses";
import { readSnowTrussSpacing } from "./sheet-readers/snow-truss-spacing";
import { readSnowHatChannels } from "./sheet-readers/snow-hat-channels";
import { readSnowVerticals } from "./sheet-readers/snow-verticals";
import { readSnowGirts } from "./sheet-readers/snow-girts";
import { readSnowDiagonalBracing } from "./sheet-readers/snow-diagonal-bracing";
import { validateMatrices, type ValidationResult } from "./validators";

export const PARSER_VERSION = "0.2.1";

export interface ParseResult {
  detection: RegionDetection;
  matrices: PSBPricingMatrices;
  validation: ValidationResult;
}

/**
 * Main entry point — parse a PSB workbook (south or north) into normalized matrices.
 */
export function parsePsbWorkbook(
  buffer: ArrayBuffer | Uint8Array,
  filename?: string
): ParseResult {
  const workbook = XLSX.read(buffer, { type: "array" });
  const detection = detectRegion(workbook, filename);

  const meta = readQuoteSheetMeta(getSheet(workbook, "PSB-Quote Sheet"));

  const baseSheet = getSheet(workbook, "Pricing - Base");
  const base = readBase(baseSheet);
  const roofPitch = readRoofPitch(baseSheet);
  const overhang = readOverhang(baseSheet);

  const roofStyle = readRoofStyle(getSheet(workbook, "Pricing - Roof Style"));
  const legs = readLegs(getSheet(workbook, "Pricing - Legs"));
  const sides = readSides(getSheet(workbook, "Pricing - Sides"));
  const ends = readEnds(getSheet(workbook, "Pricing - Ends"));
  const accessories = readAccessories(getSheet(workbook, "Pricing - Accessories"));
  const anchors = readAnchors(getSheet(workbook, "Pricing - Anchors"));
  const insulation = readInsulation(getSheet(workbook, "Pricing - Insulated"));
  const laborEquipment = readLaborEquipment(getSheet(workbook, "Pricing - Labor-EQ"));
  const promotions = readPromotions(getSheet(workbook, "Promotions"));
  const plans = readPlans(getSheet(workbook, "Plans for Buildings"));
  const changers = readChangers(getSheet(workbook, "Pricing - Changers"));

  const snowChangers = readSnowChangers(getSheet(workbook, "Snow - Changers"));
  const snowTrusses = readSnowTrusses(getSheet(workbook, "Snow - Trusses"));
  const snowTrussSpacing = readSnowTrussSpacing(getSheet(workbook, "Snow - Truss Spacing"));
  const snowHat = readSnowHatChannels(getSheet(workbook, "Snow - Hat Channels"));
  const snowVerticals = readSnowVerticals(getSheet(workbook, "Snow - Verticals"));
  const snowGirts = readSnowGirts(getSheet(workbook, "Snow - Girts"));
  const snowDB = tryGetSheet(workbook, "Snow - Diagonal Bracing");
  const diagonalBracing = snowDB
    ? readSnowDiagonalBracing(snowDB)
    : { matrix: {} } as ReturnType<typeof readSnowDiagonalBracing>;

  const matrices: PSBPricingMatrices = {
    region: detection.region,
    filenameStates: detection.states,
    parsedAt: new Date().toISOString(),
    parserVersion: PARSER_VERSION,
    meta,
    base,
    roofStyle,
    legs,
    sides,
    ends,
    accessories,
    anchors,
    insulation,
    laborEquipment,
    promotions,
    plans,
    changers,
    snow: {
      changers: snowChangers,
      trusses: snowTrusses,
      trussSpacing: snowTrussSpacing,
      hatChannels: snowHat,
      verticals: snowVerticals,
      girts: snowGirts,
      diagonalBracing,
    },
    roofPitch,
    overhang,
  };

  const validation = validateMatrices(matrices);

  return { detection, matrices, validation };
}
