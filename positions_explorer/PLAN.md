# Positions explorer and shared Yahoo quotes: implementation plan

Scope: [/Users/nitzan/.cursor/plans/positions_explorer_quotes_2316f360.plan.md](/Users/nitzan/.cursor/plans/positions_explorer_quotes_2316f360.plan.md). Three steps, one commit each, in order. Do not push.

Rules for every step: DRY, YAGNI, simplify. Reuse `query` from [src/common/db.js](src/common/db.js). Don't add a framework, chart library, or new npm dependency. Keep the Python downloader as is. Commit messages follow the repo style: one plain sentence, for example "Load Yahoo daily bars into yahoo_quotes."

Facts this plan relies on:

- `raw_signals` keys on `ticker`, not `symbol` ([etl/etl.sql](etl/etl.sql), lines 5-14). Its columns are `source, date, ticker, analyst, percent, projected_price`.
- `positions.sell_date` and `positions.sell_price` exist only after [etl/sell_alerts.sql](etl/sell_alerts.sql) has run once (it adds them with `ADD COLUMN IF NOT EXISTS`).
- [src/common/db.js](src/common/db.js) returns `date` values as `YYYY-MM-DD` strings and opens one connection per call.
- No Jest test in the repo mocks a module. Inject `query` instead of mocking it.
- `buy_alerts.sql`, `sell_alerts.sql`, and `assert_session_closed.sql` use only unqualified table names, so `search_path` scopes them.

## Step A: quotes table, Makefile, bars API, close line

| File | Change |
|---|---|
| [etl/load_yahoo_quotes.sql](etl/load_yahoo_quotes.sql) | New. `CREATE TABLE`, `TRUNCATE`, and `\copy` in one transaction |
| [Makefile](Makefile) | `download_yahoo_quotes` adds the `DATABASE_URL` check and the psql load. Add the `positions-explorer` target and its `.PHONY` entry. Update the comment |
| [etl/test/fixtures/yahoo_quotes.csv](etl/test/fixtures/yahoo_quotes.csv) | New. 6 bars (see the Tests section) |
| [etl/test/quotes.sql](etl/test/quotes.sql) | New. Throwaway schema, schema guard, the load, and `DO` asserts |
| [etl/test/run.sh](etl/test/run.sh) | After the existing diff, generate `etl/test/tmp/load_yahoo_quotes.sql` with sed, then run `quotes.sql` |
| [.gitignore](.gitignore) | Add `etl/test/tmp/` |
| [positions_explorer/lib/series.js](positions_explorer/lib/series.js) | New. `buildSeries({ bars })` returns `{ close }` |
| [positions_explorer/server.js](positions_explorer/server.js) | New. `createServer(source)`, `dbSource(query)`, `fixtureSource(fixture)`, and the `/api/chart` route only |
| [positions_explorer/public/index.html](positions_explorer/public/index.html) | New. One `<svg id="chart">` and `<script type="module" src="/chart.js">` |
| [positions_explorer/public/svg.js](positions_explorer/public/svg.js) | New. Pure `renderSvg(series, {width, height})` that returns the SVG markup. Draws a polyline for the closes |
| [positions_explorer/public/chart.js](positions_explorer/public/chart.js) | New. DOM glue: reads `?symbol=`, fetches `/api/chart`, sets `innerHTML` from `renderSvg` |
| [positions_explorer/lib/fixture.json](positions_explorer/lib/fixture.json) | New. Bars for 2 symbols |
| `positions_explorer/**/*.test.js` | New. `lib/series.test.js`, `server.test.js`, `public/svg.test.js` |

`renderSvg` lives in its own file so Jest can import it without a DOM. `chart.js` is the only file that touches `document`.

### DDL and load ([etl/load_yahoo_quotes.sql](etl/load_yahoo_quotes.sql))

```sql
-- Daily Yahoo bars from make download_yahoo_quotes. bar_date is the
-- America/New_York day. Replaced on every load in one transaction, so
-- readers never see it empty, including on the first load.
BEGIN;
CREATE TABLE IF NOT EXISTS yahoo_quotes (
  bar_date date NOT NULL,
  symbol text NOT NULL,
  open double precision,
  high double precision,
  low double precision,
  close double precision NOT NULL,
  PRIMARY KEY (bar_date, symbol)
);
TRUNCATE yahoo_quotes;
\copy yahoo_quotes (bar_date, symbol, open, high, low, close) FROM 'data/yahoo_quotes/all_symbols_per_date_and_symbol.csv' WITH CSV HEADER
COMMIT;
```

A failed first load rolls the table away. A failed later load rolls the `TRUNCATE` back and keeps the previous bars. Don't run this file with `psql -1`: its own `COMMIT` would end that outer transaction early.

`close` can be `NOT NULL` because the downloader skips days with no close. Blank `open`, `high`, and `low` values are unquoted empty fields and load as NULL. The CSV header is `date,...`, and the column list maps it to `bar_date`.

### Makefile edits ([Makefile](Makefile))

```make
# Daily Yahoo chart responses for every symbol in data/fortune_500/symbols.csv.
# Writes data/yahoo_quotes/quotes.csv and all_symbols_per_date_and_symbol.csv,
# then loads the bars into yahoo_quotes. Requires DATABASE_URL.
download_yahoo_quotes: download_fortune_500
	@if [ -z "$$DATABASE_URL" ]; then echo "Error: DATABASE_URL is not set"; exit 1; fi
	@./penv python etl/download_yahoo_quotes.py
	@psql "$$DATABASE_URL" -v ON_ERROR_STOP=1 -f etl/load_yahoo_quotes.sql
```

Check `DATABASE_URL` before the download so the target fails before it downloads about 500 charts. `alert:buy`, `alert:sell`, and `winrate` keep `download_yahoo_quotes` as a prerequisite unchanged. Leave `winrate` alone.

```make
# Chart closes, positions, and analyst targets per symbol. FIXTURE=1 serves
# positions_explorer/lib/fixture.json instead of the database. PORT defaults to 3000.
#   make positions-explorer
#   FIXTURE=1 make positions-explorer
positions-explorer:
	@. "$${NVM_DIR:-$$HOME/.nvm}/nvm.sh" && nvm use >/dev/null && node positions_explorer/server.js
```

Add `positions-explorer` to `.PHONY`. The target needs no `DATABASE_URL` check: fixture mode doesn't use the database, and `query` already throws when the variable is unset.

### Series, sources, server

```js
// lib/series.js (Step A)
export function buildSeries({ bars }) {
  return { close: bars.map((b) => ({ x: b.bar_date, y: b.close })) };
}
```

```js
// server.js (Step A). node:http only.
const BARS_SQL = "SELECT bar_date, close FROM yahoo_quotes WHERE symbol = $1 ORDER BY bar_date";

const FILES = {
  "/": ["public/index.html", "text/html"],
  "/chart.js": ["public/chart.js", "text/javascript"],
  "/svg.js": ["public/svg.js", "text/javascript"],
};

export function dbSource(query) {
  return { rows: async (symbol) => ({ bars: await query(BARS_SQL, [symbol]) }) };
}

export function fixtureSource(fixture) {
  return { rows: async (symbol) => fixture[symbol] ?? { bars: [] } };
}

export function createServer(source) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    try {
      if (url.pathname === "/api/chart") {
        const symbol = url.searchParams.get("symbol");
        if (!symbol) return json(res, 400, { error: "symbol is required" });
        return json(res, 200, buildSeries(await source.rows(symbol)));
      }
      const file = FILES[url.pathname];
      if (!file) return json(res, 404, { error: "not found" });
      res.writeHead(200, { "content-type": file[1] });
      res.end(await readFile(new URL(file[0], import.meta.url)));
    } catch (error) {
      json(res, 500, { error: error.message });
    }
  });
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const source = process.env.FIXTURE === "1"
    ? fixtureSource(JSON.parse(await readFile(new URL("./lib/fixture.json", import.meta.url))))
    : dbSource(query);
  const port = Number(process.env.PORT ?? 3000);
  createServer(source).listen(port, () => console.error(`http://localhost:${port}`));
}
```

`FILES` is a fixed allowlist, so there is no generic static handler and no path traversal. The queries run in sequence, so a request uses one connection at a time. The `argv` guard keeps `import` (and Jest) from listening.

`renderSvg` computes the x domain (ISO dates as epoch ms) and the y domain from the `close` points, with linear scales and a small padding. It draws the closes as one `<polyline class="close">`. When there are no bars it returns an empty-state `<text>`. `chart.js` renders that empty state when `?symbol=` is absent.

## Step B: buy and sell read yahoo_quotes; buy and sell markers

| File | Change |
|---|---|
| [etl/buy_alerts.sql](etl/buy_alerts.sql) | Delete `_yahoo_quotes` and `_yahoo_price` (lines 152-172). Replace the positions insert (lines 174-198): positions take `yahoo_quotes.close` on the run's New York date. Update the header comment (lines 1-15) |
| [etl/assert_session_closed.sql](etl/assert_session_closed.sql) | Fill `_bar` from `yahoo_quotes`. Change "daily file" to `yahoo_quotes` in the header |
| [etl/sell_alerts.sql](etl/sell_alerts.sql) | Comment only (lines 15-16): bars come from `yahoo_quotes`. The SQL is unchanged and still reads `_bar` |
| [Makefile](Makefile) | Comments on `alert:buy` and `alert:sell`: "Refreshes Yahoo quotes" now also covers the table load |
| [etl/test/quotes.sql](etl/test/quotes.sql) | Add the stub `signals`, the buy run, a direct MSFT alert and position, the sell run, and asserts |
| [etl/test/run.sh](etl/test/run.sh) | Also generate `tmp/buy_alerts.sql` and `tmp/sell_alerts.sql` with `NOW()` replaced |
| `server.js`, `lib/series.js`, `public/svg.js`, `lib/fixture.json`, tests | `POSITIONS_SQL`, `buys` and `sells`, circles, fixture positions |

### buy_alerts.sql: the new positions insert

```sql
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
    SELECT 1 FROM positions po WHERE po.symbol = a.symbol AND po.open
  )
ON CONFLICT (symbol) WHERE open DO NOTHING;
```

`p.price IS NOT NULL` goes away because `close` is `NOT NULL`. The inner join skips a symbol with no bar on that date; don't add a fallback price. The header comment changes "the regular-market price at decision time" to "the close of the run's New York date from `yahoo_quotes`", and the comment on lines 12-13 drops the mention of "Yahoo regular-market prices". [etl/download_yahoo_quotes.py](etl/download_yahoo_quotes.py) keeps writing `quotes.csv`, which SQL no longer reads.

### assert_session_closed.sql: filling `_bar`

```sql
DROP TABLE IF EXISTS _bar;
CREATE TEMP TABLE _bar AS
SELECT bar_date, symbol, open, high, low, close FROM yahoo_quotes;
```

The `DO` block is unchanged. `MAX(bar_date)` now means the last bar of the latest load.

### Explorer: positions

```sql
-- POSITIONS_SQL. Markers sit on the New York day so they line up with bar_date.
SELECT (timezone('America/New_York', buy_date))::date AS buy_date,
       price,
       (timezone('America/New_York', sell_date))::date AS sell_date,
       sell_price
FROM positions
WHERE symbol = $1
ORDER BY buy_date
```

```js
// lib/series.js: buildSeries({ bars, positions }) adds
buys: positions.map((p) => ({ x: p.buy_date, y: p.price })),
sells: positions
  .filter((p) => p.sell_date != null)
  .map((p) => ({ x: p.sell_date, y: p.sell_price })),

// server.js: dbSource.rows adds
positions: await query(POSITIONS_SQL, [symbol]),
// and the fixtureSource fallback becomes { bars: [], positions: [] }
```

`renderSvg` extends the domain with `buys` and `sells`, and adds a `<circle class="buy">` for each buy and a `<circle class="sell">` for each sell. Draw every position for the symbol.

## Step C: symbol dropdown and raw_signals triangles

| File | Change |
|---|---|
| `server.js` | `/api/symbols` route, `SYMBOLS_SQL`, `SIGNALS_SQL`, `symbols()` on both sources |
| `lib/series.js` | `targets` |
| `public/index.html`, `public/chart.js` | `<select id="symbol">` filled from `/api/symbols`. The default is `?symbol=` if it's in the list, otherwise the first symbol. On change, fetch and redraw. The URL isn't updated |
| `public/svg.js` | Domain includes `targets`. One `<polygon class="target source-<source>">` triangle per target |
| `lib/fixture.json`, tests | Signals from all 3 sources |

```sql
-- SYMBOLS_SQL
SELECT DISTINCT symbol FROM positions ORDER BY symbol

-- SIGNALS_SQL. Base sources only. Combined books would draw the same target twice.
SELECT date, projected_price, source, analyst
FROM raw_signals
WHERE ticker = $1
  AND source IN ('yahoo', 'google', 'tipranks')
  AND projected_price IS NOT NULL
ORDER BY date, source, analyst
```

```js
// lib/series.js: buildSeries({ bars, positions, signals }) adds
targets: signals.map((s) => ({
  x: s.date, y: s.projected_price, source: s.source, analyst: s.analyst,
})),

// server.js
// dbSource adds   symbols: async () => (await query(SYMBOLS_SQL)).map((r) => r.symbol)
//   and rows adds signals: await query(SIGNALS_SQL, [symbol])
// fixtureSource adds symbols: async () => Object.keys(fixture).sort()
//   and its fallback becomes { bars: [], positions: [], signals: [] }
// createServer adds, before /api/chart:
if (url.pathname === "/api/symbols") return json(res, 200, await source.symbols());
```

## Fixture mode

`FIXTURE=1` swaps `dbSource(query)` for `fixtureSource(fixture.json)`. The routes, `buildSeries`, and the page stay the same, and no database call is made. [positions_explorer/lib/fixture.json](positions_explorer/lib/fixture.json) stores the same row shapes the SQL returns, keyed by symbol. Every entry carries every key the current step reads. After Step C:

```json
{
  "AAPL": {
    "bars": [{ "bar_date": "2026-11-02", "close": 201.5 }],
    "positions": [{ "buy_date": "2026-11-03", "price": 203, "sell_date": "2026-11-10", "sell_price": 197.9 }],
    "signals": [{ "date": "2026-11-04", "projected_price": 240, "source": "tipranks", "analyst": "Jane Doe" }]
  }
}
```

The fixture grows with each step. Step A has bars only. Step B adds positions for AAPL (one closed and one open) and MSFT (one open). Step C adds signals from all 3 sources. Use about 20 bars per symbol so the line is readable in the browser pass.

## Tests

Run JS tests with `npm test`; Jest already picks up `positions_explorer/**/*.test.js`. Run SQL tests with `etl/test/run.sh`, which needs `DATABASE_URL`.

**Server test harness.** Every `server.test.js` case goes through one helper so an open server can't keep `npm test` from exiting:

```js
async function withServer(source, fn) {
  const server = createServer(source);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    return await fn(`http://127.0.0.1:${server.address().port}`);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  }
}
```

**SQL harness.** [etl/test/run.sh](etl/test/run.sh) keeps its `cd` to the repo root and adds the following after its existing diff. It runs only `quotes.sql`; never `psql -f` a generated file by itself, because the load file `TRUNCATE`s `yahoo_quotes` on the default search path.

```bash
mkdir -p etl/test/tmp
alert_at="2026-11-06 22:00:00+0000"   # Friday, 17:00 America/New_York
sed "s|data/yahoo_quotes/all_symbols_per_date_and_symbol.csv|etl/test/fixtures/yahoo_quotes.csv|" \
  etl/load_yahoo_quotes.sql > etl/test/tmp/load_yahoo_quotes.sql
sed "s/NOW()/TIMESTAMPTZ '$alert_at'/g" etl/buy_alerts.sql > etl/test/tmp/buy_alerts.sql    # Step B
sed "s/NOW()/TIMESTAMPTZ '$alert_at'/g" etl/sell_alerts.sql > etl/test/tmp/sell_alerts.sql  # Step B
if grep -nE 'public\.|search_path' etl/test/tmp/*.sql etl/assert_session_closed.sql; then
  echo "Error: SQL under test must not name a schema" >&2; exit 1
fi
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f etl/test/quotes.sql
```

[etl/test/quotes.sql](etl/test/quotes.sql) starts like this, before any `\i`:

```sql
DROP SCHEMA IF EXISTS etl_test_quotes CASCADE;
CREATE SCHEMA etl_test_quotes;
SET search_path TO etl_test_quotes;
DO $$ BEGIN
  IF current_schema() IS DISTINCT FROM 'etl_test_quotes' THEN
    RAISE EXCEPTION 'search_path is %, expected etl_test_quotes', current_schema();
  END IF;
END $$;
```

Keep `public` off the path, so a table missing from the test schema fails instead of resolving to production. Don't wrap any `\i` in `BEGIN`: the load file's own `COMMIT` would end it. `\i` paths are relative to the repo root. Results are checked in `DO $$ ... RAISE EXCEPTION ... $$` blocks.

The fixture CSV, exactly (MSFT's 2026-11-05 `open` is an unquoted empty field):

```csv
date,symbol,open,high,low,close
2026-11-04,AAPL,199,201,198,200
2026-11-04,MSFT,101,102,99,100
2026-11-05,AAPL,201,206,200,205
2026-11-05,MSFT,,100,98,99
2026-11-06,AAPL,206,211,205,210
2026-11-06,MSFT,98,99,94,95
```

**Step A**

- SQL: `\i etl/test/tmp/load_yahoo_quotes.sql` twice, then assert there are 6 rows (`TRUNCATE` makes the load idempotent) and MSFT's 2026-11-05 `open IS NULL`. This is the only file Step A loads against the fixture.
- `lib/series.test.js`: bars map to `close` points in order. Empty bars give an empty `close`.
- `server.test.js`, through `withServer` and global `fetch`:
  - `/api/chart?symbol=AAPL` with `fixtureSource` returns the closes.
  - A missing `symbol` returns 400. An unknown path returns 404. `/api/symbols` returns 404. A `source.rows` that throws gives a 500.
  - `dbSource` with a stubbed `query` passes `[symbol]` and maps the rows it gets back.
  - `/` serves the HTML.
- `public/svg.test.js`: the polyline has one point per bar, and no bars gives the empty-state text.

**Step B**

- SQL, after the Step A asserts, against the sed'd copies (scoped by the guard and `search_path` above):
  - `CREATE TABLE signals (signal_name text, date date, ticker text, analyst_projections_count double precision, average_projected double precision)` with one row: `('yahoo_and_tipranks_1d_recency', '2026-11-06', 'AAPL', 3, 50)`. The real `signals` is a view in `public`; the test schema needs this table.
  - `\i etl/test/tmp/buy_alerts.sql`, then assert the AAPL position has `price = 210`.
  - Insert an MSFT `alerts` row directly (every `NOT NULL` column: `type 'buy'`, `alerted_at`, `alert_strategy 'at >2 >40%'`, `signal_name`, `signal_date`, `symbol 'MSFT'`, `analysts`, `percent`, `strength`), then an MSFT `positions` row with that `alert_id`, `signal_date`, `open true`, `lots 1`, `buy_date timestamptz '2026-11-04 22:00+00'`, `price 100`.
  - `\i etl/test/tmp/sell_alerts.sql`, then assert MSFT is closed with `sell_reason = 'dd'` and `sell_price = 95`, and AAPL is still open. Only bars from `yahoo_quotes` give that result.
- `series.test.js`: several positions give several buys. An open position gives a buy and no sell.
- `server.test.js`: `dbSource` passes the symbol to `POSITIONS_SQL`, and `/api/chart` returns `buys` and `sells`.
- `svg.test.js`: the counts and classes of the buy and sell circles are correct.

**Step C**

- `series.test.js`: `targets` keeps `source` and `analyst`.
- `server.test.js`:
  - `/api/symbols` returns the sorted fixture keys.
  - `dbSource.symbols` maps `symbol`.
  - The stubbed `query` records each SQL string. The signals call receives `[symbol]`, and its SQL includes `source IN ('yahoo', 'google', 'tipranks')` and `ticker = $1` and does not include `yahoo_and_tipranks` or `yahoo_and_google`.
- `svg.test.js`: one `polygon.source-<source>` per target, and a target above every close still lands inside the plot.
- No SQL test for Step C, because it only reads data.

**Browser pass (last):** run `FIXTURE=1 make positions-explorer`, pick each symbol, and confirm the line, the buy and sell markers, and the triangles.

## Out of scope

- `etl/winrate.sql` and `etl/sell_alerts.sh` are referenced from the [Makefile](Makefile) but missing from the repo. Leave both alone.
- Don't add: a refresh button, zoom, a date range, URL updates on symbol change, hover tooltips, or a test for the Python downloader.
