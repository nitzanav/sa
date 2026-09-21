"""
VectorBT simulations of buy signals from data/signals.csv.

Start 100% in SPY. Each signal is a $5K long funded by selling that much SPY.
Selling a lot buys SPY with the proceeds. The book stays fully invested, so
the headline comparison is portfolio return vs buy-and-hold SPY.

1. Sell 30 trading days after the last signal received while still held.
2. Same 30-day rule, or sell earlier when close reaches 75% of the analyst
   projected upside. A new signal while held resets the projection target and
   adds another 30 days.
"""

import sys
from pathlib import Path

import numpy as np
import pandas as pd
import vectorbt as vbt

ROOT = Path(__file__).resolve().parents[1]
SIGNALS_CSV = ROOT / "data/signals.csv"
OUT_DIR = Path(__file__).resolve().parent

POSITION_VALUE = 5_000.0
HOLD_AFTER_LAST_DAYS = 30
TARGET_FRACTION = 0.75
HOLD_NORM_DAYS = 30
SPY = "SPY"


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


def as_series(value, index):
    if isinstance(value, pd.DataFrame):
        series = value.sum(axis=1)
    elif isinstance(value, pd.Series):
        series = value
    else:
        series = pd.Series(np.asarray(value, dtype=float).reshape(-1))
    series.index = index
    return series


def bar_dates(index):
    idx = index.tz_localize(None) if getattr(index, "tz", None) is not None else index
    return pd.DatetimeIndex(pd.to_datetime(idx).normalize())


def loc_on(index, ts):
    dates = bar_dates(index)
    day = pd.Timestamp(ts)
    if day.tzinfo is not None:
        day = day.tz_localize(None)
    loc = dates.get_indexer([day.normalize()], method="bfill")[0]
    if loc < 0:
        loc = dates.get_indexer([day.normalize()], method="ffill")[0]
    return int(loc)


def aligned_spy(spy, index):
    series = spy.reindex(index)
    if series.isna().any():
        series = series.ffill().bfill()
    return series


def spy_funded_nav(portfolio, spy, init_cash):
    """Start in SPY; sell SPY to buy lots; buy SPY with sale proceeds."""
    index = portfolio.wrapper.index
    spy = aligned_spy(spy, index)
    cash = as_series(portfolio.cash(), index)
    stocks = as_series(portfolio.asset_value(), index)
    flow = cash.diff()
    flow.iloc[0] = float(cash.iloc[0]) - init_cash
    shares = init_cash / float(spy.iloc[0]) + (flow / spy).cumsum()
    spy_value = shares * spy
    return stocks + spy_value, spy_value, stocks


def max_drawdown_pct(nav):
    peak = nav.cummax()
    return float((nav / peak - 1.0).min()) * 100


def positions_frame(portfolio, spy):
    trades = portfolio.trades.records_readable
    columns = [
        "ticker",
        "date_buy",
        "date_sell",
        "price_buy",
        "price_sell",
        "pnl",
        "return_pct",
        "return_pct_30d",
        "spy_pct",
        "vs_spy_pct",
        "hold_days",
        "status",
    ]
    if trades.empty:
        return pd.DataFrame(columns=columns)
    index = portfolio.wrapper.index
    spy = aligned_spy(spy, spy.index)
    rows = []
    for _, rec in trades.iterrows():
        column = str(rec["Column"])
        if column == SPY or column.startswith(f"{SPY}_"):
            continue
        buy = rec["Entry Timestamp"]
        sell = rec["Exit Timestamp"]
        ret = float(rec["Return"]) * 100
        ib = loc_on(index, buy)
        ie = loc_on(index, sell)
        hold_days = max(ie - ib + 1, 1)
        sb = loc_on(spy.index, buy)
        se = loc_on(spy.index, sell)
        spy_ret = float(spy.iloc[se] / spy.iloc[sb] - 1.0) * 100
        rows.append(
            {
                "ticker": column.split("_")[0],
                "date_buy": pd.Timestamp(buy).strftime("%Y-%m-%d"),
                "date_sell": pd.Timestamp(sell).strftime("%Y-%m-%d"),
                "price_buy": float(rec["Avg Entry Price"]),
                "price_sell": float(rec["Avg Exit Price"]),
                "pnl": float(rec["PnL"]),
                "return_pct": ret,
                "return_pct_30d": ret * HOLD_NORM_DAYS / hold_days,
                "spy_pct": spy_ret,
                "vs_spy_pct": ret - spy_ret,
                "hold_days": hold_days,
                "status": rec["Status"] if "Status" in rec else "",
            }
        )
    return pd.DataFrame(rows, columns=columns)


def write_positions_csv(path, positions):
    positions.to_csv(path, index=False)
    print(f"Wrote {path} ({len(positions)} rows)")


def summary_row(name, portfolio, nav, spy, init_cash, n_signals, positions):
    index = portfolio.wrapper.index
    spy = aligned_spy(spy, index)
    stock_pnl = float(positions["pnl"].sum()) if len(positions) else 0.0
    pnl = float(nav.iloc[-1]) - init_cash
    spy_bnh = float(spy.iloc[-1] / spy.iloc[0] - 1.0) * 100
    n_trades = int(round(as_float(portfolio.trades.count())))
    n_closed = int(round(as_float(portfolio.trades.closed.count()))) if n_trades else 0
    try:
        assets = portfolio.assets(group_by=False)
    except TypeError:
        assets = portfolio.assets()
    cost = as_series(assets > 1e-8, index) * POSITION_VALUE
    return {
        "strategy": name,
        "n_signals": n_signals,
        "n_trades": n_trades,
        "n_closed": n_closed,
        "n_open": n_trades - n_closed,
        "stock_pnl": stock_pnl,
        "pnl": pnl,
        "return_pct": pnl / init_cash * 100,
        "spy_pct": spy_bnh,
        "vs_spy_pct": pnl / init_cash * 100 - spy_bnh,
        "avg_stock_invested": float(cost.mean()),
        "win_rate_pct": as_float(portfolio.trades.win_rate()) * 100 if n_trades else 0.0,
        "max_drawdown_pct": max_drawdown_pct(nav),
        "mean_lot_return_pct": float(positions["return_pct"].mean()) if len(positions) else 0.0,
        "mean_vs_spy_pct": float(positions["vs_spy_pct"].mean()) if len(positions) else 0.0,
    }


def simulate(name, close, entries, exits, init_cash, spy, csv_path, n_signals):
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
    nav, _, _ = spy_funded_nav(portfolio, spy, init_cash)
    positions = positions_frame(portfolio, spy)
    write_positions_csv(csv_path, positions)
    row = summary_row(name, portfolio, nav, spy, init_cash, n_signals, positions)
    print(
        f"  stock P&L {row['stock_pnl']:+,.0f}  "
        f"book {row['pnl']:+,.0f} ({row['return_pct']:+.2f}%)  "
        f"SPY {row['spy_pct']:+.2f}%  vs SPY {row['vs_spy_pct']:+.2f}%  "
        f"trades {row['n_trades']} ({row['n_closed']} closed)\n"
    )
    return portfolio, row


def load_signals(path=SIGNALS_CSV):
    signals = pd.read_csv(path, parse_dates=["date"])
    if signals.empty:
        raise RuntimeError(f"No signals in {path}")
    return signals.sort_values(["date", "signal_score"], ascending=[True, False]).reset_index(
        drop=True
    )


def unique_tickers(signals):
    return signals["ticker"].drop_duplicates().tolist()


def signal_positions(close, signals):
    """One column per signal so each $5K lot has its own entry/exit."""
    dates = bar_dates(close.index)
    frames = {}
    rows = []
    close_columns = close.columns if isinstance(close, pd.DataFrame) else [close.name]
    for row in signals.itertuples(index=False):
        ticker = row.ticker
        if ticker not in close_columns:
            continue
        series = close[ticker] if isinstance(close, pd.DataFrame) else close
        loc = dates.get_indexer([pd.Timestamp(row.date)], method="bfill")[0]
        if loc < 0:
            continue
        column = f"{ticker}_{pd.Timestamp(row.date).date()}_{len(rows)}"
        frames[column] = series
        rows.append(
            {
                "column": column,
                "ticker": ticker,
                "entry_loc": loc,
                "average_projected": float(row.average_projected),
            }
        )
    if not frames:
        raise RuntimeError("No signals aligned to price data")
    close_wide = pd.DataFrame(frames, index=close.index)
    return close_wide, pd.DataFrame(rows)


def entries_from_meta(close_wide, meta):
    entries = pd.DataFrame(False, index=close_wide.index, columns=close_wide.columns)
    col_index = {name: i for i, name in enumerate(close_wide.columns)}
    for row in meta.itertuples(index=False):
        entries.iat[row.entry_loc, col_index[row.column]] = True
    return entries


def _extend_deadline(signal_locs, entry_loc, hold_days):
    """Push the sell date out hold_days after each signal that arrives while still held."""
    deadline = entry_loc + hold_days
    for loc in signal_locs:
        if loc < entry_loc:
            continue
        if loc <= deadline:
            deadline = loc + hold_days
        else:
            break
    return deadline


def exits_after_last_signal(close_wide, meta, hold_days):
    """Sell each lot hold_days after the last signal received while it was still open."""
    exits = pd.DataFrame(False, index=close_wide.index, columns=close_wide.columns)
    n = len(close_wide)
    col_index = {name: i for i, name in enumerate(close_wide.columns)}
    for _, group in meta.groupby("ticker"):
        locs = sorted(int(loc) for loc in group["entry_loc"])
        for row in group.itertuples(index=False):
            deadline = _extend_deadline(locs, int(row.entry_loc), hold_days)
            if deadline < n:
                exits.iat[deadline, col_index[row.column]] = True
    return exits


def exits_after_last_or_target(close_wide, meta, hold_days, target_frac):
    """Sell on the 30-day last-signal rule, or sooner at 75% of projected upside.

    A new signal for the same ticker, received while the lot is still open,
    resets the target to 75% of that signal's projected move from that day's
    close and pushes the time stop out another hold_days.
    """
    exits = pd.DataFrame(False, index=close_wide.index, columns=close_wide.columns)
    n = len(close_wide)
    col_index = {name: i for i, name in enumerate(close_wide.columns)}

    for _, group in meta.groupby("ticker"):
        group = group.sort_values("entry_loc")
        prices = close_wide[group["column"].iloc[0]].to_numpy()
        signal_locs = [int(loc) for loc in group["entry_loc"]]
        loc_to_proj = {
            int(loc): float(proj)
            for loc, proj in zip(group["entry_loc"], group["average_projected"])
        }
        signal_loc_set = set(signal_locs)

        for row in group.itertuples(index=False):
            entry = int(row.entry_loc)
            deadline = entry + hold_days
            target = prices[entry] * (1.0 + target_frac * float(row.average_projected) / 100.0)
            for t in range(entry + 1, n):
                if t in signal_loc_set:
                    deadline = t + hold_days
                    target = prices[t] * (1.0 + target_frac * loc_to_proj[t] / 100.0)
                if t >= deadline or prices[t] >= target:
                    exits.iat[t, col_index[row.column]] = True
                    break
    return exits


def run_strategies(signals_path=SIGNALS_CSV, end=None):
    signals = load_signals(signals_path)
    start = signals["date"].min()
    close = download_close(unique_tickers(signals), start, end)
    spy = download_close(SPY, start, end)
    close_wide, meta = signal_positions(close, signals)
    entries = entries_from_meta(close_wide, meta)
    init_cash = POSITION_VALUE * len(meta)
    print(f"{len(meta)} signals × ${POSITION_VALUE:,.0f} = ${init_cash:,.0f} starting in SPY\n")
    jobs = (
        (
            "1. Sell 30d after last signal",
            exits_after_last_signal(close_wide, meta, HOLD_AFTER_LAST_DAYS),
            OUT_DIR / "positions_30d_last_signal.csv",
        ),
        (
            "2. Sell 30d after last signal or 75% of projection",
            exits_after_last_or_target(close_wide, meta, HOLD_AFTER_LAST_DAYS, TARGET_FRACTION),
            OUT_DIR / "positions_30d_or_75pct.csv",
        ),
    )
    rows = []
    portfolios = []
    for name, exits, csv_path in jobs:
        pf, row = simulate(name, close_wide, entries, exits, init_cash, spy, csv_path, len(meta))
        portfolios.append(pf)
        rows.append(row)
    summary = pd.DataFrame(rows)
    summary_path = OUT_DIR / "positions_summary.csv"
    summary.to_csv(summary_path, index=False)
    print(f"Wrote {summary_path}")
    print(summary.to_string(index=False))
    return tuple(portfolios)


if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else SIGNALS_CSV
    end = sys.argv[2] if len(sys.argv) > 2 else None
    run_strategies(path, end)
