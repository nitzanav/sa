-- Buy alerts for the calendar date of this run.
-- Qualifiers are yahoo_and_tipranks_1d_recency through 5d_recency with
-- analyst_projections_count > 2 and average_projected > 40.
-- strength is the at lot count: floor(analysts * percent / 10), clamped to 1..16.
-- A repeat of the same alert key is ignored. alerted_at stays on the first insert.
-- Inside this transaction the timestamp function is stable. `make alert:buy`
-- replaces each call with one stamped timestamptz before psql runs.
-- Requires the signals view from etl/etl.sql (`make etl`).

BEGIN;

CREATE TABLE IF NOT EXISTS alerts_raw (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type text NOT NULL,
  alerted_at timestamptz NOT NULL,
  alert_strategy text NOT NULL,
  signal_name text NOT NULL,
  signal_date date NOT NULL,
  symbol text NOT NULL,
  analysts double precision NOT NULL,
  percent double precision NOT NULL,
  strength integer NOT NULL
);

CREATE TABLE IF NOT EXISTS alerts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type text NOT NULL,
  alerted_at timestamptz NOT NULL,
  alert_strategy text NOT NULL,
  signal_name text NOT NULL,
  signal_date date NOT NULL,
  symbol text NOT NULL,
  analysts double precision NOT NULL,
  percent double precision NOT NULL,
  strength integer NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS alerts_raw_dedup
  ON alerts_raw (
    type, alert_strategy, signal_name, signal_date, symbol, analysts, percent, strength
  );

CREATE UNIQUE INDEX IF NOT EXISTS alerts_dedup
  ON alerts (
    type, alert_strategy, signal_name, signal_date, symbol, analysts, percent, strength
  );

-- One row set for both inserts. A psql variable cannot hold these rows.
CREATE TEMP TABLE _buy_alert_candidates ON COMMIT DROP AS
SELECT
  s.signal_name,
  s.date AS signal_date,
  s.ticker AS symbol,
  s.analyst_projections_count AS analysts,
  s.average_projected AS percent,
  LEAST(
    16,
    GREATEST(
      1,
      FLOOR(s.analyst_projections_count * s.average_projected / 10.0)::integer
    )
  ) AS strength,
  s.signal_score
FROM signals s
WHERE s.signal_name IN (
    'yahoo_and_tipranks_1d_recency',
    'yahoo_and_tipranks_2d_recency',
    'yahoo_and_tipranks_3d_recency',
    'yahoo_and_tipranks_4d_recency',
    'yahoo_and_tipranks_5d_recency'
  )
  AND s.analyst_projections_count > 2
  AND s.average_projected > 40
  AND s.date = NOW()::date;

INSERT INTO alerts_raw (
  type, alerted_at, alert_strategy, signal_name, signal_date,
  symbol, analysts, percent, strength
)
SELECT
  'buy',
  NOW(),
  'at >2 >40%',
  c.signal_name,
  c.signal_date,
  c.symbol,
  c.analysts,
  c.percent,
  c.strength
FROM _buy_alert_candidates c
ON CONFLICT (
  type, alert_strategy, signal_name, signal_date, symbol, analysts, percent, strength
) DO NOTHING;

INSERT INTO alerts (
  type, alerted_at, alert_strategy, signal_name, signal_date,
  symbol, analysts, percent, strength
)
SELECT DISTINCT ON (c.symbol)
  'buy',
  NOW(),
  'at >2 >40%',
  'yahoo_and_tipranks_any_recency',
  c.signal_date,
  c.symbol,
  c.analysts,
  c.percent,
  c.strength
FROM _buy_alert_candidates c
ORDER BY c.symbol, c.strength DESC, c.signal_score DESC NULLS LAST, c.signal_name ASC
ON CONFLICT (
  type, alert_strategy, signal_name, signal_date, symbol, analysts, percent, strength
) DO NOTHING;

COMMIT;
