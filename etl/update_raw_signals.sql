CREATE TABLE IF NOT EXISTS raw_signals (
  source varchar,
  date date,
  ticker varchar,
  analyst text,
  percent real,
  projected_price real
);
TRUNCATE TABLE raw_signals;

CREATE TEMP TABLE _load (date date, ticker varchar, analyst text, percent real, projected_price real);

\copy _load FROM 'data/analyst_recomendation/yahoo/all_symbols.csv' CSV HEADER
INSERT INTO raw_signals SELECT 'yahoo', * FROM _load;
TRUNCATE _load;

\copy _load FROM 'data/analyst_recomendation/google/all_symbols.csv' CSV HEADER
INSERT INTO raw_signals SELECT 'google', * FROM _load;
