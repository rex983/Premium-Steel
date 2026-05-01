# psb-pricing — Premium Steel Buildings pricer (BBD Launcher ecosystem)

## What this app is

Pricing calculator + quote tool for **Premium Steel Buildings (PSB)** — Godley TX,
sold through BBD. Replaces a 22-sheet Excel workbook split into two regional files
(South: IN/OH/KY/IL/TN/MO/WV; North: MI/WI/PA/MN). Same engine, different rate cards.

This is the third pricing app in the BBD Launcher ecosystem after `asc-pricing` and `qsb`.

## Source-of-truth analysis

Full spreadsheet decode + decisions live at:

- `C:/Users/Redir/bbd-pricer-analysis/PSB_PRICER_ANALYSIS.md` — main writeup
- `C:/Users/Redir/bbd-pricer-analysis/dumps/*.tsv` — every cell of both workbooks
- `C:/Users/Redir/bbd-pricer-analysis/diff_south_vs_north.json` — what differs
- `C:/Users/Redir/bbd-pricer-analysis/sheet_dependency_graph.json` — formula edges
- `C:/Users/Redir/bbd-pricer-analysis/quote_sheet_dropdowns.json` — input options

Sample workbooks:
- `C:/Users/Redir/Downloads/IN OH KY IL TN WV MO 1_26_26.xlsx` (south)
- `C:/Users/Redir/Downloads/MI WI PA MN 1_26_26.xlsx` (north)

## Stack

- Next.js 16 + Tailwind v4 + shadcn/ui (new-york)
- NextAuth v5 (shared with BBD Launcher — `profiles` table)
- Supabase: shared instance `xockuiyvxijuzlwlsfbu` (lives next to `asc_*`/`qsb_*` tables)
- @react-pdf/renderer for quote PDFs
- xlsx + exceljs for parser

## Conventions

- Tables prefixed `psb_*`
- Quote numbers: `PSB-YYYY-####` via `next_psb_quote_number()`
- Routes mirror asc-pricing exactly: `(app)/calculator|quotes|customers|admin/(regions|states|upload|config|audit-log)`
- Auth: shared profiles, all BBD Launcher users get access by default. Role gates `/admin/*`.

## Architecture decisions (locked 2026-05-01)

1. **Regions: mirror ASC's pattern.** Admin-managed CRUD, slug from states, versioned
   `is_current` snapshots via `psb_pricing_data`. Drop ASC's `spreadsheet_type` column —
   PSB has only one product. Seed: South (IN/OH/KY/IL/TN/MO/WV) + North (MI/WI/PA/MN).
2. **Plans + Calcs: display-only.** Show on quote, NOT added to balance (mirror spreadsheet).
3. **PDF brand assets**: generic placeholder for v1; real assets pending from Brandyn.
4. **Quote numbers**: `PSB-YYYY-####`.
5. **Auth**: shared with BBD Launcher.
6. **Snow load auto-default per state**: `psb_state_defaults` table. Stub: south states
   default `60 Ground Load`, north states default `30 Ground Load`. Admin-editable at
   `/admin/states`.
7. **Engineering breakdown shown**: spreadsheet rows 56–63 rendered on calculator
   (collapsible, default open) and PDF (always shown).

## Layout (src/)

```
src/
  auth.ts                 NextAuth v5 config (Google + Credentials, profiles lookup)
  middleware.ts           Auth-gates everything except /login, /api/auth
  types/auth.ts           UserRole + Office types, augments next-auth Session
  lib/
    supabase/             admin / server / client clients
    utils.ts              cn(), formatCurrency, formatDate, etc.
    audit.ts              audit-log helper
    excel/                (Phase 2) per-sheet parsers, auto-detect north/south
    pricing/              (Phase 3) engine, lookups, snow-engineering
    pdf/                  (Phase 5) react-pdf quote template
  components/
    ui/                   shadcn primitives
    layout/               app-sidebar, app-header, logo, user-nav
    providers/            session-provider
    features/             (per-domain feature components)
  app/
    layout.tsx            root + ThemeProvider
    page.tsx              redirect → /calculator
    login/                login page
    api/auth/[...]/       NextAuth handler
    (app)/                authed shell: sidebar + header
      layout.tsx
      calculator/         (Phase 4)
      quotes/             (Phase 5)
      customers/          (Phase 5)
      admin/
        regions/          (Phase 6)
        states/           (Phase 6) snow-load defaults per state
        upload/           (Phase 2 + 6)
        config/           (Phase 6)
        audit-log/        (Phase 6)
```

## Phase plan

1. **Phase 1** — Scaffolding (DONE — 2026-05-01)
2. **Phase 2** — Excel parser per sheet (DONE)
3. **Phase 3** — Pricing engine + snow engineering pipeline (DONE; engineering matches within $1; RUD adders + 12g leg-height adjustment are deferred Phase-3b TODOs)
4. **Phase 4** — Calculator UI (DONE)
5. **Phase 5** — Quotes CRUD + PDF (DONE)
6. **Phase 6** — Admin + Launcher integration (DONE)
7. **Phase 7** — Polish, RLS hardening, golden-case tests, deploy

## Launcher integration

Apply `supabase/launcher-integration.sql` against the shared Supabase project
AFTER psb-pricing is deployed (update the URL inside that file first). It:
1. Inserts a tile into `launcher_apps`
2. Grants `admin` role access via `launcher_role_app_access`
3. Registers `Premium Steel Buildings` in `manufacturer_config` for deposit/contact tracking

## How to bootstrap

```sh
cd C:/Users/Redir/psb-pricing
npm install
cp .env.example .env.local        # fill in Supabase + AUTH_SECRET + ADMIN_PASSWORD
# After applying Supabase migration:
npm run dev                        # http://localhost:3000
```

## Sibling apps

- `C:/Users/Redir/asc-pricing/` — closest sibling; clone patterns from here
- `C:/Users/Redir/BBDLauncher/` — central hub; PSB will get a tile after Phase 6
- `C:/Users/Redir/asc-engineering/` — engineering-only ASC fork (different model — PSB
  bakes engineering inline, not separate)
