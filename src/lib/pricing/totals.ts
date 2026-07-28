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
 *   AC42  = AC26 × AB42                              (Deposit — AB42 = user-editable, default 0.10)
 *   AC44  = AC26 × AB44                              (25% additional deposit for special orders)
 *   AC46  = AC40 - (AC42 + AC44)                     (Balance Due)
 *   AC50  = Plans for Buildings!C25                  (Plans cost — display only)
 *   AC52  = Plans for Buildings!T25                  (Calcs cost — display only)
 */
export const DEFAULT_DEPOSIT_PCT = 0.10;
export const DEFAULT_ADDITIONAL_DEPOSIT_PCT = 0;

export function computeTotals(
  lineItems: LineItem[],
  engineeringTotal: number,
  promoDiscount: number,
  taxPct: number,
  equipmentLabor: number,
  additionalLabor: number,
  plansCost: number,
  calcsCost: number,
  depositPct: number = DEFAULT_DEPOSIT_PCT,
  additionalDepositPct: number = DEFAULT_ADDITIONAL_DEPOSIT_PCT,
): EngineTotals {
  const lineSum = lineItems.reduce((sum, li) => sum + li.price, 0);

  const totalTaxableSale = lineSum + engineeringTotal + promoDiscount;
  const taxAmount = round2(totalTaxableSale * taxPct);
  const subtotal = round2(totalTaxableSale + taxAmount);
  const total = round2(subtotal + equipmentLabor + additionalLabor);
  const depositAmount = round2(totalTaxableSale * depositPct);
  const additionalDepositAmount = round2(totalTaxableSale * additionalDepositPct);
  const balanceDue = round2(total - depositAmount - additionalDepositAmount);

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
    additionalDepositAmount,
    balanceDue,
    plansCost: round2(plansCost),
    calcsCost: round2(calcsCost),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
