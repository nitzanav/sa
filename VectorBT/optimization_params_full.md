# Optimization parameters

One cell is one signal book, one buy, and one sell. The sell closes on the first of a time stop, a profit target, or a trailing drawdown. Rank by return on avg invested. $5,000 a lot, at least 30 signals. Repeat `--signal-name` to run several books at once. Each cell stays one book. The canvas filters books.

## Signal

| Source | Daily | 7-day window |
| --- | --- | --- |
| Yahoo | `yahoo-daily` | `yahoo-7d-window` |
| TipRanks | `tipranks-daily` | `tipranks-7d-window` |
| All sources | `all_sources-daily` | `all_sources-7d-window` |
| Google | `google-daily` | `google-7d-window` |

A full run with no `--signal-name` uses the six all_sources, yahoo, and google books. TipRanks is included only when named.

## Buy

Both cuts are strict greater-than.

**Analysts** (`analyst_projections_count`): `>2` `>3` `>4` `>5` `>6` `>7` `>8` `>9`

**Projected upside** (`average_projected`): `>10%` `>20%` `>25%` `>30%` `>40%` `>50%`

8 × 6 = 48 buys on one book. Six books: 288 buys.

## Sell

Order is hold, target, drawdown (`30d 25% 7.5dd`).

**Hold.** Trading days from the last signal on the lot. A later signal for that ticker restarts the clock. `10d` `15d` `30d` `45d` `60d` `75d` `90d` `105d` `120d`

**Target.** Fraction of that signal's projected upside, from the price that set it. A later signal replaces the target. `25%` `50%` `75%` `100%`

**Drawdown.** From the high since entry. `7.5dd` sells 7.5% under that peak. A later signal does not reset the peak. `5dd` `7.5dd` `10dd` `15dd`

9 × 4 × 4 = 144 sells. One book is 6,912 cells. All six books: 41,472 cells.

## Lots

Each signal opens a lot. A later signal while held resets the hold and the target; the peak stays since entry. `--one-lot` keeps one open lot per ticker: a later buy only restarts the hold, and the next signal after a close opens a new lot.

## `--end`

`--end YYYY-MM-DD` drops every signal after that day and stops prices on that day, so later quotes never enter the test. Without `--end`, the cutoff is today: signals dated today or earlier stay in, and prices load through today.
