import type { InsulationMatrix } from "@/types/pricing";
import type { BuildingConfig } from "./types";
import { gridCell, num, type RawGrid } from "./_helpers";

/**
 * Pricing - Insulated!G12 — single-cell reference.
 *   E37 (insulation type)  → lookup
 *   M37 (coverage)         → lookup
 *
 * Coverage types: "Roof Only", "Fully Insulated-Vertical", "Fully Insulated-Horizontal".
 *
 * Sample: 2" Fiberglass + Fully Insulated-Vertical → 14850
 */
export function calcInsulation(config: BuildingConfig, matrices: InsulationMatrix & { raw?: RawGrid }): number {
  if (!config.insulation || config.insulation === "0" || !config.insulationType) return 0;

  // Find matching option by label + coverage
  const coverage = config.insulationType.toLowerCase().includes("roof") ? "Roof Only" : "Fully Insulated";
  const opt = matrices.options.find(
    (o) => o.label === config.insulation && o.coverage === coverage
  );
  if (opt) return opt.price;

  // Fall back to cached G12 if available
  if (matrices.raw) return num(gridCell(matrices.raw, 12, "G"));
  return 0;
}
