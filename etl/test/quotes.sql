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

\echo 'PASS: etl/test/quotes.sql'
