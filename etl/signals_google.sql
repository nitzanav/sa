CREATE OR REPLACE VIEW yahoo_all_symbols_per_ticker_and_date_stats AS
SELECT
  AVG(sqrt(analyst_projections_count)) AS avg_sqrt_analist_count,
  MIN(sqrt(analyst_projections_count)) AS min_sqrt_analist_count,
  MAX(sqrt(analyst_projections_count)) AS max_sqrt_analist_count
FROM yahoo_all_symbols_per_ticker_and_date;


-- 1. Calculate signal score and basic stats overview
-- 1a. View for daily aggregation by ticker and date
CREATE OR REPLACE VIEW yahoo_all_symbols_per_ticker_and_date AS
SELECT
  date,
  ticker,
  AVG(percent) AS average_projected,
  COUNT(*) AS analyst_projections_count,
  STDDEV_POP(percent) AS std,
  STRING_AGG(analyst || ':' || percent::text, '|' ORDER BY analyst) AS analyst_percent_list
FROM yahoo_all_symbols
GROUP BY date, ticker;

-- 1b. View for 7-day rolling window, grouping by ticker and each date (window includes current and previous 6 days)
CREATE OR REPLACE VIEW yahoo_all_symbols_per_ticker_and_date_7d_window AS
SELECT
  a.date,
  a.ticker,
  AVG(b.percent) AS average_projected,
  COUNT(*) AS analyst_projections_count,
  STDDEV_POP(b.percent) AS std,
  STRING_AGG(b.analyst || ':' || b.percent::text, '|' ORDER BY b.analyst) AS analyst_percent_list
FROM (SELECT DISTINCT ticker, date FROM yahoo_all_symbols) a
JOIN yahoo_all_symbols b
  ON a.ticker = b.ticker
 AND b.date BETWEEN a.date - INTERVAL '6 days' AND a.date
GROUP BY a.date, a.ticker;
-- 2a. Query for daily scores (from daily aggregation)
CREATE OR REPLACE VIEW signal_score_daily AS
SELECT
  date,
  ticker,
  average_projected,
  analyst_projections_count,
  std,
  average_projected * sqrt(analyst_projections_count) / NULLIF(std / ABS(average_projected), 0) AS signal_score,
  analyst_percent_list
FROM yahoo_all_symbols_per_ticker_and_date
WHERE analyst_projections_count > 2
  AND average_projected > 0;

-- 2b. Query for 7d window scores (from 7d window aggregation)
CREATE OR REPLACE VIEW signal_score_7d_window AS
SELECT
  date,
  ticker,
  average_projected,
  analyst_projections_count,
  std,
  average_projected * sqrt(analyst_projections_count) / NULLIF(std / ABS(average_projected), 0) AS signal_score,
  analyst_percent_list
FROM yahoo_all_symbols_per_ticker_and_date_7d_window
WHERE analyst_projections_count > 1
  AND average_projected > 0;

-- 3. Single signals table
drop VIEW IF EXISTS signals;

CREATE OR REPLACE VIEW signals AS
SELECT
  u.*,
  PERCENT_RANK() OVER (
    PARTITION BY signal_name
    ORDER BY signal_score ASC NULLS FIRST
  ) AS signal_percentile
FROM (
  SELECT 'yahoo-daily' AS signal_name, *
  FROM signal_score_daily
  UNION ALL
  SELECT 'yahoo-7d-window' AS signal_name, *
  FROM signal_score_7d_window
) u;

-- Buy signals
SELECT * FROM signals
WHERE signal_percentile > 0.5
ORDER BY signal_percentile DESC;
