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
/**
 * Per-state engineering constants (one entry per long state name on the
 * Snow - Changers truss-pricing block, rows 58–70). Multiple long names can
 * share a `code` (e.g. several "MI"-tier states), and the constants vary
 * across the long-name columns even within the same code — so we key by the
 * long state name here and let the engine resolve the code when it needs it.
 */
export interface SnowStateConstants {
  code: string;                                // row 59  (e.g. "IN", "MI", "TX")
  trussPriceByWidth: Record<number, number>;   // rows 60–67  (12,18,20,22,24,26,28,30 wide truss)
  legHeightMult: number;                       // row 68
  channelPricePerFt: number;                   // row 69
  tubingPricePerFt: number;                    // row 70
}

export interface SnowChangersMatrix {
  // Snow-load name ↔ short code (rows 9–10)
  snowLoadNameToCode: Record<string, string>;  // "30 Ground Load" → "30GL"
  snowLoadCodeOrder: string[];                 // axis order of B10:P10 — used for F94 column MATCH

  // Leg height → symbol (rows 26–27) and tubing feet (row 28)
  legHeightSymbol: Record<number, string>;     // 15 → "T"
  legHeightTubingFeet: Record<number, number>; // 15 → 28

  // Width buckets — Hat Channel (rows 17–18) and Truss (rows 49–50)
  hcWidthBucket: Record<number, number>;       // 30 → 36
  trussWidthBucket: Record<number, number>;    // 30 → 30

  // Per-state engineering constants, keyed by long state name (row 58)
  byStateName: Record<string, SnowStateConstants>;

  // F94 leg-height-adjustment table (rows 81–89, cols B–P).
  // Row axis = truss width buckets (12,18,20,22,24,26,28,30,0).
  // Col axis = snow-load codes in `snowLoadCodeOrder`.
  legHeightAdjust: Record<number, Record<string, number>>;

  // UI dropdowns (back-compat)
  states: string[];                            // [N73:N77] — distinct state codes
  snowLoads: string[];                         // long-name list for UI
  windOptions: number[];                       // distinct wind speeds (105/115/130/140/155/165/180)
}

/**
 * Snow - Trusses — original truss count by (truss-width, state-code, length).
 * Col 1 row keys = `${widthBucket}-${stateCode}` (e.g. "30-IN").
 * Row axis = lengths 1..100 (col A).
 */
export interface SnowTrussesMatrix {
  colKeys: string[];                           // row 1 col B..BE — `${width}-${stateCode}`
  lengths: number[];                           // col A rows 2..101 — 1..100
  counts: number[][];                          // rows × cols (B2:BE101)
}

/**
 * Snow - Hat Channels.
 * Lookup tables:
 *   - rowKeys (col A 2..71): `${widthBucket}-${snowCode}` — e.g. "36-30GL"
 *   - windHeader (B1:H1): wind values
 *   - spacingTable (B2:H71): required spacing
 *   - stateCodes (R2:R8): per-state row axis
 *   - widthHeader (S1:Z1): per-width col axis
 *   - originalCounts (S2:Z8): original hat-channel count per (state, width)
 */
export interface SnowHatChannelsMatrix {
  rowKeys: string[];
  windHeader: number[];
  spacingTable: number[][];

  stateCodes: string[];
  widthHeader: number[];
  originalCounts: number[][];
}

/**
 * Snow - Verticals.
 *   - legHeightHeader (B1:V1): leg heights 0..20
 *   - windCol (A2:A8): wind values
 *   - spacingTable (B2:V8): required vertical spacing
 *   - widthHeader (B13:I13): widths 12..30
 *   - originalRow (B14:I14): original vertical count per width
 */
export interface SnowVerticalsMatrix {
  legHeightHeader: number[];
  windCol: number[];
  spacingTable: number[][];
  widthHeader: number[];
  originalRow: number[];
}

/**
 * Snow - Girts.
 *   - girtRowKeys (A2:A6): bucketed truss-spacing keys (60,54,48,42,36)
 *   - windHeader (B1:H1): wind values
 *   - spacingTable (B2:H6): required girt spacing
 *   - legHeightCol (L2:L22): 0..20
 *   - originalCol (M2:M22): original girt count per leg height
 *   - trussSpacingAxis (B28:BJ28): 0..60 (raw truss-spacing values)
 *   - trussSpacingBucket (B27:BJ27): bucket lookup for each axis value
 */
export interface SnowGirtsMatrix {
  girtRowKeys: number[];
  windHeader: number[];
  spacingTable: number[][];
  legHeightCol: number[];
  originalCol: number[];
  trussSpacingAxis: number[];
  trussSpacingBucket: number[];
}

/**
 * Snow - Truss Spacing — the master spacing matrix.
 *   - rowKeys (A2:A43): `${legSymbol}-${snowCode}` (e.g. "T-30GL")
 *   - colKeys (B1:HQ1): `${E|O}-${wind}-${trussWidth}-{STD|AFV}` (e.g. "E-105-30-AFV")
 *   - spacingTable (B2:HQ43)
 */
export interface SnowTrussSpacingMatrix {
  rowKeys: string[];
  colKeys: string[];
  spacingTable: number[][];
}

export interface SnowDiagonalBracingMatrix {
  // [width][length] = brace count or price
  matrix: Record<number, Record<number, number>>;
}

export interface SnowMatrices {
  changers: SnowChangersMatrix;
  trusses: SnowTrussesMatrix;
  trussSpacing: SnowTrussSpacingMatrix;
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
