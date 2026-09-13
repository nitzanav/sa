"""
Minimal VectorBT backtest.

Strategy:
- Stock: SPY (S&P 500 ETF) — always available via yfinance
- Random buy signal: 0.1% probability each trading day
- Hold each position for exactly 90 trading days, then sell
- Starting capital: $100,000
"""

import numpy as np
import pandas as pd
import vectorbt as vbt

# ── Settings ──────────────────────────────────────────────────────────────────
SYMBOL       = "SPY"
START        = "2010-01-01"
END          = "2023-12-31"
INIT_CASH    = 100_000.0
BUY_PROB     = 0.001          # 0.1 % chance of a buy on any given day
HOLD_DAYS    = 90             # hold period in trading days
SEED         = 42

# ── 1. Download price data ────────────────────────────────────────────────────
print(f"Downloading {SYMBOL} daily close prices {START} → {END} …")
price = vbt.YFData.download(SYMBOL, start=START, end=END).get("Close")
price = price.dropna()
n = len(price)
print(f"  {n} trading days loaded.\n")

# ── 2. Build entry / exit signals ─────────────────────────────────────────────
rng = np.random.default_rng(SEED)

entries = pd.Series(False, index=price.index)
exits   = pd.Series(False, index=price.index)

# Mark random buy days; corresponding sell day = buy_day + HOLD_DAYS
for i in range(n):
    if rng.random() < BUY_PROB:
        entries.iloc[i] = True
        sell_idx = i + HOLD_DAYS
        if sell_idx < n:
            exits.iloc[sell_idx] = True

# ── 3. Run portfolio simulation ───────────────────────────────────────────────
print("Running portfolio simulation …")
portfolio = vbt.Portfolio.from_signals(
    close       = price,
    entries     = entries,
    exits       = exits,
    init_cash   = INIT_CASH,
    fees        = 0.0,          # keep it simple — no commissions
    freq        = "1D",
)

# ── 4. Print results ──────────────────────────────────────────────────────────
start_value  = INIT_CASH
end_value    = portfolio.final_value()
pnl          = end_value - start_value
total_return = (pnl / start_value) * 100
n_trades     = portfolio.trades.count()

print("=" * 40)
print(f"Starting value  : ${start_value:>12,.2f}")
print(f"Ending value    : ${end_value:>12,.2f}")
print(f"Total P&L       : ${pnl:>+12,.2f}")
print(f"Total return    :  {total_return:>+11.2f} %")
print(f"Completed trades:  {n_trades}")
print("=" * 40)
