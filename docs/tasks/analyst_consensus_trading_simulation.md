# Analyst Consensus Trading Simulation

- **Goal**
  - Build a buy indicator based on analysts' Price Target forecasts.
  - Find stocks with strong consensus for significant upside.
  - Generate a small number of high-quality alerts, e.g. 2–4 per week.
  - Compare performance against the S&P 500 over the same period.

- **Data source**
  - Finnhub or FMP.
  - For each forecast, store:
    - Stock.
    - Analyst.
    - Forecast date.
    - Target price.
    - Stock price at the time of the forecast.

- **Building the indicator**
  - Calculate Upside for each analyst:
    - `(Target Price / Current Price) - 1`
  - Combine:
    - Upside magnitude.
    - Number of analysts.
    - Agreement / dispersion among analysts.
  - Possible initial formula:
    - `Consensus Score = Upside Signal × √(Number of Analysts)`
  - Test variations rather than assuming one formula is correct.

- **Comparing stocks**
  - Rank all stocks each day.
  - Focus especially on Top 1 / Top 3.
  - Measure how exceptional each stock is relative to that day's mean/distribution.
  - Daily normalization allows a Threshold to be compared across different days.

- **Threshold**
  - Don't choose it based only on maximum return.
  - Also account for the desired number of alerts.
  - Example:
    - Threshold 5 → 30 alerts/week → too many.
    - Threshold 10 → 3 alerts/week → suitable.
  - Generate roughly twice as many candidates as desired actual trades, leaving a final human decision.

- **Analyst quality weighting — advanced stage**
  - Test whether analysts with stronger historical performance should receive higher weights.
  - Separate Training/Test data to prevent Data Leakage.
  - Example:
    - First half → calculate analyst quality.
    - Second half → test using frozen weights.
  - Later, test Walk-Forward, where every decision uses only information available up to that date.

- **Preventing Overfitting**
  - Start with only 2–3 formulas.
  - Don't let the Agent try thousands of formulas and select the winner afterward.
  - Keep Training and Test periods separate.
  - Change one variable at a time.
  - Add complexity only if a simple model works Out-of-sample.

- **Initial exit strategy**
  - Don't try to simulate the future manual selling process yet.
  - Test fixed exits:
    - 30 days.
    - 60 days.
    - 90 days.
    - 180 days.
  - First determine whether the buy signal itself generates Alpha before optimizing exits.

- **Simple portfolio simulation**
  - Start with 100% cash.
  - Maximum 5 positions.
  - Each purchase = 20% of the portfolio.
  - If 5 positions are already open → don't open another.
  - Don't optimize position sizing initially.

- **Metrics**
  - Return versus S&P 500 over the same period.
  - Alpha.
  - Win rate.
  - Maximum Drawdown.
  - Number of trades.
  - Number of alerts per week.
  - Performance after 30/60/90/180 days.

- **Tools**
  - **VectorBT** — preferred choice.
    - Python/code-first.
    - Good for many simulations and parameter combinations.
    - Well suited to automation with Cursor/Claude Agent.
  - **Backtrader** — good alternative, especially for more detailed trading simulation.

- **AI Agent workflow**
  - Agent fetches/prepares data.
  - Runs the predefined formulas.
  - Runs backtests.
  - Varies parameters only within predefined ranges.
  - Compares results against the benchmark.
  - Produces a summary of performance and stability.
  - **Do not** allow the Agent to invent unlimited formulas until it finds one that happened to work.
