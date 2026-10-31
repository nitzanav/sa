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
SELECT 'yahoo_and_tipranks', date, ticker, analyst, percent, projected_price
FROM raw_signals
WHERE source IN ('yahoo', 'tipranks');

INSERT INTO raw_signals
SELECT 'yahoo_and_google', date, ticker, analyst, percent, projected_price
FROM raw_signals
WHERE source IN ('yahoo', 'google');

-- ---------------------------------------------------------------------
-- NASDAQ trading calendar (explicit, independent of the data)
-- ---------------------------------------------------------------------
DROP TABLE IF EXISTS _nasdaq_holidays;
CREATE TABLE _nasdaq_holidays (date date PRIMARY KEY);
INSERT INTO _nasdaq_holidays VALUES
-- 2024
('2024-01-01'), -- New Year's Day
('2024-01-15'), -- Martin Luther King Jr. Day
('2024-02-19'), -- Presidents' Day (Washington's Birthday)
('2024-03-29'), -- Good Friday
('2024-05-27'), -- Memorial Day
('2024-06-19'), -- Juneteenth
('2024-07-04'), -- Independence Day
('2024-09-02'), -- Labor Day
('2024-11-28'), -- Thanksgiving Day
('2024-12-25'), -- Christmas Day
-- 2025
('2025-01-01'), -- New Year's Day
('2025-01-09'), -- National Day of Mourning (President Carter)
('2025-01-20'), -- Martin Luther King Jr. Day
('2025-02-17'), -- Presidents' Day
('2025-04-18'), -- Good Friday
('2025-05-26'), -- Memorial Day
('2025-06-19'), -- Juneteenth
('2025-07-04'), -- Independence Day
('2025-09-01'), -- Labor Day
('2025-11-27'), -- Thanksgiving Day
('2025-12-25'), -- Christmas Day
-- 2026
('2026-01-01'), -- New Year's Day
('2026-01-19'), -- Martin Luther King Jr. Day
('2026-02-16'), -- Presidents' Day
('2026-04-03'), -- Good Friday
('2026-05-25'), -- Memorial Day
('2026-06-19'), -- Juneteenth
('2026-07-03'), -- Independence Day (observed; July 4 is a Saturday)
('2026-09-07'), -- Labor Day
('2026-11-26'), -- Thanksgiving Day
('2026-12-25'); -- Christmas Day
-- Early-close days (day after Thanksgiving, Christmas Eve, ...) are trading days.

-- Weekdays minus holidays, numbered consecutively. Starts 30 calendar days
-- before the first data date so early windows have full look-back.
-- Views from a previous run reference this table, so drop them first.
DROP VIEW IF EXISTS signals CASCADE;
DROP VIEW IF EXISTS signal_score_daily CASCADE;
DROP VIEW IF EXISTS signal_score_7d_window CASCADE;
DROP VIEW IF EXISTS signal_score_nd_window CASCADE;
DROP VIEW IF EXISTS raw_signals_per_ticker_and_date CASCADE;
DROP VIEW IF EXISTS raw_signals_per_ticker_and_date_7d_window CASCADE;
DROP VIEW IF EXISTS raw_signals_per_ticker_and_date_nd_window CASCADE;
DROP TABLE IF EXISTS _trading_days;
CREATE TABLE _trading_days AS
SELECT d::date AS date, ROW_NUMBER() OVER (ORDER BY d) AS day_idx
FROM generate_series(
       (SELECT MIN(date) FROM raw_signals)::timestamp - INTERVAL '30 days',
       (SELECT MAX(date) FROM raw_signals)::timestamp,
       INTERVAL '1 day') AS g(d)
WHERE EXTRACT(ISODOW FROM d) < 6
  AND d::date NOT IN (SELECT date FROM _nasdaq_holidays);
CREATE INDEX ON _trading_days(date);

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

-- 1b. 7-day rolling window, calendar days (MAD around the window mean)
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

-- 1c. N-trading-day rolling window, N = 2..5 (MAD around the window mean)
CREATE OR REPLACE VIEW raw_signals_per_ticker_and_date_nd_window AS
SELECT
  source,
  n,
  date,
  ticker,
  AVG(percent) AS average_projected,
  COUNT(*) AS analyst_projections_count,
  AVG(ABS(percent - mean_percent)) / ABS(AVG(mean_percent)) AS MAD,
  STRING_AGG(analyst || ':' || percent::text, '|' ORDER BY analyst) AS analyst_percent_list
  FROM (
    SELECT
      a.source, w.n, a.date, a.ticker, b.analyst, b.percent,
      AVG(b.percent) OVER (PARTITION BY a.source, w.n, a.date, a.ticker) AS mean_percent
    FROM (
      SELECT DISTINCT r.source, r.ticker, r.date, t.day_idx
      FROM raw_signals r
      JOIN _trading_days t ON t.date = r.date
    ) a
    CROSS JOIN (VALUES (2), (3), (4), (5)) AS w(n)
    JOIN _trading_days tb
      ON tb.day_idx BETWEEN a.day_idx - (w.n - 1) AND a.day_idx
    JOIN raw_signals b
      ON b.source = a.source
     AND b.ticker = a.ticker
     AND b.date = tb.date
    WHERE b.percent IS NOT NULL
  ) x
GROUP BY source, n, date, ticker;

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

-- 2c. N-trading-day window scores
CREATE OR REPLACE VIEW signal_score_nd_window AS
SELECT
  source,
  n,
  date,
  ticker,
  average_projected,
  analyst_projections_count,
  MAD,
  average_projected * sqrt(analyst_projections_count) * (1 - MAD) AS signal_score,
  analyst_percent_list
FROM raw_signals_per_ticker_and_date_nd_window
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
  SELECT source || '-1d' AS signal_name,
         date, ticker, average_projected, analyst_projections_count,
         MAD, signal_score, analyst_percent_list
  FROM signal_score_daily
  UNION ALL
  SELECT source || '-' || n || 'd' AS signal_name,
         date, ticker, average_projected, analyst_projections_count,
         MAD, signal_score, analyst_percent_list
  FROM signal_score_nd_window
  UNION ALL
  SELECT source || '-7d' AS signal_name,
         date, ticker, average_projected, analyst_projections_count,
         MAD, signal_score, analyst_percent_list
  FROM signal_score_7d_window
) u;

-- \copy reads the rest of the line only, so the export query stays on one line.
-- 1d and 7d only, so this export can be diffed against the previous signals.csv.
\copy (SELECT * FROM signals WHERE signal_name ~ '^(yahoo|google|tipranks|yahoo_and_tipranks|yahoo_and_google)-[17]d$' AND analyst_projections_count > 0 AND average_projected > 0 ORDER BY signal_name,date,ticker,average_projected DESC) TO 'data/signals.csv' WITH CSV HEADER
