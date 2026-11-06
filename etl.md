# ETL signal pipeline

`etl/etl.sql` loads Yahoo, Google, and TipRanks analyst rows, aligns them to Nasdaq sessions, and writes `data/signals.csv`. `etl/test/run.sh` replays that file on fixtures and diffs the export.

Ticker names in the fixtures are the test names. A feature is tested when that ticker’s rows in `etl/test/expected/signals.csv` (or their absence) match the rule.

## Features

| Feature | What it does | Test ticker |
|---|---|---|
| Three sources | Load Yahoo, Google, TipRanks CSVs into `_raw_signals`. | Present as `yahoo-*`, `google-*`, `tipranks-*` books |
| Holiday-list guard | Abort if data (plus 30-day look-back) falls outside 2024–2026. | Not in the CSV (would raise). Dates stay inside the list. |
| Nasdaq calendar | Trading day = weekday minus `_nasdaq_holidays`. Early closes are sessions. | `SHIFT_WEEKEND` (Mon 2026-01-19 is a holiday, not a session) |
| Date shift | Sat, Sun, and holiday rows move to the last session on or before them. Friday stays Friday. Lookahead: a Friday signal includes weekend/holiday rows published after the close. | `SHIFT_WEEKEND` |
| Shared window | Keep dates from the latest source start through the earliest source end. | `CLIP_BEFORE_START`, `CLIP_AFTER_END` |
| Combined books | Copy `yahoo`+`tipranks` as `yahoo_and_tipranks` and `yahoo`+`google` as `yahoo_and_google`. | `COMBINE_YT_PRICE`, `COMBINE_YG_PRICE` |
| Combined-price collapse | Under a combined source name, the same `projected_price` on one session counts once. A combined count is not the sum of the parts. | `COMBINE_YT_PRICE`, `COMBINE_YG_PRICE` |
| Price dedupe | One row per `(source, ticker, date, projected_price)`. Same price, two analysts → first name alphabetically. | `DEDUPE_SAME_PRICE` |
| Price change kept | Same analyst, two different prices on dates that land on one session → two rows. | `KEEP_PRICE_CHANGE` |
| NULL price | Empty `projected_price` is unique per analyst, not collapsed with other NULLs. | `KEEP_NULL_PRICE` |
| NULL percent dropped | Rows with no `percent` never enter `signals_dedup`. | `DROP_NULL_PERCENT` |
| 1d mean / count / MAD | Daily `AVG`, `COUNT(*)`, MAD around that mean, analyst list. | `MAD_DAILY_VS_WINDOW` |
| 1d score | `average * sqrt(count)` (no MAD term). Only `average_projected > 0`. | `MAD_DAILY_VS_WINDOW` |
| 2d–5d window | N Nasdaq sessions ending on the signal date (`day_idx`). Count is rows in the window. Score is `average * sqrt(count) * (1 - MAD)`. | `WINDOW_SKIP_HOLIDAY`, `MAD_DAILY_VS_WINDOW` |
| Holiday skipped in windows | A holiday is not a session, so a 2d Tuesday window is Friday+Tuesday. | `WINDOW_SKIP_HOLIDAY` |
| Recency 1d–5d | Weight `2.5 / trading_days_back`. Count is the sum of weights. 1d recency count is 2.5× the daily count and the mean matches 1d. | `RECENCY_1D_SCALE`, `RECENCY_WEIGHT` |
| Recency score | 1d recency uses the daily formula; 2d–5d recency uses the window formula. | `RECENCY_1D_SCALE`, `RECENCY_WEIGHT` |
| Percentile | `PERCENT_RANK` within each `signal_name`. | Several 1d tickers on one date; ranks differ |
| Positive-only export | `analyst_projections_count > 0` and `average_projected > 0`. Negatives and zeros are omitted. | `EXCLUDE_NEGATIVE`, `EXCLUDE_ZERO` |
| Export names | Five sources × `-[1-5]d` and `_[1-5]d_recency`. | Golden file header names |

## Fixture checks

Dates: Thursday 2026-01-15 (Yahoo only), Friday 16, Saturday 17, Sunday 18, MLK Day Monday 19, Tuesday 20, Wednesday 21 (Yahoo only). Google and TipRanks run Friday through Tuesday, so the shared window is those two sessions.

| Ticker | Expectation |
|---|---|
| `SHIFT_WEEKEND` | No rows dated 17, 18, or 19. Yahoo 1d on Friday lists four percents (Fri/Sat/Sun/holiday). |
| `CLIP_BEFORE_START` | No 2026-01-15 in the export. |
| `CLIP_AFTER_END` | No 2026-01-21 in the export. |
| `DEDUPE_SAME_PRICE` | Yahoo 1d count is 1; list is `Dave:50` (before `Eve`). |
| `KEEP_NULL_PRICE` | Yahoo 1d count is 2 (`Frank` with no price and `Gina`). |
| `KEEP_PRICE_CHANGE` | Yahoo 1d Friday count is 2 (`Pat:20` and `Pat:25`). |
| `COMBINE_YT_PRICE` | `yahoo_and_tipranks-1d` count is 1, not 2. |
| `COMBINE_YG_PRICE` | `yahoo_and_google-1d` count is 1, not 2. |
| `WINDOW_SKIP_HOLIDAY` | Yahoo 2d on Tuesday lists Friday and Tuesday, count 2. |
| `RECENCY_WEIGHT` | Yahoo 2d mean on Tuesday is 25. Recency 2d mean is 30, count 3.75. |
| `RECENCY_1D_SCALE` | Yahoo 1d count 1; `yahoo_1d_recency` count 2.5 and the same mean. |
| `MAD_DAILY_VS_WINDOW` | Mean 20, MAD 0.5. 1d score `20 * sqrt(2)`. 2d score that times `(1 - 0.5)`. |
| `DROP_NULL_PERCENT` | Yahoo 1d count is 1 (`Keep` only). |
| `EXCLUDE_NEGATIVE` / `EXCLUDE_ZERO` | Ticker does not appear in the export. |
