
# Stock Sell Strategies

## Analyst-Based
- **Last Buy Signal:** Sell when too much time passes since the latest analyst buy recommendation.
- **Last Hold Signal:** Consider elapsed time since the most recent analyst hold recommendation.
- **Target Price Changes:** Increase sell score when analysts lower their target prices.
- **Remaining Target Upside:** Sell when remaining upside toward analyst consensus becomes insufficient.
- **Analyst Downgrades:** Increase sell score when downgrades outweigh upgrades.

## Price & Technical
- **Maximum Holding Period:** Exit positions after an optimized number of trading days.
- **Peak Drawdown:** Sell when price drops a defined percentage from its post-purchase peak.
- **ATR-Adjusted Drawdown:** Normalize peak drawdown by historical volatility to identify unusually significant declines.
- **Single-Day ATR Decline:** Detect unusually sharp daily losses relative to typical daily price movements.
- **Multi-Day ATR Decline:** Identify persistent negative returns over several days, adjusted for historical volatility.
- **MACD Momentum:** Detect weakening price momentum and potential bearish trend reversals.
- **Relative Market Performance:** Sell stocks consistently underperforming the S&P 500 over comparable periods.

## Fundamentals & Portfolio
- **Earnings Estimate Revisions:** Increase sell score when analysts reduce expected future company earnings.
- **Opportunity-Based Selling:** Replace weaker holdings when significantly stronger buy opportunities become available.

## Combination Strategies
- **OR Logic:** Sell immediately when any individual indicator crosses its predefined threshold.
- **Binary Voting:** Each triggered indicator contributes one point; sell after enough signals accumulate.
- **Weighted Scoring:** Combine continuous indicator scores, allowing multiple moderate signals to trigger selling.
- **Hybrid Strategy:** Combine mandatory hard exits with a weighted score for softer indicators.

## Optimization
Test indicators individually, then jointly optimize parameters, weights, and thresholds using walk-forward validation. Keep final test data unseen until the strategy is fixed.

