-- Requires _run(alerted_at). Stops the script unless this run is a finished
-- New York session: a weekday at or after 16:00 America/New_York, and
-- yahoo_quotes contains that date. Loads _bar for the caller.
-- The order placed from this run is the next session's open.

DROP TABLE IF EXISTS _bar;
CREATE TEMP TABLE _bar AS
SELECT bar_date, symbol, open, high, low, close FROM yahoo_quotes;

DROP TABLE IF EXISTS _session;
CREATE TEMP TABLE _session AS
SELECT
  (timezone('America/New_York', alerted_at))::date AS ny_date,
  (timezone('America/New_York', alerted_at))::time AS ny_time
FROM _run;

DO $$
DECLARE
  ny_date date;
  ny_time time;
  last_bar date;
BEGIN
  SELECT s.ny_date, s.ny_time INTO ny_date, ny_time FROM _session s;
  SELECT MAX(bar_date) INTO last_bar FROM _bar;
  IF ny_time < TIME '16:00' THEN
    RAISE EXCEPTION 'run % % is before the 16:00 America/New_York close', ny_date, ny_time;
  END IF;
  IF EXTRACT(DOW FROM ny_date) IN (0, 6) THEN
    RAISE EXCEPTION 'run date % is not a New York weekday', ny_date;
  END IF;
  IF last_bar IS DISTINCT FROM ny_date THEN
    RAISE EXCEPTION 'daily bars end on %, run date is %', last_bar, ny_date;
  END IF;
END $$;
