-- Buy alerts for the New York trade date of this run.
-- etl/assert_session_closed.sql requires a weekday at or after 16:00
-- America/New_York and that date's close in yahoo_quotes. The order
-- placed from this run is the next session's open. The stored price is
-- the close of the run's New York date from yahoo_quotes. A symbol with
-- no bar on that date is skipped.
-- Qualifiers are yahoo_and_tipranks_1d_recency through 5d_recency with
-- analyst_projections_count > 2 and average_projected > 40.
-- strength is the at lot count: floor(analysts * percent / 10), clamped to 1..16.
-- A repeat of the same alert key is ignored. alerted_at stays on the first insert.
-- _run freezes one timestamp. Each psql statement is its own transaction, so a
-- later timestamp call would differ. alerts ranks the raw rows from that run.
-- `make alert:buy` replaces the timestamp call, then opens positions from
-- today's alerts at that close (make download_yahoo_quotes loads yahoo_quotes).
-- Requires the signals view from etl/etl.sql (`make etl`).
-- Book: recency union · at >2 >40% · 12 slots · lots = min(at strength, 12).

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

CREATE INDEX IF NOT EXISTS alerts_raw_alerted_at_idx ON alerts_raw (alerted_at);

CREATE TABLE IF NOT EXISTS positions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  alert_id bigint NOT NULL REFERENCES alerts (id),
  signal_date date NOT NULL,
  symbol text NOT NULL,
  open boolean NOT NULL DEFAULT true,
  lots integer NOT NULL,
  buy_date timestamptz NOT NULL,
  price double precision NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS positions_open_symbol_uniq
  ON positions (symbol)
  WHERE open;

CREATE INDEX IF NOT EXISTS positions_buy_date_idx ON positions (buy_date);

-- Freeze the timestamp once. Each statement is its own transaction under psql -f,
-- so a later timestamp call would differ. ON COMMIT DROP would remove _run
-- before the next statement.
DROP TABLE IF EXISTS _run;
CREATE TEMP TABLE _run AS SELECT NOW() AS alerted_at;

\i etl/assert_session_closed.sql

INSERT INTO alerts_raw (
  type, alerted_at, alert_strategy, signal_name, signal_date,
  symbol, analysts, percent, strength
)
SELECT
  'buy',
  r.alerted_at,
  'at >2 >40%',
  s.signal_name,
  s.date,
  s.ticker,
  s.analyst_projections_count,
  s.average_projected,
  LEAST(
    16,
    GREATEST(
      1,
      FLOOR(s.analyst_projections_count * s.average_projected / 10.0)::integer
    )
  )
FROM signals s
CROSS JOIN _run r
WHERE s.signal_name IN (
    'yahoo_and_tipranks_1d_recency',
    'yahoo_and_tipranks_2d_recency',
    'yahoo_and_tipranks_3d_recency',
    'yahoo_and_tipranks_4d_recency',
    'yahoo_and_tipranks_5d_recency'
  )
  AND s.analyst_projections_count > 2
  AND s.average_projected > 40
  AND s.date = (timezone('America/New_York', r.alerted_at))::date
ON CONFLICT (
  type, alert_strategy, signal_name, signal_date, symbol, analysts, percent, strength
) DO NOTHING;

INSERT INTO alerts (
  type, alerted_at, alert_strategy, signal_name, signal_date,
  symbol, analysts, percent, strength
)
SELECT
  'buy',
  ranked.alerted_at,
  'at >2 >40%',
  'yahoo_and_tipranks_any_recency',
  ranked.signal_date,
  ranked.symbol,
  ranked.analysts,
  ranked.percent,
  ranked.strength
FROM (
  SELECT
    a.alerted_at,
    a.signal_date,
    a.symbol,
    a.analysts,
    a.percent,
    a.strength,
    ROW_NUMBER() OVER (
      PARTITION BY a.symbol
      ORDER BY a.strength DESC, a.signal_name ASC
    ) AS rn
  FROM alerts_raw a
  WHERE a.alerted_at = (SELECT alerted_at FROM _run)
    AND a.type = 'buy'
    AND a.alert_strategy = 'at >2 >40%'
) ranked
WHERE ranked.rn = 1
ON CONFLICT (
  type, alert_strategy, signal_name, signal_date, symbol, analysts, percent, strength
) DO NOTHING;

INSERT INTO positions (
  alert_id, signal_date, symbol, open, lots, buy_date, price
)
SELECT
  a.id,
  a.signal_date,
  a.symbol,
  true,
  LEAST(a.strength, 12),
  r.alerted_at,
  q.close
FROM alerts a
CROSS JOIN _run r
JOIN yahoo_quotes q
  ON q.symbol = a.symbol
 AND q.bar_date = (timezone('America/New_York', r.alerted_at))::date
WHERE a.alerted_at = r.alerted_at
  AND a.type = 'buy'
  AND a.alert_strategy = 'at >2 >40%'
  AND NOT EXISTS (
    SELECT 1
    FROM positions po
    WHERE po.symbol = a.symbol
      AND po.open
  )
ON CONFLICT (symbol) WHERE open DO NOTHING;
