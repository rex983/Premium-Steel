/**
 * BuildingConfig — full enumeration of inputs to the PSB pricing engine.
 * Mirrors the PSB-Quote Sheet user-input cells (rows 8–55).
 */
export interface BuildingConfig {
  // Geometry
  width: number;          // L17
  length: number;         // P17
  height: number;         // T17 (leg height)

  // Structure
  gauge: "12g" | "14g";   // G18 (case-insensitive normalize)
  roofStyle: "A-Frame Vertical" | "A-Frame Horizontal"; // E16

  // Walls
  sides: string;          // G27 — "Fully Enclosed" | "Partial Sides" | "Open" | etc.
  ends: string;           // G28 — "Gable" | "Enclosed Ends" | "Extended Gable"
  sidesPanel: "Vertical" | "Horizontal"; // N27
  endsPanel: "Vertical" | "Horizontal";  // N28
  sidesQty: 0 | 1 | 2;    // L27
  endsQty: 0 | 1 | 2;     // L28

  // Roll-up doors (up to 3 lines)
  rollUpDoors: Array<{
    size: string;         // I33: "8x8", "10x10", etc.
    qty: number;          // H33
    position: "SIDE" | "END"; // K33
    headerSeal?: string;  // M33
  }>;

  // Walk-in doors (up to 2 lines)
  walkInDoors: Array<{
    size: string;         // G29
    qty: number;
  }>;

  // Windows (up to 2 lines)
  windows: Array<{
    size: string;         // G31
    qty: number;
  }>;

  // Anchors
  anchorType: string;     // E36 — "Concrete", etc.
  windWarranty: string;   // L36 — "105 MPH Wind Warranty"

  // Insulation
  insulation: string;     // E37
  insulationType: string; // M37 — "Fully Insulated-Vertical", "Roof Only", etc.

  // Roof pitch & overhang
  pitch: 0 | 4 | 5 | 6;   // I38
  pitchUnit: string;      // K38 = "12P"
  overhang: string;       // G39

  // Trim, gutter, premium
  baseTrim?: string;      // G42
  foamClosure?: string;   // I43
  gutterColor?: string;   // G44
  gutterSide?: string;    // L44 (One Side / Both Sides)
  colorScrews?: string;   // G45
  extraSheetMetal?: string; // G46
  jtrim?: string;         // P46
  frameOuts?: { width: number; height: number; qty: number; position: "SIDE" | "END"; gauge: string }; // G47/I47/L47/N47/K47/P47
  upgrade26ga?: string;   // G48
  upgrade26gaCoverage?: string; // L48
  premiumColor?: string;  // G49
  premiumColorCoverage?: string; // L49

  // Wainscot
  wainscotEnd?: string;   // G40
  wainscotSide?: string;  // G41
  wainscotEndQty?: number;
  wainscotSideQty?: number;

  // Extras (up to 2 lines + interior walls)
  extras?: Array<{ label: string; qty: number }>; // G50/G51 + Q50/O51
  interiorWalls?: { label: string; qty: number }; // G52

  // Labor fees (up to 2)
  laborFees?: Array<string>; // G53, G54

  // Engineering inputs
  windMph: number;        // J55 — typically 105
  snowLoad: string;       // N55 — "60 Ground Load", etc.

  // Customer / location (drives region)
  state: string;          // Z10 — drives state-defaults (snow load + wind defaults)

  // Promo + tax (configurable). Deposit % is auto-tiered from total — see totals.ts.
  promoTier?: string;     // W24 — "No Promotional Sale" if absent
  taxPct?: number;        // AA28 — default 0.07
}

export interface LineItem {
  key: string;
  label: string;
  price: number;
  // Optional sub-line items (engineering breakdown)
  children?: LineItem[];
}

export interface EngineTotals {
  totalTaxableSale: number;  // AC26 — sum of all line items + R55 + AC24 (promo)
  promoDiscount: number;     // AC24 — negative if promo applied
  taxAmount: number;         // AC28 = AC26 × taxPct
  subtotal: number;          // AC30 = AC26 + AC28
  equipmentLabor: number;    // AC36 — Pricing - Labor-EQ!N29
  additionalLabor: number;   // AC38 = R53 + R54
  total: number;             // AC40 = AC30 + AC36 + AC38 + AC34 + AC32 + AC39
  depositPct: number;        // auto-tiered: <30k = 0.20, >=30k = 0.22
  depositAmount: number;     // AC42 = AC26 × depositPct
  balanceDue: number;        // AC46 = AC40 - (AC42 + AC44)
  // Display-only (NOT in balance)
  plansCost: number;         // AC50
  calcsCost: number;         // AC52
}

export interface SnowEngineeringBreakdown {
  trussSpacing: string;       // e.g., "36\""
  originalTrusses: number;
  extraTrussesNeeded: number;
  trussPrice: number;
  hatChannelSpacing: string;
  originalHatChannels: number;
  extraChannelsNeeded: number;
  hatChannelPrice: number;
  girtSpacing: string;
  originalGirts: number;
  extraGirtsNeeded: number;
  girtPrice: number;
  verticalSpacing: string;
  originalVerticals: number;
  extraVerticalsNeeded: number;
  verticalPrice: number;
  totalEngineering: number;
}

export interface EngineOutput {
  lineItems: LineItem[];
  totals: EngineTotals;
  engineeringBreakdown: SnowEngineeringBreakdown;
  // For debugging / display
  inputs: BuildingConfig;
  region: "north" | "south";
}
