# signals.csv, 20% of cash, 30-day hold

**Run:** 2026-09-20 16:07 UTC+3

$100k. 42 yahoo-daily rows. $20k per lot, max 5 at once. Cash prefers higher `signal_score`. Duplicate ticker ignored.

| Ending | P&L | Return on cash | Win rate | Max DD | Trades |
| ---: | ---: | ---: | ---: | ---: | ---: |
| $108,878 | +$8,878 | +8.88% | 72.7% | −6.81% | 11 (6 closed, 5 open) |

### Positions

Each row `%` is that lot’s own return (price sell / price buy − 1). **Total `%` is P&L ÷ average $ actually in the market**, not ÷ the idle $100,000. That matches “on avg invested”. Open lots use the last close as sell. `% 30d` scales the hold to 30 trading days. `% S&P500` is SPY over the same window; Total S&P uses the same invested-dollar-days.

| ticker | price buy | price sell | date buy | date sell | P&L | % | % 30d | % S&P500 | % vs S&P500 |
| --- | ---: | ---: | --- | --- | ---: | ---: | ---: | ---: | ---: |
| PANW | 331.94 | 363.58 | 2026-09-03 | 2026-09-18 | +1,906 | +9.53% | +26.00% | -1.24% | +10.77% |
| ISRG | 345.42 | 372.60 | 2026-07-17 | 2026-08-28 | +1,574 | +7.87% | +7.61% | +3.51% | +4.36% |
| MU | 1,213.37 | 877.57 | 2026-06-25 | 2026-08-07 | -5,535 | -27.68% | -26.78% | +5.31% | -32.98% |
| ULTA | 471.21 | 479.57 | 2026-06-03 | 2026-07-17 | +355 | +1.77% | +1.72% | -1.20% | +2.97% |
| BLK | 1,066.73 | 1,158.53 | 2026-07-17 | 2026-08-28 | +1,721 | +8.61% | +8.33% | +3.51% | +5.10% |
| HPE | 54.30 | 60.76 | 2026-09-03 | 2026-09-18 | +2,378 | +11.89% | +32.43% | -1.24% | +13.13% |
| DELL | 492.20 | 568.06 | 2026-09-02 | 2026-09-18 | +3,082 | +15.41% | +38.53% | -0.21% | +15.62% |
| DDOG | 260.78 | 229.92 | 2026-08-10 | 2026-09-18 | -2,367 | -11.83% | -12.24% | -1.22% | -10.61% |
| MRVL | 216.62 | 244.25 | 2026-08-28 | 2026-09-18 | +2,551 | +12.76% | +25.51% | -0.75% | +13.50% |
| ROP | 363.16 | 349.23 | 2026-01-29 | 2026-03-13 | -767 | -3.84% | -3.71% | -4.57% | +0.74% |
| NFLX | 67.60 | 81.05 | 2026-07-20 | 2026-08-31 | +3,979 | +19.90% | +19.25% | +3.36% | +16.53% |
| **Total** | avg invested $32,593 |  |  |  | +8,878 | +27.24% | +5.04% | +3.22% | +24.02% |
