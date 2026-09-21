# 30d 50% 7.5dd signal_percentile buys

**Run:** 2026-09-21 23:12 UTC+3
**Period:** 2026-01-28 → 2026-09-18 · 232 days (162 trading)
Sell frozen: **30d or 50% of projected target or 7.5% trailing dd**. $5,000 per lot. Ranked by **return on avg invested**.

# WINNING PERCENTILE CUT

# SELL: 30D OR 50% TARGET OR 7.5% DD

# BUY: SIGNAL_PERCENTILE > 0.80

# +39.4% ON INVESTED · +$7,371 · 38 SIGNALS · 63.2% WIN RATE

## 30d 50% 7.5dd — signal_percentile buys

| Buy | n | On invested | Stock P&L |
| --- | ---: | ---: | ---: |
| **signal_percentile > 0.80** | **38** | **+39.4%** | **+$7,371** |
| signal_percentile > 0.60 | 76 | +36.6% | +$12,658 |
| signal_percentile > 0.40 | 113 | +27.1% | +$14,346 |
| signal_percentile > 0.20 | 151 | +20.8% | +$13,833 |
| signal_percentile > 0.00 | 188 | +12.0% | +$10,347 |

## Detail

| Buy | n | On invested | Stock P&L | Win rate | Trades | vs SPY | Avg invested |
| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |
| signal_percentile > 0.80 | 38 | +39.4% | +$7,371 | 63.2% | 38 (34c/4o) | +2.65% | 9.8% |
| signal_percentile > 0.60 | 76 | +36.6% | +$12,658 | 53.9% | 76 (66c/10o) | +2.10% | 9.1% |
| signal_percentile > 0.40 | 113 | +27.1% | +$14,346 | 54.0% | 113 (98c/15o) | +1.17% | 9.4% |
| signal_percentile > 0.20 | 151 | +20.8% | +$13,833 | 50.3% | 151 (134c/17o) | +0.43% | 8.8% |
| signal_percentile > 0.00 | 188 | +12.0% | +$10,347 | 46.8% | 188 (170c/18o) | -0.34% | 9.2% |

Best **return on invested**: **signal_percentile > 0.80** → +39.4% (38 signals, +$7,371).

Best **stock P&L**: **signal_percentile > 0.40** → +$14,346 (113 signals, +27.1%).

## vs previous run (2026-09-21 22:32)

Same n at every cut. Percentile ranks were rewritten again; bucket membership moved except all-in.

| Buy | n | On invested now | was | Stock P&L now | was |
| --- | ---: | ---: | ---: | ---: | ---: |
| signal_percentile > 0.80 | 38 | **+39.4%** | +41.6% | **+$7,371** | +$7,504 |
| signal_percentile > 0.60 | 76 | **+36.6%** | +37.3% | **+$12,658** | +$13,195 |
| signal_percentile > 0.40 | 113 | **+27.1%** | +26.8% | **+$14,346** | +$13,751 |
| signal_percentile > 0.20 | 151 | **+20.8%** | +20.3% | **+$13,833** | +$13,740 |
| signal_percentile > 0.00 | 188 | +12.0% | +12.0% | +$10,347 | +$10,347 |

## vs analyst/proj (not re-simulated, 20:41 focus)

| Buy | n | On invested | Stock P&L |
| --- | ---: | ---: | ---: |
| analyst>2 · proj>20% | 84 | +37.2% | +$14,446 |
| analyst>2 · proj>25% | 63 | +46.2% | +$13,321 |
| analyst>2 · proj>30% | 42 | +52.9% | +$9,569 |
| analyst>3 · proj>20% *(old freeze)* | 42 | +36.4% | +$7,433 |
| analyst>3 · proj>25% | 31 | +51.4% | +$7,674 |
| **ANALYST>3 · PROJ>30%** | **22** | **+63.1%** | **+$6,346** |
| **signal_percentile > 0.80** *(this run)* | **38** | **+39.4%** | **+$7,371** |

## Conclusions

- Percentile is still monotonic on rate: tighter is better. **signal_percentile > 0.80** is the best of these five (+39.4% / +$7,371 / 38).
- Best dollars among percentile cuts: **signal_percentile > 0.40** (+$14,346). Loosening to >0.00 still hurts dollars.
- Vs 22:32: the top two cuts slipped a little on rate and dollars; >0.40 and >0.20 ticked up; all-in is unchanged.
- **>0.80 (+39.4%)** still beats the old freeze (**analyst>3 · proj>20% +36.4%**). **>0.60 (+36.6%)** is a hair above that freeze. **analyst>3 · proj>30% (+63.1%)** remains the rate winner.

## Notes

- Sell frozen at 30d or 50% of projected upside or 7.5% trailing drawdown. Peak for drawdown is since entry. A new signal resets the 30d clock and the target.
- signal_percentile > 0.00 excludes the single row with percentile 0 (188 of 189).
- Comparison is on invested dollars, not book vs SPY. Exposure stays un-optimized.
- Analyst/proj rows are copied from VectorBT/.cache/focus.json (run 2026-09-21 20:41 UTC+3). They were not re-simulated.
