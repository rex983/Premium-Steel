-- Per-region office allowlist for access control.
-- Empty array = no non-admin can view or use the region (admin-only).
-- Populated = only users whose profiles.office matches an entry can access.
-- Admin role bypasses regardless.

ALTER TABLE psb_regions
  ADD COLUMN IF NOT EXISTS offices TEXT[] NOT NULL DEFAULT '{}';
