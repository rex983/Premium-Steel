# Premium Steel Buildings — Pricing

Pricing calculator + quote tool for Premium Steel Buildings (PSB), Godley TX.
Part of the Big Buildings Direct ecosystem alongside asc-pricing and qsb.

## Stack

Next.js 16 · Tailwind v4 · shadcn/ui · NextAuth v5 · Supabase · @react-pdf/renderer

## Setup

```sh
npm install
cp .env.example .env.local      # fill in env vars
npm run dev
```

Supabase migration lives at `supabase/migrations/`. Apply via Supabase CLI or
push to the shared project (`xockuiyvxijuzlwlsfbu`).

## Tests

```sh
npm test         # golden-case engine check against sample workbooks
npm run smoke    # invariant sweep across states/sizes/gauges/promos/deposits
npm run parity   # cell-by-cell parity vs both workbooks' lookup matrices
npm run test:all # all three, in order
```

- **`npm test`** loads the older `IN OH KY IL TN WV MO 1_26_26.xlsx` and
  `MI WI PA MN 1_26_26.xlsx` from `C:/Users/Redir/Downloads/` and asserts
  priced outputs against the workbooks' cached totals (7 south assertions
  within $1). Also smoke-checks the newer 07-26 workbooks parse cleanly,
  expose "Manual Discount" as `isManual`, and apply it correctly. Missing
  reference files are reported as SKIPPED.
- **`npm run smoke`** exercises the current workbooks across every state, a
  geometry sweep, gauge/roof-style/panel variants, RUDs, anchors, insulation,
  snow load, all 4 promo tiers, Manual Discount, additional deposit, and edge
  cases. Enforces invariants (no NaN, deposit/tax math, monotonicity).
- **`npm run parity`** iterates every valid cell in the 07-26 workbooks'
  lookup matrices across 38 categories: base × gauge × width × length, legs,
  roof style, walk-ins, windows, roll-ups × position × seal, plans, calcs,
  leg surcharge, door surcharge, sides V/HZ, ends V/HZ × FE/G, base trim,
  foam closure, sheet metal, J-trim, extras, labor fees, frame outs, wainscot
  end/side, roof pitch, overhang, 26ga upgrade, premium colors, color screws,
  gutter, insulation, anchors (Anchors-Only + 105 MPH auto-count), and the 8
  snow-engineering lookup tables (truss/hat-channel/girt/vertical spacing +
  original counts) — ~38,000 assertions per full run, all penny-perfect.
  Snow engineering OUTPUT parity (engine's exposed `trussPrice` etc. for
  arbitrary inputs) is covered by the golden case in `npm test` + snow-load
  monotonicity in `npm smoke`.

## Deploy checklist

1. Deploy to Vercel — envs from `.env.example` (fill `SUPABASE_SERVICE_ROLE_KEY`,
   `AUTH_SECRET`, `AUTH_GOOGLE_ID/SECRET`, `AUTH_URL` → prod URL).
2. Verify the deployed URL matches the one embedded in
   `supabase/launcher-integration.sql` (currently `premium-steel-umber.vercel.app`).
   Update the SQL if it differs.
3. Apply `supabase/launcher-integration.sql` against the shared Supabase project.
4. Confirm the tile appears in BBD Launcher for admin role.

## Status

Phases 1–7 complete. Phase-3b engine gaps closed 2026-07-28 (deposit + equipment/labor formulas
wired; RUD adders were already correct; "12g leg-height adjustment" was a false-alarm TODO).
See [CLAUDE.md](CLAUDE.md) for the full plan.
