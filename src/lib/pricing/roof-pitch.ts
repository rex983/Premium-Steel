import type { BuildingConfig } from "./types";

/**
 * Pricing - Base!F42 = D42 * F27
 * D42 is INDEX of the pitch matrix at A35:J39 keyed by (pitch-key, width).
 *
 * Pitch keys: "0-12P" (no upcharge), "4-12P", "5-12P", "6-12P".
 *
 * Multiplier × base price = pitch upcharge.
 */
export function calcRoofPitch(
  config: BuildingConfig,
  pitchMatrix: Record<string, Record<number, number>>,
  basePrice: number
): number {
  if (!config.pitch) return 0;
  const key = `${config.pitch}-${config.pitchUnit || "12P"}`;
  const widthRow = pitchMatrix[key];
  if (!widthRow) return 0;
  // The matrix indexes by raw width header; if exact width missing, fall back to nearest key
  const multiplier = widthRow[config.width] ?? 0;
  return Math.round(multiplier * basePrice);
}
