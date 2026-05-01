import type { BuildingConfig } from "./types";

/**
 * Pricing - Base!F52 = D52 * F27
 * D52 = INDEX(overhang_matrix, length, overhang_label)
 * overhang_matrix at A46:U48 — labels are "12\" Overhang (Vertical Roof ONLY)" / "18\" Overhang ..." / none.
 */
export function calcOverhang(
  config: BuildingConfig,
  overhangMatrix: Record<string, Record<number, number>>,
  basePrice: number
): number {
  if (!config.overhang) return 0;
  const labelRow = overhangMatrix[config.overhang];
  if (!labelRow) return 0;
  const multiplier = labelRow[config.length] ?? 0;
  return Math.round(multiplier * basePrice);
}
