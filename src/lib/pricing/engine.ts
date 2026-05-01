import type { PSBPricingMatrices } from "@/types/pricing";
import type { BuildingConfig, EngineOutput, LineItem } from "./types";
import { calcBasePrice } from "./base";
import { calcRoofPitch } from "./roof-pitch";
import { calcOverhang } from "./overhang";
import { calcRoofStyle } from "./roof-style";
import { calcLegs } from "./legs";
import { calcSides, calcWainscotSide } from "./sides";
import { calcEnds, calcWainscotEnd } from "./ends";
import {
  calcWalkInDoors, calcWindows, calcRollUpDoors, calcExtras, calcInteriorWalls,
  calcBaseTrim, calcFoamClosure, calc26gaUpgrade, calcPremiumColors,
  calcColorScrews, calcGutter, calcExtraSheetMetal, calcFrameOuts, calcJTrim,
  calcLaborFees,
} from "./accessories";
import { calcAnchors } from "./anchors";
import { calcInsulation } from "./insulation";
import { calcEquipmentLabor } from "./labor";
import { calcSnowEngineering } from "./snow-engineering";
import { calcPromoDiscount } from "./promotions";
import { calcPlansCost, calcCalcsCost } from "./plans";
import { computeTotals } from "./totals";

/**
 * Main PSB pricing engine.
 *
 * Reproduces the PSB-Quote Sheet's calculations. Returns line items, totals,
 * and the engineering breakdown. Mirrors spreadsheet rows 24–55 + AC totals.
 */
export function priceBuilding(
  config: BuildingConfig,
  matrices: PSBPricingMatrices
): EngineOutput {
  const lineItems: LineItem[] = [];

  const basePrice = calcBasePrice(config, matrices.base);
  push(lineItems, "base", "BASE PRICE", basePrice);

  const roofStyle = calcRoofStyle(config, matrices.roofStyle);
  push(lineItems, "roofStyle", "Roof Style", roofStyle);

  const legs = calcLegs(config, matrices.legs);
  push(lineItems, "legs", "Height", legs);

  const sides = calcSides(config, matrices.sides);
  push(lineItems, "sides", "Sides", sides);

  const ends = calcEnds(config, matrices.ends);
  push(lineItems, "ends", "Ends", ends);

  // Walk-in doors (2 lines)
  const wid = calcWalkInDoors(config, matrices.accessories);
  push(lineItems, "wid1", "Entry Door", wid[0]);
  push(lineItems, "wid2", "Entry Door", wid[1]);

  // Windows (2 lines)
  const win = calcWindows(config, matrices.accessories);
  push(lineItems, "win1", "Windows Option", win[0]);
  push(lineItems, "win2", "Windows Option", win[1]);

  // Roll-up doors (3 lines)
  const rud = calcRollUpDoors(config, matrices.accessories);
  push(lineItems, "rud1", "Roll up Door", rud[0]);
  push(lineItems, "rud2", "Roll up Door", rud[1]);
  push(lineItems, "rud3", "Roll up Door", rud[2]);

  // Anchors / Insulation
  push(lineItems, "anchors", "Anchors", calcAnchors(config, matrices.anchors));
  push(lineItems, "insulation", "Insulation", calcInsulation(config, matrices.insulation));

  // Pitch / Overhang
  push(lineItems, "pitch", "Roof Pitch", calcRoofPitch(config, matrices.roofPitch, basePrice));
  push(lineItems, "overhang", "Overhang", calcOverhang(config, matrices.overhang, basePrice));

  // Wainscot
  push(lineItems, "wainscotEnd", "Wainscot (End)", calcWainscotEnd(config, matrices.ends, (config.wainscotEndQty ?? 0) as 0 | 1 | 2));
  push(lineItems, "wainscotSide", "Wainscot (Side)", calcWainscotSide(config, matrices.sides, (config.wainscotSideQty ?? 0) as 0 | 1 | 2));

  // Trim / Foam / Gutter / Screws / 26ga / Premium
  push(lineItems, "baseTrim", "Base Trim", calcBaseTrim(config, matrices.accessories));
  push(lineItems, "foam", "Foam Closure Package", calcFoamClosure(config, matrices.accessories));
  push(lineItems, "gutter", '6" K-style Gutter', calcGutter(config, matrices.accessories));
  push(lineItems, "colorScrews", "Color Screws", calcColorScrews(config, matrices.accessories));
  push(lineItems, "extraSheet", "Extra Sheet Metal", calcExtraSheetMetal(config, matrices.accessories));
  push(lineItems, "frameOuts", "Frame Outs", calcFrameOuts(config, matrices.accessories));
  push(lineItems, "26ga", "26ga Upgrade", calc26gaUpgrade(config, matrices.accessories));
  push(lineItems, "premium", "Premium Colors", calcPremiumColors(config, matrices.accessories));

  // Extras + interior walls
  const extras = calcExtras(config, matrices.accessories);
  push(lineItems, "extras1", "Extras", extras[0]);
  push(lineItems, "extras2", "Extras", extras[1]);
  push(lineItems, "interior", "Interior Walls", calcInteriorWalls(config, matrices.accessories));

  // Labor fees (on the line-item side; equipmentLabor goes into totals separately)
  const labor = calcLaborFees(config, matrices.accessories);
  push(lineItems, "laborFee1", "Labor Fees", labor[0]);
  push(lineItems, "laborFee2", "Labor Fees", labor[1]);

  // Snow engineering (R55)
  const engineering = calcSnowEngineering(config, matrices.snow);

  // Promo (R24:U52 + R55 sum × tier pct)
  const lineSum = lineItems.reduce((s, li) => s + li.price, 0);
  const promoDiscount = calcPromoDiscount(config.promoTier, matrices.promotions, lineSum + engineering.totalEngineering);

  // Equipment / additional labor (added in totals, not as line items)
  const equipmentLabor = calcEquipmentLabor(config, matrices.laborEquipment);
  const additionalLabor = labor[0] + labor[1];

  // Plans / Calcs (display only)
  const plansCost = calcPlansCost(config, matrices.plans);
  const calcsCost = calcCalcsCost(config, matrices.plans);

  const totals = computeTotals(
    lineItems,
    engineering.totalEngineering,
    promoDiscount,
    config.taxPct ?? 0.07,
    config.depositPct ?? 0.10,
    equipmentLabor,
    additionalLabor,
    plansCost,
    calcsCost
  );

  return {
    lineItems: lineItems.filter((li) => li.price !== 0),
    totals,
    engineeringBreakdown: engineering,
    inputs: config,
    region: matrices.region,
  };
}

function push(arr: LineItem[], key: string, label: string, price: number) {
  arr.push({ key, label, price });
}
