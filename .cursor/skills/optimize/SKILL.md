---
name: optimize
description: >-
  Run and extend VectorBT buy/sell permutation sweeps. Copy
  VectorBT/optimize.py to simulation_<timestamp>_<words>__optimize.py, edit and
  run that copy, then overwrite optimize.py with it. Use when the user asks
  to optimize, sweep, or rerun a simulation, add a phase or
  hold/target/drawdown permutation, or produce the timestamped report,
  canvas, positions CSV, or optimize.py snapshot.
---

# Optimize

Read [VectorBT/optimize.md](../../../VectorBT/optimize.md) and [VectorBT/optimization_params_full.md](../../../VectorBT/optimization_params_full.md) before a sweep. The second file is the parameter catalog: signal books, analyst and upside cuts, hold, target, and drawdown. When the sweep's rules or phases change, update `optimize.md` in the same change. When the catalog changes, update `optimization_params_full.md` too.

## Work on a copy

Do not edit `VectorBT/optimize.py` until the sweep is finished. Other optimize agents may be running at the same time. Ignore them: do not read their copies, diff them, or merge their code. Each run is independent.

1. Before any edit, copy `VectorBT/optimize.py` to `VectorBT/simulation_<timestamp>_<words>__optimize.py`. `<timestamp>` comes first, in the `run_clock()` shape `2026-10-24_1019_UTC+3` (`YYYY-MM-DD_HHMM_UTC±offset`). `<words>` follows it, a few kebab-case words for this sweep, for example `relevant-full`. Two underscores sit before `optimize`. That copy is `simulation_2026-10-24_1019_UTC+3_relevant-full__optimize.py`.
2. Make every code change in that copy, including its output prefix, so the run writes this same stem. From the repo root, run `./penv python VectorBT/simulation_<timestamp>_<words>__optimize.py` with the sweep's arguments.
3. Keep that stem. The timestamp stays the one from the copy, at the front. If the process writes a report, canvas, or CSV under another name, rename those outputs onto this stem. Do not put `<words>` before the timestamp.
4. When the run is finished, overwrite `VectorBT/optimize.py` with the finished copy. Replace the whole file. Do not merge.

Run from the repo root with `./penv python`. Rank by return on avg invested. Trusted winners have at least 30 signals.

Phase `full` runs every buy and sell in `optimization_params_full.md`. Repeat `--signal-name` to put several books in that one run. With no `--signal-name`, `full` uses all six: `all_sources-daily`, `all_sources-7d-window`, `yahoo-daily`, `yahoo-7d-window`, `google-daily`, `google-7d-window`. Each cell is still one book. The canvas signal pills filter those books. Do not merge two books inside one cell.

## New phase

Add a phase instead of overwriting a published grid. Steps and permutation examples are in `VectorBT/optimize.md`: argparse choice, buy grid, `neighborhood_sells`, `run_combos`, `write_grid_summary`.

A later buy opens a new lot after the previous one has closed. `--one-lot` only skips a second lot while that ticker is still held, and then restarts the hold clock. The default still opens one lot per signal.

Re-check one published cell before trusting an extension. Analyst >4 · proj >25% · 15d 25% 5dd on tipranks-daily in `simulation_2026-10-24_1019_UTC+3_relevant-full` is +103.4% and +$5,146.

## Four files, one stamp

The stem is `simulation_<timestamp>_<words>__optimize`. `<timestamp>` comes first, shape `2026-10-24_1019_UTC+3`. `<words>` follows it, for example `relevant-full`, then `__optimize`. That stem is `simulation_2026-10-24_1019_UTC+3_relevant-full__optimize`. Write all four under `VectorBT/` before finishing:

1. `simulation_<timestamp>_<words>__optimize.py` — the copy created at the start and edited in place. It is the code that ran. After the run, that same file overwrites `VectorBT/optimize.py`. If the command has arguments, also write `simulation_<timestamp>_<words>__optimize.sh` with that exact command (the snapshot path).
2. `simulation_<timestamp>_<words>__optimize.md` — static report whose conclusion names the winning sell, buy, return on invested, stock P&L, signals, win rate, closed/open lots, and lot-day exposure.
3. `simulation_<timestamp>_<words>__optimize.tsx` — canvas source. Also save the same source as `~/.cursor/projects/<workspace>/canvases/simulation_<timestamp>_<words>__optimize.canvas.tsx` so it opens beside chat. If a canvas for this run exists under another name, save it under this stem. Link the `.canvas.tsx` path in the reply. Copy the filter and table rules in [Canvas filters](#canvas-filters). The published example is the relevant-full run below.
4. `simulation_<timestamp>_<words>__optimize.csv.xz` — one row per lot for every combo in the report, xz-compressed. Columns listed in `VectorBT/optimize.md`. `write_positions_log` writes the plain CSV and then xz-compresses it in place; macOS Finder decompresses `.csv.xz` with a double-click.

## Canvas filters

The published example is `simulation_2026-10-24_1019_UTC+3_relevant-full`. Copy its filter layout and table. These four files are that run:

- `VectorBT/simulation_2026-10-24_1019_UTC+3_relevant-full__optimize.py` — the sweep that ran, including the canvas template.
- `VectorBT/simulation_2026-10-24_1019_UTC+3_relevant-full__optimize.md` — the report. Winner: tipranks-daily · analyst >4 · proj >25% · 15d 25% 5dd, +103.4% and +$5,146.
- `VectorBT/simulation_2026-10-24_1019_UTC+3_relevant-full__optimize.tsx` — canvas source in the repo.
- `~/.cursor/projects/<workspace>/canvases/simulation_2026-10-24_1019_UTC+3_relevant-full__optimize.canvas.tsx` — the same source, opened beside chat.

### Which filters, and how many choices

Buy filters are signal, analysts, upside, and symbols. Sell filters are hold, target, and drawdown. Show is separate, above the table.

- **Signal, analysts, hold, target, drawdown** are multi-select. A click adds or removes that value. The last selected value in a group stays on.
- **Upside** is one floor, like symbols. The pills are the projected cuts in that run. The default is the lowest. A buy stays when its projected cut is greater than or equal to the active floor, so `>20%` keeps `>20%`, `>25%`, and `>30%`.
- **Symbols** is one floor. The pills are `>0`, `>2`, `>4`, `>7`, `>8`, `>9`, `>10`, `>12`, `>14`, `>16`, `>18`, `>20`, `>40`, `>80`, `>160`, `>320`. The default is `>0`. A buy stays when its unique-ticker count is greater than that floor.
- **Show** is one choice: `%`, `$`, or Both. The default is Both. It sits above the table, outside the two filter columns.

### Layout

Two columns, so the filters stay short. Signal, analysts, upside, and symbols are on the left. Hold, target, and drawdown are on the right. Inside a filter the values stack vertically. Show is a single row above the table.

Each value is one row: the pill, then nine figures. Return min, avg, and max come first. Symbol-count min, avg, and max follow. Win-rate min, avg, and max come last. Group those nine under the headings Return, Symbols, and Win rate. Return and win rate are percentages. Symbol count is a whole number.

Those nine figures use the other active filters. The figure for a value includes the cells that match that value, including a value that is currently off, so the row shows what selecting it would cover. An upside or symbols floor includes every buy at or above that floor.

### Table

One merged table. Each result is a `%` sub-cell and a `$` sub-cell, colored yellow (low) to red (high) on a scale fixed to the full grid. Buy rows carry Symbols (unique tickers) and Signals (lots opened).

Min, Avg, and Max columns sit on the left, after Signals and before the sells. They summarize that buy across the sells in view. Min, Avg, and Max rows sit at the top, under the header and above the buys. They summarize that sell across the buys in view. The corner is those stats of those stats.

Click a heading to sort the buy rows. Click it again to reverse the order. Buy sorts by name. Symbols and Signals sort by those counts. Min, Avg, Max, and each sell sort by return or profit, using the `%` and `$` subheadings when both are shown. The total rows stay at the top.

## Lot-day exposure

The conclusion states these four figures for the winning combination. Compute them from the lots, not from the price-cache period. An open lot runs through the last quote day.

- **Trade range:** first buy date → last sell date, written `from … to …`.
- **Days exposed:** distinct calendar days on which at least one lot was open. Two lots open on the same day count as one day.
- **Lot-days:** sum of the days each lot was held. One lot held 3 days, another held 1 day, and another held 3 days is 6 lot-days. Overlapping days count once per lot.
- **Average lot amount:** mean dollar size of the lots opened.
