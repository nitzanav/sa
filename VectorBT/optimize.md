# Optimize

`VectorBT/optimize.py` sweeps buy and sell permutations on `data/signals.csv` through the VectorBT engine in `backtest.py`. Rank by **return on avg invested** (stock P&L / time-average dollars in stocks). Each lot is $5,000. Exposure is not the objective.

When this behavior changes, update this file in the same change.

## Run

From the repo root, with the project virtualenv. Do not edit `optimize.py` while the sweep is in progress. Copy it to `simulation_<timestamp>_<words>__optimize.py` first, change and run that copy, then overwrite `optimize.py` with the finished copy. Concurrent sweeps each keep their own copy; the overwrite replaces `optimize.py` wholesale, with no merge.

```bash
./penv python VectorBT/simulation_2026-10-24_1019_UTC+3_relevant-full__optimize.py full --signal-name all_sources-daily --signal-name all_sources-7d-window --signal-name yahoo-daily --signal-name yahoo-7d-window --signal-name tipranks-daily --signal-name tipranks-7d-window --end 2026-10-22
```

`run_clock()` supplies the timestamp `<YYYY-MM-DD>_<HHMM>_UTC+<offset>`. The timestamp comes first, then a few kebab-case words, then `__optimize`: `simulation_<timestamp>_<words>__optimize`. That file is `simulation_2026-10-24_1019_UTC+3_relevant-full__optimize`.

Pin `--end` to the last quote day when today is not a session (the cache's last bar is then before `today`, so a refresh would download again). A download that omits a symbol must not drop that symbol: `ensure_prices` keeps prior columns with `combine_first`.

Each cell is one signal book. Repeat `--signal-name` to put several books in one run; the canvas signal pills filter them. Phase `full` with no `--signal-name` uses all six: `all_sources-daily`, `all_sources-7d-window`, `yahoo-daily`, `yahoo-7d-window`, `google-daily`, `google-7d-window`. Do not merge two books inside one cell. The catalog is `VectorBT/optimization_params_full.md`.

Trusted cells have at least 30 signals. Smaller cells stay in the matrices and out of the winner.

## Lot rules

Default: every signal opens its own lot. A later signal for a ticker that is still held resets that lot's time stop and its projection target. The drawdown peak stays since entry.

`--one-lot`: at most one open lot per ticker. A later buy **while that lot is open** does not open another lot; it restarts the hold clock (10/15/30/…) from that bar. The profit target and the drawdown peak stay on the original entry. After the lot has closed (time, target, or drawdown), the next buy opens a new lot. A closed position does not block the next one.

## New phase

A phase is one named grid: a buy list × a sell list, run by `run_combos`, written by `write_grid_summary`.

1. Add the phase name to the `choices` tuple in `parse_args`.
2. Add a buy grid and a sell grid. Buys are dicts passed through `with_signal_names`. Sells are `SellSpec` rows from `neighborhood_sells(holds, targets, drawdowns)`.
3. Add `run_<phase>` that calls `run_combos(signals, close, spy, buys, specs, set(), "<phase>")`.
4. In `main`, call it, `save_json`, build `period_info`, and `write_grid_summary`. State the lot rule in the notes.
5. Document the phase in the module docstring and here.

`neighborhood_sells` order is hold, then target, then drawdown. Keep that order in the canvas columns.

### Permutation examples

Coarse, 180 cells. Analysts >2–6 × projected >20/25/30 × hold 10/15/30 × target 25/50% × drawdown 7.5/10%:

```python
def coarse_buy_grid():
    return with_signal_names(
        [
            {"min_analysts": n, "min_projected": float(p)}
            for n in (2, 3, 4, 5, 6)
            for p in (20, 25, 30)
        ]
    )

def coarse_sell_grid():
    return neighborhood_sells((10, 15, 30), (0.25, 0.50), (0.075, 0.10))
```

```bash
./penv python VectorBT/optimize.py coarse --signal-name yahoo-7d-window
```

Longer holds on that same buy grid, same targets, same drawdowns, same default lot rule. 15 × 24 = 360 cells. Append the columns. Do not replace 10/15/30.

```python
neighborhood_sells((45, 60, 75, 90, 105, 120), (0.25, 0.50), (0.075, 0.10))
```

One lot per ticker, same coarse permutation, end pinned to the last quote day:

```bash
./penv python VectorBT/optimize.py coarse --signal-name yahoo-7d-window --one-lot --end 2026-10-16
```

Before trusting an extension, re-run one published cell. Analyst >4 · proj >25% · 15d 25% 5dd on tipranks-daily in `simulation_2026-10-24_1019_UTC+3_relevant-full` is +103.4% and +$5,146.

Wide, 540 cells. Same 15 buys as coarse. Holds append 45/60/75/90/105/120 onto 10/15/30. Targets stay 25/50%. Drawdowns stay 7.5/10%. This is the grid in `simulation_7d-coarse-grid_2026-10-17_1332_UTC+3_optimize.tsx`. One book per run. Signals dated after `--end` are dropped before the sweep.

```python
def wide_sell_grid():
    return neighborhood_sells(
        (10, 15, 30, 45, 60, 75, 90, 105, 120),
        (0.25, 0.50),
        (0.075, 0.10),
    )
```

```bash
./penv python VectorBT/optimize.py wide --signal-name tipranks-7d-window --end 2026-10-22
```

Full, every cut in `optimization_params_full.md`. 5 analyst cuts × 4 upside cuts × 6 books = 120 buys. Holds 10/15/30/45/60 × target 25/50/75% × drawdown 5/7.5% = 30 sells. 120 × 30 = 3,600 cells. One book per cell. Analysts above 7, upside above 30%, and holds above 60 days are out. Target 100% and drawdowns 10% and 15% are out so this six-book run stays near 30 minutes.

```python
def full_buy_grid():
    return with_signal_names(
        [
            {"min_analysts": n, "min_projected": float(p)}
            for n in (2, 3, 4, 5, 6)
            for p in (10, 20, 25, 30)
        ]
    )


def full_sell_grid():
    return neighborhood_sells(
        (10, 15, 30, 45, 60),
        (0.25, 0.50, 0.75),
        (0.05, 0.075),
    )
```

```bash
./penv python VectorBT/optimize.py full --end 2026-10-22
```

Pass `--signal-name` more than once to run a subset of the six. `tipranks-daily` and `tipranks-7d-window` stay valid names; they are not in the default six.

`make etl` loads `data/analyst_recomendation/tipranks/all_symbols.csv` and writes `tipranks-daily` and `tipranks-7d-window` into `data/signals.csv` with the Yahoo, Google, and all-sources books. Each of those names is its own book.

## Four files, one stamp

Every run writes these siblings under `VectorBT/`. The file stem is `simulation_<timestamp>_<words>__optimize`. `<timestamp>` comes first, for example `2026-10-23_2014_UTC+3`. `<words>` follows it, for example `full-all-signals`, then `__optimize`. Set the copy's output prefix to that stem.

1. `simulation_<timestamp>_<words>__optimize.py` — the copy of `optimize.py` created before editing and executed as-is. After the run, that file overwrites `optimize.py`. If the invocation has arguments or is not a bare phase command, also write `simulation_<timestamp>_<words>__optimize.sh` with the exact command from the repo root:

```bash
#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
./penv python VectorBT/simulation_2026-10-24_1019_UTC+3_relevant-full__optimize.py full --signal-name all_sources-daily --signal-name all_sources-7d-window --signal-name yahoo-daily --signal-name yahoo-7d-window --signal-name tipranks-daily --signal-name tipranks-7d-window --end 2026-10-22
```

2. `simulation_<timestamp>_<words>__optimize.md` — static report with a conclusion: period, lot rule, winning sell and buy, return on invested, stock P&L, signal count, win rate, closed/open lots, lot-day exposure, and the best stock-P&L cell. `write_grid_summary` is the report. An extension that only adds cells still gets a conclusion in this file.

Lot-day exposure is four figures on the winning combination, taken from the lots. An open lot runs through the last quote day.

- **Trade range:** first buy date → last sell date (`from … to …`). This is the range of actual trades, separate from the price-cache period.
- **Days exposed:** distinct calendar days with at least one lot open. A day with two lots open counts once.
- **Lot-days:** sum of days held across lots. One lot for 3 days, one for 1 day, and one for 3 days is 6 lot-days. Overlap counts once per lot.
- **Average lot amount:** mean dollar size of the lots opened.

3. `simulation_<timestamp>_<words>__optimize.tsx` — copy of the canvas source. The file Cursor opens beside chat is the same source at:

`/Users/<user>/.cursor/projects/<workspace>/canvases/simulation_<timestamp>_<words>__optimize.canvas.tsx`

If that canvas is missing or has a different name, save it under this stamp before finishing. In the chat, link the `.canvas.tsx` path.

The canvas is one merged table, not separate return and P&L tables. Copy the structure of `simulation_2026-10-24_1019_UTC+3_relevant-full__optimize.canvas.tsx`.

- Each result is two sub-cells, `%` and `$`. Show is three exclusive choices above the table: `%`, `$`, or Both.
- Click a column heading to sort the buy rows. Click it again to reverse the order. Buy sorts by name. Symbols and Signals sort by those counts. Min, Avg, Max, and each sell sort by return or profit, using the `%` and `$` subheadings when both are shown. The Min, Avg, and Max rows stay at the top.
- Color each sub-cell from yellow (low) to red (high) with `useHostTheme()` category tokens. Scale `%` across all `%` values and `$` across all `$` values. Pick text color for contrast.
- Buy rows carry Symbols (unique tickers) and Signals (signal count).
- Pill filters: signal book, analysts, upside, hold, target, drawdown, and Symbols. The signal pills are the books in that run. The Symbols pills are a single floor: `>0`, `>2`, `>4`, `>7`, `>8`, `>9`, `>10`, `>12`, `>14`, `>16`, `>18`, `>20`, `>40`, `>80`, `>160`, `>320`. The default is `>0`. A buy row stays when its unique-ticker count is greater than the active floor. The Upside pills are a single floor too. One cut is active and the default is the lowest. A buy stays when its projected cut is at least that floor.
- Each filter value shows min, average, and max return (%) for the cells with that value under the other active filters, then min, average, and max symbol count for that same slice, then min, average, and max win rate. Two columns: signal, analysts, upside, and symbols on the left; hold, target, and drawdown on the right. Show is the row above the table. Values stack vertically. On that row, return Min, Avg, and Max come first, symbol-count Min, Avg, and Max follow them, and win-rate Min, Avg, and Max come last.
- Three total columns and three total rows: Min, Avg, Max. Columns summarize the visible sells for each buy and sit on the left, after Symbols and Signals and before the sells. Rows summarize the visible buys for each sell and sit at the top, under the header and above the buys. The corner is the same stats of those stats.
- Embed the numbers. No `fetch`. Import only from `cursor/canvas`.

4. `simulation_<timestamp>_<words>__optimize.csv` — one row per lot for every combo in the report. Columns: `sell`, `buy`, `ticker`, `date_buy`, `date_sell`, `price_buy`, `price_sell`, `pnl`, `return_pct`, `return_pct_30d`, `spy_pct`, `vs_spy_pct`, `hold_days`, `status`, then the combo's `trade_from`, `trade_to`, `days_exposed`, `lot_days`, `avg_lot_amount` repeated on each of its lots.

## Winners grid

Daily-signal cross-check around the pasted winner cells. 48 buys × 12 sells = 576 cells. Analysts >2/>3/>4 × projected >20/30/40/50% on `yahoo-daily`, `tipranks-daily`, `all_sources-daily`, `yahoo_and_google-daily`. Hold 10/15 × target 25/50% × drawdown 5/7.5/10%. Anchor sell is `15d 50% 7.5dd`.

```python
def winners_buy_grid():
    return with_signal_names(
        [
            {"min_analysts": n, "min_projected": float(p)}
            for n in (2, 3, 4)
            for p in (20, 30, 40, 50)
        ]
    )


def winners_sell_grid():
    return neighborhood_sells((10, 15), (0.25, 0.50), (0.05, 0.075, 0.10))
```

```bash
./penv python VectorBT/optimize.py winners \
  --signal-name yahoo-daily --signal-name tipranks-daily \
  --signal-name all_sources-daily --signal-name yahoo_and_google-daily \
  --end 2026-10-22
```

`yahoo_and_google-daily` and `yahoo_and_google-7d-window` are valid `--signal-name` values; `make etl` writes them into `data/signals.csv` alongside the Yahoo, Google, TipRanks, and all_sources books.

## Fine grid

Fine neighborhood of the coarse 10d 25% 7.5dd peak. 6 buys × 60 sells. Holds 5/7/10/12 × target 20/25/30/35/40% × drawdown 6/7.5/8.5%, on analyst >2/>3/>4 and projected >25/30/35% around the two best coarse buys:

```bash
./penv python VectorBT/optimize.py fine --signal-name yahoo-7d-window
```
