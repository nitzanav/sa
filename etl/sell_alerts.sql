-- Sell alerts for open positions. Book sell is 2.5dd 15pp (ls is manual).
-- etl/assert_session_closed.sql requires a weekday at or after 16:00
-- America/New_York and that date's close in the daily file. The order
-- placed from this run is the next session's open.
-- The decision price is the latest close on or before that New York date,
-- and on or after the buy.
-- The peak is the max of the entry and those closes. A new high close
-- does not sell. pp sells when peak > entry and
-- current <= peak - 0.15 * (peak - entry): a giveback of at least 15%
-- of the peak gain. pp is preferred when both rules match.
-- dd sells while current < entry and current <= entry * 0.975
-- (a loss of at least 2.5% from the entry).
-- A repeat of the same alert key is ignored. Closing is idempotent via open.
-- _run freezes one timestamp. `make alert:sell` replaces NOW().
-- Bars come from data/yahoo_quotes/all_symbols_per_date_and_symbol.csv
-- (make download_yahoo_quotes).
-- alerts and positions come from etl/buy_alerts.sql. A sell writes alerts only.

ALTER TABLE positions ADD COLUMN IF NOT EXISTS sell_date timestamptz;
ALTER TABLE positions ADD COLUMN IF NOT EXISTS sell_price double precision;
ALTER TABLE positions ADD COLUMN IF NOT EXISTS sell_reason text;
ALTER TABLE positions ADD COLUMN IF NOT EXISTS peak_price double precision;

-- Freeze the timestamp once. Each statement is its own transaction under psql -f,
-- so a later timestamp call would differ. ON COMMIT DROP would remove _run
-- before the next statement.
DROP TABLE IF EXISTS _run;
CREATE TEMP TABLE _run AS SELECT NOW() AS alerted_at;

\i etl/assert_session_closed.sql

DROP TABLE IF EXISTS _open_positions;
CREATE TEMP TABLE _open_positions AS
SELECT
  po.id AS position_id,
  po.symbol,
  po.lots,
  po.price AS entry_price,
  po.buy_date,
  po.alert_id,
  a.analysts,
  a.percent,
  a.strength
FROM positions po
JOIN alerts a ON a.id = po.alert_id
WHERE po.open;

-- _bar is loaded by etl/assert_session_closed.sql. This date's close is
-- included: the assert has required that the session is over.
DROP TABLE IF EXISTS _closed;
CREATE TEMP TABLE _closed AS
SELECT
  b.symbol,
  b.bar_date,
  b.close
FROM _bar b
CROSS JOIN _run r
WHERE b.close > 0
  AND b.bar_date <= (timezone('America/New_York', r.alerted_at))::date;

DROP TABLE IF EXISTS _last_close;
CREATE TEMP TABLE _last_close AS
SELECT DISTINCT ON (o.position_id)
  o.position_id,
  c.close AS current_price
FROM _open_positions o
JOIN _closed c
  ON c.symbol = o.symbol
 AND c.bar_date >= (timezone('America/New_York', o.buy_date))::date
ORDER BY o.position_id, c.bar_date DESC;

DROP TABLE IF EXISTS _peak;
CREATE TEMP TABLE _peak AS
SELECT
  o.position_id,
  GREATEST(o.entry_price, MAX(c.close)) AS peak_price
FROM _open_positions o
JOIN _closed c
  ON c.symbol = o.symbol
 AND c.bar_date >= (timezone('America/New_York', o.buy_date))::date
GROUP BY o.position_id, o.entry_price;

DROP TABLE IF EXISTS _sell_eval;
CREATE TEMP TABLE _sell_eval AS
SELECT
  priced.position_id,
  priced.symbol,
  priced.lots,
  priced.entry_price,
  priced.buy_date,
  priced.alert_id,
  priced.analysts,
  priced.percent,
  priced.strength,
  priced.current_price,
  priced.peak_price,
  CASE

    -- No sell. current_price is null when this symbol has no daily close on
    -- or after the buy. A close of 0 or less does not reach this point:
    -- _closed keeps close > 0. entry_price <= 0 only if positions.price was
    -- stored that way.
    WHEN priced.current_price IS NULL
      OR priced.current_price <= 0
      OR priced.entry_price <= 0
      THEN NULL

    -- pp. The best close since the buy is above the entry, and the latest
    -- close has given back at least 15% of that gain.
    WHEN priced.peak_price > priced.entry_price
     AND priced.current_price <= priced.peak_price
        - 0.15 * (priced.peak_price - priced.entry_price)
      THEN 'pp'

    -- dd. The latest close is under the entry by at least 2.5%.
    WHEN priced.current_price < priced.entry_price
     AND priced.current_price <= priced.entry_price * (1.0 - 0.025)
      THEN 'dd'

  END AS sell_reason
FROM (
  SELECT
    o.position_id,
    o.symbol,
    o.lots,
    o.entry_price,
    o.buy_date,
    o.alert_id,
    o.analysts,
    o.percent,
    o.strength,
    lc.current_price,
    pk.peak_price
  FROM _open_positions o
  LEFT JOIN _last_close lc ON lc.position_id = o.position_id
  LEFT JOIN _peak pk ON pk.position_id = o.position_id
) priced;

\echo '--- open positions (pp >= 15% of peak gain, dd >= 2.5% loss) ---'
SELECT
  symbol,
  lots,
  entry_price AS entry,
  current_price AS current,
  peak_price AS peak,
  CASE
    WHEN peak_price > entry_price
      THEN (peak_price - current_price) / (peak_price - entry_price)
  END AS giveback,
  CASE
    WHEN current_price < entry_price
      THEN (entry_price - current_price) / entry_price
  END AS loss_dd,
  sell_reason
FROM _sell_eval
ORDER BY sell_reason NULLS LAST, symbol;

INSERT INTO alerts (
  type, alerted_at, alert_strategy, signal_name, signal_date,
  symbol, analysts, percent, strength
)
SELECT
  'sell',
  r.alerted_at,
  '2.5dd 15pp',
  e.sell_reason,
  (timezone('America/New_York', r.alerted_at))::date,
  e.symbol,
  e.analysts,
  e.percent,
  e.strength
FROM _sell_eval e
CROSS JOIN _run r
WHERE e.sell_reason IS NOT NULL
ON CONFLICT (
  type, alert_strategy, signal_name, signal_date, symbol, analysts, percent, strength
) DO NOTHING;

UPDATE positions po
SET
  open = false,
  sell_date = r.alerted_at,
  sell_price = e.current_price,
  sell_reason = e.sell_reason,
  peak_price = e.peak_price
FROM _sell_eval e
CROSS JOIN _run r
WHERE po.id = e.position_id
  AND po.open
  AND e.sell_reason IS NOT NULL
  AND e.current_price IS NOT NULL;
