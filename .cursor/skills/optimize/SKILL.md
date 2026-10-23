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

1. Before any edit, copy `VectorBT/optimize.py` to `VectorBT/simulation_<timestamp>_<words>__optimize.py`. `<timestamp>` comes first, in the `run_clock()` shape `2026-10-19_2127_UTC+3` (`YYYY-MM-DD_HHMM_UTC±offset`). `<words>` follows it, a few kebab-case words for this sweep, for example `7d-fine-grid`. Two underscores sit before `optimize`. A fine-grid copy is `simulation_2026-10-19_2127_UTC+3_7d-fine-grid__optimize.py`.
2. Make every code change in that copy, including its output prefix, so the run writes this same stem. From the repo root, run `./penv python VectorBT/simulation_<timestamp>_<words>__optimize.py` with the sweep's arguments.
3. Keep that stem. The timestamp stays the one from the copy, at the front. If the process writes a report, canvas, or CSV under another name, rename those outputs onto this stem. Do not put `<words>` before the timestamp.
4. When the run is finished, overwrite `VectorBT/optimize.py` with the finished copy. Replace the whole file. Do not merge.

Run from the repo root with `./penv python`. Rank by return on avg invested. Trusted winners have at least 30 signals.

Phase `full` runs every buy and sell in `optimization_params_full.md`. Repeat `--signal-name` to put several books in that one run. With no `--signal-name`, `full` uses all six: `all_sources-daily`, `all_sources-7d-window`, `yahoo-daily`, `yahoo-7d-window`, `google-daily`, `google-7d-window`. Each cell is still one book. The canvas signal pills filter those books. Do not merge two books inside one cell.

## New phase

Add a phase instead of overwriting a published grid. Steps and permutation examples are in `VectorBT/optimize.md`: argparse choice, buy grid, `neighborhood_sells`, `run_combos`, `write_grid_summary`.

A later buy opens a new lot after the previous one has closed. `--one-lot` only skips a second lot while that ticker is still held, and then restarts the hold clock. The default still opens one lot per signal.

Re-check one published cell before trusting an extension. Analyst >2 · proj >20% · 10d 25% 7.5dd on the 13:32 book is +63.0% and +$30,432.

## Four files, one stamp

The stem is `simulation_<timestamp>_<words>__optimize`. `<timestamp>` comes first, shape `2026-10-19_2127_UTC+3`. `<words>` follows it, for example `7d-fine-grid`, then `__optimize`. A fine-grid stem is `simulation_2026-10-19_2127_UTC+3_7d-fine-grid__optimize`. Write all four under `VectorBT/` before finishing:

1. `simulation_<timestamp>_<words>__optimize.py` — the copy created at the start and edited in place. It is the code that ran. After the run, that same file overwrites `VectorBT/optimize.py`. If the command has arguments, also write `simulation_<timestamp>_<words>__optimize.sh` with that exact command (the snapshot path).
2. `simulation_<timestamp>_<words>__optimize.md` — static report whose conclusion names the winning sell, buy, return on invested, stock P&L, signals, win rate, closed/open lots, and lot-day exposure.
3. `simulation_<timestamp>_<words>__optimize.tsx` — canvas source. Also save the same source as `~/.cursor/projects/<workspace>/canvases/simulation_<timestamp>_<words>__optimize.canvas.tsx` so it opens beside chat. If a canvas for this run exists under another name, save it under this stem. Link the `.canvas.tsx` path in the reply. The table is the merged one in `VectorBT/optimize.md`: `%` and `$` sub-cells, yellow-to-red scale, symbol and signal columns, parameter pills, Show filter, and Min / Avg / Max on both axes.
4. `simulation_<timestamp>_<words>__optimize.csv` — one row per lot for every combo in the report, columns listed in `VectorBT/optimize.md`.

## Lot-day exposure

The conclusion states these four figures for the winning combination. Compute them from the lots, not from the price-cache period. An open lot runs through the last quote day.

- **Trade range:** first buy date → last sell date, written `from … to …`.
- **Days exposed:** distinct calendar days on which at least one lot was open. Two lots open on the same day count as one day.
- **Lot-days:** sum of the days each lot was held. One lot held 3 days, another held 1 day, and another held 3 days is 6 lot-days. Overlapping days count once per lot.
- **Average lot amount:** mean dollar size of the lots opened.
