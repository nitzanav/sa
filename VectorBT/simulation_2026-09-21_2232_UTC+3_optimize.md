# 30d 50% 7.5dd signal_percentile buys

**Run:** 2026-09-21 22:32 UTC+3
**Period:** 2026-01-28 → 2026-09-18 · 232 days (162 trading)
Sell frozen: **30d or 50% of projected target or 7.5% trailing dd**. $5,000 per lot. Ranked by **return on avg invested**.

# WINNING PERCENTILE CUT

# SELL: 30D OR 50% TARGET OR 7.5% DD

# BUY: SIGNAL_PERCENTILE > 0.80

# +41.6% ON INVESTED · +$7,504 · 38 SIGNALS · 60.5% WIN RATE

## 30d 50% 7.5dd — signal_percentile buys

| Buy | n | On invested | Stock P&L |
| --- | ---: | ---: | ---: |
| **signal_percentile > 0.80** | **38** | **+41.6%** | **+$7,504** |
| signal_percentile > 0.60 | 76 | +37.3% | +$13,195 |
| signal_percentile > 0.40 | 113 | +26.8% | +$13,751 |
| signal_percentile > 0.20 | 151 | +20.3% | +$13,740 |
| signal_percentile > 0.00 | 188 | +12.0% | +$10,347 |

## Detail

| Buy | n | On invested | Stock P&L | Win rate | Trades | vs SPY | Avg invested |
| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| signal_percentile > 0.80 | 38 | +41.6% | +$7,504 | 60.5% | 38 (33c/5o) | +2.62% | 9.5% |
| signal_percentile > 0.60 | 76 | +37.3% | +$13,195 | 55.3% | 76 (64c/12o) | +2.27% | 9.3% |
| signal_percentile > 0.40 | 113 | +26.8% | +$13,751 | 53.1% | 113 (99c/14o) | +1.15% | 9.1% |
| signal_percentile > 0.20 | 151 | +20.3% | +$13,740 | 50.3% | 151 (133c/18o) | +0.41% | 9.0% |
| signal_percentile > 0.00 | 188 | +12.0% | +$10,347 | 46.8% | 188 (170c/18o) | -0.34% | 9.2% |

Best **return on invested**: **signal_percentile > 0.80** → +41.6% (38 signals, +$7,504).

Best **stock P&L**: **signal_percentile > 0.40** → +$13,751 (113 signals, +26.8%).

## vs previous run (2026-09-21 21:43)

Same n at every cut. `data/signals.csv` was rewritten (all 189 rows), so the names inside each bucket moved.

| Buy | n | On invested now | was | Stock P&L now | was |
| --- | ---: | ---: | ---: | ---: | ---: |
| signal_percentile > 0.80 | 38 | **+41.6%** | +32.7% | **+$7,504** | +$5,857 |
| signal_percentile > 0.60 | 76 | **+37.3%** | +22.7% | **+$13,195** | +$8,460 |
| signal_percentile > 0.40 | 113 | **+26.8%** | +22.7% | **+$13,751** | +$11,435 |
| signal_percentile > 0.20 | 151 | **+20.3%** | +18.2% | **+$13,740** | +$12,722 |
| signal_percentile > 0.00 | 188 | +12.0% | +12.8% | +$10,347 | +$10,962 |

## vs analyst/proj (not re-simulated, 20:41 focus)

| Buy | n | On invested | Stock P&L |
| --- | ---: | ---: | ---: |
| analyst>2 · proj>20% | 84 | +37.2% | +$14,446 |
| analyst>2 · proj>25% | 63 | +46.2% | +$13,321 |
| analyst>2 · proj>30% | 42 | +52.9% | +$9,569 |
| analyst>3 · proj>20% *(old freeze)* | 42 | +36.4% | +$7,433 |
| analyst>3 · proj>25% | 31 | +51.4% | +$7,674 |
| **ANALYST>3 · PROJ>30%** | **22** | **+63.1%** | **+$6,346** |
| **signal_percentile > 0.80** *(this run)* | **38** | **+41.6%** | **+$7,504** |

## Conclusions

- Percentile is still monotonic on rate: tighter is better. **signal_percentile > 0.80** is the best of these five (+41.6% / +$7,504 / 38).
- Best dollars among percentile cuts: **signal_percentile > 0.40** (+$13,751), with **>0.20** almost tied (+$13,740). Loosening to >0.00 still hurts dollars.
- After the signal rewrite, percentile is no longer strictly worse than every analyst/proj cut. **>0.80 (+41.6%)** and **>0.60 (+37.3%)** both beat the old freeze (**analyst>3 · proj>20% +36.4%**). **>0.80** also beats **analyst>2 · proj>20% (+37.2%)** on rate.
- **analyst>3 · proj>30% (+63.1%)** is still the rate winner. Do not replace it with percentile. Percentile >0.80 is now a credible second on rate with more names (38 vs 22).

## Notes

- Sell frozen at 30d or 50% of projected upside or 7.5% trailing drawdown. Peak for drawdown is since entry. A new signal resets the 30d clock and the target.
- signal_percentile > 0.00 excludes the single row with percentile 0 (188 of 189).
- Comparison is on invested dollars, not book vs SPY. Exposure stays un-optimized.
- Analyst/proj rows are copied from VectorBT/.cache/focus.json (run 2026-09-21 20:41 UTC+3). They were not re-simulated.
