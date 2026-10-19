---
name: optimize
description: >-
  Run and extend VectorBT buy/sell permutation sweeps in VectorBT/optimize.py.
  Use when the user asks to optimize, sweep, or rerun a simulation, add a
  phase or hold/target/drawdown permutation, or produce the timestamped
  report, canvas, positions CSV, or optimize.py snapshot.
---

# Optimize

Read [VectorBT/optimize.md](../../../VectorBT/optimize.md) before editing `VectorBT/optimize.py` or launching a sweep. When the sweep's rules or phases change, update that file in the same change.

Run from the repo root with `./penv python`. Do not mix `yahoo-daily` and `yahoo-7d-window` in one book. Rank by return on avg invested. Trusted winners have at least 30 signals.

## New phase

Add a phase instead of overwriting a published grid. Steps and permutation examples are in `VectorBT/optimize.md`: argparse choice, buy grid, `neighborhood_sells`, `run_combos`, `write_grid_summary`.

A later buy opens a new lot after the previous one has closed. `--one-lot` only skips a second lot while that ticker is still held, and then restarts the hold clock. The default still opens one lot per signal.

Re-check one published cell before trusting an extension. Analyst >2 · proj >20% · 10d 25% 7.5dd on the 13:32 book is +63.0% and +$30,432.

## Four files, one stamp

The stem is `simulation_<words>_<timestamp>_optimize`. `<timestamp>` comes from `run_clock()`, shape `2026-10-17_1332_UTC+3`. `<words>` is a few kebab-case words before the timestamp that say what the sweep is, for example `7d-coarse-grid`. Write all four under `VectorBT/` before finishing:

1. `simulation_<words>_<timestamp>_optimize.py` — byte copy of `optimize.py` as executed. If the command has arguments, also write `simulation_<words>_<timestamp>_optimize.sh` with that exact command.
2. `simulation_<words>_<timestamp>_optimize.md` — static report whose conclusion names the winning sell, buy, return on invested, stock P&L, signals, win rate, closed/open lots, and lot-day exposure.
3. `simulation_<words>_<timestamp>_optimize.tsx` — canvas source. Also save the same source as `~/.cursor/projects/<workspace>/canvases/simulation_<words>_<timestamp>_optimize.canvas.tsx` so it opens beside chat. If a canvas for this run exists under another name, save it under this stem. Link the `.canvas.tsx` path in the reply. The table is the merged one in `VectorBT/optimize.md`: `%` and `$` sub-cells, yellow-to-red scale, symbol and signal columns, parameter pills, Show filter, and Min / Avg / Max on both axes.
4. `simulation_<words>_<timestamp>_optimize.csv` — one row per lot for every combo in the report, columns listed in `VectorBT/optimize.md`.

## Lot-day exposure

The conclusion states these four figures for the winning combination. Compute them from the lots, not from the price-cache period. An open lot runs through the last quote day.

- **Trade range:** first buy date → last sell date, written `from … to …`.
- **Days exposed:** distinct calendar days on which at least one lot was open. Two lots open on the same day count as one day.
- **Lot-days:** sum of the days each lot was held. One lot held 3 days, another held 1 day, and another held 3 days is 6 lot-days. Overlapping days count once per lot.
- **Average lot amount:** mean dollar size of the lots opened.
