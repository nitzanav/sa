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

Default: every signal opens its own lot. A later signal for a ticker that is still held resets that lot's time stop and its projection target. The drawdown peak stays since entry. On a slot book, several lots can open from one signal. Win rate counts that entry once: lots with the same ticker, buy date, and buy price are one position, and the position wins when their P&L sums to more than zero.

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

4. `simulation_<timestamp>_<words>__optimize.csv.xz` — one row per lot for every combo in the report, xz-compressed so GitHub accepts the push (plain CSV lot logs can exceed the 100 MB blob limit). `write_positions_log` writes the plain `.csv` and then runs `xz` on it; Finder decompresses `.csv.xz` by double-click. Columns: `sell`, `buy`, `ticker`, `date_buy`, `date_sell`, `price_buy`, `price_sell`, `pnl`, `return_pct`, `return_pct_30d`, `spy_pct`, `vs_spy_pct`, `hold_days`, `status`, then the combo's `trade_from`, `trade_to`, `days_exposed`, `lot_days`, `avg_lot_amount` repeated on each of its lots.

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

## Protect grid

Same daily books and the same winner buys as the winners grid. The sell has no hold and no profit target. 5 books × 12 buys × 12 sells = 720 cells.

**Loss dropdown.** While the close is below the entry, sell at 2.5%, 5%, or 7.5% under that entry. `2.5dd` on a $10 entry sells at $9.75. This is not a trail from the high.

**Profit protection.** Once a close has traded above the entry, sell when the giveback from the highest close reaches 5%, 10%, 20%, or 40% of the gain from the entry to that peak. A $10 buy, a $12 high, and `10pp` allow a $0.20 giveback, so the sell is $11.80. The peak is the highest close since entry. A new high does not sell, and a later signal does not reset the peak. A lot that hits neither stop stays open through the last quote day.

Column order is loss dropdown, then profit protection: `2.5dd 5pp`. Anchor sell is `5dd 10pp`.

```python
def protect_sell_grid():
    return [
        SellSpec(drawdown=dd, profit_protect=pp)
        for dd in (0.025, 0.05, 0.075)
        for pp in (0.05, 0.10, 0.20, 0.40)
    ]
```

```bash
./penv python VectorBT/optimize.py protect \
  --signal-name yahoo-daily --signal-name tipranks-daily \
  --signal-name google-daily --signal-name all_sources-daily \
  --signal-name yahoo_and_google-daily \
  --end 2026-10-22
```

The canvas sell pills are Loss dd and Profit protect. Signal, analysts, upside, and symbols stay on the left.

## Yahoo book

yahoo-daily only, same winner buys. Each cell is one book size, one loss dropdown, and one profit protect. 12 buys × 4 loss stops × 5 profit protects × 6 book sizes = 1,440 cells.

Loss dropdown, while the close is below the entry: `1.25dd`, `2.5dd`, `7.5dd`, `10dd`. Profit protection, once a close has traded above the entry: `2.5pp`, `5pp`, `10pp`, `20pp`, `30pp` of the gain from entry to the highest close. Stops run before new signals. A new high does not sell.

Book size is 4, 6, 8, 12, 16, or 20 lots of $5,000. A free slot takes the signal. On a full book, sell the biggest loss, or, if every lot is in profit, the least profitable lot only when its strength is strictly below the new signal. Strength is `sqrt(min(analysts, 10)) × floor(target / 10) × 10`. Anchor sell is `2.5dd 5pp · 8 lots`.

```bash
./penv python VectorBT/optimize.py book \
  --signal-name yahoo-daily \
  --end 2026-10-26
```

The canvas pills are Loss dd, Profit protect, and Lots. Signal, analysts, upside, and symbols stay on the left.

## Yahoo park

Same yahoo-daily grid as the Yahoo book. Empty capacity is filled at the close.

A slot still empty after the day's stock buys holds TQQQ. A slot freed by a stop and not reused for a new ticker holds SPY. A new buy sells a SPY lot before it sells TQQQ, and TQQQ before it sells a stock. Stops do not apply to SPY or TQQQ. Anchor sell is `2.5dd 5pp · 8 lots`.

```bash
./penv python VectorBT/optimize.py park \
  --signal-name yahoo-daily \
  --end 2026-10-26
```

## Stop fillers

Same yahoo park grid. Free leftover slots stay TQQQ. The stop filler, the lot bought when a stop is not reused for a new ticker, is swept in place of SPY: `VOO`, `SSO`, `UPRO`, `SPXL`, `QQQ`, `QLD`, `TQQQ`. A new buy sells that filler before TQQQ, and TQQQ before a stock. 12 buys × 120 sells × 7 fillers = 10,080 cells. The canvas Stop filler pill selects one ETF.

```bash
./penv python VectorBT/optimize.py fillers \
  --signal-name yahoo-daily \
  --end 2026-10-26
```

## 64-lot scale

yahoo-daily, one book of 64 lots. Free leftover slots hold TQQQ. The stop filler is `SPY` or `none`. With SPY, a stop that is not reused buys SPY and a new buy sells that lot first. Without SPY, that slot stays empty. `ls` sells the biggest loss. `dls` sells that loss divided by calendar days held. Lot size `1` opens one lot. `str` opens `floor(analysts × target percent / 10)` lots, from 1 to 16. 12 buys × 20 sells × 2 fillers × 2 sell picks × 2 lot sizes = 1,920 cells.

```bash
./penv python VectorBT/optimize.py scale \
  --signal-name yahoo-daily \
  --end 2026-10-26
```

## Cash book

yahoo-daily. No SPY and no TQQQ. An empty slot stays cash, a stop that is not reused stays cash, and uninvested money is cash rather than a SPY sleeve. Every signal opens `floor(analysts × target percent / 10)` lots, from 1 to 16. There is no one-lot size. Book size is 8/12/16/24/32/48/64. `ls` sells the biggest loss. `dls` sells that loss per day held. Buys are analyst >2/>3/>4 × projected >10/20/30/40/50%. 15 buys × 280 sells = 4,200 cells. The canvas Lots pills are those seven book sizes, and Upside includes >10%.

```bash
./penv python VectorBT/simulation_2026-10-27_1536_UTC+2_yahoo-cash-strength__optimize.py cash \
  --signal-name yahoo-daily \
  --end 2026-10-26
```

## Fixed book

Same stock-only rules as the cash book, with one change: the cash is always $320,000. The lot count splits that cash. Eight lots are $40,000 each. Sixty-four lots are $5,000 each. Counts are 8/12/16/24/32/48/64. Buys include projected >10%. The Upside filter pill is `>10%`. Lots utilized is the average open lots divided by the lot count. Days utilized is the count of calendar days with at least one lot open.

```bash
./penv python VectorBT/simulation_2026-10-27_1552_UTC+2_yahoo-split-lots__optimize.py fixed \
  --signal-name yahoo-daily \
  --end 2026-10-26
```

## Strength formulas

Same fixed $320,000 stock-only book as `fixed`. The lot size is one of four formulas, each at least 1 lot and at most 16.

- `at`: `floor(analysts × target percent / 10)`. Two analysts and 10% is 2 lots. Four analysts and 40% is 16.
- `sqra`: `floor(analysts²)`. Two analysts is 4 lots. Four is 16.
- `a`: `floor(analysts × 3)`. Two analysts is 6 lots. Four is 12.
- `sqra_target`: `floor(analysts² × target percent / 40)`. Two analysts and 10% is 1 lot. Three analysts and 30% is 6. Four analysts and 40% is 16.

15 buys × 1,120 sells = 16,800 cells. The canvas Strength pills are those four names. Lot-days invested is invested lot-days divided by the lot count times the calendar days in the test. A full book held every day is 100%.

```bash
./penv python VectorBT/simulation_2026-10-27_1631_UTC+2_yahoo-strength-formulas__optimize.py formulas \
  --signal-name yahoo-daily \
  --end 2026-10-26
```

## Analyst counts

Same fixed book and the same four strength formulas as `formulas`. Analyst cuts add `>0` and `>1` beside `>2`, `>3`, and `>4`. Projected cuts stay `>10/20/30/40/50%`. 25 buys × 1,120 sells = 28,000 cells. The published `sqra` cell on analyst `>3` · projected `>10%` · `7.5dd 2.5pp` · 16 × $20,000 · `ls` was +207.4% and +$186,593.

```bash
./penv python VectorBT/simulation_2026-10-27_2040_UTC+2_yahoo-analyst-counts__optimize.py counts \
  --signal-name yahoo-daily \
  --end 2026-10-26
```

## Upside above 0%

Same fixed book, same four strength formulas, and the same analyst cuts as `counts`, including `>0` and `>1`. Projected cuts add `>0%` beside `>10/20/30/40/50%`. The signal export keeps projected upside above 0%, so 1- and 2-analyst rows between 0% and 10% stay in `data/signals.csv`. 30 buys × 1,120 sells = 33,600 cells. The canvas Upside pill includes `>0%`.

```bash
./penv python VectorBT/simulation_2026-10-27_2101_UTC+2_yahoo-upside-0__optimize.py low \
  --signal-name yahoo-daily \
  --end 2026-10-26
```

## All signal books

Same fixed book, same four strength formulas, same analyst cuts, and same projected cuts as `low`, including `>0` and `>0%`. The books are every name in the `etl/etl.sql` export: `yahoo-daily`, `yahoo-7d-window`, `google-daily`, `google-7d-window`, `tipranks-daily`, `tipranks-7d-window`, `all_sources-daily`, `all_sources-7d-window`, `yahoo_and_google-daily`, and `yahoo_and_google-7d-window`. Each cell is one book. 300 buys × 1,120 sells = 336,000 cells. The canvas Signal pills are those ten names.

```bash
./penv python VectorBT/simulation_2026-10-27_2202_UTC+2_all-signal-books__optimize.py books \
  --signal-name yahoo-daily --signal-name yahoo-7d-window \
  --signal-name google-daily --signal-name google-7d-window \
  --signal-name tipranks-daily --signal-name tipranks-7d-window \
  --signal-name all_sources-daily --signal-name all_sources-7d-window \
  --signal-name yahoo_and_google-daily --signal-name yahoo_and_google-7d-window \
  --end 2026-10-26
```

## Daily books

Same fixed $320,000 stock-only book and the same four strength formulas as `books`, on a smaller grid. The books are the five daily names: `yahoo-daily`, `google-daily`, `tipranks-daily`, `all_sources-daily`, and `yahoo_and_google-daily`. Analyst cuts stay `>0` `>1` `>2` `>3` `>4`. Projected cuts are `>0%` `>10%` `>20%` `>30%`. Lot counts are `8` `12` `16` `32` `64`. Loss dropdown stays `1.25%` `2.5%` `7.5%` `10%`. Profit protection is `2.5%` `5%` `10%` of the gain from entry to the high. The sell pick is `ls` only. 100 buys × 240 sells = 24,000 cells.

Win rate counts positions, not lots. Lots opened together — the same ticker, buy date, and buy price — are one position. That position wins when the lots' P&L sums to more than zero. The top 30 table adds Symbols and Positions from that cell's lots. A ticker counts once when it has more than one lot or more than one signal. A position counts once for lots that share a ticker, buy date, and buy price.

```bash
./penv python VectorBT/simulation_2026-10-31_1925_UTC+2_daily-ls-books__optimize.py daily \
  --end 2026-10-26
```

## 7-day books

Same grid as `daily`, on the five 7-day books: `yahoo-7d-window`, `google-7d-window`, `tipranks-7d-window`, `all_sources-7d-window`, and `yahoo_and_google-7d-window`. Analyst cuts, projected cuts, lot counts, loss dropdown, profit protection, and `ls` stay the same. 100 buys × 240 sells = 24,000 cells. Win rate, Symbols, and Positions count the same way as the daily sweep.

```bash
./penv python VectorBT/simulation_2026-10-31_2043_UTC+2_7d-ls-books__optimize.py window \
  --end 2026-10-26
```

## Eight-lot book

Same daily books and the same winner buys. One sell: a book of 8 lots. 5 books × 12 buys = 60 cells. There is no hold, no profit target, and no drawdown.

Each lot is $5,000. A signal buys at that close when a slot is free. A second signal on a ticker that is already held opens another lot. Same-day signals are taken strongest first.

When all 8 slots are full:

- If any open lot is at a loss, sell the biggest loss at that close and buy the new signal. Strength is not consulted.
- If every open lot is in profit, sell the least profitable one only when its strength is strictly below the new signal. A flat lot is not sold.

Strength is `sqrt(min(analysts, 10)) × floor(target percent / 10) × 10`. Two analysts and a 33% target score `sqrt(2) × 30`. A lot that is never replaced stays open through the last quote day.

```bash
./penv python VectorBT/optimize.py slots \
  --signal-name yahoo-daily --signal-name tipranks-daily \
  --signal-name google-daily --signal-name all_sources-daily \
  --signal-name yahoo_and_google-daily \
  --end 2026-10-22
```

## Fine grid

Fine neighborhood of the coarse 10d 25% 7.5dd peak. 6 buys × 60 sells. Holds 5/7/10/12 × target 20/25/30/35/40% × drawdown 6/7.5/8.5%, on analyst >2/>3/>4 and projected >25/30/35% around the two best coarse buys:

```bash
./penv python VectorBT/optimize.py fine --signal-name yahoo-7d-window
```
