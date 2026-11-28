-- Daily Yahoo bars from make download_yahoo_quotes. bar_date is the
-- America/New_York day. Replaced on every load in one transaction, so
-- readers never see it empty, including on the first load.
-- Do not run with psql -1: the COMMIT below would end that outer transaction.
BEGIN;
CREATE TABLE IF NOT EXISTS yahoo_quotes (
  bar_date date NOT NULL,
  symbol text NOT NULL,
  open double precision,
  high double precision,
  low double precision,
  close double precision NOT NULL,
  PRIMARY KEY (bar_date, symbol)
);
TRUNCATE yahoo_quotes;
\copy yahoo_quotes (bar_date, symbol, open, high, low, close) FROM 'data/yahoo_quotes/all_symbols_per_date_and_symbol.csv' WITH CSV HEADER
COMMIT;
