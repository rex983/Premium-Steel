-- The quote number's year was now()'s year in the database's zone (UTC), so
-- quotes made after 7 PM Eastern on Dec 31 took next year's number and
-- started its sequence early. Use the Eastern year. Same function otherwise
-- (20261013000000_quote_number_no_truncate.sql).
CREATE OR REPLACE FUNCTION next_psb_quote_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  current_year INT := EXTRACT(YEAR FROM (now() AT TIME ZONE 'America/New_York'));
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
