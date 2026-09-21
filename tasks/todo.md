# Analyst-signal parameter sweep (sell then buy)

## Goal

Find better exits, then test buy filters, ranked by **return on avg invested** (stock P&L ÷ time-average dollars in stocks). Exposure is not optimized; book vs SPY is secondary.

## Data (inspected)

`data/signals.csv`: 189 yahoo-daily rows, 151 tickers, 2026-01-29 → 2026-09-18.

| Filter | n |
| --- | ---: |
| analyst > 2 (all rows; min count is 3) | 189 |
| analyst > 3 | 85 |
| analyst > 4 | 45 |
| analyst > 5 | 22 |
| analyst > 6 | 11 |
| projected > 10% (all rows; min 10.06%) | 189 |
| projected > 20% | 84 |
| projected > 30% | 42 |
| projected > 40% | 19 |
| **analyst > 3 and projected > 20% (freeze)** | **42** |

Previous run (`simulation_2026-09-21_1554`): those 42 names, 30d → +18.9% on invested; 30d or 75% target → +21.0%. >2 and >10% was worse.

## Plan

- [x] Add `VectorBT/optimize.py`: sell-spec list, generic exit, buy filter, price cache, reports like 1554
- [x] Reuse `VectorBT/backtest.py` simulate / download / summary
- [x] Phase 1: freeze buy >3 and >20%; run 24 sells + 2 baselines
- [x] Verify baselines match 1554 (~+$6,144 / +18.9% and +$6,703 / +21.0%)
- [x] Pick 4 winners by return on avg invested
- [x] Phase 2: 4 winners × 20 buy filters
- [x] Write `VectorBT/simulation_2026-09-21_1729_UTC+3_optimize.md`

## Focused 6×4 (2026-09-21 evening)

Buys: analyst >2/>3 × proj >20/25/30% (6). Sells: 30d+50%+7.5dd, 30d+7.5dd, 50%+7.5dd, 7.5dd (4). Rank on invested $.

- [x] Add `focus` phase to `VectorBT/optimize.py`
- [x] Run 24 cells
- [x] Write timestamped md + canvas with ablation conclusions

**Focus result:** 30d+50%+7.5dd wins every cell (mean +47.9% vs +28.5% dd-only). analyst>3 · >25% (31) beats the old freeze on both ROI and P&L. ROI peak is analyst>3 · >30% (+63.1%). Dollar mix: analyst>2 · >25% (+46.2% / +$13,321).

Full tables: `VectorBT/simulation_2026-09-21_2041_UTC+3_optimize.md`.

## Conclusion: freeze sell 30d 50% 7.5dd (2026-09-21 night)

Same 6 analyst/proj buys (reuse 2041 numbers). Add percentile cuts >0.80/0.60/0.40/0.20/0.00. Add Fortune 500 buy at period start. One comparison table.

- [x] Add `conclusion` phase to `VectorBT/optimize.py`
- [x] Run 5 percentile + 1 F500 cells
- [x] Write timestamped md + canvas

**Result:** analyst>3 · proj>30% still wins (+63.1% / +$6,346 / 22). Every analyst/proj cut beats every percentile cut (tightest percentile +32.7%). F500 · 30d 7.5dd is +4.9% / +$13,852; F500 · 7.5dd-only is −1.0% / −$3,655 (all 501 stopped out).

Full tables: `VectorBT/simulation_2026-09-21_2143_UTC+3_optimize.md`.

## Review

Baselines matched 1554 exactly after clipping Yahoo bars by **calendar date** (timestamp-after-midnight had dropped 2026-09-18 and the ON print).

**Sells (buy frozen, 42 names):** 7.5–10% trailing drawdown + 50% of projected upside + 30d time stop is the cluster. Best on invested: 30d or 50% target or 7.5% dd **+36.4% / +$7,433**. Best dollars: 10% dd **+$8,353 / +35.4%**. 2.5% dd is worse than the 30d baseline.

**Buys (on those four exits):** proj>30% is the ROI ridge (analyst>3 · proj>30%, n=22, about +55–63%). Widening to analyst>2 · proj>20% (n=84) is the dollar ridge (up to **+$14,674**). analyst>5 and proj>40% are small or negative.

Full tables: `VectorBT/simulation_2026-09-21_1729_UTC+3_optimize.md`.
