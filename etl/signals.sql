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

-- Buy signals
SELECT * FROM signals
WHERE analyst_projections_count > 2 and average_projected > 20
ORDER BY signal_percentile DESC;
