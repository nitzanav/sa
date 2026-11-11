-- NOTE: signal dates are session-aligned; weekend/holiday rows are shifted back
-- onto the prior session (lookahead, see the shift comment).
-- raw_signals is cumulative. A rating that later disappears from a source page stays.
-- created_at is the first time that key was stored. updated_at moves when it is seen again.
CREATE TABLE IF NOT EXISTS raw_signals (
  source varchar,
  date date,
  ticker varchar,
  analyst text,
  percent real,
  projected_price real,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE raw_signals ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE raw_signals ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
-- Source files repeat the same analyst and price. Collapse those copies so the
-- conflict key can be unique. NULL prices count as one row per analyst.
DELETE FROM raw_signals
WHERE ctid IN (
  SELECT ctid FROM (
    SELECT ctid,
           row_number() OVER (
             PARTITION BY source, ticker, date, analyst, projected_price
             ORDER BY ctid
           ) AS rn
    FROM raw_signals
  ) d
  WHERE rn > 1
);
DROP INDEX IF EXISTS raw_signals_source_ticker_date_analyst_price;
CREATE UNIQUE INDEX raw_signals_source_ticker_date_analyst_price
  ON raw_signals (source, ticker, date, analyst, projected_price) NULLS NOT DISTINCT;

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

DO $$ BEGIN
  IF (SELECT MIN(date) - 30 FROM _raw_signals) < DATE '2024-01-01'
     OR (SELECT MAX(date) FROM _raw_signals) > DATE '2026-12-31' THEN
    RAISE EXCEPTION '_raw_signals fall outside the 2024-2026 Nasdaq holiday list';
  END IF;
END $$;

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
DROP VIEW IF EXISTS signal_score_nd_recency CASCADE;
DROP VIEW IF EXISTS raw_signals_per_ticker_and_date_nd_recency CASCADE;
DROP VIEW IF EXISTS raw_signals_per_ticker_and_date_nd_window CASCADE;
DROP VIEW IF EXISTS signals_dedup CASCADE;
DROP TABLE IF EXISTS _trading_days;
CREATE TABLE _trading_days AS
SELECT d::date AS date, ROW_NUMBER() OVER (ORDER BY d) AS day_idx
FROM generate_series(
       (SELECT MIN(date) FROM _raw_signals)::timestamp - INTERVAL '30 days',
       (SELECT MAX(date) FROM _raw_signals)::timestamp,
       INTERVAL '1 day') AS g(d)
WHERE EXTRACT(ISODOW FROM d) < 6
  AND d::date NOT IN (SELECT date FROM _nasdaq_holidays);
CREATE INDEX ON _trading_days(date);

-- Sat/Sun/holiday rows count as the last session before them (Fri stays Fri).
-- Intentional, with a known LOOKAHEAD: a Friday signal includes rows published
-- Sat/Sun (or on the holiday) after Friday's close. Any backtest that trades on
-- the Friday signal must account for this (e.g., act at the next session's
-- open, not Friday's close). Not a bug.
UPDATE _raw_signals r
SET date = (SELECT MAX(t.date) FROM _trading_days t WHERE t.date <= r.date);

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM _raw_signals WHERE date IS NULL) THEN
    RAISE EXCEPTION 'date shift produced NULL';
  END IF;
END $$;

-- One range for every source: latest start through earliest end.
DROP TABLE IF EXISTS _windows;
CREATE TABLE _windows AS
SELECT MAX(min_date) AS start_date, MIN(max_date) AS end_date
FROM (
  SELECT MIN(date) AS min_date, MAX(date) AS max_date
  FROM _raw_signals
  GROUP BY source
) s;

-- New file rows are upserted. Rows already stored, including ratings the file
-- no longer contains, are left in place.
INSERT INTO raw_signals (source, date, ticker, analyst, percent, projected_price)
SELECT source, date, ticker, analyst, percent, projected_price
FROM (
  SELECT DISTINCT ON (source, ticker, date, analyst, projected_price)
         r.source, r.date, r.ticker, r.analyst, r.percent, r.projected_price
  FROM _raw_signals r
  JOIN _windows w ON r.date BETWEEN w.start_date AND w.end_date
  ORDER BY r.source, r.ticker, r.date, r.analyst, r.projected_price, r.percent
) s
ON CONFLICT (source, ticker, date, analyst, projected_price)
DO UPDATE SET percent = EXCLUDED.percent, updated_at = now();

-- Combined books (yahoo_and_tipranks, yahoo_and_google) are deduped under their
-- own source name. Intentional: the same projected_price on the same session
-- from both underlying sources counts once, so a combined count is NOT the sum
-- of the parts. Feature, not a bug.
-- Built from the cumulative base rows, so a rating kept from an older scrape
-- stays in the combined book after it leaves the source page.
INSERT INTO raw_signals (source, date, ticker, analyst, percent, projected_price)
SELECT 'yahoo_and_tipranks', date, ticker, analyst, percent, projected_price
FROM (
  SELECT DISTINCT ON (ticker, date, analyst, projected_price)
         date, ticker, analyst, percent, projected_price
  FROM raw_signals
  WHERE source IN ('yahoo', 'tipranks')
  ORDER BY ticker, date, analyst, projected_price, percent
) s
ON CONFLICT (source, ticker, date, analyst, projected_price)
DO UPDATE SET percent = EXCLUDED.percent, updated_at = now();

INSERT INTO raw_signals (source, date, ticker, analyst, percent, projected_price)
SELECT 'yahoo_and_google', date, ticker, analyst, percent, projected_price
FROM (
  SELECT DISTINCT ON (ticker, date, analyst, projected_price)
         date, ticker, analyst, percent, projected_price
  FROM raw_signals
  WHERE source IN ('yahoo', 'google')
  ORDER BY ticker, date, analyst, projected_price, percent
) s
ON CONFLICT (source, ticker, date, analyst, projected_price)
DO UPDATE SET percent = EXCLUDED.percent, updated_at = now();

-- See the combined-books note above: cross-source duplicates collapse here too.
-- Dedupe key is (source, ticker, date, projected_price), NOT analyst, for a
-- real price. Intentional:
--  * identical prices on the same session count once (incl. Fri/Sat/Sun rows
--    shifted onto Friday), matching the old 1d rule.
--  * an analyst whose price changed between Fri and Sun keeps both rows.
--  * different analysts with the same price collapse to one (first by name).
-- NULL projected_price: the source CSVs do contain empty prices (yahoo 71,
-- google 1125, tipranks 962). DISTINCT ON would treat those NULLs as equal.
-- Checked on the loaded window, including a weekend/holiday shift onto the
-- prior session and the combined books: no (source, ticker, session) has more
-- than one NULL price, so nothing is dropped today. NULL-price rows are still
-- keyed by analyst so two missing prices are not collapsed into one opinion.
-- Not a bug; do not add analyst to the non-NULL key without changing this decision.
CREATE OR REPLACE VIEW signals_dedup AS
SELECT DISTINCT ON (
         source, ticker, date, projected_price,
         CASE WHEN projected_price IS NULL THEN analyst END
       )
       source, ticker, date, analyst, percent, projected_price
FROM raw_signals
WHERE percent IS NOT NULL
ORDER BY source, ticker, date, projected_price,
         CASE WHEN projected_price IS NULL THEN analyst END,
         analyst;

-- 1a. Daily aggregation (MAD around the mean)
CREATE OR REPLACE VIEW raw_signals_per_ticker_and_date AS
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
      source, date, ticker, analyst, percent, projected_price,
      AVG(percent) OVER (PARTITION BY source, date, ticker) AS mean_percent
    FROM signals_dedup
  ) s
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
      FROM signals_dedup r
      JOIN _trading_days t ON t.date = r.date
    ) a
    CROSS JOIN (VALUES (2), (3), (4), (5)) AS w(n)
    JOIN _trading_days tb
      ON tb.day_idx BETWEEN a.day_idx - (w.n - 1) AND a.day_idx
    JOIN signals_dedup b
      ON b.source = a.source
     AND b.ticker = a.ticker
     AND b.date = tb.date
  ) x
GROUP BY source, n, date, ticker;

-- 1d. Recency windows, N = 1..5.
-- A point on the signal session is 1 trading day back and weighs 2.5.
-- The previous session is 2 trading days back and weighs 1.25.
-- Weight is 2.5 / trading_days_back, so an older point counts less.
-- analyst_projections_count is the sum of those weights, not a headcount.
-- average_projected is the weighted mean. On a 1d signal every point is on
-- the signal session, so the count is 2.5 times the unweighted count and
-- the mean matches the daily mean.
CREATE OR REPLACE VIEW raw_signals_per_ticker_and_date_nd_recency AS
SELECT
  source,
  n,
  date,
  ticker,
  SUM(percent * weight) / SUM(weight) AS average_projected,
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
    SUM(p.percent * p.weight) OVER (PARTITION BY p.source, p.n, p.date, p.ticker)
      / SUM(p.weight) OVER (PARTITION BY p.source, p.n, p.date, p.ticker) AS mean_percent
  FROM (
    SELECT
      a.source,
      w.n,
      a.date,
      a.ticker,
      b.analyst,
      b.percent,
      b.date AS point_date,
      (2.5 / (a.day_idx - tb.day_idx + 1))::float8 AS weight
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
  ) p
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

-- 2d. Recency scores. 1d matches the daily score shape. 2d–5d match the window.
CREATE OR REPLACE VIEW signal_score_nd_recency AS
SELECT
  source,
  n,
  date,
  ticker,
  average_projected,
  analyst_projections_count,
  MAD,
  CASE
    WHEN n = 1 THEN average_projected * sqrt(analyst_projections_count)
    ELSE average_projected * sqrt(analyst_projections_count) * (1 - MAD)
  END AS signal_score,
  analyst_percent_list
FROM raw_signals_per_ticker_and_date_nd_recency
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
  SELECT source || '_' || n || 'd_recency' AS signal_name,
         date, ticker, average_projected, analyst_projections_count,
         MAD, signal_score, analyst_percent_list
  FROM signal_score_nd_recency
) u;

-- 1d recency is the daily book with every point weighed 2.5.
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
END $$;

-- \copy reads the rest of the line only, so the export query stays on one line.
\copy (SELECT signal_name, date, ticker, average_projected, analyst_projections_count, mad, analyst_percent_list FROM signals WHERE signal_name ~ '^(yahoo|google|tipranks|yahoo_and_tipranks|yahoo_and_google)(-[1-5]d|_[1-5]d_recency)$' AND analyst_projections_count > 0 AND average_projected > 0 ORDER BY signal_name,date,ticker,average_projected DESC) TO 'data/signals.csv' WITH CSV HEADER
