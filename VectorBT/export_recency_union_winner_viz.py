"""Daily analytics CSVs + JSON for the recency-union winner cell.

Winner: 2.5dd 15pp · 12 × $26,667 · ls · at · next open
        · 10m_Jan-Oct · yahoo_and_tipranks_any_recency · analyst>2 · proj>40%
"""

from __future__ import annotations

import importlib.util
import json
import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
OUT = Path(__file__).resolve().parent
SIM_PATH = OUT / "optimize.py"
STEM = "simulation_2026-11-07_2300_UTC+2_recency-union-winner-viz"
END = "2026-10-26"

sys.path.insert(0, str(OUT))


def load_sim():
    spec = importlib.util.spec_from_file_location("recency_union_sim", SIM_PATH)
    mod = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = mod
    spec.loader.exec_module(mod)
    return mod


def strength_percentile_bucket(strengths: list[float]) -> dict[str, int]:
    """Assign each strength to P0–25, P25–50, P50–75, P75–100 among today's open set."""
    labels = ("P0–25", "P25–50", "P50–75", "P75–100")
    counts = {label: 0 for label in labels}
    if not strengths:
        return counts
    arr = np.asarray(strengths, dtype=float)
    if len(arr) == 1:
        counts["P50–75"] = 1
        return counts
    qs = np.percentile(arr, [25, 50, 75])
    for value in arr:
        if value <= qs[0]:
            counts["P0–25"] += 1
        elif value <= qs[1]:
            counts["P25–50"] += 1
        elif value <= qs[2]:
            counts["P50–75"] += 1
        else:
            counts["P75–100"] += 1
    return counts


def main():
    sim = load_sim()
    sim.set_signal_names(sim.RECENCY_SIGNAL_NAMES + (sim.UNION_SIGNAL,))

    signals, close, spy = sim.prepare(end=END)
    opens = sim.ensure_opens(
        sim.unique_tickers(signals),
        signals["date"].min(),
        END,
        close.index,
    )

    window = next(w for w in sim.UNION_RANGES if w["label"] == "10m_Jan-Oct")
    price_to = pd.Timestamp(close.index.max()).strftime("%Y-%m-%d")
    buy = {
        "min_analysts": 2,
        "min_projected": 40.0,
        "signal_name": sim.UNION_SIGNAL,
        "range_label": window["label"],
        "date_from": window["start"],
        "date_to": window["end"],
        "price_to": price_to,
    }
    spec = next(
        s
        for s in sim.union_sells()
        if s.short == "2.5dd 15pp · 12 × $26,667 · ls · at · next open"
    )

    bought = sim.apply_buy(signals, buy)
    start, end = sim.combo_price_bounds(buy)
    book_close = close.loc[start:end]
    book_opens = opens.loc[start:end]

    _, positions, _, _ = sim.run_slot_book(
        "winner-viz",
        book_close,
        spy.loc[book_close.index],
        bought,
        slots=spec.slots,
        drawdown=spec.drawdown,
        profit_protect=spec.profit_protect,
        lot_mode=spec.lot_mode,
        cash_sleeve=False,
        lot_amount=spec.lot_amount,
        opens=book_opens,
        entry=spec.fill,
    )

    from backtest import bar_dates

    dates = bar_dates(book_close.index)
    date_str = [d.strftime("%Y-%m-%d") for d in dates]
    n = len(dates)

    # Map buy session → signal-day strength (union qualifiers).
    signal_by_fill = {}
    for row in bought.itertuples(index=False):
        bar = int(sim.next_session_bars(dates, [row.date])[0])
        if bar < 0 or bar >= n:
            continue
        fill_day = date_str[bar]
        key = (str(row.ticker), fill_day)
        strength = sim.position_strength(
            row.analyst_projections_count, row.average_projected
        )
        prev = signal_by_fill.get(key)
        if prev is None or strength > prev:
            signal_by_fill[key] = strength

    # One strength per open position (ticker); lots opened together share a buy key.
    intervals: list[tuple[int, int, str, float]] = []
    parks = {sim.PARK_SPY, sim.PARK_TQQQ}
    for row in positions.itertuples(index=False):
        if row.ticker in parks:
            continue
        buy_i = dates.get_indexer([pd.Timestamp(row.date_buy)], method="bfill")[0]
        sell_i = dates.get_indexer([pd.Timestamp(row.date_sell)], method="bfill")[0]
        if buy_i < 0 or sell_i < 0:
            continue
        strength = signal_by_fill.get((row.ticker, row.date_buy), 0.0)
        intervals.append((buy_i, sell_i, row.ticker, strength))

    daily_positions = []
    for t in range(n):
        by_ticker: dict[str, float] = {}
        for buy_i, sell_i, ticker, strength in intervals:
            if buy_i <= t <= sell_i:
                prev = by_ticker.get(ticker)
                if prev is None or strength > prev:
                    by_ticker[ticker] = strength
        open_strengths = [value for value in by_ticker.values() if value > 0]
        buckets = strength_percentile_bucket(open_strengths)
        daily_positions.append(
            {
                "date": date_str[t],
                "positions": len(by_ticker),
                "pos_p0_25": buckets["P0–25"],
                "pos_p25_50": buckets["P25–50"],
                "pos_p50_75": buckets["P50–75"],
                "pos_p75_100": buckets["P75–100"],
            }
        )

    # Unique 1d recency signals (not union) in the same buy window.
    sig_1d = sim.apply_buy(
        signals,
        {
            "min_analysts": 2,
            "min_projected": 40.0,
            "signal_name": "yahoo_and_tipranks_1d_recency",
            "date_from": window["start"],
            "date_to": window["end"],
        },
    )
    sig_1d["_day"] = pd.to_datetime(sig_1d["date"]).dt.strftime("%Y-%m-%d")
    sig_counts = sig_1d.groupby("_day").size().rename("signals_1d")
    sym_counts = sig_1d.groupby("_day")["ticker"].nunique().rename("symbols_1d")

    pos_df = pd.DataFrame(daily_positions)
    pos_df = pos_df.merge(sig_counts, left_on="date", right_index=True, how="left")
    pos_df = pos_df.merge(sym_counts, left_on="date", right_index=True, how="left")
    pos_df[["signals_1d", "symbols_1d"]] = pos_df[["signals_1d", "symbols_1d"]].fillna(0).astype(int)

    pos_path = OUT / f"{STEM}__positions_signals_daily.csv"
    pos_df.to_csv(pos_path, index=False)

    lots_path = OUT / f"{STEM}__lots.csv"
    positions.to_csv(lots_path, index=False)

    # SPY: most liquid S&P 500 tracker; volume as traded-share proxy.
    import yfinance as yf

    start_s = pd.Timestamp(window["start"]).strftime("%Y-%m-%d")
    end_s = (pd.Timestamp(END) + pd.Timedelta(days=1)).strftime("%Y-%m-%d")
    spy_hist = yf.download("SPY", start=start_s, end=end_s, auto_adjust=True, progress=False)
    if isinstance(spy_hist.columns, pd.MultiIndex):
        spy_hist = spy_hist.droplevel(1, axis=1)
    spy_hist.index = pd.to_datetime(spy_hist.index).normalize()
    spy_hist = spy_hist.reset_index()
    spy_hist.columns = [c if c != "Date" else "date" for c in spy_hist.columns]
    spy_hist["date"] = pd.to_datetime(spy_hist["date"]).dt.strftime("%Y-%m-%d")

    market = spy_hist.merge(
        pos_df[["date", "signals_1d"]], on="date", how="inner"
    )
    if "Volume" in market.columns:
        market = market.rename(columns={"Volume": "spy_volume"})
    else:
        market["spy_volume"] = np.nan
    if "Close" in market.columns:
        market = market.rename(columns={"Close": "spy_close"})

    mkt_path = OUT / f"{STEM}__signals_spy_market.csv"
    market.to_csv(mkt_path, index=False)

    meta = {
        "sell": spec.short,
        "buy": sim.buy_label(buy),
        "signals_union": int(len(bought)),
        "positions_rows": int(len(positions)),
        "date_from": date_str[0],
        "date_to": date_str[-1],
        "notes": [
            "positions = distinct tickers with an open lot that session",
            "strength stacks = same-day percentile buckets of at-strength among open positions",
            "signals_1d = yahoo_and_tipranks_1d_recency · >2 · >40% (unique book, not union)",
        ],
    }
    meta_path = OUT / f"{STEM}__meta.json"
    meta_path.write_text(json.dumps(meta, indent=2))

    print(f"Wrote {pos_path}")
    print(f"Wrote {lots_path}")
    print(f"Wrote {mkt_path}")
    print(f"Wrote {meta_path}")

    canvas_path = (
        Path.home()
        / ".cursor"
        / "projects"
        / "Users-nitzan-dev-sa"
        / "canvases"
        / f"{STEM}.canvas.tsx"
    )
    write_canvas(canvas_path, pos_df, market, meta)
    repo_canvas = OUT / f"{STEM}.canvas.tsx"
    repo_canvas.write_text(canvas_path.read_text())
    print(f"Wrote {canvas_path}")
    print(f"Wrote {repo_canvas}")


def write_canvas(path: Path, pos_df: pd.DataFrame, market: pd.DataFrame, meta: dict):
    cats = [pd.Timestamp(d).strftime("%m-%d") for d in pos_df["date"]]
    vol_m = [round(float(v) / 1e6, 2) for v in market["spy_volume"].fillna(0)]
    spy = [round(float(v), 2) for v in market["spy_close"].fillna(0)]

    def arr(col):
        return json.dumps(pos_df[col].astype(int).tolist())

    sell = meta["sell"].replace("\\", "\\\\").replace('"', '\\"')
    buy = meta["buy"].replace("\\", "\\\\").replace('"', '\\"')
    header = (
        f'Sell: {sell} · Buy: {buy} · Quotes {meta["date_from"]} → {meta["date_to"]} · '
        f'Union qualifiers in sim: {meta["signals_union"]} · Lot rows {meta["positions_rows"]}.'
    )
    data = f"""
const CATS = {json.dumps(cats)};
const P0 = {arr("pos_p0_25")};
const P1 = {arr("pos_p25_50")};
const P2 = {arr("pos_p50_75")};
const P3 = {arr("pos_p75_100")};
const POSITIONS = {arr("positions")};
const SIG1D = {arr("signals_1d")};
const SYM1D = {arr("symbols_1d")};
const SPY = {json.dumps(spy)};
const VOL_M = {json.dumps(vol_m)};
const SIG_MKT = {json.dumps(market["signals_1d"].astype(int).tolist())};
"""
    body = (
        """import {
  BarChart,
  Callout,
  Card,
  CardBody,
  CardHeader,
  Grid,
  H1,
  H3,
  LineChart,
  Stack,
  Text,
} from "cursor/canvas";
"""
        + data
        + "\nconst HEADER = "
        + json.dumps(header)
        + """;

export default function RecencyUnionWinnerViz() {
  return (
    <Stack gap={20}>
      <Stack gap={6}>
        <H1>Recency union winner — daily positions vs 1d signals</H1>
        <Text tone="secondary" size="small">{HEADER}</Text>
      </Stack>

      <Card size="lg">
        <CardHeader trailing="Stacked = open positions by at-strength percentile (same day)">
          Open positions per session (strength stack + signal overlays)
        </CardHeader>
        <CardBody>
          <Grid columns={1} gap={12}>
            <H3>Open positions (count) · strength percentile stack</H3>
            <Text tone="secondary" size="small">
              X-axis: trading session (MM-DD). Stacked columns: open positions by same-day
              at-strength quartile. Lines: 1d recency book only (not union).
            </Text>
            <BarChart
              categories={CATS}
              series={[
                { name: "Strength P0–25", data: P0, tone: "neutral" },
                { name: "Strength P25–50", data: P1, tone: "info" },
                { name: "Strength P50–75", data: P2, tone: "warning" },
                { name: "Strength P75–100", data: P3, tone: "success" },
              ]}
              stacked
              height={280}
              beginAtZero
            />
            <H3>1d recency signals vs open positions (lines)</H3>
            <LineChart
              categories={CATS}
              series={[
                {
                  name: "Signals (yahoo_and_tipranks_1d_recency · >2 · >40%)",
                  data: SIG1D,
                  tone: "info",
                },
                { name: "Distinct symbols with 1d signal", data: SYM1D, tone: "success" },
                { name: "Open positions (union book)", data: POSITIONS, tone: "warning" },
              ]}
              height={220}
              beginAtZero
            />
          </Grid>
        </CardBody>
      </Card>

      <Card size="lg">
        <CardHeader trailing="SPY = S&P 500 ETF (liquidity proxy)">
          1d signal count vs SPY price and share volume
        </CardHeader>
        <CardBody>
          <Grid columns={1} gap={12}>
            <H3>Daily 1d recency signals (columns)</H3>
            <BarChart
              categories={CATS.slice(0, SIG_MKT.length)}
              series={[{ name: "1d signals", data: SIG_MKT, tone: "info" }]}
              height={200}
              beginAtZero
            />
            <H3>SPY close ($) and volume (millions of shares)</H3>
            <LineChart
              categories={CATS.slice(0, SPY.length)}
              series={[
                { name: "SPY close ($)", data: SPY, tone: "success" },
                { name: "SPY volume (M shares)", data: VOL_M, tone: "neutral" },
              ]}
              height={220}
              beginAtZero={false}
            />
          </Grid>
        </CardBody>
      </Card>

      <Callout tone="info" title="CSV exports">
        VectorBT/"""
        + STEM
        + """__positions_signals_daily.csv · __signals_spy_market.csv · __lots.csv
      </Callout>
    </Stack>
  );
}
"""
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(body)


if __name__ == "__main__":
    main()
