/**
 * PSB Pricing Matrices — the normalized JSON snapshot produced by the parser.
 * Stored in psb_pricing_data.matrices, consumed by the pricing engine.
 */

export type Region = "north" | "south";

// =============================================================================
// Pricing - Base
// =============================================================================
/**
 * 2D matrix [length][width] keyed by (length, gauge-width-key).
 * Length rows: 20–100 in 5ft increments (17 rows).
 * Column keys: "0-14G","12-14G","18-14G","20-14G","22-14G","24-14G","26-14G","28-14G","30-14G",
 *              "0-12G","12-12G","18-12G","20-12G","22-12G","24-12G","26-12G","28-12G","30-12G".
 */
export interface BaseMatrix {
  lengths: number[];
  widthGaugeKeys: string[];
  prices: Record<string, number>; // key = `${length}|${widthGaugeKey}`
}

// =============================================================================
// Pricing - Roof Style
// =============================================================================
export interface RoofStyleMatrix {
  // multipliers/upcharges keyed by style ("A-Frame Vertical" | "A-Frame Horizontal" | "Standard") and W×L
  // shape: { [style]: { [W]: { [L]: number } } }
  prices: Record<string, Record<number, Record<number, number>>>;
}

// =============================================================================
// Pricing - Legs (height upcharge)
// =============================================================================
export interface LegsMatrix {
  // shape: { [gauge]: { [legHeight]: number } }
  upcharges: Record<string, Record<number, number>>;
}

// =============================================================================
// Pricing - Sides / Ends
// =============================================================================
export interface SidesMatrix {
  // [type ("Fully Enclosed"|"Open"|...)] x [W] x [L] x [orientation V|HZ] = price
  prices: Record<string, Record<number, Record<number, Record<string, number>>>>;
  vSidesSurcharge: Record<string, number>; // any extra V-sides surcharge keyed by W or L
}

export type EndsMatrix = SidesMatrix;

// =============================================================================
// Pricing - Accessories
// =============================================================================
export interface AccessoryItem {
  label: string;
  price: number;
}
export interface DoorOption {
  label: string; // e.g. "10x10", "12x12"
  price: number;
}
export interface AccessoriesMatrix {
  walkInDoors: AccessoryItem[];      // WID
  windows: AccessoryItem[];          // Window
  rollUpDoors: DoorOption[];         // RUD (size → price)
  windowsExtras: AccessoryItem[];    // window add-ons
  frameOuts: AccessoryItem[];        // frame-out per size
  jtrim: AccessoryItem[];            // J-Trim
  baseTrim: AccessoryItem[];         // base trim
  foamClosure: AccessoryItem[];
  extras: AccessoryItem[];           // extra sheet metal etc.
  interiorWalls: AccessoryItem[];
  laborFees: AccessoryItem[];
  headerSeal: AccessoryItem[];       // seal options
  // raw constants for engine
  bt?: number;
  fcp?: number;
}

// =============================================================================
// Pricing - Anchors
// =============================================================================
export interface AnchorsMatrix {
  packages: AccessoryItem[];          // 6 anchor types
  windWarranties: AccessoryItem[];    // MPH wind warranty options
}

// =============================================================================
// Pricing - Insulated
// =============================================================================
export interface InsulationMatrix {
  options: { label: string; type: string; coverage: string; price: number }[];
}

// =============================================================================
// Pricing - Labor-EQ
// =============================================================================
export interface LaborEquipmentMatrix {
  laborOptions: AccessoryItem[];
  equipmentOptions: AccessoryItem[];
}

// =============================================================================
// Promotions (5%, 10%, 15%, 20%, 25%, none) keyed by subtotal range
// =============================================================================
export interface PromotionTier {
  label: string;
  pct: number;     // 0.05, 0.10, etc.
  minSubtotal: number;
  maxSubtotal: number | null;
}
export interface PromotionsMatrix {
  tiers: PromotionTier[];
}

// =============================================================================
// Plans for Buildings
// =============================================================================
export interface PlansMatrix {
  // [length][width] = price
  plans: Record<number, Record<number, number>>;
  calcs: Record<number, Record<number, number>>;
  // leg-height upcharge for plans (13ft+): { [legHeight]: extraCost }
  legSurcharge: Record<number, number>;
  // door-opening upcharge: { [doorCount]: extraCost }
  doorOpeningCost: Record<number, number>;
}

// =============================================================================
// Pricing - Changers (input-routing constants — mostly irrelevant to engine,
// but extract dropdown lists for UI defaults)
// =============================================================================
export interface ChangersMatrix {
  buildingTypes: string[]; // dropdown options
  gaugeOptions: string[];
  // computed signals/flags: irregular building, etc.
}

// =============================================================================
// Snow engineering
// =============================================================================
export interface SnowChangersMatrix {
  // The state lookup column → state code mapping
  states: string[]; // [N73, N74, N75, N76, N77]
  // Snow-load options used as dropdown
  snowLoads: string[]; // 30 GL, 40 GL, ..., 90 GL, 20 RL, 27 RL, ..., 61 RL
  // wind options
  windOptions: number[];
  // constants
  trussPrice: number;       // G76
  legHeightPrice: number;   // J72
  pricePerFoot: number;     // J75 (channel pricing)
  tubingPricePerFt: number; // J76 (vertical tubing)
}

/**
 * Snow - Trusses original-truss-count matrix.
 * Indexed by (length, snow-load, wind-mph-bucket) → original trusses.
 * The actual lookup is via Snow - Truss Spacing (column 'BH11' in source).
 */
export interface SnowTrussesMatrix {
  // [snowLoad][wind][length] = originalTrussCount
  counts: Record<string, Record<number, Record<number, number>>>;
  // Original truss spacing matrix
  spacing: Record<string, Record<number, Record<number, number>>>;
}

export interface SnowHatChannelsMatrix {
  // [width][snowLoad] = { spacing, channelPricePerFt }
  matrix: Record<number, Record<string, { spacing: number; pricePerFt: number }>>;
}

export interface SnowVerticalsMatrix {
  // [width][snowLoad][wind] = original verticals + spacing
  matrix: Record<number, Record<string, Record<number, { spacing: number; original: number }>>>;
}

export interface SnowGirtsMatrix {
  // [legHeight][windMph] = original girts + spacing
  matrix: Record<number, Record<number, { spacing: number; original: number }>>;
}

export interface SnowDiagonalBracingMatrix {
  // [width][length] = brace count or price
  matrix: Record<number, Record<number, number>>;
}

export interface SnowMatrices {
  changers: SnowChangersMatrix;
  trusses: SnowTrussesMatrix;
  hatChannels: SnowHatChannelsMatrix;
  verticals: SnowVerticalsMatrix;
  girts: SnowGirtsMatrix;
  diagonalBracing: SnowDiagonalBracingMatrix;
}

// =============================================================================
// Quote Sheet metadata — dropdown options to drive UI
// =============================================================================
export interface QuoteSheetMeta {
  buildingTypes: string[];     // e.g. Garage, Carport, ...
  roofStyles: string[];        // A-Frame Vertical, A-Frame Horizontal
  gaugeOptions: string[];      // 14g, 14G, 12g, 12G
  sideOptions: string[];       // Fully Enclosed, Open, ...
  endOptions: string[];        // Enclosed Ends, Gable, Extended Gable
  panelOrientations: string[]; // Vertical, Horizontal
  pitchOptions: number[];      // 0, 4, 5, 6
  overhangOptions: string[];   // 12" / 18" / none
  rudSizes: string[];          // 8x8, 10x10, 12x12, ...
  widSizes: string[];          // walk-in door sizes
  windowSizes: string[];
  premiumColors: string[];
  gutterColors: string[];
  defaultStateLabel: string;   // e.g. "Indiana" — used to detect region
  defaultSnowLoad: string;     // e.g. "60 Ground Load"
  defaultWindMph: number;      // 105
}

// =============================================================================
// Top-level matrices blob persisted in psb_pricing_data.matrices
// =============================================================================
export interface PSBPricingMatrices {
  region: Region;
  filenameStates: string[];
  parsedAt: string;
  parserVersion: string;
  meta: QuoteSheetMeta;
  base: BaseMatrix;
  roofStyle: RoofStyleMatrix;
  legs: LegsMatrix;
  sides: SidesMatrix;
  ends: EndsMatrix;
  accessories: AccessoriesMatrix;
  anchors: AnchorsMatrix;
  insulation: InsulationMatrix;
  laborEquipment: LaborEquipmentMatrix;
  promotions: PromotionsMatrix;
  plans: PlansMatrix;
  changers: ChangersMatrix;
  snow: SnowMatrices;
  // Roof-pitch and overhang come from the Pricing - Base sheet:
  roofPitch: Record<string, Record<number, number>>; // [pitchKey][width] = multiplier
  overhang: Record<string, Record<number, number>>;  // [overhangKey][length] = multiplier
}
