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

-- Pair windows: later start through earlier end.
-- all_sources is yahoo ∩ tipranks. yahoo_and_google is yahoo ∩ google.
-- Yahoo rows cover the union of those windows so both pools can be cut from them.
DROP TABLE IF EXISTS _windows;
CREATE TABLE _windows AS
SELECT
  GREATEST(y.min_date, t.min_date) AS yt_start,
  LEAST(y.max_date, t.max_date) AS yt_end,
  GREATEST(y.min_date, g.min_date) AS yg_start,
  LEAST(y.max_date, g.max_date) AS yg_end
FROM
  (SELECT MIN(date) AS min_date, MAX(date) AS max_date FROM _raw_signals WHERE source = 'yahoo') y,
  (SELECT MIN(date) AS min_date, MAX(date) AS max_date FROM _raw_signals WHERE source = 'google') g,
  (SELECT MIN(date) AS min_date, MAX(date) AS max_date FROM _raw_signals WHERE source = 'tipranks') t;

INSERT INTO raw_signals
SELECT r.*
FROM _raw_signals r
JOIN _windows w ON
  (r.source = 'yahoo' AND r.date BETWEEN LEAST(w.yt_start, w.yg_start) AND GREATEST(w.yt_end, w.yg_end))
  OR (r.source = 'tipranks' AND r.date BETWEEN w.yt_start AND w.yt_end)
  OR (r.source = 'google' AND r.date BETWEEN w.yg_start AND w.yg_end);

INSERT INTO raw_signals
SELECT 'all_sources', r.date, r.ticker, r.analyst, r.percent, r.projected_price
FROM raw_signals r
JOIN _windows w ON r.date BETWEEN w.yt_start AND w.yt_end
WHERE r.source IN ('yahoo', 'tipranks');

INSERT INTO raw_signals
SELECT 'yahoo_and_google', r.date, r.ticker, r.analyst, r.percent, r.projected_price
FROM raw_signals r
JOIN _windows w ON r.date BETWEEN w.yg_start AND w.yg_end
WHERE r.source IN ('yahoo', 'google');

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
