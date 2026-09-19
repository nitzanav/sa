
-- 1. Calculate signal score and basic stats overview
-- 1a. Daily aggregation (MAD around the mean)
CREATE OR REPLACE VIEW yahoo_all_symbols_per_ticker_and_date AS
SELECT
  date,
  ticker,
  AVG(percent) AS average_projected,
  COUNT(*) AS analyst_projections_count,
  AVG(ABS(percent - mean_percent)) / ABS(AVG(mean_percent)) AS MAD,
  STRING_AGG(analyst || ':' || percent::text, '|' ORDER BY analyst) AS analyst_percent_list
  FROM (
    SELECT
      date, ticker, analyst, percent,
      AVG(percent) OVER (PARTITION BY date, ticker) AS mean_percent
    FROM yahoo_all_symbols
  ) s
GROUP BY date, ticker;

-- 1b. 7-day rolling window (MAD around the window mean)
CREATE OR REPLACE VIEW yahoo_all_symbols_per_ticker_and_date_7d_window AS
SELECT
  date,
  ticker,
  AVG(percent) AS average_projected,
  COUNT(*) AS analyst_projections_count,
  AVG(ABS(percent - mean_percent)) / ABS(AVG(mean_percent)) AS MAD,
  STRING_AGG(analyst || ':' || percent::text, '|' ORDER BY analyst) AS analyst_percent_list
  FROM (
    SELECT
      a.date, a.ticker, b.analyst, b.percent,
      AVG(b.percent) OVER (PARTITION BY a.date, a.ticker) AS mean_percent
    FROM (SELECT DISTINCT ticker, date FROM yahoo_all_symbols) a
    JOIN yahoo_all_symbols b
      ON a.ticker = b.ticker
    AND b.date BETWEEN a.date - INTERVAL '6 days' AND a.date
    WHERE 
       percent IS NOT NULL
  ) w
GROUP BY date, ticker;
-- 2a. Query for daily scores (from daily aggregation)
CREATE OR REPLACE VIEW signal_score_daily AS
SELECT
  date,
  ticker,
  average_projected,
  analyst_projections_count,
  MAD,
  average_projected * sqrt(analyst_projections_count) * (1 - NULLIF(MAD, 0)) AS signal_score,
  analyst_percent_list
FROM yahoo_all_symbols_per_ticker_and_date
WHERE 
  average_projected > 0;

-- 2b. Query for 7d window scores (from 7d window aggregation)
CREATE OR REPLACE VIEW signal_score_7d_window AS
SELECT
  date,
  ticker,
  average_projected,
  analyst_projections_count,
  MAD,
  average_projected * sqrt(analyst_projections_count) * (1 - NULLIF(MAD, 0))  AS signal_score,
  analyst_percent_list
FROM yahoo_all_symbols_per_ticker_and_date_7d_window
WHERE 
  average_projected > 0;

-- 3. Single signals table
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
WHERE signal_percentile > 0.5 and signal_name = 'yahoo-daily' and ticker='TSLA'
ORDER BY signal_percentile DESC;
SELECT * FROM yahoo_all_symbols
WHERE  ticker ='TSLA'
ORDER BY date DESC;