/*

task:
creaet make command that takes the yahoo and google files of all symbols
copy them to db
drop the yahoo_all_symbols and google one
do copy in psql


export DATABASE_URL="postgresql://myuser:secret@mydb.xxxx.us-east-1.rds.amazonaws.com:5432/mydb?sslmode=require"

psql "$DATABASE_URL" -c "\copy mytable (col1, col2, col3) FROM 'file.csv' CSV HEADER"

*/

-- 1. Calculate signal score and basic stats overview
-- 1a. View for daily aggregation by ticker and date
CREATE OR REPLACE VIEW yahoo_all_symbols_per_ticker_and_date AS
SELECT
  date,
  ticker,
  AVG(percent) AS average_projected,
  COUNT(*) AS analyst_projections_count,
  STDDEV_POP(percent) AS std
FROM yahoo_all_symbols
GROUP BY date, ticker;

-- 1b. View for 7-day rolling window, grouping by ticker and each date (window includes current and previous 6 days)
CREATE OR REPLACE VIEW yahoo_all_symbols_per_ticker_and_date_7d_window AS
SELECT
  a.date,
  a.ticker,
  AVG(b.percent) AS average_projected,
  COUNT(*) AS analyst_projections_count,
  STDDEV_POP(b.percent) AS std
FROM
  yahoo_all_symbols a
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
  average_projected * sqrt(analyst_projections_count) / NULLIF(std / ABS(average_projected), 0) AS signal_score
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
  average_projected * sqrt(analyst_projections_count) / NULLIF(std / ABS(average_projected), 0) AS signal_score
FROM yahoo_all_symbols_per_ticker_and_date_7d_window
WHERE analyst_projections_count > 1
  AND average_projected > 0;

-- 3. Single signals table
CREATE OR REPLACE VIEW signals AS
SELECT
  u.*,
  PERCENT_RANK() OVER (
    PARTITION BY signal_name, date
    ORDER BY signal_score ASC NULLS FIRST
  ) AS signal_percentile
FROM (
  SELECT 'daily' AS signal_name, date, ticker, average_projected, analyst_projections_count, std, signal_score
  FROM signal_score_daily
  UNION ALL
  SELECT '7d_window' AS signal_name, date, ticker, average_projected, analyst_projections_count, std, signal_score
  FROM signal_score_7d_window
) u;

-- Buy signals
SELECT * FROM signals
WHERE signal_percentile > 0.95
ORDER BY date, signal_name, signal_percentile DESC;
