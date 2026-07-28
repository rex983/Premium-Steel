-- Update region + state_defaults for the 2026-07-26 workbook batch:
--   South: added TX, removed MO   → IN, OH, KY, IL, TN, WV, TX
--   North: removed MN             → MI, WI, PA
--
-- Idempotent: safe to re-run.

-- 1) Update region state lists
UPDATE psb_regions
SET states = ARRAY['IN','OH','KY','IL','TN','WV','TX']
WHERE slug = 'south';

UPDATE psb_regions
SET states = ARRAY['MI','WI','PA']
WHERE slug = 'north';

-- 2) Add TX to psb_state_defaults (south, default 60 GL / 105 MPH)
INSERT INTO psb_state_defaults (state_code, region_id, default_snow_load, default_wind_mph)
SELECT 'TX', (SELECT id FROM psb_regions WHERE slug = 'south'), '60 Ground Load', 105
ON CONFLICT (state_code) DO UPDATE
  SET region_id = EXCLUDED.region_id,
      default_snow_load = EXCLUDED.default_snow_load,
      default_wind_mph = EXCLUDED.default_wind_mph;

-- 3) Remove MO (south) and MN (north) — no longer covered by the new workbooks.
--    Guarded on state_code to be safe if the row was already cleaned up.
DELETE FROM psb_state_defaults WHERE state_code IN ('MO', 'MN');
