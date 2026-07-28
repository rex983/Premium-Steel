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
npm test         # runs the golden-case engine check against sample workbooks
```

The engine test loads `IN OH KY IL TN WV MO 1_26_26.xlsx` and
`MI WI PA MN 1_26_26.xlsx` from `C:/Users/Redir/Downloads/` and asserts
priced outputs against the workbooks' cached totals. Missing reference files
are reported as SKIPPED. All 7 south assertions currently PASS within $1.

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
