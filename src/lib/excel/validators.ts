import type { PSBPricingMatrices } from "@/types/pricing";

export interface ValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  stats: Record<string, number | string>;
}

/**
 * Validate the parsed matrices.
 *
 * Phase 2 first-pass: structural sanity checks. Phase 3 will add golden-case
 * validation — feed known (inputs → expected total) cases captured from the
 * spreadsheet's cached values and assert the engine's output matches.
 */
export function validateMatrices(m: PSBPricingMatrices): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const stats: Record<string, number | string> = {
    region: m.region,
    parserVersion: m.parserVersion,
    baseLengthCount: m.base.lengths.length,
    baseWidthGaugeCount: m.base.widthGaugeKeys.length,
    basePriceCount: Object.keys(m.base.prices).length,
    rollUpDoorCount: m.accessories.rollUpDoors.length,
    walkInDoorCount: m.accessories.walkInDoors.length,
    windowCount: m.accessories.windows.length,
    anchorPackageCount: m.anchors.packages.length,
    windWarrantyCount: m.anchors.windWarranties.length,
    insulationOptionCount: m.insulation.options.length,
    promotionTierCount: m.promotions.tiers.length,
    plansLengthCount: Object.keys(m.plans.plans).length,
    snowLoadCount: m.snow.changers.snowLoads.length,
    snowStateCount: m.snow.changers.states.length,
  };

  // Structural sanity
  if (m.base.lengths.length === 0) errors.push("Pricing - Base: no lengths parsed");
  if (m.base.widthGaugeKeys.length === 0) errors.push("Pricing - Base: no width-gauge keys parsed");
  if (Object.keys(m.base.prices).length < 50) {
    warnings.push(
      `Pricing - Base: only ${Object.keys(m.base.prices).length} prices — expected hundreds`
    );
  }
  if (m.promotions.tiers.length < 5) {
    warnings.push(`Promotions: ${m.promotions.tiers.length} tiers (expected 6)`);
  }
  if (m.snow.changers.snowLoads.length === 0) {
    errors.push("Snow - Changers: no snow load options parsed");
  }
  if (!m.meta.defaultStateLabel) {
    warnings.push("PSB-Quote Sheet Z10 (default state) is empty");
  }
  if (m.snow.changers.trussPrice === 0) {
    warnings.push("Snow - Changers G76 (truss price) is 0");
  }

  return { ok: errors.length === 0, errors, warnings, stats };
}
