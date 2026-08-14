-- Add sales-rep-facing display name to regions.
-- `name` stays as the internal/admin/upload identifier.
-- `display_name` is what quote-facing UI (calculator, quote picker) shows.
-- When null, UI falls back to `name`.

ALTER TABLE psb_regions
  ADD COLUMN IF NOT EXISTS display_name TEXT;
