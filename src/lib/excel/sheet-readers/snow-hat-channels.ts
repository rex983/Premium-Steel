import type { WorkSheet } from "xlsx";
import type { SnowHatChannelsMatrix } from "@/types/pricing";
import { rawGrid, type RawGrid } from "./_raw-grid";

/**
 * Snow - Hat Channels — 72×32.
 * Reference outputs:
 *   - 'Snow - Math Calculations'!P4 = 'Snow - Hat Channels'!$L$7   (required spacing)
 *   - 'Snow - Math Calculations'!T4 = 'Snow - Hat Channels'!$AD$10 (original channel count)
 */
export function readSnowHatChannels(sheet: WorkSheet): SnowHatChannelsMatrix {
  return {
    matrix: {},
    raw: rawGrid(sheet, 72, 32),
  } as SnowHatChannelsMatrix & { raw: RawGrid };
}
