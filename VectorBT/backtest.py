"""
VectorBT simulations of buy signals from data/signals.csv.

Each taken signal opens one $5K long per ticker. If a ticker already has an
open position, later signals for that ticker are skipped (no add-on buy) but
still extend the exit rules below.

1. Sell 30 trading days after the last signal received while still held.
2. Same 30-day rule, or sell earlier when close reaches 75% of the analyst
   projected upside. A new signal while held resets the projection target and
   adds another 30 days.
"""

from pathlib import Path

import numpy as np
import pandas as pd
import vectorbt as vbt

ROOT = Path(__file__).resolve().parents[1]
SIGNALS_CSV = ROOT / "data/signals.csv"

POSITION_VALUE = 5_000.0
HOLD_AFTER_LAST_DAYS = 30
TARGET_FRACTION = 0.75


def download_close(symbols, start, end):
    single = isinstance(symbols, str)
    names = [symbols] if single else list(symbols)
    label = names[0] if single else f"{len(names)} symbols"
    print(f"Downloading {label} daily close prices {start} → {end or 'today'} …")
    frames = {}
    for symbol in names:
        try:
            series = vbt.YFData.download(symbol, start=start, end=end).get("Close").dropna()
        except Exception as exc:
            print(f"  skip {symbol}: {exc}")
            continue
        if series.empty:
            print(f"  skip {symbol}: no data")
            continue
        if series.index.tz is not None:
            series = series.tz_localize(None)
        frames[symbol] = series
    if not frames:
        raise RuntimeError("No price data downloaded")
    close = pd.concat(frames, axis=1).sort_index()
    if single:
        close = close.iloc[:, 0]
        print(f"  {len(close)} trading days loaded.\n")
        return close
    print(f"  {len(close)} trading days, {close.shape[1]} symbols loaded.\n")
    return close


def as_float(value):
    arr = np.asarray(value, dtype=float).reshape(-1)
    return float(arr[0] if arr.size == 1 else arr.sum())


def as_series(value):
    if isinstance(value, pd.DataFrame):
        return value.sum(axis=1)
    if isinstance(value, pd.Series):
        return value
    return pd.Series(np.asarray(value, dtype=float).reshape(-1))


def open_lots_series(portfolio, index):
    try:
        assets = portfolio.assets(group_by=False)
    except TypeError:
        assets = portfolio.assets()
    if isinstance(assets, pd.DataFrame):
        lots = (assets > 1e-8).sum(axis=1)
        lots.index = index
        return lots.astype(int)
    return pd.Series(np.where(np.asarray(assets, dtype=float).reshape(-1) > 1e-8, 1, 0), index=index)


def exposure_stats(portfolio, init_cash):
    """Capital at work vs allocated cash. Exposure is market value / starting cash."""
    asset_value = as_series(portfolio.asset_value())
    cash = as_series(portfolio.cash())
    nav = as_series(portfolio.value())
    index = asset_value.index
    open_lots = open_lots_series(portfolio, index)
    cost_deployed = open_lots.astype(float) * POSITION_VALUE
    pnl = as_float(portfolio.final_value()) - init_cash
    avg_market = float(asset_value.mean())
    avg_cost = float(cost_deployed.mean())
    max_market = float(asset_value.max())
    max_cost = float(cost_deployed.max())
    end_market = float(asset_value.iloc[-1])
    end_cost = float(cost_deployed.iloc[-1])
    avg_cash = float(cash.mean())
    min_cash = float(cash.min())
    days_invested = int((open_lots > 0).sum())
    n_days = int(len(index))
    total_bought = POSITION_VALUE * as_float(portfolio.trades.count())

    return {
        "init_cash": init_cash,
        "end_value": as_float(portfolio.final_value()),
        "pnl": pnl,
        "return_on_cash_pct": pnl / init_cash * 100,
        "return_on_avg_market_pct": pnl / avg_market * 100 if avg_market else 0.0,
        "return_on_avg_cost_pct": pnl / avg_cost * 100 if avg_cost else 0.0,
        "return_on_peak_market_pct": pnl / max_market * 100 if max_market else 0.0,
        "avg_market": avg_market,
        "max_market": max_market,
        "end_market": end_market,
        "avg_cost": avg_cost,
        "max_cost": max_cost,
        "end_cost": end_cost,
        "avg_exposure_pct": avg_market / init_cash * 100,
        "max_exposure_pct": max_market / init_cash * 100,
        "end_exposure_pct": end_market / init_cash * 100,
        "avg_cost_exposure_pct": avg_cost / init_cash * 100,
        "max_cost_exposure_pct": max_cost / init_cash * 100,
        "end_cost_exposure_pct": end_cost / init_cash * 100,
        "avg_cash": avg_cash,
        "min_cash": min_cash,
        "avg_idle_pct": avg_cash / init_cash * 100,
        "avg_open_lots": float(open_lots.mean()),
        "max_open_lots": int(open_lots.max()),
        "end_open_lots": int(open_lots.iloc[-1]),
        "days_invested": days_invested,
        "n_days": n_days,
        "total_bought": total_bought,
        "asset_value": asset_value,
        "cost_deployed": cost_deployed,
        "cash": cash,
        "nav": nav,
        "open_lots": open_lots,
    }


def print_results(name, portfolio, init_cash):
    stats = exposure_stats(portfolio, init_cash)
    n_trades = int(round(as_float(portfolio.trades.count())))
    n_closed = int(round(as_float(portfolio.trades.closed.count()))) if n_trades else 0
    win_rate = as_float(portfolio.trades.win_rate()) * 100 if n_trades else 0.0
    max_dd = as_float(portfolio.max_drawdown()) * 100
    print("=" * 40)
    print(name)
    print(f"Starting cash     : ${stats['init_cash']:>12,.2f}")
    print(f"Ending value      : ${stats['end_value']:>12,.2f}")
    print(f"Total P&L         : ${stats['pnl']:>+12,.2f}")
    print(f"Return on cash    :  {stats['return_on_cash_pct']:>+11.2f} %")
    print(f"Return on avg exp.:  {stats['return_on_avg_market_pct']:>+11.2f} %")
    print(f"Win rate          :  {win_rate:>11.2f} %")
    print(f"Max drawdown      :  {max_dd:>11.2f} %")
    print(f"Trades            :  {n_trades} ({n_closed} closed, {n_trades - n_closed} open)")
    print("-" * 40)
    print(f"Bought (cost)     : ${stats['total_bought']:>12,.2f}")
    print(f"Avg invested      : ${stats['avg_cost']:>12,.2f}  ({stats['avg_cost_exposure_pct']:5.1f}% of cash)")
    print(f"Peak invested     : ${stats['max_cost']:>12,.2f}  ({stats['max_cost_exposure_pct']:5.1f}% of cash)")
    print(f"End invested      : ${stats['end_cost']:>12,.2f}  ({stats['end_cost_exposure_pct']:5.1f}% of cash)")
    print(f"Avg market exp.   : ${stats['avg_market']:>12,.2f}  ({stats['avg_exposure_pct']:5.1f}% of cash)")
    print(f"Peak market exp.  : ${stats['max_market']:>12,.2f}  ({stats['max_exposure_pct']:5.1f}% of cash)")
    print(f"Avg idle cash     : ${stats['avg_cash']:>12,.2f}  ({stats['avg_idle_pct']:5.1f}% of cash)")
    print(f"Open lots avg/max :  {stats['avg_open_lots']:5.1f} / {stats['max_open_lots']}")
    print("=" * 40)
    print()
    return stats


def print_trades(portfolio):
    trades = portfolio.trades.records_readable
    if trades.empty:
        print("No trades.\n")
        return
    columns = [
        col
        for col in (
            "Column",
            "Entry Timestamp",
            "Exit Timestamp",
            "Avg Entry Price",
            "Avg Exit Price",
            "Size",
            "PnL",
            "Return",
            "Status",
        )
        if col in trades.columns
    ]
    view = trades[columns].copy()
    if "Return" in view.columns:
        view["Return"] = view["Return"] * 100
    print(view.to_string(index=False))
    print()


def simulate(name, close, entries, exits, init_cash):
    print(f"Running {name} …")
    portfolio = vbt.Portfolio.from_signals(
        close=close,
        entries=entries,
        exits=exits,
        init_cash=init_cash,
        fees=0.0,
        freq="1D",
        size=POSITION_VALUE,
        size_type="value",
        cash_sharing=True,
        group_by=True,
        allow_partial=False,
    )
    print_results(name, portfolio, init_cash)
    print_trades(portfolio)
    return portfolio


def bar_dates(index):
    idx = index.tz_localize(None) if getattr(index, "tz", None) is not None else index
    return pd.DatetimeIndex(pd.to_datetime(idx).normalize())


def load_signals(path=SIGNALS_CSV):
    signals = pd.read_csv(path, parse_dates=["date"])
    if signals.empty:
        raise RuntimeError(f"No signals in {path}")
    return signals.sort_values(["date", "signal_score"], ascending=[True, False]).reset_index(
        drop=True
    )


def unique_tickers(signals):
    return signals["ticker"].drop_duplicates().tolist()


def _signal_events(close, signals, ticker):
    """Return (bar_loc, average_projected) for one ticker, sorted by date."""
    dates = bar_dates(close.index)
    events = []
    for row in signals.loc[signals["ticker"] == ticker].itertuples(index=False):
        loc = dates.get_indexer([pd.Timestamp(row.date)], method="bfill")[0]
        if loc >= 0:
            events.append((int(loc), float(row.average_projected)))
    return sorted(events, key=lambda item: item[0])


def build_entries_exits(close, signals, hold_days, use_target=False, target_frac=TARGET_FRACTION):
    """One column per ticker. Skip buys when already in; repeat signals extend exits."""
    tickers = [t for t in unique_tickers(signals) if t in close.columns]
    if not tickers:
        raise RuntimeError("No signals aligned to price data")

    close_wide = close[tickers].copy()
    entries = pd.DataFrame(False, index=close_wide.index, columns=tickers)
    exits = pd.DataFrame(False, index=close_wide.index, columns=tickers)
    n_signals = 0
    n_skipped = 0
    n_buys = 0

    for col, ticker in enumerate(tickers):
        prices = close_wide[ticker].to_numpy()
        signal_map = {}
        for loc, proj in _signal_events(close, signals, ticker):
            signal_map[loc] = proj
            n_signals += 1

        in_position = False
        entry_loc = None
        deadline = None
        target = None
        n = len(prices)

        for t in range(n):
            if t in signal_map:
                proj = signal_map[t]
                if not in_position:
                    entries.iloc[t, col] = True
                    in_position = True
                    entry_loc = t
                    n_buys += 1
                    deadline = t + hold_days
                    if use_target:
                        target = prices[t] * (1.0 + target_frac * proj / 100.0)
                else:
                    n_skipped += 1
                    deadline = t + hold_days
                    if use_target:
                        target = prices[t] * (1.0 + target_frac * proj / 100.0)

            if in_position and t > entry_loc:
                hit_target = use_target and prices[t] >= target
                if t >= deadline or hit_target:
                    exits.iloc[t, col] = True
                    in_position = False
                    entry_loc = None
                    deadline = None
                    target = None

    return close_wide, entries, exits, {
        "n_signals": n_signals,
        "n_buys": n_buys,
        "n_skipped": n_skipped,
    }


def run_strategies():
    signals = load_signals()
    close = download_close(unique_tickers(signals), signals["date"].min(), None)
    init_cash = POSITION_VALUE * close.shape[1]
    print(f"{len(signals)} signals in file, max {close.shape[1]} tickers × ${POSITION_VALUE:,.0f}\n")
    return (
        _run_one(
            "1. Sell 30d after last signal",
            close,
            signals,
            init_cash,
            use_target=False,
        ),
        _run_one(
            "2. Sell 30d after last signal or 75% of projection",
            close,
            signals,
            init_cash,
            use_target=True,
        ),
    )


def _run_one(name, close, signals, init_cash, use_target):
    close_wide, entries, exits, stats = build_entries_exits(
        close,
        signals,
        HOLD_AFTER_LAST_DAYS,
        use_target=use_target,
    )
    print(
        f"{stats['n_buys']} buys, {stats['n_skipped']} skipped (already in position), "
        f"${init_cash:,.0f} starting cash\n"
    )
    return simulate(name, close_wide, entries, exits, init_cash)


if __name__ == "__main__":
    run_strategies()
