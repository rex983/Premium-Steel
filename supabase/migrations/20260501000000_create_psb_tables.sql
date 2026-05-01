-- Premium Steel Buildings (PSB) Pricing Tables
-- Lives in shared Supabase instance alongside bbd-launcher / asc-pricing / qsb tables.
-- Mirrors asc_* schema, minus spreadsheet_type (PSB has a single product priced regionally).

-- =============================================================================
-- Regions (admin-managed; e.g., "South" covering IN/OH/KY/IL/TN/MO/WV)
-- =============================================================================
CREATE TABLE psb_regions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  states TEXT[] NOT NULL DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- Per-state defaults (state picker auto-populates snow load + wind in calculator)
-- =============================================================================
CREATE TABLE psb_state_defaults (
  state_code TEXT PRIMARY KEY,
  region_id UUID REFERENCES psb_regions(id) ON DELETE SET NULL,
  default_snow_load TEXT NOT NULL DEFAULT '30 Ground Load',
  default_wind_mph INT NOT NULL DEFAULT 105,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- Upload tracking
-- =============================================================================
CREATE TABLE psb_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id UUID NOT NULL REFERENCES psb_regions(id) ON DELETE CASCADE,
  uploaded_by UUID REFERENCES profiles(id),
  filename TEXT NOT NULL,
  sheet_count INT,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'success', 'failed')),
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- Parsed pricing data (versioned JSON snapshot)
-- =============================================================================
CREATE TABLE psb_pricing_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id UUID NOT NULL REFERENCES psb_regions(id) ON DELETE CASCADE,
  version INT NOT NULL DEFAULT 1,
  is_current BOOLEAN NOT NULL DEFAULT false,
  matrices JSONB NOT NULL DEFAULT '{}',
  upload_id UUID REFERENCES psb_uploads(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_psb_pricing_data_current
  ON psb_pricing_data (region_id)
  WHERE is_current = true;

-- =============================================================================
-- Customers (PSB-scoped; could be merged with launcher central later)
-- =============================================================================
CREATE TABLE psb_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  notes TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- Quotes (immutable price snapshot via pricing_data_id)
-- =============================================================================
CREATE TABLE psb_quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number TEXT NOT NULL UNIQUE,
  region_id UUID NOT NULL REFERENCES psb_regions(id),
  pricing_data_id UUID REFERENCES psb_pricing_data(id),
  customer_id UUID REFERENCES psb_customers(id),
  created_by UUID REFERENCES profiles(id),
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'accepted', 'rejected', 'cancelled', 'expired')),
  -- snapshot of customer at quote time (so quote stays correct even if customer record changes)
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  customer_address TEXT,
  customer_city TEXT,
  customer_state TEXT,
  customer_zip TEXT,
  -- quote inputs and computed pricing
  config JSONB NOT NULL DEFAULT '{}',
  pricing JSONB NOT NULL DEFAULT '{}',
  -- summary fields surfaced for filtering / list views
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,4) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  deposit_pct NUMERIC(5,4) NOT NULL DEFAULT 0.10,
  deposit_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  promo_tier TEXT,
  notes TEXT,
  valid_until DATE,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- Quote-number sequence (PSB-YYYY-####)
-- =============================================================================
CREATE TABLE psb_quote_sequence (
  year INT PRIMARY KEY,
  last_number INT NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION next_psb_quote_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  current_year INT := EXTRACT(YEAR FROM now());
  next_num INT;
BEGIN
  INSERT INTO psb_quote_sequence (year, last_number)
  VALUES (current_year, 1)
  ON CONFLICT (year)
  DO UPDATE SET last_number = psb_quote_sequence.last_number + 1
  RETURNING last_number INTO next_num;

  RETURN 'PSB-' || current_year || '-' || LPAD(next_num::TEXT, 4, '0');
END;
$$;

-- =============================================================================
-- Audit log
-- =============================================================================
CREATE TABLE psb_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES profiles(id),
  actor_email TEXT,
  entity TEXT NOT NULL,
  entity_id UUID,
  action TEXT NOT NULL,
  diff JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_psb_audit_log_entity ON psb_audit_log (entity, entity_id);
CREATE INDEX idx_psb_audit_log_created ON psb_audit_log (created_at DESC);

-- =============================================================================
-- App config (manufacturer-level defaults)
-- =============================================================================
CREATE TABLE psb_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  deposit_default_pct NUMERIC(5,4) NOT NULL DEFAULT 0.10,
  tax_default_pct NUMERIC(5,4) NOT NULL DEFAULT 0.07,
  contact_phone TEXT,
  contact_email TEXT,
  contact_address TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- updated_at triggers
-- =============================================================================
CREATE OR REPLACE FUNCTION update_psb_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER psb_regions_updated_at BEFORE UPDATE ON psb_regions
  FOR EACH ROW EXECUTE FUNCTION update_psb_updated_at();
CREATE TRIGGER psb_state_defaults_updated_at BEFORE UPDATE ON psb_state_defaults
  FOR EACH ROW EXECUTE FUNCTION update_psb_updated_at();
CREATE TRIGGER psb_customers_updated_at BEFORE UPDATE ON psb_customers
  FOR EACH ROW EXECUTE FUNCTION update_psb_updated_at();
CREATE TRIGGER psb_quotes_updated_at BEFORE UPDATE ON psb_quotes
  FOR EACH ROW EXECUTE FUNCTION update_psb_updated_at();
CREATE TRIGGER psb_config_updated_at BEFORE UPDATE ON psb_config
  FOR EACH ROW EXECUTE FUNCTION update_psb_updated_at();

-- =============================================================================
-- RLS — authenticated read, service role full
-- =============================================================================
ALTER TABLE psb_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE psb_state_defaults ENABLE ROW LEVEL SECURITY;
ALTER TABLE psb_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE psb_pricing_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE psb_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE psb_quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE psb_audit_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE psb_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_read_regions" ON psb_regions FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_state_defaults" ON psb_state_defaults FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_uploads" ON psb_uploads FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_pricing_data" ON psb_pricing_data FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_customers" ON psb_customers FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_quotes" ON psb_quotes FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_audit_log" ON psb_audit_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth_read_config" ON psb_config FOR SELECT TO authenticated USING (true);
-- service_role bypasses RLS automatically

-- =============================================================================
-- Seed: regions
-- =============================================================================
INSERT INTO psb_regions (name, slug, states) VALUES
  ('South', 'south', ARRAY['IN','OH','KY','IL','TN','MO','WV']),
  ('North', 'north', ARRAY['MI','WI','PA','MN']);

-- =============================================================================
-- Seed: per-state defaults (snow load defaults from spreadsheet — admin-editable)
-- South states default to 60 Ground Load; North to 30 Ground Load.
-- =============================================================================
INSERT INTO psb_state_defaults (state_code, region_id, default_snow_load, default_wind_mph)
SELECT s, (SELECT id FROM psb_regions WHERE slug = 'south'), '60 Ground Load', 105
FROM unnest(ARRAY['IN','OH','KY','IL','TN','MO','WV']) AS s;

INSERT INTO psb_state_defaults (state_code, region_id, default_snow_load, default_wind_mph)
SELECT s, (SELECT id FROM psb_regions WHERE slug = 'north'), '30 Ground Load', 105
FROM unnest(ARRAY['MI','WI','PA','MN']) AS s;

-- =============================================================================
-- Seed: app config (single row)
-- =============================================================================
INSERT INTO psb_config (deposit_default_pct, tax_default_pct, contact_phone, contact_email, contact_address)
VALUES (0.10, 0.07, '844-387-7246', 'orders@premiumsteelbuildings.com', 'PO Box 24, Godley, TX 76044-9998');
