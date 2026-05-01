import type { BaseMatrix } from "@/types/pricing";
import type { BuildingConfig } from "./types";
import { GAUGE_DISPLAY } from "./constants";

/**
 * Pricing - Base!F27 = INDEX(B2:U19, MATCH(length, A2:A19), MATCH(`{W}-{gauge}`, B1:U1))
 *
 * Width-gauge keys are e.g. "30-14G", "30-12G".
 */
export function calcBasePrice(config: BuildingConfig, base: BaseMatrix): number {
  const gauge = GAUGE_DISPLAY[config.gauge.toLowerCase()] || "14G";
  const key = `${config.width}-${gauge}`;
  return base.prices[`${config.length}|${key}`] || 0;
}
