"""Count lots in one simulation cell and attach the signal that opened them.

Each row of the positions CSV is one $5,000 lot. Rows that repeat the same
ticker, start date, end date, and return are the lots of that trade. The
analyst count and target percent come from the yahoo-daily signal on that
buy. A weekend signal is the one dated on or just before the start date.

    ./penv python VectorBT/lot_counts.py \
      VectorBT/simulation_2026-10-27_1536_UTC+2_yahoo-cash-strength__optimize.csv \
      --sell "7.5dd 10pp · 8 lots · ls · str" \
      --buy "yahoo-daily · analyst>2 · proj>10%"
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SIGNALS = ROOT / "data" / "signals.csv"


def parse_buy(buy):
    name = buy.split(" · ", 1)[0]
    analysts = re.search(r"analyst>(\d+)", buy)
    projected = re.search(r"proj>(\d+(?:\.\d+)?)", buy)
    if analysts is None or projected is None:
        raise SystemExit(f"buy label needs analyst>N and proj>N: {buy!r}")
    return name, int(analysts.group(1)), float(projected.group(1))


def attach_signals(picked, buy, signals_path):
    name, min_analysts, min_projected = parse_buy(buy)
    signals = pd.read_csv(signals_path)
    signals = signals[signals["signal_name"] == name]
    signals = signals[
        (signals["analyst_projections_count"] > min_analysts)
        & (signals["average_projected"] > min_projected)
    ][
        ["date", "ticker", "analyst_projections_count", "average_projected"]
    ].copy()
    signals["date"] = pd.to_datetime(signals["date"])
    signals = signals.sort_values("date")
    picked = picked.copy()
    picked["date_buy"] = pd.to_datetime(picked["date_buy"])
    picked = picked.sort_values("date_buy")
    joined = pd.merge_asof(
        picked,
        signals,
        left_on="date_buy",
        right_on="date",
        by="ticker",
        direction="backward",
    )
    gap = (joined["date_buy"] - joined["date"]).dt.days
    missing = joined["analyst_projections_count"].isna() | (gap > 4)
    if missing.any():
        sample = joined.loc[missing, ["ticker", "date_buy"]].head(5)
        raise SystemExit(f"no signal within 4 days of the buy\n{sample}")
    return joined


def lot_counts(path, sell, buy, signals_path=SIGNALS):
    frame = pd.read_csv(path)
    picked = frame[(frame["sell"] == sell) & (frame["buy"] == buy)].copy()
    if picked.empty:
        raise SystemExit(f"no lots for sell {sell!r} buy {buy!r}")
    picked = attach_signals(picked, buy, signals_path)
    grouped = (
        picked.groupby(
            ["ticker", "date_buy", "date_sell", "return_pct"], as_index=False
        )
        .agg(
            lots=("ticker", "size"),
            analysts=("analyst_projections_count", "first"),
            target_pct=("average_projected", "first"),
            pnl=("pnl", "sum"),
        )
        .rename(columns={"date_buy": "start_date", "date_sell": "end_date"})
        .sort_values(["start_date", "end_date", "ticker"])
    )
    grouped["start_date"] = pd.to_datetime(grouped["start_date"]).dt.strftime("%Y-%m-%d")
    grouped["end_date"] = pd.to_datetime(grouped["end_date"]).dt.strftime("%Y-%m-%d")
    grouped["lots"] = grouped["lots"].astype(int)
    grouped["analysts"] = grouped["analysts"].astype(int)
    grouped["return_pct"] = grouped["return_pct"].map(lambda value: f"{value:.2f}")
    grouped["target_pct"] = grouped["target_pct"].map(lambda value: f"{value:.2f}")
    grouped["pnl"] = grouped["pnl"].map(lambda value: f"{value:.2f}")
    return grouped[
        [
            "ticker",
            "start_date",
            "end_date",
            "return_pct",
            "lots",
            "analysts",
            "target_pct",
            "pnl",
        ]
    ]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("csv", type=Path)
    parser.add_argument("--sell", required=True)
    parser.add_argument("--buy", required=True)
    parser.add_argument("--out", type=Path)
    parser.add_argument("--signals", type=Path, default=SIGNALS)
    args = parser.parse_args()
    grouped = lot_counts(args.csv, args.sell, args.buy, args.signals)
    out = args.out
    if out is None:
        out = args.csv.with_name(args.csv.stem + "__lot-counts.csv")
    grouped.to_csv(out, index=False, lineterminator="\n")
    pnl = grouped["pnl"].astype(float).sum()
    print(
        f"Wrote {out} · {len(grouped)} trades · {int(grouped['lots'].sum())} lots · "
        f"P&L ${pnl:,.2f}",
        file=sys.stderr,
    )


if __name__ == "__main__":
    main()
