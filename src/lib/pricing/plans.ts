import type { PlansMatrix } from "@/types/pricing";
import type { BuildingConfig } from "./types";

/**
 * Plans for Buildings — display-only line items (NOT added to balance).
 *
 * Plans cost = INDEX(plans, length, width) + legSurcharge[height] + doorOpeningCost[doorCount]
 * Calcs cost = INDEX(calcs, length, width)
 */
export function calcPlansCost(config: BuildingConfig, plans: PlansMatrix): number {
  const base = plans.plans[config.length]?.[config.width] ?? 0;
  const legExtra = plans.legSurcharge[config.height] ?? 0;
  const doorCount = (config.rollUpDoors || []).reduce((sum, d) => sum + d.qty, 0)
                  + (config.walkInDoors || []).reduce((sum, d) => sum + d.qty, 0);
  const doorExtra = plans.doorOpeningCost[doorCount] ?? 0;
  return Math.round(base + legExtra + doorExtra);
}

export function calcCalcsCost(config: BuildingConfig, plans: PlansMatrix): number {
  return Math.round(plans.calcs[config.length]?.[config.width] ?? 0);
}
