# 30d 50% 7.5dd buy comparison

**Run:** 2026-09-21 21:43 UTC+3; F500 7.5dd added later
**Period:** 2026-01-28 → 2026-09-18 · 232 days (162 trading)
Sell frozen: **30d or 50% of projected target or 7.5% trailing dd**. $5,000 per lot. Ranked by **return on avg invested**. Analyst/proj rows reused from the 2026-09-21 20:41 focus run.

# WINNING COMBINATION

# SELL: 30D OR 50% TARGET OR 7.5% DD

# BUY: ANALYST>3 · PROJ>30%

# +63.1% ON INVESTED · +$6,346 · 22 SIGNALS · 68.2% WIN RATE

## 30d 50% 7.5dd — all buys

| Buy | n | On invested | Stock P&L |
| --- | ---: | ---: | ---: |
| analyst>2 · proj>20% | 84 | +37.2% | +$14,446 |
| analyst>2 · proj>25% | 63 | +46.2% | +$13,321 |
| analyst>2 · proj>30% | 42 | +52.9% | +$9,569 |
| analyst>3 · proj>20% *(old freeze)* | 42 | +36.4% | +$7,433 |
| analyst>3 · proj>25% | 31 | +51.4% | +$7,674 |
| **ANALYST>3 · PROJ>30%** | **22** | **+63.1%** | **+$6,346** |
| signal_percentile > 0.80 | 38 | +32.7% | +$5,857 |
| signal_percentile > 0.60 | 76 | +22.7% | +$8,460 |
| signal_percentile > 0.40 | 113 | +22.7% | +$11,435 |
| signal_percentile > 0.20 | 151 | +18.2% | +$12,722 |
| signal_percentile > 0.00 | 188 | +12.8% | +$10,962 |
| Fortune 500 at start · 30d 7.5dd | 501 | +4.9% | +$13,852 |
| Fortune 500 at start · 7.5dd | 501 | -1.0% | -$3,655 |

## Detail

| Buy | n | On invested | Stock P&L | Win rate | Trades | vs SPY | Avg invested |
| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| analyst>2 · proj>20% | 84 | +37.2% | +$14,446 | 56.0% | 84 (74c/10o) | +2.09% | 9.2% |
| analyst>2 · proj>25% | 63 | +46.2% | +$13,321 | 57.1% | 63 (57c/6o) | +2.81% | 9.2% |
| analyst>2 · proj>30% | 42 | +52.9% | +$9,569 | 61.9% | 42 (39c/3o) | +3.09% | 8.6% |
| analyst>3 · proj>20% | 42 | +36.4% | +$7,433 | 57.1% | 42 (35c/7o) | +2.45% | 9.7% |
| analyst>3 · proj>25% | 31 | +51.4% | +$7,674 | 61.3% | 31 (27c/4o) | +3.65% | 9.6% |
| analyst>3 · proj>30% | 22 | +63.1% | +$6,346 | 68.2% | 22 (21c/1o) | +4.34% | 9.1% |
| signal_percentile > 0.80 | 38 | +32.7% | +$5,857 | 60.5% | 38 (32c/6o) | +2.23% | 9.4% |
| signal_percentile > 0.60 | 76 | +22.7% | +$8,460 | 53.9% | 76 (63c/13o) | +1.19% | 9.8% |
| signal_percentile > 0.40 | 113 | +22.7% | +$11,435 | 50.4% | 113 (99c/14o) | +0.77% | 8.9% |
| signal_percentile > 0.20 | 151 | +18.2% | +$12,722 | 49.0% | 151 (136c/15o) | +0.34% | 9.3% |
| signal_percentile > 0.00 | 188 | +12.8% | +$10,962 | 47.3% | 188 (170c/18o) | -0.29% | 9.1% |
| Fortune 500 at start · 30d 7.5dd | 501 | +4.9% | +$13,852 | 48.1% | 501 (501c/0o) | +3.40% | 11.4% |
| Fortune 500 at start · 7.5dd | 501 | -1.0% | -$3,655 | 44.3% | 501 (501c/0o) | +1.60% | 15.3% |

Best **return on invested**: **analyst>3 · proj>30%** → +63.1% (22 signals, +$6,346).

Best **stock P&L**: **analyst>2 · proj>20%** → +$14,446 (84 signals, +37.2%).

## Conclusions

- Analyst count + projected % beats signal_percentile. The weakest analyst/proj cut (**analyst>3 · proj>20%** +36.4%) still beats the tightest percentile (**signal_percentile > 0.80** +32.7%).
- Percentile is monotonic on rate: tighter is better. Loosening adds dollars until >0.00, which is worse dollars than >0.20.
- Fortune 500 at start is the floor on rate. **Fortune 500 at start · 30d 7.5dd**: 501 names, +4.9% on invested, +$13,852, 48.1% win rate (501c/0o). **Fortune 500 at start · 7.5dd**: 501 names, -1.0% on invested, -$3,655, 44.3% win rate (501c/0o). No analyst projection, so the 50% target never fires.
- Keep **analyst>3 · proj>30%** for rate. Keep **analyst>2 · proj>20%** if you want more dollars in play. Do not switch the buy filter to percentile or to the Fortune 500 universe.

Skipped Fortune 500 names: FDXF, HONA (no first-day price 2).

## Notes

- Sell frozen at 30d or 50% of projected upside or 7.5% trailing drawdown. Peak for drawdown is since entry. A new signal resets the 30d clock and the target.
- The six analyst/proj rows are copied from VectorBT/.cache/focus.json (run 2026-09-21 20:41 UTC+3). They were not re-simulated.
- signal_percentile > 0.00 excludes the single row with percentile 0 (188 of 189).
- Fortune 500 has no analyst projection, so the 50% target never fires. Two F500 rows: 30d or 7.5% dd, and 7.5% dd alone. Bought on the first bar of the period (2026-01-28). 501 of 503 listed names; FDXF and HONA had no first-day price.
- Comparison is on invested dollars, not book vs SPY. Exposure stays un-optimized.
