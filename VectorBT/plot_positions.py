"""Plot each lot of analyst>2 · proj>20% with 30d or 50% target or 7.5% dd.

Writes a CSV, a Plotly HTML (one chart per lot, 2025-01-01 → latest close),
and a canvas inspector with buy / peak / sell markers.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))

from backtest import POSITION_VALUE, run_clock, unique_tickers  # noqa: E402
from optimize import (  # noqa: E402
    CACHE_DIR,
    OUT_DIR,
    SellSpec,
    clip_prices,
    download_close_yahoo,
    ensure_prices,
    filter_signals,
    load_signals,
    run_one,
)

CHART_START = pd.Timestamp("2025-01-01")
SPEC = SellSpec(hold_days=30, target_frac=0.50, drawdown=0.075)
BUY = {"min_analysts": 2, "min_projected": 20.0}
CANVAS_PATH = Path(
    "/Users/nitzan/.cursor/projects/Users-nitzan-dev-sa/canvases"
)


def bar_days(index):
    naive = index.tz_localize(None) if getattr(index, "tz", None) is not None else index
    return pd.DatetimeIndex(pd.to_datetime(naive).normalize())


def loc_on_days(days, ts):
    day = pd.Timestamp(ts).normalize()
    loc = days.get_indexer([day], method="bfill")[0]
    if loc < 0:
        loc = days.get_indexer([day], method="ffill")[0]
    return int(loc)


def money(x):
    return f"+${x:,.0f}" if x >= 0 else f"-${abs(x):,.0f}"


def trace_lots(close_wide, meta, spec: SellSpec):
    n = len(close_wide)
    days = bar_days(close_wide.index)
    hold_days = spec.hold_days
    target_frac = spec.target_frac
    drawdown = spec.drawdown
    lots = []
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
            deadline = entry + hold_days if hold_days is not None else n + 1
            proj = float(row.average_projected)
            if target_frac is not None:
                target = prices[entry] * (1.0 + target_frac * proj / 100.0)
            else:
                target = None
            peak = float(prices[entry])
            peak_loc = entry
            exit_loc = None
            reasons = []
            for t in range(entry + 1, n):
                if t in signal_loc_set:
                    if hold_days is not None:
                        deadline = t + hold_days
                    if target_frac is not None:
                        target = prices[t] * (1.0 + target_frac * loc_to_proj[t] / 100.0)
                px = float(prices[t])
                if px > peak:
                    peak = px
                    peak_loc = t
                time_hit = t >= deadline
                tgt_hit = target is not None and px >= target
                dd_hit = drawdown is not None and px <= peak * (1.0 - drawdown)
                if time_hit or tgt_hit or dd_hit:
                    if time_hit:
                        reasons.append("30d")
                    if tgt_hit:
                        reasons.append("50% target")
                    if dd_hit:
                        reasons.append("7.5% dd")
                    exit_loc = t
                    break
            if exit_loc is None:
                exit_loc = n - 1
                reasons = ["open"]
            lots.append(
                {
                    "column": row.column,
                    "ticker": row.ticker,
                    "entry_loc": entry,
                    "exit_loc": exit_loc,
                    "peak_loc": peak_loc,
                    "date_buy": days[entry].strftime("%Y-%m-%d"),
                    "date_peak": days[peak_loc].strftime("%Y-%m-%d"),
                    "date_sell": days[exit_loc].strftime("%Y-%m-%d"),
                    "price_entry": float(prices[entry]),
                    "price_peak": float(peak),
                    "price_exit": float(prices[exit_loc]),
                    "average_projected": proj,
                    "target_price": None if target is None else float(target),
                    "dd_price": float(peak) * (1.0 - drawdown) if drawdown else None,
                    "exit_reason": " + ".join(reasons),
                    "open": reasons == ["open"],
                }
            )
    return lots


def attach_trade_stats(lots, positions, history):
    pos = positions.copy()
    pos["date_buy"] = pd.to_datetime(pos["date_buy"]).dt.strftime("%Y-%m-%d")
    keyed = {(r["ticker"], r["date_buy"]): r for r in pos.to_dict("records")}
    hist_days = bar_days(history.index)
    out = []
    for i, lot in enumerate(lots):
        row = dict(lot)
        match = keyed.get((lot["ticker"], lot["date_buy"]))
        if match:
            row["pnl"] = float(match["pnl"])
            row["return_pct"] = float(match["return_pct"])
            row["hold_days"] = int(match["hold_days"])
            row["status"] = match["status"]
        else:
            row["pnl"] = (lot["price_exit"] / lot["price_entry"] - 1.0) * POSITION_VALUE
            row["return_pct"] = (lot["price_exit"] / lot["price_entry"] - 1.0) * 100
            row["hold_days"] = lot["exit_loc"] - lot["entry_loc"] + 1
            row["status"] = "Open" if lot["open"] else "Closed"
        series = history[lot["ticker"]] if lot["ticker"] in history.columns else None
        after_max = after_min = None
        if series is not None:
            sell_loc = loc_on_days(hist_days, lot["date_sell"])
            after = series.iloc[sell_loc + 1 :].dropna()
            if len(after):
                after_max = float(after.max())
                after_min = float(after.min())
        row["after_max"] = after_max
        row["after_min"] = after_min
        if after_max is not None:
            row["after_max_pct"] = (after_max / lot["price_exit"] - 1.0) * 100
            row["after_min_pct"] = (after_min / lot["price_exit"] - 1.0) * 100
            row["after_min_vs_peak_pct"] = (after_min / lot["price_peak"] - 1.0) * 100
        else:
            row["after_max_pct"] = None
            row["after_min_pct"] = None
            row["after_min_vs_peak_pct"] = None
        row["id"] = f"{lot['ticker']}_{lot['date_buy']}_{i}"
        out.append(row)
    return out


def attach_signal_context(lots, signals, history):
    sigs = signals.copy()
    sigs["date"] = pd.to_datetime(sigs["date"]).dt.strftime("%Y-%m-%d")
    hist_days = bar_days(history.index)
    by_ticker = {}
    for rec in sigs.to_dict("records"):
        ticker = rec["ticker"]
        day = rec["date"]
        px = None
        if ticker in history.columns:
            loc = loc_on_days(hist_days, day)
            val = history[ticker].iloc[loc]
            if pd.notna(val):
                px = float(val)
        by_ticker.setdefault(ticker, []).append(
            {
                "date": day,
                "analysts": int(rec["analyst_projections_count"]),
                "proj": float(rec["average_projected"]),
                "price": None if px is None else round(px, 4),
            }
        )
    for lot in lots:
        others = by_ticker.get(lot["ticker"], [])
        this = next((s for s in others if s["date"] == lot["date_buy"]), None)
        lot["analysts"] = None if this is None else this["analysts"]
        lot["projection_price"] = lot["price_entry"] * (
            1.0 + float(lot["average_projected"]) / 100.0
        )
        lot["signals"] = others
        series = history[lot["ticker"]] if lot["ticker"] in history.columns else None
        if series is not None:
            last = series.dropna()
            lot["last_date"] = pd.Timestamp(last.index[-1]).strftime("%Y-%m-%d")
            lot["last_price"] = float(last.iloc[-1])
            lot["last_vs_buy_pct"] = (lot["last_price"] / lot["price_entry"] - 1.0) * 100
            lot["last_vs_sell_pct"] = (lot["last_price"] / lot["price_exit"] - 1.0) * 100
        else:
            lot["last_date"] = None
            lot["last_price"] = None
            lot["last_vs_buy_pct"] = None
            lot["last_vs_sell_pct"] = None
    return lots


def ensure_history(tickers, start=CHART_START):
    CACHE_DIR.mkdir(exist_ok=True)
    path = CACHE_DIR / "close_from_2025.pkl"
    cached = pd.read_pickle(path) if path.exists() else pd.DataFrame()
    missing = [t for t in tickers if t not in cached.columns]
    if missing:
        extra = download_close_yahoo(missing, start, pd.Timestamp.today())
        cached = extra if cached.empty else cached.join(extra, how="outer")
        cached = cached.sort_index()
        cached.to_pickle(path)
        print(f"Cached {cached.shape[1]} symbols from {start.date()} → {path}")
    have = [t for t in tickers if t in cached.columns]
    return cached[have]


def write_csv(path, lots):
    cols = [
        "ticker",
        "date_buy",
        "date_peak",
        "date_sell",
        "price_entry",
        "price_peak",
        "price_exit",
        "target_price",
        "dd_price",
        "average_projected",
        "analysts",
        "projection_price",
        "last_date",
        "last_price",
        "last_vs_sell_pct",
        "exit_reason",
        "hold_days",
        "pnl",
        "return_pct",
        "after_max_pct",
        "after_min_pct",
        "after_min_vs_peak_pct",
        "status",
    ]
    pd.DataFrame(lots)[cols].to_csv(path, index=False)
    print(f"Wrote {path} ({len(lots)} rows)")


def write_html(path, lots, history, info):
    import plotly.graph_objects as go

    hist_days = bar_days(history.index)
    dates = [d.strftime("%Y-%m-%d") for d in hist_days]
    figures = []
    for lot in lots:
        ticker = lot["ticker"]
        if ticker not in history.columns:
            continue
        y = [None if pd.isna(v) else round(float(v), 4) for v in history[ticker].tolist()]
        fig = go.Figure()
        fig.add_trace(
            go.Scatter(
                x=dates,
                y=y,
                name="Close",
                mode="lines",
                line=dict(width=1.4, color="#4C8DDE"),
            )
        )
        fig.add_vrect(
            x0=lot["date_buy"],
            x1=lot["date_sell"],
            fillcolor="#4C8DDE",
            opacity=0.08,
            line_width=0,
        )
        fig.add_trace(
            go.Scatter(
                x=[lot["date_buy"]],
                y=[lot["price_entry"]],
                name="Buy",
                mode="markers",
                marker=dict(size=12, color="#1F8A65", symbol="triangle-up"),
                hovertemplate=(
                    f"Buy {lot['date_buy']}<br>"
                    f"{lot['analysts']} analysts · proj {lot['average_projected']:+.1f}%"
                    "<extra></extra>"
                ),
            )
        )
        extras = [
            s
            for s in lot.get("signals") or []
            if s["date"] != lot["date_buy"] and s["price"] is not None
        ]
        if extras:
            fig.add_trace(
                go.Scatter(
                    x=[s["date"] for s in extras],
                    y=[s["price"] for s in extras],
                    name="Other signal",
                    mode="markers",
                    marker=dict(
                        size=10,
                        color="#1F8A65",
                        symbol="triangle-up-open",
                        line=dict(width=1.5, color="#1F8A65"),
                    ),
                    text=[
                        f"{s['analysts']} analysts · proj {s['proj']:+.1f}%"
                        for s in extras
                    ],
                    hovertemplate="Other signal %{x}<br>%{text}<extra></extra>",
                )
            )
        fig.add_trace(
            go.Scatter(
                x=[lot["date_peak"]],
                y=[lot["price_peak"]],
                name="Peak",
                mode="markers",
                marker=dict(size=11, color="#E8C030", symbol="diamond"),
            )
        )
        fig.add_trace(
            go.Scatter(
                x=[lot["date_sell"]],
                y=[lot["price_exit"]],
                name="Sell" if not lot["open"] else "Open",
                mode="markers",
                marker=dict(
                    size=12,
                    color="#C04848" if not lot["open"] else "#8888A8",
                    symbol="triangle-down",
                ),
            )
        )
        if lot.get("last_price") is not None:
            fig.add_trace(
                go.Scatter(
                    x=[lot["last_date"]],
                    y=[lot["last_price"]],
                    name="Last",
                    mode="markers",
                    marker=dict(size=11, color="#5A6CC0", symbol="square"),
                    hovertemplate=(
                        f"Last {lot['last_date']}<br>${lot['last_price']:.2f}"
                        f" · vs sell {lot['last_vs_sell_pct']:+.1f}%"
                        "<extra></extra>"
                    ),
                )
            )
        if lot.get("projection_price"):
            fig.add_hline(
                y=lot["projection_price"],
                line_dash="dash",
                line_color="#7B64B8",
                annotation_text=f"proj {lot['average_projected']:+.0f}%",
                annotation_position="top right",
            )
        if lot["target_price"]:
            fig.add_hline(
                y=lot["target_price"],
                line_dash="dash",
                line_color="#1F8A65",
                annotation_text="50% target",
                annotation_position="top left",
            )
        if lot["dd_price"]:
            fig.add_hline(
                y=lot["dd_price"],
                line_dash="dot",
                line_color="#C04848",
                annotation_text="7.5% dd from peak",
                annotation_position="bottom left",
            )
        after = ""
        if lot["after_max_pct"] is not None:
            vs_peak = (
                ""
                if lot.get("after_min_vs_peak_pct") is None
                else f" / min vs peak {lot['after_min_vs_peak_pct']:+.1f}%"
            )
            after = (
                f" · after sell max {lot['after_max_pct']:+.1f}% / "
                f"min {lot['after_min_pct']:+.1f}% vs sell{vs_peak}"
            )
        last = ""
        if lot.get("last_price") is not None:
            last = (
                f" · last ${lot['last_price']:.2f} {lot['last_date']} "
                f"({lot['last_vs_sell_pct']:+.1f}% vs sell)"
            )
        analysts = (
            f"{lot['analysts']} analysts · proj {lot['average_projected']:+.1f}%  "
            if lot.get("analysts") is not None
            else ""
        )
        fig.update_layout(
            title=(
                f"{ticker}  {analysts}{lot['date_buy']} → {lot['date_sell']}  "
                f"{lot['exit_reason']}  {lot['return_pct']:+.1f}%  "
                f"{money(lot['pnl'])}{after}{last}"
            ),
            height=340,
            margin=dict(l=48, r=24, t=56, b=40),
            legend=dict(orientation="h", y=1.14),
            xaxis_title="Date",
            yaxis_title="Close ($)",
            template="plotly_white",
            hovermode="x unified",
        )
        fig.update_xaxes(range=[dates[0], dates[-1]])
        figures.append(fig.to_html(full_html=False, include_plotlyjs=False))

    index_rows = []
    for lot in lots:
        index_rows.append(
            "<tr>"
            f"<td><a href='#{lot['id']}'>{lot['ticker']}</a></td>"
            f"<td>{lot.get('analysts', '')}</td>"
            f"<td>{lot['average_projected']:+.1f}%</td>"
            f"<td>{lot['date_buy']}</td>"
            f"<td>{lot['date_peak']}</td>"
            f"<td>{lot['date_sell']}</td>"
            f"<td>{lot['exit_reason']}</td>"
            f"<td>{lot['return_pct']:+.1f}%</td>"
            f"<td>{money(lot['pnl'])}</td>"
            f"<td>{'' if lot.get('after_max_pct') is None else format(lot['after_max_pct'], '+.1f') + '%'}</td>"
            f"<td>{'' if lot.get('after_min_pct') is None else format(lot['after_min_pct'], '+.1f') + '%'}</td>"
            f"<td>{'' if lot.get('after_min_vs_peak_pct') is None else format(lot['after_min_vs_peak_pct'], '+.1f') + '%'}</td>"
            f"<td>{'' if lot.get('last_price') is None else '$' + format(lot['last_price'], '.2f')}</td>"
            "</tr>"
        )
    blocks = []
    for lot, html in zip(lots, figures):
        blocks.append(f"<section id='{lot['id']}'>{html}</section>")

    page = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<title>{info['title']}</title>
<script src="https://cdn.plot.ly/plotly-2.35.2.min.js"></script>
<style>
  body {{ font-family: ui-sans-serif, system-ui, sans-serif; margin: 24px; color: #111; }}
  h1 {{ font-size: 22px; margin: 0 0 8px; }}
  .meta {{ color: #555; font-size: 13px; margin-bottom: 20px; }}
  table {{ border-collapse: collapse; font-size: 13px; margin-bottom: 28px; }}
  th, td {{ border-bottom: 1px solid #ddd; padding: 4px 10px; text-align: left; }}
  th {{ font-weight: 600; }}
  section {{ margin: 8px 0 28px; }}
  a {{ color: #1a5fb4; }}
</style>
</head>
<body>
<h1>{info['title']}</h1>
<p class="meta">{info['subtitle']}</p>
<table>
<thead><tr><th>Ticker</th><th>Analysts</th><th>Proj</th><th>Buy</th><th>Peak</th><th>Sell</th><th>Exit</th><th>Return</th><th>P&L</th><th>After max</th><th>After min</th><th>Min vs peak</th><th>Last</th></tr></thead>
<tbody>
{''.join(index_rows)}
</tbody>
</table>
{''.join(blocks)}
</body>
</html>
"""
    path.write_text(page)
    print(f"Wrote {path} ({len(figures)} charts)")


def js(value):
    return json.dumps(value, separators=(",", ":"))


def write_canvas(path, lots, history, info):
    hist_days = bar_days(history.index)
    dates = [d.strftime("%Y-%m-%d") for d in hist_days]
    prices = {}
    for col in history.columns:
        prices[col] = [
            None if pd.isna(v) else round(float(v), 4) for v in history[col].tolist()
        ]
    compact = []
    for lot in lots:
        compact.append(
            {
                "id": lot["id"],
                "ticker": lot["ticker"],
                "buy": lot["date_buy"],
                "peak": lot["date_peak"],
                "sell": lot["date_sell"],
                "buyPx": round(lot["price_entry"], 4),
                "peakPx": round(lot["price_peak"], 4),
                "sellPx": round(lot["price_exit"], 4),
                "target": None
                if lot["target_price"] is None
                else round(lot["target_price"], 4),
                "dd": None if lot["dd_price"] is None else round(lot["dd_price"], 4),
                "projPx": round(lot["projection_price"], 4),
                "proj": round(float(lot["average_projected"]), 1),
                "analysts": lot.get("analysts"),
                "last": lot.get("last_date"),
                "lastPx": None
                if lot.get("last_price") is None
                else round(lot["last_price"], 4),
                "lastVsSell": None
                if lot.get("last_vs_sell_pct") is None
                else round(lot["last_vs_sell_pct"], 1),
                "signals": [
                    {
                        "date": s["date"],
                        "analysts": s["analysts"],
                        "proj": round(s["proj"], 1),
                        "price": s["price"],
                    }
                    for s in lot.get("signals") or []
                    if s["date"] != lot["date_buy"]
                ],
                "reason": lot["exit_reason"],
                "ret": round(lot["return_pct"], 2),
                "pnl": round(lot["pnl"], 2),
                "open": bool(lot["open"]),
                "afterMax": None
                if lot["after_max_pct"] is None
                else round(lot["after_max_pct"], 1),
                "afterMin": None
                if lot["after_min_pct"] is None
                else round(lot["after_min_pct"], 1),
                "afterMinVsPeak": None
                if lot.get("after_min_vs_peak_pct") is None
                else round(lot["after_min_vs_peak_pct"], 1),
            }
        )
    n = len(compact)
    wins = sum(1 for r in compact if r["ret"] > 0)
    by_reason = {}
    for r in compact:
        by_reason[r["reason"]] = by_reason.get(r["reason"], 0) + 1
    reason_line = ", ".join(
        f"{k} {v}" for k, v in sorted(by_reason.items(), key=lambda kv: -kv[1])
    )
    options = [
        {
            "value": r["id"],
            "label": (
                f"{r['ticker']}  {r['buy']}  {r['analysts'] if r['analysts'] is not None else '?'}a  "
                f"proj {r['proj']:+.0f}%  {r['ret']:+.1f}%  {r['reason']}"
            ),
        }
        for r in compact
    ]
    table_rows = [
        [
            r["ticker"],
            str(r["analysts"] if r["analysts"] is not None else ""),
            f"{r['proj']:+.1f}%",
            r["buy"],
            r["peak"],
            r["sell"],
            r["reason"],
            f"{r['ret']:+.1f}%",
            money(r["pnl"]),
            "" if r["lastPx"] is None else f"${r['lastPx']:.2f}",
        ]
        for r in compact
    ]
    table_tone = ["success" if r["ret"] > 0 else "danger" for r in compact]
    most = reason_line.split(",")[0] if reason_line else ""
    template = (Path(__file__).resolve().parent / "position_inspector.template.tsx").read_text()
    text = (
        template.replace("@@DATES@@", js(dates))
        .replace("@@PRICES@@", js(prices))
        .replace("@@LOTS@@", js(compact))
        .replace("@@OPTIONS@@", js(options))
        .replace("@@TABLE_ROWS@@", js(table_rows))
        .replace("@@TABLE_TONE@@", js(table_tone))
        .replace("@@SUBTITLE@@", js(info["subtitle"]))
        .replace("@@RANGE@@", js(info["range"]))
        .replace("@@REASON_LINE@@", js(reason_line))
        .replace("@@STAT_N@@", js(str(n)))
        .replace("@@STAT_WIN@@", js(f"{wins / n * 100:.1f}%"))
        .replace("@@STAT_PNL@@", js(money(sum(r["pnl"] for r in compact))))
        .replace("@@STAT_EXIT@@", js(most))
    )
    path.write_text(text)
    print(f"Wrote {path}")


def main():
    stamp, run_label = run_clock()
    signals = filter_signals(load_signals(), BUY["min_analysts"], BUY["min_projected"])
    start = signals["date"].min()
    close, spy = ensure_prices(unique_tickers(signals), start)
    close = clip_prices(close)
    spy = clip_prices(spy)
    spec = SPEC
    label = f"{spec.label} · analyst>{BUY['min_analysts']} · proj>{BUY['min_projected']:.0f}%"
    print(f"Simulating {label} ({len(signals)} signals)")
    row, positions, close_wide, meta, _ = run_one(label, close, spy, signals, spec)
    print(
        f"  {row['n_signals']} lots  {row['return_on_avg_invested_pct']:+.1f}% on invested  "
        f"{row['stock_pnl']:+,.0f} stock P&L"
    )
    lots = trace_lots(close_wide, meta, spec)
    tickers = unique_tickers(signals)
    history = ensure_history(tickers)
    history = history.loc[history.index >= CHART_START]
    lots = attach_trade_stats(lots, positions, history)
    lots = attach_signal_context(lots, signals, history)
    lots.sort(key=lambda r: (r["date_buy"], r["ticker"]))

    prefix = OUT_DIR / f"simulation_{stamp}_a2-p20_30d-t50-dd75"
    csv_path = Path(f"{prefix}_positions.csv")
    html_path = Path(f"{prefix}_positions.html")
    canvas_name = f"simulation_{stamp}_a2-p20_positions.canvas.tsx"
    hist_days = bar_days(history.index)
    info = {
        "title": "analyst>2 · proj>20% · 30d or 50% target or 7.5% dd",
        "subtitle": (
            f"Run {run_label}. Daily close {hist_days[0].date()} → {hist_days[-1].date()}. "
            f"{len(lots)} lots, ${POSITION_VALUE:,.0f} each. Shaded hold. Markers: buy / "
            f"other same-ticker signals / peak-while-held / sell / last close. "
            f"Purple dashed = 100% projection; green dashed = 50% target; dotted = 7.5% dd."
        ),
        "range": f"{hist_days[0].date()} → {hist_days[-1].date()}",
    }
    write_csv(csv_path, lots)
    write_html(html_path, lots, history, info)
    canvas_path = CANVAS_PATH / canvas_name
    write_canvas(canvas_path, lots, history, info)
    repo_canvas = OUT_DIR / canvas_name
    repo_canvas.write_text(canvas_path.read_text())
    print(f"Copied canvas → {repo_canvas}")


if __name__ == "__main__":
    main()
