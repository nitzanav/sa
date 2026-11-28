# Review of `positions_explorer/PLAN.md`

Reviewed against the scope file and the repo as of this reading. `PLAN.md` and the scope file were not modified.

The plan matches the repo on the facts that matter for a correct implementation: CSV paths and column order, `raw_signals.ticker`, the `yahoo` / `google` / `tipranks` filter, Makefile prerequisite order, `db.js` date parsing, and the existing session check. The Tests section already gives each step a backend test and a frontend test. The blocking items are places where the written samples or the test harness would implement that design wrong.

## Confirmed, leave as written

These are easy to "fix" into a regression. The samples that implement them should stay.

**Filenames and columns.** `download_yahoo_quotes.py` writes `data/yahoo_quotes/quotes.csv` (`ticker`, `response`) and `data/yahoo_quotes/all_symbols_per_date_and_symbol.csv` with header `date,symbol,open,high,low,close`. `\copy ... (bar_date, symbol, open, high, low, close) ... CSV HEADER` maps `date` to `bar_date` by position. Blank `open` / `high` / `low` are unquoted empty fields; CSV `COPY` loads those as NULL. Days with no close never appear, so `close double precision NOT NULL` matches the downloader. That `NOT NULL` is a sound tightening of the scope's column list.

`buy_alerts.sql` lines 152–172 are the `_yahoo_quotes` / `_yahoo_price` block. The positions insert is lines 174–198 and should be replaced, not left beside the new insert. `sell_alerts.sql` lines 15–16 are the bar-file comment. `sell_date`, `sell_price`, `sell_reason`, and `peak_price` are added only by `sell_alerts.sql`. `raw_signals` is keyed by `ticker` (varchar). It also has `created_at` and `updated_at`; the chart query correctly ignores them. Combined books stored on that table are `yahoo_and_tipranks` and `yahoo_and_google` (`etl/etl.sql` lines 176–198). There is no `all_sources` value in `raw_signals.source`. `SIGNALS_SQL`'s `source IN ('yahoo', 'google', 'tipranks')` is the right filter. Passing `positions.symbol` as `ticker` is right: both the bar CSV and `_raw_signals` keep the constituents symbol (`BRK.B`, not `BRK-B`).

**Makefile order.** `alert:buy`, `alert:sell`, and `winrate` already depend on `download_yahoo_quotes`, and that target is already `.PHONY`. Checking `DATABASE_URL`, then running the Python downloader, then `psql -f etl/load_yahoo_quotes.sql` means those three targets load the table before they read it. `$$DATABASE_URL` and the separate recipe lines match `etl` / `alert:buy`. Leave the `alert:buy` and `alert:sell` recipes alone; only their comments need to mention the table. Leave `winrate` and the missing `etl/winrate.sql` and `etl/sell_alerts.sh` alone. `make positions-explorer` should keep the `nvm use` prefix the other Node targets use. `export` at the top of the Makefile already passes `FIXTURE` and `PORT` into the recipe.

**Reload transaction, for every load after the first.** `\copy` is client-side `COPY FROM STDIN` and runs inside the open `BEGIN`. `TRUNCATE` rolls back with that transaction. `ON_ERROR_STOP=1` exits before `COMMIT`; a later `COMMIT` on an aborted transaction rolls back anyway. `TRUNCATE` takes `ACCESS EXCLUSIVE`, so a concurrent `SELECT` waits, then sees the new rows. `query()` in `src/common/db.js` is one autocommit statement per call (default READ COMMITTED). Buy and sell are the same under `psql -f`. Those readers do not observe an empty table on a reload. Do not add `psql -1`: the file's own `COMMIT` would end that outer transaction early. Do not replace this with a shadow-table swap. Readers block for the copy; that wait is the scope's `TRUNCATE` plus `\copy`.

`TRUNCATE` is not MVCC-safe for a snapshot taken before it (REPEATABLE READ, an open cursor). Nothing in this path holds such a snapshot.

**Session check after the table switch.** `assert_session_closed.sql`'s `DO` block does not read the file format. It rejects `ny_time < 16:00` America/New_York, Saturday and Sunday, and `MAX(bar_date)` distinct from the run's New York date. Filling `_bar` with `SELECT ... FROM yahoo_quotes` keeps all three checks, because the load replaces the whole table with the same CSV. The 16:00 check reads `_run.alerted_at`, not the table. Keep the `DO` block byte for byte. The check is global: one symbol can lack that day's bar while `MAX(bar_date)` still equals the run date. Sell SQL should keep reading `_bar`.

**Buy price.** The new insert is the scope's price, and it preserves the rest of the old insert: `buy_date` stays `r.alerted_at` (timestamptz, not a date), `lots` stays `LEAST(a.strength, 12)`, and the partial unique index stays. The marker query's `(timezone('America/New_York', buy_date))::date` is the same expression that picks the bar, so the marker sits on that bar. Keep the cast. `buy_date::date` is the UTC date and lands on the next calendar day for a run still on the previous New York evening (legal under the 16:00 check, for example `2026-11-07 02:00+00`).

This is not `regularMarketPrice`, and it is not "last non-null close in the JSON". After 16:00, for a symbol that has a bar on the run's New York date, that `close` is the decision price the scope asks for. A symbol with no bar on that date is skipped by the inner join. The old query would still price it from `meta.regularMarketPrice` or an older close. Keep the inner join. Do not put that fallback back. `p.price IS NOT NULL` is redundant once `close` is `NOT NULL`; the join is what drops the missing symbol.

**Explorer dates.** `db.js` returns `date` as a `YYYY-MM-DD` string and `timestamptz` as an ISO string, and it opens one connection per `query()`. `POSITIONS_SQL` must keep the New York `::date` casts so buy and sell x values stay date strings, same as `bar_date` and `raw_signals.date`. Sequential `query()` calls are the right use of that helper. The fixed `FILES` map is the right static handler.

**Triangles.** Read `raw_signals`, not `signals_dedup`. The dedup view collapses different analysts who share a price. The scope wants `analyst` on each mark, and it wants combined sources omitted so the combined book is not drawn on top of the base rows. `projected_price IS NOT NULL` is required to place a point; null prices exist in this table.

**Tests that already match the repo.** `npm test` picks up `positions_explorer/**/*.test.js`. `testEnvironment` is `node`, `type` is `module`, and no test file calls `jest.mock` or `unstable_mockModule` (`jest.spyOn` is used widely; that is a different mechanism). Injecting `query` is the right constraint. The `import.meta.url` main guard keeps `import` from listening. `etl/test/run.sh` already `cd`s to the repo root and fails without `DATABASE_URL`. A second `psql -f etl/test/quotes.sql` after the existing signals diff is the right hook. Schema `etl_test_quotes` does not collide with the existing `etl_test` schema.

**Step B fixture math, keep these expected values.** `2026-11-06 22:00:00+0000` is Friday 17:00 America/New_York (DST ended 2026-11-01). `MAX(bar_date)` is that date, so the real `DO` block passes. AAPL's stub signal (`yahoo_and_tipranks_1d_recency`, count 3, average 50, date 2026-11-06) passes the buy filters, and the join stores `price = 210`. AAPL's buy timestamp is the run instant, so only the 210 bar is in the sell window; AAPL stays open. The manual MSFT position (`buy_date` `2026-11-04 22:00+00`, `price` 100) sees closes 100, 99, 95. Peak equals entry, so `pp` does not fire. `95 <= 100 * 0.975`, so `sell_reason = 'dd'` and `sell_price = 95`. That result is only possible when `_bar` is this fixture. The real CSV's max date is not 2026-11-06, so a leftover `\copy` from the CSV fails the session check.

**Step coverage in the Tests section.** Step A: SQL load, `series.test.js`, `server.test.js`, `svg.test.js` polyline. Step B: buy/sell SQL, series markers, server positions, svg circles. Step C: series targets, server symbols and `SIGNALS_SQL`, svg triangles. That is backend plus frontend for each step. `chart.js` is the only DOM file; leaving it to the fixture browser pass is right. Do not add jsdom or a module mock to unit-test the dropdown.

`etl/winrate.sql` and `etl/sell_alerts.sh` are referenced from the Makefile and absent from the tree. Leaving them alone matches the scope.

## Blocking

### 1. `CREATE TABLE` commits an empty `yahoo_quotes` before the load

The reload transaction is right, and the comment "Readers never see it empty" is wrong for the first run. `CREATE TABLE IF NOT EXISTS` sits outside `BEGIN`, so it autocommits an empty table. Anything that connects between that commit and the load commit reads zero rows. `alert:buy` after a fresh database is that window.

Put the `CREATE TABLE` inside the same `BEGIN` / `COMMIT` as `TRUNCATE` and `\copy`. A failed first load then rolls the table away. A failed later load rolls the `TRUNCATE` away and leaves the previous bars. Keep `\copy` (the server cannot read the client CSV via SQL `COPY`). Do not add `-1`.

`quotes.sql` must not wrap `\i` of that file in another `BEGIN`. The load file's `COMMIT` would end the outer transaction, and the rest of the test would run outside it. `SET search_path` survives that `COMMIT`; the schema guard below still has to run in that same session.

### 2. The Step A samples are the finished program

The file table and the Tests section split the work. The code under Step A does not.

- `buildSeries` already returns `buys`, `sells`, and `targets`.
- `createServer` already serves `/api/symbols` and `dbSource` already runs `POSITIONS_SQL` and `SIGNALS_SQL`.
- The Step A `renderSvg` paragraph already takes the y domain from closes, markers, and targets.

One sentence says Step A returns only bars and has no `/api/symbols` route. An implementer who copies the samples will ship B and C in the Step A commit. Step C's triangles also get clipped if the y domain stays on `close` only, and that domain change is currently written only in the Step A section.

Replace the Step A samples with Step A code:

- `buildSeries` returns `{ close }` only.
- `rows` returns `{ bars }`. `BARS_SQL` only.
- `/api/chart` only. No `/api/symbols`.
- `renderSvg` scales from `close` and draws one polyline.

Step B adds `POSITIONS_SQL`, the `buys` / `sells` keys, the circles, and extends the domain with those points. Step C adds `SYMBOLS_SQL`, `SIGNALS_SQL`, `/api/symbols`, the `targets` key, the polygons, and extends the domain with targets. The Tests section can stay; it already matches this split.

### 3. The server test keeps the process alive

`listen(0)` plus global `fetch` is the right test, and it matches "no module mock". Jest 29 does not force-exit. An open `node:http` server means `npm test` does not return.

Bind `127.0.0.1`, read `server.address().port`, and `server.close()` (and close idle connections) after the fetches, including on failure. Importing `server.js` must not listen; the `argv` guard in the sample does that, because under Jest `argv[1]` is the Jest runner.

### 4. The SQL test can write production `positions`

The throwaway schema is the right harness, and it is one `DATABASE_URL` away from production. `buy_alerts.sql` and `sell_alerts.sql` `INSERT` and `UPDATE` unqualified `positions` and `alerts`. `SET search_path TO etl_test_quotes` (with `public` not on the path) is the only isolation. `CREATE TABLE IF NOT EXISTS` will use a pre-existing `public.positions` if the path is wrong, and the AAPL assert can then open a real position at 210.

`run.sh` must keep `cd` to the repo root and must invoke only `psql -f etl/test/quotes.sql`. `quotes.sql` sets the search path, then `\i`s repo-root paths (`etl/test/tmp/load_yahoo_quotes.sql`, and in Step B the sed'd buy and sell files). `\i` is relative to the process cwd. Do not `psql -f` the generated load file by itself: that file `TRUNCATE`s `yahoo_quotes` on the default search path.

First statement of the test, after `SET search_path`, should raise unless `current_schema()` is `etl_test_quotes`.

Spell the fixture and the manual rows so the test is determined by the schema that exists today:

- CSV header `date,symbol,open,high,low,close`. Six rows, the closes in the plan's table. MSFT on 2026-11-05 has an unquoted empty `open` (`2026-11-05,MSFT,,...`), not the word `blank`. Other `open` / `high` / `low` values only need to be valid numbers. `\i` the load file twice, then assert 6 rows and `open IS NULL` on that MSFT bar.
- Stub `signals(signal_name text, date date, ticker text, analyst_projections_count double precision, average_projected double precision)` with the one AAPL row, created before `\i` of the sed'd buy file. The real `signals` object is a view in `public`; the test schema must contain this table instead.
- MSFT needs a full `alerts` row (every `NOT NULL` column) and a `positions` row whose `alert_id` references it, `open = true`, `lots` set, `buy_date = timestamptz '2026-11-04 22:00+00'`, `price = 100`. Then `\i` the sed'd sell file. Assert MSFT `sell_reason = 'dd'`, `sell_price = 95`, and AAPL still open.

`buy_alerts.sql`'s `\i etl/assert_session_closed.sql` should stay pointed at the real file. After Step B that file reads `yahoo_quotes` through the test search path, so the sell assert is what proves `_bar` came from the table.

### 5. The combined-source filter is never asserted

`SIGNALS_SQL` in the plan is correct. Step C's server test only checks that the call receives `[symbol]`. A stubbed `query` will accept `yahoo_and_tipranks` and `yahoo_and_google` the same way. Those two source values are how the same target would be drawn twice.

In the Step C server test, record the SQL string passed to the stub and require `source IN ('yahoo', 'google', 'tipranks')` and `ticker = $1`. Require the string to exclude `yahoo_and_tipranks` and `yahoo_and_google`. No SQL fixture for Step C is fine; this is a read of a table the explorer does not load.

### 6. Drop the page behavior the scope does not ask for

- `history.replaceState` on dropdown change. Step A still reads `?symbol=` because that is the chart request and the page has no dropdown yet. Step C defaults to that symbol when it is in the list, otherwise the first symbol. Changing the URL is extra page behavior.
- `<title>` on the circles and polygons, and the tests that assert tooltip text. Assert the polyline point count, the circle counts and classes, and one `polygon.source-<source>` per target.

Keep the empty-state `<text>` when there are no bars. It is the no-data branch of the line, and Step A already tests it. Keep the `PORT` override. Do not add a `(symbol)` index on `yahoo_quotes`; the primary key is the scope's key, and this table is one symbol's bars per request.

## Not in scope, correctly absent

No chart library, no new npm dependency, no Python-downloader test, no change to `download_yahoo_quotes.py` besides the Makefile still calling it, no refresh control, zoom, or date range. `quotes.csv` stays written and stops being read by SQL. The browser pass stays last, in fixture mode, and covers the dropdown the unit tests skip: each fixture symbol, the close line, both markers, and the three triangles.
