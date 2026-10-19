# Optimize

`VectorBT/optimize.py` sweeps buy and sell permutations on `data/signals.csv` through the VectorBT engine in `backtest.py`. Rank by **return on avg invested** (stock P&L / time-average dollars in stocks). Each lot is $5,000. Exposure is not the objective.

When this behavior changes, update this file in the same change.

## Run

From the repo root, with the project virtualenv:

```bash
./penv python VectorBT/optimize.py coarse --signal-name yahoo-7d-window
```

`run_clock()` supplies the timestamp `<YYYY-MM-DD>_<HHMM>_UTC+<offset>`. Put a few kebab-case words that name the sweep before that timestamp: `simulation_<words>_<timestamp>_optimize`. The 13:32 coarse pass is `simulation_7d-coarse-grid_2026-10-17_1332_UTC+3_optimize`.

Pin `--end` to the last quote day when today is not a session (the cache's last bar is then before `today`, so a refresh would download again). A download that omits a symbol must not drop that symbol: `ensure_prices` keeps prior columns with `combine_first`.

Never mix `signal_name` families in one backtest. `yahoo-daily` and `yahoo-7d-window` are separate books. Repeat `--signal-name` only to compare them as separate grids.

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

Before trusting an extension, re-run one published cell. Analyst >2 · proj >20% · 10d 25% 7.5dd on the 13:32 book is +63.0% and +$30,432.

## Four files, one stamp

Every run writes these siblings under `VectorBT/`. The file stem is `simulation_<words>_<timestamp>_optimize`. `<timestamp>` is the `run_clock()` value, for example `2026-10-17_1332_UTC+3`. `<words>` is a few kebab-case words that say what the simulation is, placed before the timestamp, for example `7d-coarse-grid`.

1. `simulation_<words>_<timestamp>_optimize.py` — exact copy of `optimize.py` as executed. If the invocation has arguments or is not a bare phase command, also write `simulation_<words>_<timestamp>_optimize.sh` with the exact command from the repo root:

```bash
#!/bin/sh
cd "$(dirname "$0")/.." || exit 1
./penv python VectorBT/optimize.py coarse --signal-name yahoo-7d-window
```

2. `simulation_<words>_<timestamp>_optimize.md` — static report with a conclusion: period, lot rule, winning sell and buy, return on invested, stock P&L, signal count, win rate, closed/open lots, lot-day exposure, and the best stock-P&L cell. `write_grid_summary` is the report. An extension that only adds cells still gets a conclusion in this file.

Lot-day exposure is four figures on the winning combination, taken from the lots. An open lot runs through the last quote day.

- **Trade range:** first buy date → last sell date (`from … to …`). This is the range of actual trades, separate from the price-cache period.
- **Days exposed:** distinct calendar days with at least one lot open. A day with two lots open counts once.
- **Lot-days:** sum of days held across lots. One lot for 3 days, one for 1 day, and one for 3 days is 6 lot-days. Overlap counts once per lot.
- **Average lot amount:** mean dollar size of the lots opened.

3. `simulation_<words>_<timestamp>_optimize.tsx` — copy of the canvas source. The file Cursor opens beside chat is the same source at:

`/Users/<user>/.cursor/projects/<workspace>/canvases/simulation_<words>_<timestamp>_optimize.canvas.tsx`

If that canvas is missing or has a different name, save it under this stamp before finishing. In the chat, link the `.canvas.tsx` path.

The canvas is one merged table, not separate return and P&L tables. Copy the structure of `simulation_7d-coarse-grid_2026-10-17_1332_UTC+3_optimize.canvas.tsx`.

- Each result is two sub-cells, `%` and `$`. A Show filter toggles `%`, `$`, or both.
- Color each sub-cell from yellow (low) to red (high) with `useHostTheme()` category tokens. Scale `%` across all `%` values and `$` across all `$` values. Pick text color for contrast.
- Buy rows carry Symbols (unique tickers) and Signals (signal count).
- Pill filters: analysts `>2 >3 >4 >5 >6`, upside `>20% >25% >30%`, hold, target `25% 50%`, drawdown `7.5dd 10dd`.
- Three total columns and three total rows: Min, Avg, Max. Columns summarize the visible sells for each buy. Rows summarize the visible buys for each sell. The corner is the same stats of those stats.
- Embed the numbers. No `fetch`. Import only from `cursor/canvas`.

4. `simulation_<words>_<timestamp>_optimize.csv` — one row per lot for every combo in the report. Columns: `sell`, `buy`, `ticker`, `date_buy`, `date_sell`, `price_buy`, `price_sell`, `pnl`, `return_pct`, `return_pct_30d`, `spy_pct`, `vs_spy_pct`, `hold_days`, `status`.
