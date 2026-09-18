"""
VectorBT simulations with shared portfolio machinery.

1. Random SPY — 0.1% buy chance each day, 90-day hold
2. Analyst 7d consensus — daily top score from
   data/google_analyst_recomendation/all_symbols_per_date_and_symbol_7d_aggregation_window.csv
   score = average_projected * sqrt(analyst_projections_count)
   20% of starting capital per position, 90-day hold
"""

from pathlib import Path

import numpy as np
import pandas as pd
import vectorbt as vbt

ROOT = Path(__file__).resolve().parents[1]
ANALYST_CSV = (
    ROOT
    / "data/google_analyst_recomendation"
    / "all_symbols_per_date_and_symbol_7d_aggregation_window.csv"
)

INIT_CASH = 100_000.0
HOLD_DAYS = 90
BUY_PROB = 0.001
SEED = 42
SPY_START = "2010-01-01"
SPY_END = "2023-12-31"
ANALYST_TOP_N = 1


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


def exits_after_hold(entries, hold_days=HOLD_DAYS):
    return entries.shift(hold_days, fill_value=False)


def as_float(value):
    arr = np.asarray(value, dtype=float).reshape(-1)
    return float(arr[0] if arr.size == 1 else arr.sum())


def print_results(name, portfolio):
    start_value = INIT_CASH
    end_value = as_float(portfolio.final_value())
    pnl = end_value - start_value
    total_return = (pnl / start_value) * 100
    n_trades = int(round(as_float(portfolio.trades.count())))
    print("=" * 40)
    print(name)
    print(f"Starting value  : ${start_value:>12,.2f}")
    print(f"Ending value    : ${end_value:>12,.2f}")
    print(f"Total P&L       : ${pnl:>+12,.2f}")
    print(f"Total return    :  {total_return:>+11.2f} %")
    print(f"Completed trades:  {n_trades}")
    print("=" * 40)
    print()


def simulate(name, close, entries, **kwargs):
    print(f"Running {name} …")
    portfolio = vbt.Portfolio.from_signals(
        close=close,
        entries=entries,
        exits=exits_after_hold(entries),
        init_cash=INIT_CASH,
        fees=0.0,
        freq="1D",
        **kwargs,
    )
    print_results(name, portfolio)
    return portfolio


def random_entries(close):
    rng = np.random.default_rng(SEED)
    return pd.Series(rng.random(len(close)) < BUY_PROB, index=close.index)


def consensus_picks(recs, top_n=ANALYST_TOP_N):
    recs = recs.copy()
    recs["score"] = recs["average_projected"] * np.sqrt(recs["analyst_projections_count"])
    return recs.sort_values("score", ascending=False).groupby("date", as_index=False).head(top_n)


def bar_dates(index):
    idx = index.tz_localize(None) if getattr(index, "tz", None) is not None else index
    return pd.DatetimeIndex(pd.to_datetime(idx).normalize())


def entries_from_picks(close, picks):
    columns = close.columns if isinstance(close, pd.DataFrame) else [close.name]
    entries = pd.DataFrame(False, index=close.index, columns=columns)
    dates = bar_dates(close.index)
    for date, symbol in zip(picks["date"], picks["symbol"]):
        if symbol not in entries.columns:
            continue
        loc = dates.get_indexer([pd.Timestamp(date)], method="bfill")[0]
        if loc >= 0:
            entries.iat[loc, entries.columns.get_loc(symbol)] = True
    if isinstance(close, pd.Series):
        return entries.iloc[:, 0]
    return entries.reindex(index=close.index, columns=close.columns, fill_value=False)


def run_random_spy():
    close = download_close("SPY", SPY_START, SPY_END)
    return simulate("Random SPY", close, random_entries(close))


def run_analyst_7d():
    recs = pd.read_csv(ANALYST_CSV)
    picks = consensus_picks(recs)
    symbols = picks["symbol"].drop_duplicates().tolist()
    close = download_close(symbols, picks["date"].min(), None)
    entries = entries_from_picks(close, picks)
    return simulate(
        "Analyst 7d consensus",
        close,
        entries,
        size=INIT_CASH * 0.2,
        size_type="value",
        cash_sharing=True,
        group_by=True,
    )


SIMULATIONS = (
    run_random_spy,
    run_analyst_7d,
)


if __name__ == "__main__":
    for run in SIMULATIONS:
        run()
