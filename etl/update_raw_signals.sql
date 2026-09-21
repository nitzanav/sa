CREATE TABLE IF NOT EXISTS yahoo_all_symbols (
  date date,
  ticker varchar,
  analyst text,
  percent real,
  projected_price real
);
ALTER TABLE yahoo_all_symbols ADD COLUMN IF NOT EXISTS projected_price real;
TRUNCATE TABLE yahoo_all_symbols;
\copy yahoo_all_symbols (date, ticker, analyst, percent, projected_price) FROM 'data/analyst_recomendation/yahoo/all_symbols.csv' CSV HEADER

CREATE TABLE IF NOT EXISTS google_all_symbols (
  date date,
  ticker varchar,
  analyst text,
  percent real,
  projected_price real
);

ALTER TABLE google_all_symbols ADD COLUMN IF NOT EXISTS projected_price real;
TRUNCATE TABLE google_all_symbols;
-- focusing now only on yahoo
-- \copy google_all_symbols (date, ticker, analyst, percent, projected_price) FROM 'data/analyst_recomendation/google/all_symbols.csv' CSV HEADER
