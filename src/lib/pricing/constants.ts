/**
 * Engine constants — keep in sync with the spreadsheet's defined names + dropdown lists.
 */

export const GAUGE_OPTIONS = ["14g", "12g"] as const;
export const GAUGE_DISPLAY: Record<string, string> = { "14g": "14G", "12g": "12G" };

export const ROOF_STYLES = ["A-Frame Vertical", "A-Frame Horizontal"] as const;
export const ROOF_STYLE_CODE: Record<string, "AFV" | "AFH" | "STD"> = {
  "A-Frame Vertical": "AFV",
  "A-Frame Horizontal": "AFH",
};

export const SIDE_OPTIONS = [
  "Fully Enclosed",
  "Partial Sides",
  "Open",
] as const;

export const END_OPTIONS = ["Gable", "Enclosed Ends", "Extended Gable"] as const;

export const PANEL_ORIENTATIONS = ["Vertical", "Horizontal"] as const;

export const PITCH_OPTIONS = [0, 4, 5, 6] as const;

/**
 * Snow load options (B9:P9 in Snow - Changers).
 * Ground Load (GL) values 30..90, Roof Load (RL) values 20..61.
 */
export const SNOW_LOAD_OPTIONS = [
  "30 Ground Load", "40 Ground Load", "50 Ground Load", "60 Ground Load",
  "70 Ground Load", "80 Ground Load", "90 Ground Load",
  "20 Roof Load", "27 Roof Load", "34 Roof Load", "41 Roof Load",
  "47 Roof Load", "54 Roof Load", "61 Roof Load",
] as const;

export const DEFAULT_WIND_MPH = 105;

export const QTY_MULTIPLIER = (qty: 0 | 1 | 2): number => {
  // From Pricing - Sides D30: =IFS($D$29=0, $D$28*0, $D$29=1, $D$28*0.5, $D$29=2, $D$28)
  // i.e., 0 sides → 0×, 1 side → 0.5×, 2 sides → 1×
  if (qty === 2) return 1;
  if (qty === 1) return 0.5;
  return 0;
};

export const END_QTY_MULTIPLIER = (qty: 0 | 1 | 2): number => {
  // From Pricing - Ends E27: =IFS($E$26=2, $E$25*2, $E$26=1, $E$25, $E$26=0, 0)
  // i.e., 0 ends → 0, 1 end → 1×, 2 ends → 2× (different from sides!)
  if (qty === 2) return 2;
  if (qty === 1) return 1;
  return 0;
};
