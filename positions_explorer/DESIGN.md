# Positions explorer and shared Yahoo quotes: detailed design

Inputs: [PLAN.md](PLAN.md) (after review), [PLAN_REVIEW.md](PLAN_REVIEW.md), and the scope file `/Users/nitzan/.cursor/plans/positions_explorer_quotes_2316f360.plan.md`. Three sub-steps, one commit each, in order: A, B, C. Do not push.

Every code block below was run in a scratch copy of the repo before it was written here. The new `positions_explorer` suites passed 12, 15, and 20 tests after A, B, and C. `npm test` also runs the repo's existing suites. `etl/test/quotes.sql` passed against a throwaway Postgres 17 cluster after A and B. The real `POSITIONS_SQL` and `SIGNALS_SQL` were run through `src/common/db.js`, and `FIXTURE=1 make positions-explorer` served the fixture.

Rules for every step: DRY, YAGNI, simplify. Reuse `query` from `src/common/db.js`. `node:http` only. No new npm dependency, framework, or chart library. No module mocking: tests pass `query` or a source object in. No `history.replaceState`. No SVG `<title>` tooltips.

## Changes from PLAN.md

These came up while running the code. Each one is small, and each sub-step below already includes it.

1. **The Makefile's `FIXTURE` variable clobbers `FIXTURE=1`.** The Makefile defines `FIXTURE := docs/tasks/analyst-recommendation/expected.json` and then runs `export`. A Makefile assignment beats the environment, so `FIXTURE=1 make positions-explorer` reaches node as `FIXTURE=docs/tasks/...` and silently runs in database mode. Verified with a two-line Makefile. Step A renames the Makefile variable to `EXPECTED_JSON`. That variable is used in 4 places, all in the Makefile.
2. **The main-module guard crashes when `process.argv[1]` is undefined.** This happens with `node -e "import('./positions_explorer/server.js')"`, where `pathToFileURL(undefined)` throws. The guard becomes `process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href`.
3. **Comments.** Line 3 of `buy_alerts.sql` and line 3 of `sell_alerts.sql` also say "the daily file". Step B changes both to `yahoo_quotes`. These are comment-only edits.
4. **The `/api/symbols` 404 assert stays while that route does not exist (Steps A and B).** In Step C the route exists, so that test checks a path-traversal URL (`/../server.js`) for the 404 instead.
5. **`positions-explorer` goes through `./nvm-run`.** Every other Node recipe does. Sourcing `nvm.sh` in the recipe fails where nvm is not installed. The alert-bot image has this Node on `PATH` and does not install nvm.

## Shared shapes

Every step uses the same contracts:

```js
// A source: the server's only dependency.
source.rows(symbol)  // A: { bars }   B: { bars, positions }   C: { bars, positions, signals }
source.symbols()     // C only: ["AAPL", "MSFT"]

// Row shapes, exactly what src/common/db.js returns. date columns are YYYY-MM-DD strings.
bars:      { bar_date, close }
positions: { buy_date, price, sell_date, sell_price }   // dates are New York dates
signals:   { date, projected_price, source, analyst }

// buildSeries output, which is also the /api/chart response. x is YYYY-MM-DD.
{ close: [{x, y}], buys: [{x, y}], sells: [{x, y}], targets: [{x, y, source, analyst}] }
```

`renderSvg(series, { width, height })` returns the inner markup for `<svg viewBox="0 0 width height">`. `chart.js` reads `width` and `height` from the `viewBox` in `index.html`, so the size is defined in one place. When `close` is empty, `renderSvg` returns the empty state before it reads any other key, so `chart.js` can always pass `{ close: [] }` when there is no symbol.

---

## Step A: quotes table, Makefile load, bars API, close line

**Goal:** `make download_yahoo_quotes` loads `yahoo_quotes`, and `make positions-explorer` charts one symbol's closes from it.

### Backend

#### `etl/load_yahoo_quotes.sql` (new)

```sql
-- Daily Yahoo bars from make download_yahoo_quotes. bar_date is the
-- America/New_York day. Replaced on every load in one transaction, so
-- readers never see it empty, including on the first load.
-- Do not run with psql -1: the COMMIT below would end that outer transaction.
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

#### `Makefile` (diff)

```diff
@@ -11,8 +11,9 @@ export
 #   make analyst-recommendation-py URL='https://...'
 URL ?= https://www.google.com/finance/beta/quote/NVDA:NASDAQ?window=YTD&tab=analysis
 
-# Reference output that every implementation must reproduce.
-FIXTURE := docs/tasks/analyst-recommendation/expected.json
+# Reference output that every implementation must reproduce. Not named FIXTURE:
+# export would overwrite FIXTURE=1 for make positions-explorer.
+EXPECTED_JSON := docs/tasks/analyst-recommendation/expected.json
 
 # $(call diff-against-fixture,<stdout capture file>)
 # Compares parsed JSON: json.tool normalizes whitespace and sorts keys.
@@ -20,8 +21,8 @@ FIXTURE := docs/tasks/analyst-recommendation/expected.json
 # implementations are validated the same way.
 define diff-against-fixture
 @diff <(./penv python -m json.tool --sort-keys $(1)) \
-      <(./penv python -m json.tool --sort-keys $(FIXTURE)) \
-  && echo 'PASS: $(1) matches $(FIXTURE)'
+      <(./penv python -m json.tool --sort-keys $(EXPECTED_JSON)) \
+  && echo 'PASS: $(1) matches $(EXPECTED_JSON)'
 endef
 
 # ---------------------------------------------------------------------------
@@ -29,7 +30,7 @@ endef
 # ---------------------------------------------------------------------------
 # Naming convention: <task>-<tech> for the runner, <task>-<tech>-test for the
 # test. The runner MUST print pure JSON to stdout (no logs), so the test can
-# capture stdout to a file and diff it against $(FIXTURE).
+# capture stdout to a file and diff it against $(EXPECTED_JSON).
 #
 # Steps to add a new tech `<tech>` for task `analyst-recommendation`:
 #   1. Put the script under `src/analyst-recommendation/dyi_<tech>/`.
@@ -51,7 +52,7 @@ endef
         scrape_analyst_recommendations scrape_analyst_recommendations-test symbols_exchange \
         download_fortune_500 download_yahoo_quotes write_joint_analyst_recommendations etl winrate backtest \
         alert\:buy alert\:buy-truncate alert_bot notify_alerts \
-        alert\:sell sell_alerts
+        alert\:sell sell_alerts positions-explorer
 
 analyst-recommendation-py:
 	@./penv python src/analyst-recommendation/dyi_python/scrape_analyst_recommendation.py '$(URL)'
@@ -105,9 +106,12 @@ download_fortune_500:
 # Daily Yahoo chart responses for every symbol in data/fortune_500/symbols.csv.
 # Writes data/yahoo_quotes/quotes.csv (ticker, raw JSON response) and
 # data/yahoo_quotes/all_symbols_per_date_and_symbol.csv
-# (date, symbol, open, high, low, close; date is America/New_York).
+# (date, symbol, open, high, low, close; date is America/New_York), then
+# replaces the yahoo_quotes table with those bars. Requires DATABASE_URL.
 download_yahoo_quotes: download_fortune_500
+	@if [ -z "$$DATABASE_URL" ]; then echo "Error: DATABASE_URL is not set"; exit 1; fi
 	@./penv python etl/download_yahoo_quotes.py
+	@psql "$$DATABASE_URL" -v ON_ERROR_STOP=1 -f etl/load_yahoo_quotes.sql
 
 # ---------------------------------------------------------------------------
 # Database operations
@@ -207,3 +211,14 @@ sell_alerts:
 
 backtest:
 	@./penv python VectorBT/backtest.py
+
+# ---------------------------------------------------------------------------
+# Positions explorer
+# ---------------------------------------------------------------------------
+
+# Chart closes, positions, and analyst targets per symbol. FIXTURE=1 serves
+# positions_explorer/lib/fixture.json instead of the database. PORT defaults to 3000.
+#   make positions-explorer
+#   FIXTURE=1 make positions-explorer
+positions-explorer:
+	@./nvm-run node positions_explorer/server.js
```

`alert:buy`, `alert:sell`, and `winrate` already depend on `download_yahoo_quotes`. Leave their recipes alone. The `DATABASE_URL` check runs before the download, so the target fails before it fetches about 500 charts.

#### `.gitignore` (diff)

```diff
 etl/test/etl_test.sql
 etl/test/signals.csv
+etl/test/tmp/
```

#### `positions_explorer/lib/series.js` (new)

```js
// Chart points from the rows a source returns. x is a YYYY-MM-DD string.
export function buildSeries({ bars }) {
  return { close: bars.map((b) => ({ x: b.bar_date, y: b.close })) };
}
```

#### `positions_explorer/server.js` (new)

```js
import http from "node:http";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { query } from "../src/common/db.js";
import { buildSeries } from "./lib/series.js";

const BARS_SQL = "SELECT bar_date, close FROM yahoo_quotes WHERE symbol = $1 ORDER BY bar_date";

const FILES = {
  "/": ["public/index.html", "text/html; charset=utf-8"],
  "/chart.js": ["public/chart.js", "text/javascript"],
  "/svg.js": ["public/svg.js", "text/javascript"],
};

export function dbSource(query) {
  return { rows: async (symbol) => ({ bars: await query(BARS_SQL, [symbol]) }) };
}

export function fixtureSource(fixture) {
  return { rows: async (symbol) => fixture[symbol] ?? { bars: [] } };
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const source = process.env.FIXTURE === "1"
    ? fixtureSource(JSON.parse(await readFile(new URL("./lib/fixture.json", import.meta.url))))
    : dbSource(query);
  const port = Number(process.env.PORT ?? 3000);
  createServer(source).listen(port, () => console.error(`http://localhost:${port}`));
}
```

`FILES` is a fixed allowlist, so the server has no generic static handler and no path traversal. Under Jest, `argv[1]` is the Jest runner, so importing the module never calls `listen`. The `dbSource` queries run one after another, so a request uses one connection at a time.

#### `positions_explorer/lib/fixture.json` (new, Step A version: bars only)

```json
{
  "AAPL": {
    "bars": [
      { "bar_date": "2026-10-12", "close": 227.4 },
      { "bar_date": "2026-10-13", "close": 229.1 },
      { "bar_date": "2026-10-14", "close": 231.0 },
      { "bar_date": "2026-10-15", "close": 230.2 },
      { "bar_date": "2026-10-16", "close": 233.5 },
      { "bar_date": "2026-10-19", "close": 232.8 },
      { "bar_date": "2026-10-20", "close": 228.9 },
      { "bar_date": "2026-10-21", "close": 225.1 },
      { "bar_date": "2026-10-22", "close": 224.3 },
      { "bar_date": "2026-10-23", "close": 226.7 },
      { "bar_date": "2026-10-26", "close": 229.8 },
      { "bar_date": "2026-10-27", "close": 231.4 },
      { "bar_date": "2026-10-28", "close": 234.2 },
      { "bar_date": "2026-10-29", "close": 236.0 },
      { "bar_date": "2026-10-30", "close": 235.1 },
      { "bar_date": "2026-11-02", "close": 237.9 },
      { "bar_date": "2026-11-03", "close": 239.4 },
      { "bar_date": "2026-11-04", "close": 238.2 },
      { "bar_date": "2026-11-05", "close": 240.6 },
      { "bar_date": "2026-11-06", "close": 242.3 }
    ]
  },
  "MSFT": {
    "bars": [
      { "bar_date": "2026-10-12", "close": 512.3 },
      { "bar_date": "2026-10-13", "close": 515.0 },
      { "bar_date": "2026-10-14", "close": 518.8 },
      { "bar_date": "2026-10-15", "close": 516.4 },
      { "bar_date": "2026-10-16", "close": 520.1 },
      { "bar_date": "2026-10-19", "close": 523.7 },
      { "bar_date": "2026-10-20", "close": 521.2 },
      { "bar_date": "2026-10-21", "close": 525.9 },
      { "bar_date": "2026-10-22", "close": 528.4 },
      { "bar_date": "2026-10-23", "close": 526.0 },
      { "bar_date": "2026-10-26", "close": 530.5 },
      { "bar_date": "2026-10-27", "close": 533.2 },
      { "bar_date": "2026-10-28", "close": 531.0 },
      { "bar_date": "2026-10-29", "close": 527.6 },
      { "bar_date": "2026-10-30", "close": 524.9 },
      { "bar_date": "2026-11-02", "close": 529.3 },
      { "bar_date": "2026-11-03", "close": 532.8 },
      { "bar_date": "2026-11-04", "close": 536.1 },
      { "bar_date": "2026-11-05", "close": 534.7 },
      { "bar_date": "2026-11-06", "close": 538.2 }
    ]
  }
}
```

### Frontend

#### `positions_explorer/public/index.html` (new)

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Positions explorer</title>
  <style>
    body { font: 14px system-ui, sans-serif; margin: 16px; }
    #chart { display: block; width: 100%; max-width: 960px; border: 1px solid #ddd; }
    .close { fill: none; stroke: steelblue; stroke-width: 1.5; }
    .empty { fill: #888; }
  </style>
</head>
<body>
  <svg id="chart" viewBox="0 0 960 480"></svg>
  <script type="module" src="/chart.js"></script>
</body>
</html>
```

#### `positions_explorer/public/svg.js` (new, pure, no DOM)

```js
const PAD = 24;

const fmt = (n) => n.toFixed(1);

function linear(lo, hi, from, to) {
  return (v) => (hi === lo ? (from + to) / 2 : from + ((v - lo) / (hi - lo)) * (to - from));
}

// Returns p => [px, py] that fits every point inside the padded plot.
function scale(points, width, height) {
  const xs = points.map((p) => Date.parse(p.x));
  const ys = points.map((p) => p.y);
  const sx = linear(Math.min(...xs), Math.max(...xs), PAD, width - PAD);
  const sy = linear(Math.min(...ys), Math.max(...ys), height - PAD, PAD);
  return (p) => [sx(Date.parse(p.x)), sy(p.y)];
}

// Inner markup for <svg viewBox="0 0 width height">.
export function renderSvg({ close }, { width, height }) {
  if (close.length === 0) {
    return `<text class="empty" x="${width / 2}" y="${height / 2}" text-anchor="middle">No bars</text>`;
  }
  const at = scale(close, width, height);
  const line = close.map((p) => at(p).map(fmt).join(",")).join(" ");
  return `<polyline class="close" points="${line}"/>`;
}
```

The `hi === lo` branch keeps a single bar, or a flat line, from dividing by zero and producing `NaN`.

#### `positions_explorer/public/chart.js` (new, the only DOM file)

```js
import { renderSvg } from "./svg.js";

const svg = document.getElementById("chart");
const { width, height } = svg.viewBox.baseVal;

async function getJson(url) {
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error);
  return body;
}

async function draw(symbol) {
  const series = symbol
    ? await getJson(`/api/chart?symbol=${encodeURIComponent(symbol)}`)
    : { close: [] };
  svg.innerHTML = renderSvg(series, { width, height });
}

draw(new URLSearchParams(location.search).get("symbol"));
```

### Backend tests

#### `etl/test/fixtures/yahoo_quotes.csv` (new, exactly)

MSFT's 2026-11-05 `open` is an unquoted empty field.

```csv
date,symbol,open,high,low,close
2026-11-04,AAPL,199,201,198,200
2026-11-04,MSFT,101,102,99,100
2026-11-05,AAPL,201,206,200,205
2026-11-05,MSFT,,100,98,99
2026-11-06,AAPL,206,211,205,210
2026-11-06,MSFT,98,99,94,95
```

#### `etl/test/quotes.sql` (new, Step A version)

```sql
-- Runs the real SQL against etl/test/fixtures/yahoo_quotes.csv in a throwaway
-- schema. etl/test/run.sh generates etl/test/tmp/ and runs this file from the
-- repo root. public stays off search_path, so a table missing here fails
-- instead of resolving to production. Never wrap an \i in BEGIN: the load
-- file's own COMMIT would end it.
DROP SCHEMA IF EXISTS etl_test_quotes CASCADE;
CREATE SCHEMA etl_test_quotes;
SET search_path TO etl_test_quotes;
DO $$ BEGIN
  IF current_schema() IS DISTINCT FROM 'etl_test_quotes' THEN
    RAISE EXCEPTION 'search_path is %, expected etl_test_quotes', current_schema();
  END IF;
END $$;

-- Twice: TRUNCATE makes the load idempotent.
\i etl/test/tmp/load_yahoo_quotes.sql
\i etl/test/tmp/load_yahoo_quotes.sql

DO $$
DECLARE
  n bigint;
BEGIN
  SELECT count(*) INTO n FROM yahoo_quotes;
  IF n <> 6 THEN
    RAISE EXCEPTION 'yahoo_quotes has % rows, expected 6', n;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM yahoo_quotes
    WHERE symbol = 'MSFT' AND bar_date = '2026-11-05' AND open IS NULL
  ) THEN
    RAISE EXCEPTION 'MSFT 2026-11-05 open should load as NULL';
  END IF;
END $$;

\echo 'PASS: etl/test/quotes.sql'
```

#### `etl/test/run.sh` (append after the existing `diff -u ...` line)

```bash

mkdir -p etl/test/tmp
sed "s|data/yahoo_quotes/all_symbols_per_date_and_symbol.csv|etl/test/fixtures/yahoo_quotes.csv|" \
  etl/load_yahoo_quotes.sql > etl/test/tmp/load_yahoo_quotes.sql
if grep -nE 'public\.|search_path' etl/test/tmp/*.sql etl/assert_session_closed.sql; then
  echo "Error: SQL under test must not name a schema" >&2
  exit 1
fi
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f etl/test/quotes.sql
```

The added `psql` runs `quotes.sql` after the existing etl diff. Never `psql -f` a generated file by itself: the load file `TRUNCATE`s `yahoo_quotes` on the default search path.

#### `positions_explorer/server.test.js` (new, Step A version)

```js
import { createServer, dbSource, fixtureSource } from "./server.js";

const fixture = {
  AAPL: {
    bars: [
      { bar_date: "2026-11-04", close: 200 },
      { bar_date: "2026-11-05", close: 205 },
    ],
  },
};

// Listens on a free port and always closes, so npm test can exit.
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

function get(source, path) {
  return withServer(source, async (base) => {
    const res = await fetch(base + path);
    return { status: res.status, type: res.headers.get("content-type"), body: await res.text() };
  });
}

// A query stub that records each call and answers from rowsFor(sql).
function stubQuery(rowsFor) {
  const calls = [];
  const query = async (sql, params = []) => {
    calls.push({ sql, params });
    return rowsFor(sql);
  };
  return { query, calls };
}

test("/api/chart returns the closes for a symbol", async () => {
  const res = await get(fixtureSource(fixture), "/api/chart?symbol=AAPL");
  expect(res.status).toBe(200);
  expect(JSON.parse(res.body)).toEqual({
    close: [
      { x: "2026-11-04", y: 200 },
      { x: "2026-11-05", y: 205 },
    ],
  });
});

test("/api/chart for a symbol missing from the fixture returns an empty line", async () => {
  const res = await get(fixtureSource(fixture), "/api/chart?symbol=ZZZZ");
  expect(JSON.parse(res.body)).toEqual({ close: [] });
});

test("/api/chart without a symbol is a 400", async () => {
  const res = await get(fixtureSource(fixture), "/api/chart");
  expect(res.status).toBe(400);
  expect(JSON.parse(res.body)).toEqual({ error: "symbol is required" });
});

test("unknown paths are a 404", async () => {
  expect((await get(fixtureSource(fixture), "/nope")).status).toBe(404);
  expect((await get(fixtureSource(fixture), "/api/symbols")).status).toBe(404);
});

test("a failing source is a 500 with its message", async () => {
  const broken = { rows: async () => { throw new Error("db down"); } };
  const res = await get(broken, "/api/chart?symbol=AAPL");
  expect(res.status).toBe(500);
  expect(JSON.parse(res.body)).toEqual({ error: "db down" });
});

test("/ serves the page", async () => {
  const res = await get(fixtureSource(fixture), "/");
  expect(res.status).toBe(200);
  expect(res.type).toMatch(/^text\/html/);
  expect(res.body).toContain('<svg id="chart"');
});

test("dbSource reads yahoo_quotes for the symbol", async () => {
  const { query, calls } = stubQuery(() => fixture.AAPL.bars);
  expect(await dbSource(query).rows("AAPL")).toEqual({ bars: fixture.AAPL.bars });
  expect(calls).toEqual([
    { sql: expect.stringContaining("FROM yahoo_quotes WHERE symbol = $1"), params: ["AAPL"] },
  ]);
});
```

### Frontend tests

#### `positions_explorer/lib/series.test.js` (new, Step A version)

```js
import { buildSeries } from "./series.js";

test("bars map to close points in order", () => {
  const bars = [
    { bar_date: "2026-11-04", close: 200 },
    { bar_date: "2026-11-05", close: 205 },
  ];
  expect(buildSeries({ bars })).toEqual({
    close: [
      { x: "2026-11-04", y: 200 },
      { x: "2026-11-05", y: 205 },
    ],
  });
});

test("no bars give an empty close line", () => {
  expect(buildSeries({ bars: [] })).toEqual({ close: [] });
});
```

#### `positions_explorer/public/svg.test.js` (new, Step A version)

```js
import { renderSvg } from "./svg.js";

const SIZE = { width: 400, height: 200 };
const close = [
  { x: "2026-11-04", y: 200 },
  { x: "2026-11-05", y: 205 },
  { x: "2026-11-06", y: 210 },
];

// [[x, y], ...] from every points="..." attribute on elements of this tag.
function pointsOf(svg, tag) {
  return [...svg.matchAll(new RegExp(`<${tag} [^>]*points="([^"]+)"`, "g"))]
    .flatMap((m) => m[1].split(" ").map((p) => p.split(",").map(Number)));
}

function expectInside([x, y]) {
  expect(x).toBeGreaterThanOrEqual(0);
  expect(x).toBeLessThanOrEqual(SIZE.width);
  expect(y).toBeGreaterThanOrEqual(0);
  expect(y).toBeLessThanOrEqual(SIZE.height);
}

test("the close polyline has one point per bar, inside the plot", () => {
  const xy = pointsOf(renderSvg({ close }, SIZE), "polyline");
  expect(xy).toHaveLength(3);
  xy.forEach(expectInside);
  expect(xy[0][0]).toBeLessThan(xy[2][0]);
  expect(xy[0][1]).toBeGreaterThan(xy[2][1]);
});

test("a single bar does not produce NaN", () => {
  const xy = pointsOf(renderSvg({ close: [close[0]] }, SIZE), "polyline");
  expect(xy).toEqual([[200, 100]]);
});

test("no bars give the empty-state text", () => {
  expect(renderSvg({ close: [] }, SIZE)).toBe(
    '<text class="empty" x="200" y="100" text-anchor="middle">No bars</text>',
  );
});
```

### Commands

```bash
nvm use && npm test            # positions_explorer: 3 suites, 12 tests; also runs existing suites
./etl/test/run.sh              # needs DATABASE_URL; existing etl test, then quotes.sql
FIXTURE=1 make positions-explorer   # manual: open http://localhost:3000/?symbol=AAPL
```

Commit: "Load Yahoo daily bars into yahoo_quotes and chart closes in the positions explorer."

---

## Step B: buy and sell read yahoo_quotes; buy and sell markers

**Goal:** Buy prices come from `yahoo_quotes.close` on the run's New York date, sell bars come from `yahoo_quotes`, and the chart draws a circle for every buy and sell.

### Backend

#### `etl/buy_alerts.sql` (diff)

```diff
@@ -1,8 +1,9 @@
 -- Buy alerts for the New York trade date of this run.
 -- etl/assert_session_closed.sql requires a weekday at or after 16:00
--- America/New_York and that date's close in the daily file. The order
+-- America/New_York and that date's close in yahoo_quotes. The order
 -- placed from this run is the next session's open. The stored price is
--- the regular-market price at decision time.
+-- the close of the run's New York date from yahoo_quotes. A symbol with
+-- no bar on that date is skipped.
 -- Qualifiers are yahoo_and_tipranks_1d_recency through 5d_recency with
 -- analyst_projections_count > 2 and average_projected > 40.
 -- strength is the at lot count: floor(analysts * percent / 10), clamped to 1..16.
@@ -10,7 +11,7 @@
 -- _run freezes one timestamp. Each psql statement is its own transaction, so a
 -- later timestamp call would differ. alerts ranks the raw rows from that run.
 -- `make alert:buy` replaces the timestamp call, then opens positions from
--- today's alerts using Yahoo regular-market prices (make download_yahoo_quotes).
+-- today's alerts at that close (make download_yahoo_quotes loads yahoo_quotes).
 -- Requires the signals view from etl/etl.sql (`make etl`).
 -- Book: recency union · at >2 >40% · 12 slots · lots = min(at strength, 12).
 
@@ -149,28 +150,6 @@ ON CONFLICT (
   type, alert_strategy, signal_name, signal_date, symbol, analysts, percent, strength
 ) DO NOTHING;
 
-DROP TABLE IF EXISTS _yahoo_quotes;
-CREATE TEMP TABLE _yahoo_quotes (ticker text, response text);
-\copy _yahoo_quotes FROM 'data/yahoo_quotes/quotes.csv' WITH CSV HEADER
-
-DROP TABLE IF EXISTS _yahoo_price;
-CREATE TEMP TABLE _yahoo_price AS
-SELECT
-  ticker AS symbol,
-  COALESCE(
-    NULLIF(response::jsonb #>> '{chart,result,0,meta,regularMarketPrice}', '')::double precision,
-    (
-      SELECT (elem #>> '{}')::double precision
-      FROM jsonb_array_elements(
-             COALESCE(response::jsonb #> '{chart,result,0,indicators,quote,0,close}', '[]'::jsonb)
-           ) WITH ORDINALITY AS t(elem, ord)
-      WHERE elem IS NOT NULL AND elem::text <> 'null'
-      ORDER BY ord DESC
-      LIMIT 1
-    )
-  ) AS price
-FROM _yahoo_quotes;
-
 INSERT INTO positions (
   alert_id, signal_date, symbol, open, lots, buy_date, price
 )
@@ -181,14 +160,15 @@ SELECT
   true,
   LEAST(a.strength, 12),
   r.alerted_at,
-  p.price
+  q.close
 FROM alerts a
 CROSS JOIN _run r
-JOIN _yahoo_price p ON p.symbol = a.symbol
+JOIN yahoo_quotes q
+  ON q.symbol = a.symbol
+ AND q.bar_date = (timezone('America/New_York', r.alerted_at))::date
 WHERE a.alerted_at = r.alerted_at
   AND a.type = 'buy'
   AND a.alert_strategy = 'at >2 >40%'
-  AND p.price IS NOT NULL
   AND NOT EXISTS (
     SELECT 1
     FROM positions po
     WHERE po.symbol = a.symbol
       AND po.open
   )
 ON CONFLICT (symbol) WHERE open DO NOTHING;
```

`buy_date` stays `r.alerted_at`, `lots` stays `LEAST(a.strength, 12)`, and the partial unique index stays. Keep the inner join: a symbol with no bar that day gets no position. Don't add a fallback price.

#### `etl/assert_session_closed.sql` (diff; the `_session` select and the `DO` block below are unchanged byte for byte)

```diff
@@ -1,18 +1,11 @@
 -- Requires _run(alerted_at). Stops the script unless this run is a finished
--- New York session: a weekday at or after 16:00 America/New_York, and the
--- daily file contains that date. Loads _bar for the caller.
+-- New York session: a weekday at or after 16:00 America/New_York, and
+-- yahoo_quotes contains that date. Loads _bar for the caller.
 -- The order placed from this run is the next session's open.
 
 DROP TABLE IF EXISTS _bar;
-CREATE TEMP TABLE _bar (
-  bar_date date,
-  symbol text,
-  open double precision,
-  high double precision,
-  low double precision,
-  close double precision
-);
-\copy _bar (bar_date, symbol, open, high, low, close) FROM 'data/yahoo_quotes/all_symbols_per_date_and_symbol.csv' WITH CSV HEADER
+CREATE TEMP TABLE _bar AS
+SELECT bar_date, symbol, open, high, low, close FROM yahoo_quotes;
 
 DROP TABLE IF EXISTS _session;
 CREATE TEMP TABLE _session AS
```

#### `etl/sell_alerts.sql` (comments only; the SQL still reads `_bar`)

```diff
@@ -1,6 +1,6 @@
 -- Sell alerts for open positions. Book sell is 2.5dd 15pp (ls is manual).
 -- etl/assert_session_closed.sql requires a weekday at or after 16:00
--- America/New_York and that date's close in the daily file. The order
+-- America/New_York and that date's close in yahoo_quotes. The order
 -- placed from this run is the next session's open.
 -- The decision price is the latest close on or before that New York date,
 -- and on or after the buy.
@@ -12,8 +12,8 @@
 -- (a loss of at least 2.5% from the entry).
 -- A repeat of the same alert key is ignored. Closing is idempotent via open.
 -- _run freezes one timestamp. `make alert:sell` replaces NOW().
--- Bars come from data/yahoo_quotes/all_symbols_per_date_and_symbol.csv
--- (make download_yahoo_quotes).
+-- Bars come from yahoo_quotes through _bar (make download_yahoo_quotes
+-- loads the table).
 -- alerts and positions come from etl/buy_alerts.sql. A sell writes alerts only.
```

#### `Makefile` (comments only)

```diff
 # Today's buy alerts from the signals view. Run after `make etl`, on a weekday
 # at or after 16:00 America/New_York, once the daily bars include that date.
-# The order is the next session's open. Refreshes Yahoo quotes, then replaces
-# NOW() with ALERT_AT (default: now, UTC). alert_bot exports one value so
-# sell, buy, and notify share it.
+# The order is the next session's open. Refreshes Yahoo quotes and the
+# yahoo_quotes table, then replaces NOW() with ALERT_AT (default: now, UTC).
+# alert_bot exports one value so sell, buy, and notify share it.
@@
 # a weekday at or after 16:00 America/New_York with that date in the daily
-# bars. The order is the next session's open. ls is manual. Refreshes Yahoo
-# quotes, then replaces NOW() with ALERT_AT.
+# bars. The order is the next session's open. ls is manual. Refreshes Yahoo
+# quotes and the yahoo_quotes table, then replaces NOW() with ALERT_AT.
```

#### `positions_explorer/lib/series.js` (full, Step B)

```js
// Chart points from the rows a source returns. x is a YYYY-MM-DD string.
export function buildSeries({ bars, positions }) {
  return {
    close: bars.map((b) => ({ x: b.bar_date, y: b.close })),
    buys: positions.map((p) => ({ x: p.buy_date, y: p.price })),
    sells: positions
      .filter((p) => p.sell_date != null)
      .map((p) => ({ x: p.sell_date, y: p.sell_price })),
  };
}
```

#### `positions_explorer/server.js` (diff from Step A)

```diff
@@ -6,6 +6,16 @@ import { buildSeries } from "./lib/series.js";
 
 const BARS_SQL = "SELECT bar_date, close FROM yahoo_quotes WHERE symbol = $1 ORDER BY bar_date";
 
+// New York dates, so markers line up with bar_date.
+const POSITIONS_SQL = `
+  SELECT (timezone('America/New_York', buy_date))::date AS buy_date,
+         price,
+         (timezone('America/New_York', sell_date))::date AS sell_date,
+         sell_price
+  FROM positions
+  WHERE symbol = $1
+  ORDER BY buy_date`;
+
 const FILES = {
   "/": ["public/index.html", "text/html; charset=utf-8"],
   "/chart.js": ["public/chart.js", "text/javascript"],
@@ -13,11 +23,16 @@ const FILES = {
 };
 
 export function dbSource(query) {
-  return { rows: async (symbol) => ({ bars: await query(BARS_SQL, [symbol]) }) };
+  return {
+    rows: async (symbol) => ({
+      bars: await query(BARS_SQL, [symbol]),
+      positions: await query(POSITIONS_SQL, [symbol]),
+    }),
+  };
 }
 
 export function fixtureSource(fixture) {
-  return { rows: async (symbol) => fixture[symbol] ?? { bars: [] } };
+  return { rows: async (symbol) => fixture[symbol] ?? { bars: [], positions: [] } };
 }
```

Keep the New York `::date` casts. `buy_date::date` would be the UTC date, which lands one day late for a run on a New York evening after 19:00 EST. `sell_date` and `sell_price` exist once `etl/sell_alerts.sql` has run; production has run it.

#### `positions_explorer/lib/fixture.json` (diff: add a `positions` key to each symbol)

```diff
   "AAPL": {
     "bars": [ ...unchanged... ],
+    "positions": [
+      { "buy_date": "2026-10-16", "price": 233.5, "sell_date": "2026-10-22", "sell_price": 224.3 },
+      { "buy_date": "2026-10-28", "price": 234.2, "sell_date": null, "sell_price": null }
+    ]
   },
   "MSFT": {
     "bars": [ ...unchanged... ],
+    "positions": [
+      { "buy_date": "2026-10-20", "price": 521.2, "sell_date": null, "sell_price": null }
+    ]
   }
```

Each price equals that day's fixture close. The closed AAPL trade is a `dd` under `sell_alerts.sql`: buy 2026-10-16 at 233.5, sell 2026-10-22 at 224.3. No close in that window is above the entry, so `pp` does not fire, and 224.3 <= 233.5 × 0.975.

### Frontend

#### `positions_explorer/public/index.html` (diff: marker colors)

```diff
     .empty { fill: #888; }
+    .buy { fill: seagreen; }
+    .sell { fill: crimson; }
```

#### `positions_explorer/public/svg.js` (full, Step B)

```js
const PAD = 24;
const R = 5;

const fmt = (n) => n.toFixed(1);

function linear(lo, hi, from, to) {
  return (v) => (hi === lo ? (from + to) / 2 : from + ((v - lo) / (hi - lo)) * (to - from));
}

// Returns p => [px, py] that fits every point inside the padded plot.
function scale(points, width, height) {
  const xs = points.map((p) => Date.parse(p.x));
  const ys = points.map((p) => p.y);
  const sx = linear(Math.min(...xs), Math.max(...xs), PAD, width - PAD);
  const sy = linear(Math.min(...ys), Math.max(...ys), height - PAD, PAD);
  return (p) => [sx(Date.parse(p.x)), sy(p.y)];
}

// Inner markup for <svg viewBox="0 0 width height">.
export function renderSvg({ close, buys, sells }, { width, height }) {
  if (close.length === 0) {
    return `<text class="empty" x="${width / 2}" y="${height / 2}" text-anchor="middle">No bars</text>`;
  }
  const at = scale([...close, ...buys, ...sells], width, height);
  const line = close.map((p) => at(p).map(fmt).join(",")).join(" ");
  const circles = (cls, points) =>
    points
      .map((p) => {
        const [cx, cy] = at(p).map(fmt);
        return `<circle class="${cls}" cx="${cx}" cy="${cy}" r="${R}"/>`;
      })
      .join("");
  return `<polyline class="close" points="${line}"/>${circles("buy", buys)}${circles("sell", sells)}`;
}
```

`chart.js` is unchanged. Its `{ close: [] }` still works because `renderSvg` returns before it reads `buys` or `sells`.

### Backend tests

#### `etl/test/quotes.sql` (append before the final `\echo`)

```sql
-- Buy and sell read yahoo_quotes. The run is Friday 2026-11-06 17:00
-- America/New_York (run.sh replaces NOW()). The real signals is a view in
-- public; this stub has the columns buy_alerts.sql reads.
CREATE TABLE signals (
  signal_name text,
  date date,
  ticker text,
  analyst_projections_count double precision,
  average_projected double precision
);
INSERT INTO signals VALUES ('yahoo_and_tipranks_1d_recency', '2026-11-06', 'AAPL', 3, 50);

\i etl/test/tmp/buy_alerts.sql

DO $$
DECLARE
  p double precision;
BEGIN
  SELECT price INTO p FROM positions WHERE symbol = 'AAPL' AND open;
  IF p IS DISTINCT FROM 210 THEN
    RAISE EXCEPTION 'AAPL buy price is %, expected the 2026-11-06 close 210', p;
  END IF;
END $$;

-- MSFT bought at 100 on 2026-11-04 sees closes 100, 99, 95: dd at 95.
WITH a AS (
  INSERT INTO alerts (
    type, alerted_at, alert_strategy, signal_name, signal_date,
    symbol, analysts, percent, strength
  )
  VALUES (
    'buy', '2026-11-04 22:00+00', 'at >2 >40%', 'yahoo_and_tipranks_any_recency',
    '2026-11-04', 'MSFT', 3, 50, 15
  )
  RETURNING id, signal_date
)
INSERT INTO positions (alert_id, signal_date, symbol, open, lots, buy_date, price)
SELECT id, signal_date, 'MSFT', true, 1, timestamptz '2026-11-04 22:00+00', 100 FROM a;

\i etl/test/tmp/sell_alerts.sql

DO $$
DECLARE
  r record;
BEGIN
  SELECT open, sell_reason, sell_price INTO r FROM positions WHERE symbol = 'MSFT';
  IF r.open OR r.sell_reason IS DISTINCT FROM 'dd' OR r.sell_price IS DISTINCT FROM 95 THEN
    RAISE EXCEPTION 'MSFT is open=% reason=% price=%, expected closed dd at 95',
      r.open, r.sell_reason, r.sell_price;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM positions WHERE symbol = 'AAPL' AND open) THEN
    RAISE EXCEPTION 'AAPL should still be open';
  END IF;
END $$;
```

`buy_alerts.sql` still runs `\i etl/assert_session_closed.sql`, the real file, which now reads `yahoo_quotes` through the test `search_path`. The sell assert holds only when `_bar` came from this fixture. The real CSV's last date isn't 2026-11-06, so a leftover `\copy` would fail the session check.

#### `etl/test/run.sh` (the Step A block becomes)

```bash

mkdir -p etl/test/tmp
alert_at="2026-11-06 22:00:00+0000"  # Friday, 17:00 America/New_York
sed "s|data/yahoo_quotes/all_symbols_per_date_and_symbol.csv|etl/test/fixtures/yahoo_quotes.csv|" \
  etl/load_yahoo_quotes.sql > etl/test/tmp/load_yahoo_quotes.sql
sed "s/NOW()/TIMESTAMPTZ '$alert_at'/g" etl/buy_alerts.sql > etl/test/tmp/buy_alerts.sql
sed "s/NOW()/TIMESTAMPTZ '$alert_at'/g" etl/sell_alerts.sql > etl/test/tmp/sell_alerts.sql
if grep -nE 'public\.|search_path' etl/test/tmp/*.sql etl/assert_session_closed.sql; then
  echo "Error: SQL under test must not name a schema" >&2
  exit 1
fi
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f etl/test/quotes.sql
```

#### `positions_explorer/server.test.js` (full, Step B)

```js
import { createServer, dbSource, fixtureSource } from "./server.js";

const fixture = {
  AAPL: {
    bars: [
      { bar_date: "2026-11-04", close: 200 },
      { bar_date: "2026-11-05", close: 205 },
    ],
    positions: [
      { buy_date: "2026-11-04", price: 200, sell_date: "2026-11-05", sell_price: 205 },
      { buy_date: "2026-11-05", price: 205, sell_date: null, sell_price: null },
    ],
  },
};

// Listens on a free port and always closes, so npm test can exit.
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

function get(source, path) {
  return withServer(source, async (base) => {
    const res = await fetch(base + path);
    return { status: res.status, type: res.headers.get("content-type"), body: await res.text() };
  });
}

// A query stub that records each call and answers from rowsFor(sql).
function stubQuery(rowsFor) {
  const calls = [];
  const query = async (sql, params = []) => {
    calls.push({ sql, params });
    return rowsFor(sql);
  };
  return { query, calls };
}

test("/api/chart returns the closes, buys, and sells for a symbol", async () => {
  const res = await get(fixtureSource(fixture), "/api/chart?symbol=AAPL");
  expect(res.status).toBe(200);
  expect(JSON.parse(res.body)).toEqual({
    close: [
      { x: "2026-11-04", y: 200 },
      { x: "2026-11-05", y: 205 },
    ],
    buys: [
      { x: "2026-11-04", y: 200 },
      { x: "2026-11-05", y: 205 },
    ],
    sells: [{ x: "2026-11-05", y: 205 }],
  });
});

test("/api/chart for a symbol missing from the fixture returns an empty line", async () => {
  const res = await get(fixtureSource(fixture), "/api/chart?symbol=ZZZZ");
  expect(JSON.parse(res.body)).toEqual({ close: [], buys: [], sells: [] });
});

test("/api/chart without a symbol is a 400", async () => {
  const res = await get(fixtureSource(fixture), "/api/chart");
  expect(res.status).toBe(400);
  expect(JSON.parse(res.body)).toEqual({ error: "symbol is required" });
});

test("unknown paths are a 404", async () => {
  expect((await get(fixtureSource(fixture), "/nope")).status).toBe(404);
  expect((await get(fixtureSource(fixture), "/api/symbols")).status).toBe(404);
});

test("a failing source is a 500 with its message", async () => {
  const broken = { rows: async () => { throw new Error("db down"); } };
  const res = await get(broken, "/api/chart?symbol=AAPL");
  expect(res.status).toBe(500);
  expect(JSON.parse(res.body)).toEqual({ error: "db down" });
});

test("/ serves the page", async () => {
  const res = await get(fixtureSource(fixture), "/");
  expect(res.status).toBe(200);
  expect(res.type).toMatch(/^text\/html/);
  expect(res.body).toContain('<svg id="chart"');
});

test("dbSource reads yahoo_quotes and positions for the symbol", async () => {
  const { query, calls } = stubQuery((sql) =>
    sql.includes("FROM positions") ? fixture.AAPL.positions : fixture.AAPL.bars);
  expect(await dbSource(query).rows("AAPL")).toEqual(fixture.AAPL);
  expect(calls).toEqual([
    { sql: expect.stringContaining("FROM yahoo_quotes WHERE symbol = $1"), params: ["AAPL"] },
    { sql: expect.stringContaining("FROM positions"), params: ["AAPL"] },
  ]);
  expect(calls[1].sql).toContain("(timezone('America/New_York', buy_date))::date");
  expect(calls[1].sql).toContain("(timezone('America/New_York', sell_date))::date");
});
```

### Frontend tests

#### `positions_explorer/lib/series.test.js` (full, Step B)

```js
import { buildSeries } from "./series.js";

const bars = [
  { bar_date: "2026-11-04", close: 200 },
  { bar_date: "2026-11-05", close: 205 },
];

test("bars map to close points in order", () => {
  expect(buildSeries({ bars, positions: [] }).close).toEqual([
    { x: "2026-11-04", y: 200 },
    { x: "2026-11-05", y: 205 },
  ]);
});

test("no rows give empty series", () => {
  expect(buildSeries({ bars: [], positions: [] })).toEqual({ close: [], buys: [], sells: [] });
});

test("every position is a buy; only closed positions are sells", () => {
  const positions = [
    { buy_date: "2026-11-02", price: 190, sell_date: "2026-11-04", sell_price: 185 },
    { buy_date: "2026-11-05", price: 205, sell_date: null, sell_price: null },
  ];
  const { buys, sells } = buildSeries({ bars, positions });
  expect(buys).toEqual([
    { x: "2026-11-02", y: 190 },
    { x: "2026-11-05", y: 205 },
  ]);
  expect(sells).toEqual([{ x: "2026-11-04", y: 185 }]);
});
```

#### `positions_explorer/public/svg.test.js` (full, Step B)

```js
import { renderSvg } from "./svg.js";

const SIZE = { width: 400, height: 200 };
const close = [
  { x: "2026-11-04", y: 200 },
  { x: "2026-11-05", y: 205 },
  { x: "2026-11-06", y: 210 },
];
const none = { buys: [], sells: [] };

// [[x, y], ...] from every points="..." attribute on elements of this tag.
function pointsOf(svg, tag) {
  return [...svg.matchAll(new RegExp(`<${tag} [^>]*points="([^"]+)"`, "g"))]
    .flatMap((m) => m[1].split(" ").map((p) => p.split(",").map(Number)));
}

// [[cx, cy], ...] for every circle of this class.
function circlesOf(svg, cls) {
  return [...svg.matchAll(new RegExp(`<circle class="${cls}" cx="([^"]+)" cy="([^"]+)"`, "g"))]
    .map((m) => [Number(m[1]), Number(m[2])]);
}

function expectInside([x, y]) {
  expect(x).toBeGreaterThanOrEqual(0);
  expect(x).toBeLessThanOrEqual(SIZE.width);
  expect(y).toBeGreaterThanOrEqual(0);
  expect(y).toBeLessThanOrEqual(SIZE.height);
}

test("the close polyline has one point per bar, inside the plot", () => {
  const xy = pointsOf(renderSvg({ ...none, close }, SIZE), "polyline");
  expect(xy).toHaveLength(3);
  xy.forEach(expectInside);
  expect(xy[0][0]).toBeLessThan(xy[2][0]);
  expect(xy[0][1]).toBeGreaterThan(xy[2][1]);
});

test("a single bar does not produce NaN", () => {
  const xy = pointsOf(renderSvg({ ...none, close: [close[0]] }, SIZE), "polyline");
  expect(xy).toEqual([[200, 100]]);
});

test("no bars give the empty-state text", () => {
  expect(renderSvg({ ...none, close: [] }, SIZE)).toBe(
    '<text class="empty" x="200" y="100" text-anchor="middle">No bars</text>',
  );
});

test("one circle per buy and per sell, inside the plot", () => {
  const svg = renderSvg({
    close,
    buys: [{ x: "2026-11-04", y: 200 }, { x: "2026-11-06", y: 210 }],
    sells: [{ x: "2026-11-07", y: 190 }],
  }, SIZE);
  const buys = circlesOf(svg, "buy");
  const sells = circlesOf(svg, "sell");
  expect(buys).toHaveLength(2);
  expect(sells).toHaveLength(1);
  [...buys, ...sells, ...pointsOf(svg, "polyline")].forEach(expectInside);
});

test("markers are ignored when there are no bars", () => {
  const svg = renderSvg({ close: [], buys: [{ x: "2026-11-04", y: 200 }], sells: [] }, SIZE);
  expect(svg).not.toContain("<circle");
});
```

The sell at 2026-11-07, 190, is outside the closes in both x and y. It proves the domain includes markers.

### Commands

```bash
nvm use && npm test            # positions_explorer: 3 suites, 15 tests; also runs existing suites
./etl/test/run.sh              # needs DATABASE_URL; load, buy at 210, MSFT dd at 95
FIXTURE=1 make positions-explorer   # manual: /?symbol=AAPL shows 2 buys and 1 sell
```

Commit: "Price buys and sells from yahoo_quotes and mark positions on the explorer chart."

---

## Step C: symbol dropdown and raw_signals triangles

**Goal:** A dropdown of position symbols drives the chart, and analyst targets from the base sources are drawn as triangles colored by source.

### Backend

#### `positions_explorer/server.js` (full, final)

```js
import http from "node:http";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { query } from "../src/common/db.js";
import { buildSeries } from "./lib/series.js";

const BARS_SQL = "SELECT bar_date, close FROM yahoo_quotes WHERE symbol = $1 ORDER BY bar_date";

// New York dates, so markers line up with bar_date.
const POSITIONS_SQL = `
  SELECT (timezone('America/New_York', buy_date))::date AS buy_date,
         price,
         (timezone('America/New_York', sell_date))::date AS sell_date,
         sell_price
  FROM positions
  WHERE symbol = $1
  ORDER BY buy_date`;

const SYMBOLS_SQL = "SELECT DISTINCT symbol FROM positions ORDER BY symbol";

// Base sources only. The combined books (yahoo_and_tipranks, yahoo_and_google)
// repeat these rows and would draw the same target twice.
const SIGNALS_SQL = `
  SELECT date, projected_price, source, analyst
  FROM raw_signals
  WHERE ticker = $1
    AND source IN ('yahoo', 'google', 'tipranks')
    AND projected_price IS NOT NULL
  ORDER BY date, source, analyst`;

const FILES = {
  "/": ["public/index.html", "text/html; charset=utf-8"],
  "/chart.js": ["public/chart.js", "text/javascript"],
  "/svg.js": ["public/svg.js", "text/javascript"],
};

export function dbSource(query) {
  return {
    symbols: async () => (await query(SYMBOLS_SQL)).map((r) => r.symbol),
    rows: async (symbol) => ({
      bars: await query(BARS_SQL, [symbol]),
      positions: await query(POSITIONS_SQL, [symbol]),
      signals: await query(SIGNALS_SQL, [symbol]),
    }),
  };
}

export function fixtureSource(fixture) {
  return {
    symbols: async () => Object.keys(fixture).sort(),
    rows: async (symbol) => fixture[symbol] ?? { bars: [], positions: [], signals: [] },
  };
}

function json(res, status, body) {
  res.writeHead(status, { "content-type": "application/json" });
  res.end(JSON.stringify(body));
}

export function createServer(source) {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");
    try {
      if (url.pathname === "/api/symbols") return json(res, 200, await source.symbols());
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const source = process.env.FIXTURE === "1"
    ? fixtureSource(JSON.parse(await readFile(new URL("./lib/fixture.json", import.meta.url))))
    : dbSource(query);
  const port = Number(process.env.PORT ?? 3000);
  createServer(source).listen(port, () => console.error(`http://localhost:${port}`));
}
```

Read `raw_signals`, not `signals_dedup`, which collapses different analysts who share a price. `raw_signals.projected_price` is `real`, so `pg` returns a number. `positions.symbol` passes as `ticker` unchanged: both keep the constituents spelling (`BRK.B`). This was run against Postgres with a `yahoo_and_tipranks` row and a null-price row in `raw_signals`; both were dropped.

#### `positions_explorer/lib/series.js` (full, final)

```js
// Chart points from the rows a source returns. x is a YYYY-MM-DD string.
export function buildSeries({ bars, positions, signals }) {
  return {
    close: bars.map((b) => ({ x: b.bar_date, y: b.close })),
    buys: positions.map((p) => ({ x: p.buy_date, y: p.price })),
    sells: positions
      .filter((p) => p.sell_date != null)
      .map((p) => ({ x: p.sell_date, y: p.sell_price })),
    targets: signals.map((s) => ({
      x: s.date, y: s.projected_price, source: s.source, analyst: s.analyst,
    })),
  };
}
```

#### `positions_explorer/lib/fixture.json` (diff: add a `signals` key to each symbol, all 3 sources)

```diff
   "AAPL": {
     "bars": [ ...unchanged... ],
     "positions": [ ...unchanged... ],
+    "signals": [
+      { "date": "2026-10-13", "projected_price": 260, "source": "yahoo", "analyst": "Jane Doe" },
+      { "date": "2026-10-27", "projected_price": 255, "source": "google", "analyst": "John Roe" },
+      { "date": "2026-11-03", "projected_price": 270, "source": "tipranks", "analyst": "Ann Lee" }
+    ]
   },
   "MSFT": {
     "bars": [ ...unchanged... ],
     "positions": [ ...unchanged... ],
+    "signals": [
+      { "date": "2026-10-16", "projected_price": 600, "source": "tipranks", "analyst": "Sam Park" },
+      { "date": "2026-10-30", "projected_price": 580, "source": "yahoo", "analyst": "Jane Doe" },
+      { "date": "2026-11-04", "projected_price": 590, "source": "google", "analyst": "Ravi Shah" }
+    ]
   }
```

Every target is above every close, so the browser pass shows whether the y domain includes targets.

### Frontend

#### `positions_explorer/public/index.html` (full, final)

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Positions explorer</title>
  <style>
    body { font: 14px system-ui, sans-serif; margin: 16px; }
    #chart { display: block; width: 100%; max-width: 960px; margin-top: 8px; border: 1px solid #ddd; }
    .close { fill: none; stroke: steelblue; stroke-width: 1.5; }
    .empty { fill: #888; }
    .buy { fill: seagreen; }
    .sell { fill: crimson; }
    .target { fill-opacity: 0.7; }
    .source-yahoo { fill: rebeccapurple; }
    .source-google { fill: darkorange; }
    .source-tipranks { fill: teal; }
  </style>
</head>
<body>
  <label>Symbol <select id="symbol"></select></label>
  <svg id="chart" viewBox="0 0 960 480"></svg>
  <script type="module" src="/chart.js"></script>
</body>
</html>
```

#### `positions_explorer/public/svg.js` (full, final)

```js
const PAD = 24;
const R = 5;

const fmt = (n) => n.toFixed(1);

function linear(lo, hi, from, to) {
  return (v) => (hi === lo ? (from + to) / 2 : from + ((v - lo) / (hi - lo)) * (to - from));
}

// Returns p => [px, py] that fits every point inside the padded plot.
function scale(points, width, height) {
  const xs = points.map((p) => Date.parse(p.x));
  const ys = points.map((p) => p.y);
  const sx = linear(Math.min(...xs), Math.max(...xs), PAD, width - PAD);
  const sy = linear(Math.min(...ys), Math.max(...ys), height - PAD, PAD);
  return (p) => [sx(Date.parse(p.x)), sy(p.y)];
}

// Inner markup for <svg viewBox="0 0 width height">.
export function renderSvg({ close, buys, sells, targets }, { width, height }) {
  if (close.length === 0) {
    return `<text class="empty" x="${width / 2}" y="${height / 2}" text-anchor="middle">No bars</text>`;
  }
  const at = scale([...close, ...buys, ...sells, ...targets], width, height);
  const line = close.map((p) => at(p).map(fmt).join(",")).join(" ");
  const circles = (cls, points) =>
    points
      .map((p) => {
        const [cx, cy] = at(p).map(fmt);
        return `<circle class="${cls}" cx="${cx}" cy="${cy}" r="${R}"/>`;
      })
      .join("");
  const triangles = targets
    .map((t) => {
      const [x, y] = at(t);
      const points = [[x, y - R], [x - R, y + R], [x + R, y + R]];
      return `<polygon class="target source-${t.source}" points="${points.map((p) => p.map(fmt).join(",")).join(" ")}"/>`;
    })
    .join("");
  return `${triangles}<polyline class="close" points="${line}"/>${circles("buy", buys)}${circles("sell", sells)}`;
}
```

Triangles are drawn first so the line and the position markers sit on top. `R` is smaller than `PAD`, so a triangle at the top edge stays inside the plot. `analyst` stays in the JSON and isn't rendered, because the page has no tooltips. `source` goes into a class name unescaped because `SIGNALS_SQL` restricts it to three literals.

#### `positions_explorer/public/chart.js` (full, final)

```js
import { renderSvg } from "./svg.js";

const svg = document.getElementById("chart");
const select = document.getElementById("symbol");
const { width, height } = svg.viewBox.baseVal;

async function getJson(url) {
  const res = await fetch(url);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error);
  return body;
}

async function draw(symbol) {
  const series = symbol
    ? await getJson(`/api/chart?symbol=${encodeURIComponent(symbol)}`)
    : { close: [] };
  svg.innerHTML = renderSvg(series, { width, height });
}

const symbols = await getJson("/api/symbols");
select.replaceChildren(...symbols.map((s) => new Option(s, s)));
const wanted = new URLSearchParams(location.search).get("symbol");
select.value = symbols.includes(wanted) ? wanted : (symbols[0] ?? "");
select.addEventListener("change", () => draw(select.value));
draw(select.value);
```

`?symbol=` is the default when it is in the list; otherwise the page uses the first symbol. Changing the dropdown doesn't update the URL. With no positions, the list is empty and the chart shows "No bars".

### Backend tests

No new SQL test: Step C only reads `positions` and `raw_signals`. The combined-source filter is asserted on the SQL string below.

#### `positions_explorer/server.test.js` (full, final)

```js
import { createServer, dbSource, fixtureSource } from "./server.js";

const fixture = {
  MSFT: { bars: [], positions: [], signals: [] },
  AAPL: {
    bars: [
      { bar_date: "2026-11-04", close: 200 },
      { bar_date: "2026-11-05", close: 205 },
    ],
    positions: [
      { buy_date: "2026-11-04", price: 200, sell_date: "2026-11-05", sell_price: 205 },
      { buy_date: "2026-11-05", price: 205, sell_date: null, sell_price: null },
    ],
    signals: [
      { date: "2026-11-04", projected_price: 240, source: "tipranks", analyst: "Jane Doe" },
    ],
  },
};

// Listens on a free port and always closes, so npm test can exit.
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

function get(source, path) {
  return withServer(source, async (base) => {
    const res = await fetch(base + path);
    return { status: res.status, type: res.headers.get("content-type"), body: await res.text() };
  });
}

// A query stub that records each call and answers from rowsFor(sql).
function stubQuery(rowsFor) {
  const calls = [];
  const query = async (sql, params = []) => {
    calls.push({ sql, params });
    return rowsFor(sql);
  };
  return { query, calls };
}

test("/api/chart returns the closes, buys, sells, and targets for a symbol", async () => {
  const res = await get(fixtureSource(fixture), "/api/chart?symbol=AAPL");
  expect(res.status).toBe(200);
  expect(JSON.parse(res.body)).toEqual({
    close: [
      { x: "2026-11-04", y: 200 },
      { x: "2026-11-05", y: 205 },
    ],
    buys: [
      { x: "2026-11-04", y: 200 },
      { x: "2026-11-05", y: 205 },
    ],
    sells: [{ x: "2026-11-05", y: 205 }],
    targets: [{ x: "2026-11-04", y: 240, source: "tipranks", analyst: "Jane Doe" }],
  });
});

test("/api/chart for a symbol missing from the fixture returns empty series", async () => {
  const res = await get(fixtureSource(fixture), "/api/chart?symbol=ZZZZ");
  expect(JSON.parse(res.body)).toEqual({ close: [], buys: [], sells: [], targets: [] });
});

test("/api/chart without a symbol is a 400", async () => {
  const res = await get(fixtureSource(fixture), "/api/chart");
  expect(res.status).toBe(400);
  expect(JSON.parse(res.body)).toEqual({ error: "symbol is required" });
});

test("unknown paths are a 404", async () => {
  expect((await get(fixtureSource(fixture), "/nope")).status).toBe(404);
  expect((await get(fixtureSource(fixture), "/../server.js")).status).toBe(404);
});

test("a failing source is a 500 with its message", async () => {
  const broken = { rows: async () => { throw new Error("db down"); } };
  const res = await get(broken, "/api/chart?symbol=AAPL");
  expect(res.status).toBe(500);
  expect(JSON.parse(res.body)).toEqual({ error: "db down" });
});

test("/ serves the page", async () => {
  const res = await get(fixtureSource(fixture), "/");
  expect(res.status).toBe(200);
  expect(res.type).toMatch(/^text\/html/);
  expect(res.body).toContain('<svg id="chart"');
});

test("/api/symbols returns the sorted fixture keys", async () => {
  const res = await get(fixtureSource(fixture), "/api/symbols");
  expect(res.status).toBe(200);
  expect(JSON.parse(res.body)).toEqual(["AAPL", "MSFT"]);
});

test("dbSource.symbols maps symbol from positions", async () => {
  const { query, calls } = stubQuery(() => [{ symbol: "AAPL" }, { symbol: "MSFT" }]);
  expect(await dbSource(query).symbols()).toEqual(["AAPL", "MSFT"]);
  expect(calls).toEqual([{ sql: expect.stringContaining("FROM positions"), params: [] }]);
});

test("dbSource reads quotes, positions, and base-source signals for the symbol", async () => {
  const { query, calls } = stubQuery((sql) => {
    if (sql.includes("FROM positions")) return fixture.AAPL.positions;
    if (sql.includes("FROM raw_signals")) return fixture.AAPL.signals;
    return fixture.AAPL.bars;
  });
  expect(await dbSource(query).rows("AAPL")).toEqual(fixture.AAPL);
  expect(calls.map((c) => c.params)).toEqual([["AAPL"], ["AAPL"], ["AAPL"]]);

  const [bars, positions, signals] = calls.map((c) => c.sql);
  expect(bars).toContain("FROM yahoo_quotes WHERE symbol = $1");
  expect(positions).toContain("(timezone('America/New_York', buy_date))::date");
  expect(positions).toContain("(timezone('America/New_York', sell_date))::date");
  expect(signals).toContain("FROM raw_signals");
  expect(signals).toContain("ticker = $1");
  expect(signals).toContain("source IN ('yahoo', 'google', 'tipranks')");
  expect(signals).not.toContain("yahoo_and_tipranks");
  expect(signals).not.toContain("yahoo_and_google");
});
```

`MSFT` is listed before `AAPL` in the test fixture, so the `/api/symbols` assert proves the keys are sorted.

### Frontend tests

#### `positions_explorer/lib/series.test.js` (full, final)

```js
import { buildSeries } from "./series.js";

const bars = [
  { bar_date: "2026-11-04", close: 200 },
  { bar_date: "2026-11-05", close: 205 },
];
const empty = { bars: [], positions: [], signals: [] };

test("bars map to close points in order", () => {
  expect(buildSeries({ ...empty, bars }).close).toEqual([
    { x: "2026-11-04", y: 200 },
    { x: "2026-11-05", y: 205 },
  ]);
});

test("no rows give empty series", () => {
  expect(buildSeries(empty)).toEqual({ close: [], buys: [], sells: [], targets: [] });
});

test("every position is a buy; only closed positions are sells", () => {
  const positions = [
    { buy_date: "2026-11-02", price: 190, sell_date: "2026-11-04", sell_price: 185 },
    { buy_date: "2026-11-05", price: 205, sell_date: null, sell_price: null },
  ];
  const { buys, sells } = buildSeries({ ...empty, bars, positions });
  expect(buys).toEqual([
    { x: "2026-11-02", y: 190 },
    { x: "2026-11-05", y: 205 },
  ]);
  expect(sells).toEqual([{ x: "2026-11-04", y: 185 }]);
});

test("targets keep source and analyst", () => {
  const signals = [
    { date: "2026-11-04", projected_price: 240, source: "tipranks", analyst: "Jane Doe" },
    { date: "2026-11-05", projected_price: 230, source: "google", analyst: null },
  ];
  expect(buildSeries({ ...empty, bars, signals }).targets).toEqual([
    { x: "2026-11-04", y: 240, source: "tipranks", analyst: "Jane Doe" },
    { x: "2026-11-05", y: 230, source: "google", analyst: null },
  ]);
});
```

#### `positions_explorer/public/svg.test.js` (full, final)

```js
import { renderSvg } from "./svg.js";

const SIZE = { width: 400, height: 200 };
const close = [
  { x: "2026-11-04", y: 200 },
  { x: "2026-11-05", y: 205 },
  { x: "2026-11-06", y: 210 },
];
const none = { buys: [], sells: [], targets: [] };

// [[x, y], ...] from every points="..." attribute on elements matching tagAndClass.
function pointsOf(svg, tagAndClass) {
  return [...svg.matchAll(new RegExp(`<${tagAndClass}[^>]* points="([^"]+)"`, "g"))]
    .flatMap((m) => m[1].split(" ").map((p) => p.split(",").map(Number)));
}

// [[cx, cy], ...] for every circle of this class.
function circlesOf(svg, cls) {
  return [...svg.matchAll(new RegExp(`<circle class="${cls}" cx="([^"]+)" cy="([^"]+)"`, "g"))]
    .map((m) => [Number(m[1]), Number(m[2])]);
}

function expectInside([x, y]) {
  expect(x).toBeGreaterThanOrEqual(0);
  expect(x).toBeLessThanOrEqual(SIZE.width);
  expect(y).toBeGreaterThanOrEqual(0);
  expect(y).toBeLessThanOrEqual(SIZE.height);
}

test("the close polyline has one point per bar, inside the plot", () => {
  const xy = pointsOf(renderSvg({ ...none, close }, SIZE), "polyline");
  expect(xy).toHaveLength(3);
  xy.forEach(expectInside);
  expect(xy[0][0]).toBeLessThan(xy[2][0]);
  expect(xy[0][1]).toBeGreaterThan(xy[2][1]);
});

test("a single bar does not produce NaN", () => {
  const xy = pointsOf(renderSvg({ ...none, close: [close[0]] }, SIZE), "polyline");
  expect(xy).toEqual([[200, 100]]);
});

test("no bars give the empty-state text", () => {
  expect(renderSvg({ ...none, close: [] }, SIZE)).toBe(
    '<text class="empty" x="200" y="100" text-anchor="middle">No bars</text>',
  );
});

test("one circle per buy and per sell, inside the plot", () => {
  const svg = renderSvg({
    ...none,
    close,
    buys: [{ x: "2026-11-04", y: 200 }, { x: "2026-11-06", y: 210 }],
    sells: [{ x: "2026-11-07", y: 190 }],
  }, SIZE);
  const buys = circlesOf(svg, "buy");
  const sells = circlesOf(svg, "sell");
  expect(buys).toHaveLength(2);
  expect(sells).toHaveLength(1);
  [...buys, ...sells, ...pointsOf(svg, "polyline")].forEach(expectInside);
});

test("markers are ignored when there are no bars", () => {
  const svg = renderSvg({ ...none, close: [], buys: [{ x: "2026-11-04", y: 200 }] }, SIZE);
  expect(svg).not.toContain("<circle");
});

test("one triangle per target, classed by source", () => {
  const targets = [
    { x: "2026-11-04", y: 220, source: "yahoo", analyst: "A" },
    { x: "2026-11-05", y: 230, source: "google", analyst: "B" },
    { x: "2026-11-05", y: 240, source: "tipranks", analyst: "C" },
  ];
  const svg = renderSvg({ ...none, close, targets }, SIZE);
  for (const source of ["yahoo", "google", "tipranks"]) {
    expect(pointsOf(svg, `polygon class="target source-${source}"`)).toHaveLength(3);
  }
  expect(svg.match(/<polygon /g)).toHaveLength(3);
});

test("a target above every close still lands inside the plot", () => {
  const targets = [{ x: "2026-11-05", y: 400, source: "yahoo", analyst: "A" }];
  const svg = renderSvg({ ...none, close, targets }, SIZE);
  const triangle = pointsOf(svg, "polygon");
  expect(triangle).toHaveLength(3);
  [...triangle, ...pointsOf(svg, "polyline")].forEach(expectInside);
});
```

In `pointsOf(svg, "polygon class=...")`, each triangle contributes 3 points, so `toHaveLength(3)` means exactly one triangle for that source.

### Commands

```bash
nvm use && npm test            # positions_explorer: 3 suites, 20 tests; also runs existing suites
./etl/test/run.sh              # unchanged from Step B; rerun to confirm nothing regressed
FIXTURE=1 make positions-explorer   # browser pass: pick AAPL and MSFT; line, buys, sells, 3 triangle colors
```

Commit: "Add the symbol dropdown and analyst target triangles to the positions explorer."

---

## Out of scope

- `etl/winrate.sql` and `etl/sell_alerts.sh` are referenced from the Makefile but missing from the repo. Leave both alone.
- Don't add: a refresh button, zoom, a date range, URL updates on symbol change, hover tooltips, axis labels, a `(symbol)` index on `yahoo_quotes`, jsdom, or a test for the Python downloader. `download_yahoo_quotes.py` keeps writing `quotes.csv`, which SQL no longer reads.
