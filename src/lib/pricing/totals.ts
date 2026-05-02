import type { LineItem, EngineTotals } from "./types";

/**
 * Combine all line items into PSB-Quote Sheet totals (rows 24–52 + R55).
 *
 * Spreadsheet formulas:
 *   AC24  = Promotions!C10                           (promo discount, negative)
 *   AC26  = SUM(R24:U52, R55) + AC24                 (Total Taxable Sale)
 *   AC28  = AC26 × taxPct                            (Sales Tax)
 *   AC30  = AC26 + AC28                              (Subtotal)
 *   AC36  = IFERROR(Pricing - Labor-EQ!N29, 0)       (Equipment/Labor)
 *   AC38  = R53 + R54                                (Additional Labor)
 *   AC40  = AC30 + AC36 + AC38 + AC34 + AC32 + AC39  (Total)
 *   AC42  = AC26 × depositPct                        (Deposit)
 *   AC46  = AC40 - (AC42 + AC44)                     (Balance Due)
 *   AC50  = Plans for Buildings!C25                  (Plans cost — display only)
 *   AC52  = Plans for Buildings!T25                  (Calcs cost — display only)
 */
export const DEPOSIT_TIER_THRESHOLD = 30_000;
export const DEPOSIT_PCT_BELOW = 0.20;
export const DEPOSIT_PCT_AT_OR_ABOVE = 0.22;

function depositPctFor(totalTaxableSale: number): number {
  return totalTaxableSale >= DEPOSIT_TIER_THRESHOLD
    ? DEPOSIT_PCT_AT_OR_ABOVE
    : DEPOSIT_PCT_BELOW;
}

export function computeTotals(
  lineItems: LineItem[],
  engineeringTotal: number,
  promoDiscount: number,
  taxPct: number,
  equipmentLabor: number,
  additionalLabor: number,
  plansCost: number,
  calcsCost: number
): EngineTotals {
  const lineSum = lineItems.reduce((sum, li) => sum + li.price, 0);

  const totalTaxableSale = lineSum + engineeringTotal + promoDiscount;
  const taxAmount = round2(totalTaxableSale * taxPct);
  const subtotal = round2(totalTaxableSale + taxAmount);
  const total = round2(subtotal + equipmentLabor + additionalLabor);
  const depositPct = depositPctFor(totalTaxableSale);
  const depositAmount = round2(totalTaxableSale * depositPct);
  // AC44 = 25% additional deposit (special orders); not modeled yet
  const balanceDue = round2(total - depositAmount);

  return {
    totalTaxableSale: round2(totalTaxableSale),
    promoDiscount: round2(promoDiscount),
    taxAmount,
    subtotal,
    equipmentLabor: round2(equipmentLabor),
    additionalLabor: round2(additionalLabor),
    total,
    depositPct,
    depositAmount,
    balanceDue,
    plansCost: round2(plansCost),
    calcsCost: round2(calcsCost),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
