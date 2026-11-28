-- Runs the real SQL against etl/test/fixtures/yahoo_quotes.csv in a throwaway
-- schema. etl/test/run.sh generates etl/test/tmp/ and runs this file from the
-- repo root. public stays off search_path, so a table missing here fails
-- instead of resolving to production. Never wrap an \i in BEGIN: the load
-- file's own COMMIT would end it.
DROP SCHEMA IF EXISTS etl_test_quotes CASCADE;
CREATE SCHEMA etl_test_quotes;
SET search_path TO etl_test_quotes;
DO $$ BEGIN
  IF current_schema() IS DISTINCT FROM 'etl_test_quotes' THEN
    RAISE EXCEPTION 'search_path is %, expected etl_test_quotes', current_schema();
  END IF;
END $$;

-- Twice: TRUNCATE makes the load idempotent.
\i etl/test/tmp/load_yahoo_quotes.sql
\i etl/test/tmp/load_yahoo_quotes.sql

DO $$
DECLARE
  n bigint;
BEGIN
  SELECT count(*) INTO n FROM yahoo_quotes;
  IF n <> 6 THEN
    RAISE EXCEPTION 'yahoo_quotes has % rows, expected 6', n;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM yahoo_quotes
    WHERE symbol = 'MSFT' AND bar_date = '2026-11-05' AND open IS NULL
  ) THEN
    RAISE EXCEPTION 'MSFT 2026-11-05 open should load as NULL';
  END IF;
END $$;

-- Buy and sell read yahoo_quotes. The run is Friday 2026-11-06 17:00
-- America/New_York (run.sh replaces NOW()). The real signals is a view in
-- public; this stub has the columns buy_alerts.sql reads.
CREATE TABLE signals (
  signal_name text,
  date date,
  ticker text,
  analyst_projections_count double precision,
  average_projected double precision
);
INSERT INTO signals VALUES ('yahoo_and_tipranks_1d_recency', '2026-11-06', 'AAPL', 3, 50);

\i etl/test/tmp/buy_alerts.sql

DO $$
DECLARE
  p double precision;
BEGIN
  SELECT price INTO p FROM positions WHERE symbol = 'AAPL' AND open;
  IF p IS DISTINCT FROM 210 THEN
    RAISE EXCEPTION 'AAPL buy price is %, expected the 2026-11-06 close 210', p;
  END IF;
END $$;

-- MSFT bought at 100 on 2026-11-04 sees closes 100, 99, 95: dd at 95.
WITH a AS (
  INSERT INTO alerts (
    type, alerted_at, alert_strategy, signal_name, signal_date,
    symbol, analysts, percent, strength
  )
  VALUES (
    'buy', '2026-11-04 22:00+00', 'at >2 >40%', 'yahoo_and_tipranks_any_recency',
    '2026-11-04', 'MSFT', 3, 50, 15
  )
  RETURNING id, signal_date
)
INSERT INTO positions (alert_id, signal_date, symbol, open, lots, buy_date, price)
SELECT id, signal_date, 'MSFT', true, 1, timestamptz '2026-11-04 22:00+00', 100 FROM a;

\i etl/test/tmp/sell_alerts.sql

DO $$
DECLARE
  r record;
BEGIN
  SELECT open, sell_reason, sell_price INTO r FROM positions WHERE symbol = 'MSFT';
  IF r.open OR r.sell_reason IS DISTINCT FROM 'dd' OR r.sell_price IS DISTINCT FROM 95 THEN
    RAISE EXCEPTION 'MSFT is open=% reason=% price=%, expected closed dd at 95',
      r.open, r.sell_reason, r.sell_price;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM positions WHERE symbol = 'AAPL' AND open) THEN
    RAISE EXCEPTION 'AAPL should still be open';
  END IF;
END $$;

\echo 'PASS: etl/test/quotes.sql'
