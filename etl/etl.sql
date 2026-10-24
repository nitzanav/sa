CREATE TABLE IF NOT EXISTS raw_signals (
  source varchar,
  date date,
  ticker varchar,
  analyst text,
  percent real,
  projected_price real
);
TRUNCATE TABLE raw_signals;

DROP TABLE IF EXISTS _load;
CREATE TABLE _load (date date, ticker varchar, analyst text, percent real, projected_price real);

DROP TABLE IF EXISTS _raw_signals;
CREATE TABLE _raw_signals (
  source varchar,
  date date,
  ticker varchar,
  analyst text,
  percent real,
  projected_price real
);

\copy _load FROM 'data/analyst_recomendation/yahoo/all_symbols.csv' CSV HEADER
INSERT INTO _raw_signals SELECT 'yahoo', * FROM _load;
TRUNCATE _load;

\copy _load FROM 'data/analyst_recomendation/google/all_symbols.csv' CSV HEADER
INSERT INTO _raw_signals SELECT 'google', * FROM _load;
TRUNCATE _load;

\copy _load FROM 'data/analyst_recomendation/tipranks/all_symbols.csv' CSV HEADER
INSERT INTO _raw_signals SELECT 'tipranks', * FROM _load;

-- One range for every source: latest start through earliest end.
DROP TABLE IF EXISTS _windows;
CREATE TABLE _windows AS
SELECT MAX(min_date) AS start_date, MIN(max_date) AS end_date
FROM (
  SELECT MIN(date) AS min_date, MAX(date) AS max_date
  FROM _raw_signals
  GROUP BY source
) s;

INSERT INTO raw_signals
SELECT r.*
FROM _raw_signals r
JOIN _windows w ON r.date BETWEEN w.start_date AND w.end_date;

INSERT INTO raw_signals
SELECT 'all_sources', date, ticker, analyst, percent, projected_price
FROM raw_signals
WHERE source IN ('yahoo', 'tipranks');

INSERT INTO raw_signals
SELECT 'yahoo_and_google', date, ticker, analyst, percent, projected_price
FROM raw_signals
WHERE source IN ('yahoo', 'google');

-- Drop old views so columns can be re-ordered / renamed cleanly.
DROP VIEW IF EXISTS signals CASCADE;
DROP VIEW IF EXISTS signal_score_daily CASCADE;
DROP VIEW IF EXISTS signal_score_7d_window CASCADE;
DROP VIEW IF EXISTS raw_signals_per_ticker_and_date CASCADE;
DROP VIEW IF EXISTS raw_signals_per_ticker_and_date_7d_window CASCADE;

-- 1a. Daily aggregation (MAD around the mean)
CREATE OR REPLACE VIEW raw_signals_per_ticker_and_date AS
SELECT
  source,
  date,
  ticker,
  AVG(percent) AS average_projected,
  COUNT(distinct projected_price) AS analyst_projections_count, -- ignore analyst with same exact projected price
  AVG(ABS(percent - mean_percent)) / ABS(AVG(mean_percent)) AS MAD,
  STRING_AGG(analyst || ':' || percent::text, '|' ORDER BY analyst) AS analyst_percent_list
  FROM (
    SELECT
      source, date, ticker, analyst, percent, projected_price,
      AVG(percent) OVER (PARTITION BY source, date, ticker) AS mean_percent
    FROM raw_signals
  ) s
GROUP BY source, date, ticker;

-- 1b. 7-day rolling window (MAD around the window mean)
CREATE OR REPLACE VIEW raw_signals_per_ticker_and_date_7d_window AS
SELECT
  source,
  date,
  ticker,
  AVG(percent) AS average_projected,
  COUNT(*) AS analyst_projections_count,
  AVG(ABS(percent - mean_percent)) / ABS(AVG(mean_percent)) AS MAD,
  STRING_AGG(analyst || ':' || percent::text, '|' ORDER BY analyst) AS analyst_percent_list
  FROM (
    SELECT
      a.source, a.date, a.ticker, b.analyst, b.percent,
      AVG(b.percent) OVER (PARTITION BY a.source, a.date, a.ticker) AS mean_percent
    FROM (SELECT DISTINCT source, ticker, date FROM raw_signals) a
    JOIN raw_signals b
      ON a.source = b.source
     AND a.ticker = b.ticker
     AND b.date BETWEEN a.date - INTERVAL '6 days' AND a.date
    WHERE percent IS NOT NULL
  ) w
GROUP BY source, date, ticker;

-- 2a. Daily scores
CREATE OR REPLACE VIEW signal_score_daily AS
SELECT
  source,
  date,
  ticker,
  average_projected,
  analyst_projections_count,
  MAD,
  average_projected * sqrt(analyst_projections_count) AS signal_score,
  analyst_percent_list
FROM raw_signals_per_ticker_and_date
WHERE average_projected > 0;

-- 2b. 7-day window scores
CREATE OR REPLACE VIEW signal_score_7d_window AS
SELECT
  source,
  date,
  ticker,
  average_projected,
  analyst_projections_count,
  MAD,
  average_projected * sqrt(analyst_projections_count) * (1 - MAD) AS signal_score,
  analyst_percent_list
FROM raw_signals_per_ticker_and_date_7d_window
WHERE average_projected > 0;

-- Combined signals. Percentile is ranked within each signal_name.
CREATE OR REPLACE VIEW signals AS
SELECT
  u.*,
  PERCENT_RANK() OVER (
    PARTITION BY signal_name
    ORDER BY signal_score ASC NULLS FIRST
  ) AS signal_percentile
FROM (
  SELECT source || '-daily' AS signal_name,
         date, ticker, average_projected, analyst_projections_count,
         MAD, signal_score, analyst_percent_list
  FROM signal_score_daily
  WHERE analyst_projections_count > 2 AND average_projected > 10
  UNION ALL
  SELECT source || '-7d-window' AS signal_name,
         date, ticker, average_projected, analyst_projections_count,
         MAD, signal_score, analyst_percent_list
  FROM signal_score_7d_window
  WHERE analyst_projections_count > 2 AND average_projected > 10
) u;

-- \copy reads the rest of the line only, so the export query stays on one line.
\copy (SELECT * FROM signals WHERE signal_name in ('yahoo-daily', 'yahoo-7d-window', 'google-daily', 'google-7d-window', 'tipranks-daily', 'tipranks-7d-window', 'all_sources-daily', 'all_sources-7d-window', 'yahoo_and_google-daily', 'yahoo_and_google-7d-window') AND analyst_projections_count > 2 AND average_projected > 10 ORDER BY signal_name,date,ticker,average_projected DESC) TO 'data/signals.csv' WITH CSV HEADER
