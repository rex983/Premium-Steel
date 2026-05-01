-- =============================================================================
-- BBD Launcher integration — registers PSB Pricing as an app tile + manufacturer.
-- Run this against the SHARED Supabase project (xockuiyvxijuzlwlsfbu) AFTER:
--   1. The launcher's own migrations are applied (launcher_apps + manufacturer_config exist)
--   2. The PSB tables migration has been applied (psb_*)
--   3. The PSB app is deployed (or update the URL below before applying)
-- =============================================================================

-- Deployed URL is set below. Update if the Vercel alias changes or a custom
-- domain is added.
DO $$
DECLARE
  psb_url TEXT := 'https://premium-steel-umber.vercel.app';
  psb_app_id UUID;
BEGIN
  -- 1) Register PSB Pricing as a launcher app tile
  INSERT INTO launcher_apps (name, description, url, sso_type, status, display_order, open_in_new_tab)
  VALUES (
    'PSB Pricing',
    'Premium Steel Buildings pricing calculator + quotes',
    psb_url,
    'none',
    'active',
    50,
    true
  )
  ON CONFLICT DO NOTHING
  RETURNING id INTO psb_app_id;

  -- If already exists, look it up
  IF psb_app_id IS NULL THEN
    SELECT id INTO psb_app_id FROM launcher_apps WHERE name = 'PSB Pricing' LIMIT 1;
  END IF;

  -- 2) Grant access to admin role (extend to other roles via the launcher admin UI)
  IF psb_app_id IS NOT NULL THEN
    INSERT INTO launcher_role_app_access (role_name, app_id)
    VALUES ('admin', psb_app_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- 3) Register PSB in manufacturer_config (so it surfaces in launcher's /admin/manufacturers
  --    for deposit/contact tracking alongside ASC and other manufacturers).
  --    Deposit % matches the PSB default; tiers can be edited later in the launcher UI.
  INSERT INTO manufacturer_config (name, sku, deposit_percent, deposit_tiers, active)
  VALUES (
    'Premium Steel Buildings',
    'PSB',
    10,
    '[]'::jsonb,
    true
  )
  ON CONFLICT DO NOTHING;
END $$;

-- Verification queries:
--   SELECT id, name, url, status FROM launcher_apps WHERE name = 'PSB Pricing';
--   SELECT name, sku, deposit_percent FROM manufacturer_config WHERE sku = 'PSB';
--   SELECT role_name FROM launcher_role_app_access
--     WHERE app_id = (SELECT id FROM launcher_apps WHERE name = 'PSB Pricing');
