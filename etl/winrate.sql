-- Point-in-time analyst win rates.
-- Run after etl/etl.sql so _raw_signals exists.
-- Prices are adjusted closes. A horizon of N calendar days uses the first
-- session on or after that calendar date (Thursday + 3 days is Sunday, so
-- the price is Monday's close). percent is (future / price - 1) * 100.
-- An analyst's record on a signal date uses only their earlier calls with
-- date <= signal date - 3 days (a Thursday signal sees Monday and before).

DO $$ BEGIN
  IF to_regclass('_raw_signals') IS NULL THEN
    RAISE EXCEPTION '_raw_signals is missing; run make etl first';
  END IF;
END $$;

DROP TABLE IF EXISTS yahoo_quote_responses;
CREATE TABLE yahoo_quote_responses (
  ticker varchar,
  response text
);

\copy yahoo_quote_responses FROM 'data/yahoo_quotes/quotes.csv' CSV HEADER

DROP TABLE IF EXISTS yahoo_quotes;
CREATE TABLE yahoo_quotes AS
SELECT DISTINCT ON (ticker, date)
  ticker,
  (to_timestamp(ts.elem::text::double precision) AT TIME ZONE 'America/New_York')::date AS date,
  adj.elem::text::double precision AS price
FROM yahoo_quote_responses r
CROSS JOIN LATERAL jsonb_array_elements(
  r.response::jsonb #> '{chart,result,0,timestamp}'
) WITH ORDINALITY AS ts(elem, ord)
JOIN LATERAL jsonb_array_elements(
  r.response::jsonb #> '{chart,result,0,indicators,adjclose,0,adjclose}'
) WITH ORDINALITY AS adj(elem, ord) ON adj.ord = ts.ord
WHERE jsonb_typeof(adj.elem) = 'number'
  AND adj.elem::text::double precision <> 0
ORDER BY ticker, date, ts.elem::text::double precision;
CREATE INDEX ON yahoo_quotes (ticker, date);

-- One row per ticker and signal date. The 7- and 14-day averages are the
-- mean of the percent change from the signal close to each later session
-- through the session used for the point return.
DROP TABLE IF EXISTS symbol_date_winrate;
CREATE TABLE symbol_date_winrate AS
SELECT
  k.ticker,
  k.date,
  spot.price,
  (fwd3.price / NULLIF(spot.price, 0) - 1) * 100 AS percent_3d,
  (fwd7.price / NULLIF(spot.price, 0) - 1) * 100 AS percent_7d,
  avg7.percent_7d_avg,
  avg14.percent_14d_avg
FROM (
  SELECT DISTINCT ticker, date FROM _raw_signals
) k
LEFT JOIN LATERAL (
  SELECT q.price
  FROM yahoo_quotes q
  WHERE q.ticker = k.ticker AND q.date = k.date
) spot ON true
LEFT JOIN LATERAL (
  SELECT q.date AS px_date, q.price
  FROM yahoo_quotes q
  WHERE q.ticker = k.ticker AND q.date >= k.date + 3
  ORDER BY q.date
  LIMIT 1
) fwd3 ON true
LEFT JOIN LATERAL (
  SELECT q.date AS px_date, q.price
  FROM yahoo_quotes q
  WHERE q.ticker = k.ticker AND q.date >= k.date + 7
  ORDER BY q.date
  LIMIT 1
) fwd7 ON true
LEFT JOIN LATERAL (
  SELECT q.date AS px_date, q.price
  FROM yahoo_quotes q
  WHERE q.ticker = k.ticker AND q.date >= k.date + 14
  ORDER BY q.date
  LIMIT 1
) fwd14 ON true
LEFT JOIN LATERAL (
  SELECT AVG((q.price / spot.price - 1) * 100) AS percent_7d_avg
  FROM yahoo_quotes q
  WHERE spot.price IS NOT NULL
    AND fwd7.px_date IS NOT NULL
    AND q.ticker = k.ticker
    AND q.date > k.date
    AND q.date <= fwd7.px_date
) avg7 ON true
LEFT JOIN LATERAL (
  SELECT AVG((q.price / spot.price - 1) * 100) AS percent_14d_avg
  FROM yahoo_quotes q
  WHERE spot.price IS NOT NULL
    AND fwd14.px_date IS NOT NULL
    AND q.ticker = k.ticker
    AND q.date > k.date
    AND q.date <= fwd14.px_date
) avg14 ON true;
CREATE INDEX ON symbol_date_winrate (ticker, date);

DROP TABLE IF EXISTS raw_signals_winrate;
CREATE TABLE raw_signals_winrate AS
SELECT
  r.source,
  r.date,
  r.ticker,
  r.analyst,
  r.percent,
  r.projected_price,
  w.price,
  w.percent_3d,
  w.percent_7d,
  w.percent_7d_avg,
  w.percent_14d_avg
FROM _raw_signals r
LEFT JOIN symbol_date_winrate w
  ON w.ticker = r.ticker AND w.date = r.date;
CREATE INDEX ON raw_signals_winrate (source, analyst, date);

-- History for the combined books, so a yahoo_and_tipranks signal can use
-- that analyst's record inside the book. Component rows are not deduped.
DROP TABLE IF EXISTS _analyst_history;
CREATE TABLE _analyst_history AS
SELECT source, date, ticker, analyst, percent_3d, percent_7d, percent_7d_avg, percent_14d_avg
FROM raw_signals_winrate
UNION ALL
SELECT 'yahoo_and_tipranks', date, ticker, analyst, percent_3d, percent_7d, percent_7d_avg, percent_14d_avg
FROM raw_signals_winrate
WHERE source IN ('yahoo', 'tipranks')
UNION ALL
SELECT 'yahoo_and_google', date, ticker, analyst, percent_3d, percent_7d, percent_7d_avg, percent_14d_avg
FROM raw_signals_winrate
WHERE source IN ('yahoo', 'google');
CREATE INDEX ON _analyst_history (source, analyst, date);

-- One row per source, signal date, and analyst who already has a call on or
-- before that signal date minus 3 days. A running total per analyst makes the
-- as-of lookup the latest snapshot with hist_date <= signal date - 3.
-- percent_7d_avg here is the mean of the 7-day point return.
-- percent_7d_window_avg is the mean of the path average (symbol percent_7d_avg).
-- percent_14d_window_avg is the mean of symbol percent_14d_avg.
DROP TABLE IF EXISTS analyst_winrate;
CREATE TABLE analyst_winrate AS
WITH ordered AS (
  SELECT
    source,
    analyst,
    date,
    percent_3d,
    percent_7d,
    percent_7d_avg,
    percent_14d_avg,
    ROW_NUMBER() OVER (
      PARTITION BY source, analyst
      ORDER BY date, ticker, percent_3d NULLS LAST, percent_7d NULLS LAST
    ) AS rn
  FROM _analyst_history
  WHERE analyst IS NOT NULL
),
running AS (
  SELECT
    source,
    analyst,
    date AS hist_date,
    COUNT(*) OVER w AS total_recomendations,
    AVG(percent_3d) OVER w AS percent_3d_avg,
    AVG(percent_7d) OVER w AS percent_7d_avg,
    AVG(percent_7d_avg) OVER w AS percent_7d_window_avg,
    AVG(percent_14d_avg) OVER w AS percent_14d_window_avg,
    SUM(CASE WHEN percent_3d > 0 THEN 1 ELSE 0 END) OVER w AS wins,
    rn
  FROM ordered
  WINDOW w AS (PARTITION BY source, analyst ORDER BY rn)
),
snap AS (
  SELECT DISTINCT ON (source, analyst, hist_date)
    source,
    analyst,
    hist_date,
    total_recomendations,
    percent_3d_avg,
    percent_7d_avg,
    percent_7d_window_avg,
    percent_14d_window_avg,
    wins::double precision / NULLIF(total_recomendations, 0) AS percent_3d_winrate
  FROM running
  ORDER BY source, analyst, hist_date, rn DESC
),
asof AS (
  SELECT DISTINCT ON (d.source, d.date, s.analyst)
    d.source,
    d.date,
    s.analyst,
    s.total_recomendations,
    s.percent_3d_avg,
    s.percent_7d_avg,
    s.percent_7d_window_avg,
    s.percent_14d_window_avg,
    s.percent_3d_winrate
  FROM (SELECT DISTINCT source, date FROM _analyst_history) d
  JOIN snap s
    ON s.source = d.source
   AND s.hist_date <= d.date - 3
  ORDER BY d.source, d.date, s.analyst, s.hist_date DESC
)
SELECT
  source,
  date,
  analyst,
  total_recomendations,
  percent_3d_avg,
  percent_7d_avg,
  percent_7d_window_avg,
  percent_14d_window_avg,
  percent_3d_winrate,
  PERCENT_RANK() OVER (
    PARTITION BY source, date
    ORDER BY percent_3d_winrate
  ) AS percent_3d_winrate_percentile,
  PERCENT_RANK() OVER (
    PARTITION BY source, date
    ORDER BY percent_3d_avg
  ) AS percent_3d_avg_percentile
FROM asof;
CREATE INDEX ON analyst_winrate (source, analyst, date);

DO $$ BEGIN
  IF (SELECT COUNT(*) FROM symbol_date_winrate)
     <> (SELECT COUNT(*) FROM (SELECT DISTINCT ticker, date FROM _raw_signals) s) THEN
    RAISE EXCEPTION 'symbol_date_winrate must have one row per ticker and date';
  END IF;
  IF EXISTS (
    SELECT 1 FROM analyst_winrate
    WHERE percent_3d_winrate < 0 OR percent_3d_winrate > 1
  ) THEN
    RAISE EXCEPTION 'percent_3d_winrate out of range';
  END IF;
END $$;

-- The recency view gains an unweighted mean and a win-rate-weighted mean.
-- Score views keep the recency-weighted mean under average_projected so the
-- exported signal books do not change shape.
DROP VIEW IF EXISTS signals CASCADE;
DROP VIEW IF EXISTS signal_score_nd_recency CASCADE;
DROP VIEW IF EXISTS raw_signals_per_ticker_and_date_nd_recency CASCADE;

CREATE VIEW raw_signals_per_ticker_and_date_nd_recency AS
SELECT
  source,
  n,
  date,
  ticker,
  AVG(percent) AS percent_avg,
  SUM(percent * weight) / NULLIF(SUM(weight), 0) AS percent_avg_weighted_recency,
  SUM(percent * weight * percent_3d_winrate)
    / NULLIF(SUM(weight * percent_3d_winrate), 0)
    AS percent_avg_weighted_recency_and_analyst_winrate,
  SUM(weight) AS analyst_projections_count,
  (
    SUM(ABS(percent - mean_percent) * weight) / NULLIF(SUM(weight), 0)
  ) / NULLIF(ABS(SUM(percent * weight) / NULLIF(SUM(weight), 0)), 0) AS MAD,
  STRING_AGG(analyst || ':' || percent::text, '|' ORDER BY point_date, analyst) AS analyst_percent_list
FROM (
  SELECT
    p.source,
    p.n,
    p.date,
    p.ticker,
    p.analyst,
    p.percent,
    p.point_date,
    p.weight,
    p.percent_3d_winrate,
    SUM(p.percent * p.weight) OVER (PARTITION BY p.source, p.n, p.date, p.ticker)
      / NULLIF(SUM(p.weight) OVER (PARTITION BY p.source, p.n, p.date, p.ticker), 0) AS mean_percent
  FROM (
    SELECT
      a.source,
      w.n,
      a.date,
      a.ticker,
      b.analyst,
      b.percent,
      b.date AS point_date,
      (2.5 / (a.day_idx - tb.day_idx + 1))::float8 AS weight,
      aw.percent_3d_winrate
    FROM (
      SELECT DISTINCT r.source, r.ticker, r.date, t.day_idx
      FROM signals_dedup r
      JOIN _trading_days t ON t.date = r.date
    ) a
    CROSS JOIN (VALUES (1), (2), (3), (4), (5)) AS w(n)
    JOIN _trading_days tb
      ON tb.day_idx BETWEEN a.day_idx - (w.n - 1) AND a.day_idx
    JOIN signals_dedup b
      ON b.source = a.source
     AND b.ticker = a.ticker
     AND b.date = tb.date
    LEFT JOIN analyst_winrate aw
      ON aw.source = b.source
     AND aw.analyst = b.analyst
     AND aw.date = a.date
  ) p
) x
GROUP BY source, n, date, ticker;

CREATE VIEW signal_score_nd_recency AS
SELECT
  source,
  n,
  date,
  ticker,
  percent_avg_weighted_recency AS average_projected,
  analyst_projections_count,
  MAD,
  CASE
    WHEN n = 1 THEN percent_avg_weighted_recency * sqrt(analyst_projections_count)
    ELSE percent_avg_weighted_recency * sqrt(analyst_projections_count) * (1 - MAD)
  END AS signal_score,
  analyst_percent_list
FROM raw_signals_per_ticker_and_date_nd_recency
WHERE percent_avg_weighted_recency > 0;

CREATE VIEW signals AS
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
  SELECT source || '_' || n || 'd_recency' AS signal_name,
         date, ticker, average_projected, analyst_projections_count,
         MAD, signal_score, analyst_percent_list
  FROM signal_score_nd_recency
) u;

DO $$ BEGIN
  IF (SELECT COUNT(*) FROM signal_score_daily) <>
     (SELECT COUNT(*) FROM signal_score_nd_recency WHERE n = 1) THEN
    RAISE EXCEPTION '1d recency row count does not match the daily book';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM signal_score_daily d
    JOIN signal_score_nd_recency r
      ON r.source = d.source
     AND r.n = 1
     AND r.date = d.date
     AND r.ticker = d.ticker
    WHERE abs(r.analyst_projections_count - 2.5 * d.analyst_projections_count) > 1e-6
       OR abs(r.average_projected - d.average_projected) > 1e-3
  ) THEN
    RAISE EXCEPTION '1d recency must weigh the signal session by 2.5 and keep the daily mean';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM raw_signals_per_ticker_and_date_nd_recency
    WHERE n = 1
      AND abs(percent_avg - percent_avg_weighted_recency) > 1e-3
  ) THEN
    RAISE EXCEPTION '1d percent_avg must match the recency-weighted mean';
  END IF;
END $$;
