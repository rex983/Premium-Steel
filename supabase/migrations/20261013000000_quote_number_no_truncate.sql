-- LPAD(n, 4, '0') truncates to 4 chars once n >= 10000 (e.g. 10000 -> '1000'),
-- which would reissue an existing quote number and hit the UNIQUE constraint.
-- Pad to at least 4 digits but never truncate.
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

  RETURN 'PSB-' || current_year || '-' ||
    CASE WHEN next_num < 10000 THEN LPAD(next_num::TEXT, 4, '0') ELSE next_num::TEXT END;
END;
$$;
