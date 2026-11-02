# Optimization parameters

One cell is one signal book, one buy, and one sell. The sell closes on the first of a time stop, a profit target, or a trailing drawdown. Rank by return on avg invested. $5,000 a lot, at least 30 signals. Repeat `--signal-name` to run several books at once. Each cell stays one book. The canvas filters books.

## Signal

| Source | Daily | 7-day window |
| --- | --- | --- |
| Yahoo | `yahoo-daily` | `yahoo-7d-window` |
| TipRanks | `tipranks-daily` | `tipranks-7d-window` |
| All sources | `all_sources-daily` | `all_sources-7d-window` |
| Google | `google-daily` | `google-7d-window` |
| Yahoo + Google | `yahoo_and_google-daily` | `yahoo_and_google-7d-window` |

A full run with no `--signal-name` uses the six all_sources, yahoo, and google books. TipRanks and yahoo_and_google are included only when named.

## Buy

Both cuts are strict greater-than.

**Analysts** (`analyst_projections_count`): `>2` `>3` `>4` `>5` `>6`. Above 7 is out.

**Projected upside** (`average_projected`): `>10%` `>20%` `>25%` `>30%`. Above 40% and 50% are out.

5 × 4 = 20 buys on one book. Six books: 120 buys.

## Sell

Order is hold, target, drawdown (`30d 25% 7.5dd`).

**Hold.** Trading days from the last signal on the lot. A later signal for that ticker restarts the clock. `10d` `15d` `30d` `45d` `60d`. Above 60 days is out.

**Target.** Fraction of that signal's projected upside, from the price that set it. A later signal replaces the target. `25%` `50%` `75%`. `100%` is out so the six-book run stays near 30 minutes.

**Drawdown.** From the high since entry. `7.5dd` sells 7.5% under that peak. A later signal does not reset the peak. `5dd` `7.5dd`. `10dd` and `15dd` are out for the same reason.

5 × 3 × 2 = 30 sells. One book is 600 cells. All six books: 3,600 cells.

Phase `protect` is a different sell, not part of that 30. No hold and no target. Loss dropdown from the entry is `2.5dd` `5dd` `7.5dd`, and only while the close is below the entry. Profit protection is `5pp` `10pp` `20pp` `40pp`: that fraction of the gain from entry to the highest close. See `VectorBT/optimize.md`.

Phase `book` is yahoo-daily only. It keeps the slot rule and sweeps book size `4` `6` `8` `12` `16` `20`, loss dropdown `1.25dd` `2.5dd` `7.5dd` `10dd`, and profit protection `2.5pp` `5pp` `10pp` `20pp` `30pp`.

Phase `park` is that same grid. A leftover slot holds TQQQ. A stop that is not reused for a new ticker holds SPY. A new buy sells SPY before TQQQ, and TQQQ before a stock.

Phase `fillers` repeats that grid with the stop filler set to `VOO` `SSO` `UPRO` `SPXL` `QQQ` `QLD` `TQQQ` instead of SPY. Free leftover slots stay TQQQ.

Phase `scale` is yahoo-daily with 64 lots. The stop filler is `SPY` or `none`. `ls` sells the biggest loss and `dls` sells loss per day held. Lot size `1` is one lot; `str` is `floor(analysts × target percent / 10)` lots, capped at 16.

Phase `cash` is yahoo-daily with no SPY and no TQQQ. Empty slots and stopped slots stay cash, and the cash sleeve is cash. Lot size is only `str`. Book size is `8` `12` `16` `24` `32` `48` `64`, each lot still $5,000, so the total cash changes with the lot count.

Phase `fixed` is that same stock-only book with the total held at $320,000. The lot count splits that cash: 8 lots are $40,000 each and 64 lots are $5,000 each. Buys include projected `>10%`.

Phase `formulas` keeps that fixed book and sweeps four lot sizes: `at` is `floor(analysts × target percent / 10)`, `sqra` is `floor(analysts²)`, `a` is `floor(analysts × 3)`, and `sqra_target` is `floor(analysts² × target percent / 40)`. Each is at least 1 lot and at most 16. Lot-days invested is invested lot-days divided by slots times the calendar days in the test.

Phase `counts` keeps that formula grid and adds analyst `>0` and `>1` beside `>2` `>3` `>4`.

Phase `low` keeps that grid and adds projected `>0%` beside `>10%` `>20%` `>30%` `>40%` `>50%`. The export in `etl/etl.sql` keeps rows with projected upside above 0%.

Phase `books` keeps that grid and runs every signal name in that export: `yahoo-daily`, `yahoo-7d-window`, `google-daily`, `google-7d-window`, `tipranks-daily`, `tipranks-7d-window`, `all_sources-daily`, `all_sources-7d-window`, `yahoo_and_google-daily`, and `yahoo_and_google-7d-window`. Each cell is one book.

Phase `daily` keeps the fixed $320,000 book and the four strength formulas, on the five daily books only: `yahoo-daily`, `google-daily`, `tipranks-daily`, `all_sources-daily`, and `yahoo_and_google-daily`. Analyst cuts stay `>0` `>1` `>2` `>3` `>4`. Projected cuts are `>0%` `>10%` `>20%` `>30%`. Lot counts are `8` `12` `16` `32` `64`. Loss dropdown stays `1.25dd` `2.5dd` `7.5dd` `10dd`. Profit protection is `2.5pp` `5pp` `10pp`. The sell pick is `ls` only. 100 buys × 240 sells = 24,000 cells.

Phase `window` is that same grid on the five 7-day books: `yahoo-7d-window`, `google-7d-window`, `tipranks-7d-window`, `all_sources-7d-window`, and `yahoo_and_google-7d-window`.

Phase `horizon` is that same fixed book on the 1–5 day names `yahoo-1d` through `yahoo-5d`, `tipranks-1d` through `tipranks-5d`, and `yahoo_and_tipranks-1d` through `yahoo_and_tipranks-5d`. Analyst cuts, projected cuts, lot counts, and `ls` stay the same. Loss dropdown adds `5dd`. Profit protection adds `7.5pp`. 300 buys × 400 sells = 120,000 cells.

Phase `recency` is that same horizon grid on `yahoo_and_tipranks_1d_recency` through `yahoo_and_tipranks_5d_recency`. A point on the signal session weighs 2.5. An older point weighs `2.5 / trading days back`, counting the signal session as 1. The analyst count is the weight sum and the projected upside is the weighted mean. A ticker that already has an open position is skipped. 100 buys × 400 sells = 40,000 cells.

Win rate is the share of positions with positive P&L. Lots opened together — the same ticker, buy date, and buy price — are one position. The position wins when those lots' P&L sums to more than zero. A four-lot winner counts once.

## Lots

Each signal opens a lot. A later signal while held resets the hold and the target; the peak stays since entry. `--one-lot` keeps one open lot per ticker: a later buy only restarts the hold, and the next signal after a close opens a new lot.

## `--end`

`--end YYYY-MM-DD` drops every signal after that day and stops prices on that day, so later quotes never enter the test. Without `--end`, the cutoff is today: signals dated today or earlier stay in, and prices load through today.
