"""Sweep sell and buy permutations on data/signals.csv.

Reuse the VectorBT engine in backtest.py. Rank by return on avg invested
(stock P&L / time-average dollars in stocks). Exposure is not optimized.

Phase 1 freezes buy at analyst_count > 3 and average_projected > 20%, then
runs 24 sell specs (drawdown × target fraction × time stop) plus two baselines.

Phase 2 takes the four winning sells and sweeps buy filters.

Phase focus runs a smaller 6×4 grid: analyst >2/>3 × proj >20/25/30%,
against 7.5% dd with/without 30d and with/without a 50% target.
"""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import dataclass
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))

from backtest import (  # noqa: E402
    HOLD_AFTER_LAST_DAYS,
    POSITION_VALUE,
    SIGNALS_CSV,
    SPY,
    TARGET_FRACTION,
    aligned_spy,
    download_close,
    entries_from_meta,
    exits_after_last_or_target,
    exits_after_last_signal,
    load_signals,
    run_clock,
    signal_positions,
    simulate,
    unique_tickers,
)

OUT_DIR = Path(__file__).resolve().parent
ROOT = Path(__file__).resolve().parents[1]
CACHE_DIR = OUT_DIR / ".cache"
PRICE_END = pd.Timestamp("2026-09-18")
FORTUNE_CSV = ROOT / "data" / "fortune_500" / "symbols.csv"
PERCENTILE_CUTS = (0.80, 0.60, 0.40, 0.20, 0.00)


def clip_prices(obj, end=PRICE_END):
    idx = obj.index
    naive = idx.tz_localize(None) if getattr(idx, "tz", None) is not None else idx
    days = pd.DatetimeIndex(pd.to_datetime(naive).normalize())
    mask = days <= pd.Timestamp(end).normalize()
    return obj.loc[mask]


FREEZE_ANALYSTS = 3
FREEZE_PROJECTED = 20.0
DRAWDOWNS = (0.025, 0.05, 0.075, 0.10)
TARGET_FRACS = (0.50, 0.75, 1.00)
HOLD_DAYS = (30, 60)
ANALYST_CUTS = (2, 3, 4, 5, 6)
PROJECTED_CUTS = (10, 20, 30, 40)
WINNERS_N = 4
TWIN_EPS = 0.2


@dataclass(frozen=True)
class SellSpec:
    hold_days: int | None = None
    target_frac: float | None = None
    drawdown: float | None = None
    baseline: bool = False

    @property
    def tag(self) -> str:
        parts = []
        if self.hold_days is not None:
            parts.append(f"{self.hold_days}d")
        if self.target_frac is not None:
            parts.append(f"t{int(round(self.target_frac * 100))}")
        if self.drawdown is not None:
            dd = self.drawdown * 100
            parts.append(f"dd{dd:g}")
        return "-".join(parts) or "hold"

    @property
    def short(self) -> str:
        parts = []
        if self.hold_days is not None:
            parts.append(f"{self.hold_days}d")
        if self.target_frac is not None:
            parts.append(f"{int(round(self.target_frac * 100))}%")
        if self.drawdown is not None:
            parts.append(f"{self.drawdown * 100:g}dd")
        return " ".join(parts) or "hold"

    @property
    def label(self) -> str:
        if self.hold_days == 30 and self.target_frac is None and self.drawdown is None:
            return "30d after last signal"
        if (
            self.hold_days == 30
            and self.target_frac == TARGET_FRACTION
            and self.drawdown is None
        ):
            return "30d or 75% of projection"
        bits = []
        if self.hold_days is not None:
            bits.append(f"{self.hold_days}d")
        if self.target_frac is not None:
            bits.append(f"{int(round(self.target_frac * 100))}% target")
        if self.drawdown is not None:
            bits.append(f"{self.drawdown * 100:g}% dd")
        return " or ".join(bits)


WINNING_SELL = SellSpec(hold_days=30, target_frac=0.50, drawdown=0.075)


def freeze_buy_filter():
    return {"min_analysts": FREEZE_ANALYSTS, "min_projected": FREEZE_PROJECTED}


def sell_grid():
    specs = [
        SellSpec(hold_days=HOLD_AFTER_LAST_DAYS, baseline=True),
        SellSpec(
            hold_days=HOLD_AFTER_LAST_DAYS,
            target_frac=TARGET_FRACTION,
            baseline=True,
        ),
    ]
    for drawdown in DRAWDOWNS:
        for target_frac in TARGET_FRACS:
            for hold_days in HOLD_DAYS:
                specs.append(
                    SellSpec(
                        hold_days=hold_days,
                        target_frac=target_frac,
                        drawdown=drawdown,
                    )
                )
    return specs


def buy_grid():
    return [
        {"min_analysts": n, "min_projected": float(p)}
        for n in ANALYST_CUTS
        for p in PROJECTED_CUTS
    ]


def focus_sell_grid():
    return [
        SellSpec(hold_days=30, target_frac=0.50, drawdown=0.075),
        SellSpec(hold_days=30, drawdown=0.075),
        SellSpec(target_frac=0.50, drawdown=0.075),
        SellSpec(drawdown=0.075),
    ]


def focus_buy_grid():
    return [
        {"min_analysts": n, "min_projected": float(p)}
        for n in (2, 3)
        for p in (20, 25, 30)
    ]


def buy_label(filt):
    if filt.get("label"):
        return filt["label"]
    if filt.get("universe") == "fortune_500":
        return "Fortune 500 at start"
    if "min_percentile" in filt:
        return f"signal_percentile > {filt['min_percentile']:.2f}"
    return f"analyst>{filt['min_analysts']} · proj>{filt['min_projected']:.0f}%"


def filter_signals(signals, min_analysts, min_projected):
    out = signals[
        (signals["analyst_projections_count"] > min_analysts)
        & (signals["average_projected"] > min_projected)
    ]
    return out.sort_values(["date", "signal_score"], ascending=[True, False]).reset_index(
        drop=True
    )


def spec_from_row(row):
    hold = row.get("hold_days_spec")
    if hold is None:
        hold = row.get("hold_days")
    return SellSpec(
        hold_days=int(hold) if hold is not None else None,
        target_frac=row.get("target_frac"),
        drawdown=row.get("drawdown"),
        baseline=bool(row.get("baseline", False)),
    )


def exits_from_spec(close_wide, meta, spec: SellSpec):
    """OR of time stop, target fraction of projected upside, trailing drawdown.

    A new signal for the same ticker while the lot is open resets the time
    stop and the projection target. Peak for drawdown is since entry.
    """
    exits = pd.DataFrame(False, index=close_wide.index, columns=close_wide.columns)
    n = len(close_wide)
    col_index = {name: i for i, name in enumerate(close_wide.columns)}
    hold_days = spec.hold_days
    target_frac = spec.target_frac
    drawdown = spec.drawdown

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
            if target_frac is not None:
                target = prices[entry] * (
                    1.0 + target_frac * float(row.average_projected) / 100.0
                )
            else:
                target = None
            peak = float(prices[entry])
            for t in range(entry + 1, n):
                if t in signal_loc_set:
                    if hold_days is not None:
                        deadline = t + hold_days
                    if target_frac is not None:
                        target = prices[t] * (
                            1.0 + target_frac * loc_to_proj[t] / 100.0
                        )
                px = float(prices[t])
                if px > peak:
                    peak = px
                time_hit = t >= deadline
                tgt_hit = target is not None and px >= target
                dd_hit = drawdown is not None and px <= peak * (1.0 - drawdown)
                if time_hit or tgt_hit or dd_hit:
                    exits.iat[t, col_index[row.column]] = True
                    break
    return exits


def verify_exits(close_wide, meta):
    time_only = SellSpec(hold_days=HOLD_AFTER_LAST_DAYS)
    got = exits_from_spec(close_wide, meta, time_only)
    want = exits_after_last_signal(close_wide, meta, HOLD_AFTER_LAST_DAYS)
    if not got.equals(want):
        raise RuntimeError("exits_from_spec(30d) != exits_after_last_signal")
    combo = SellSpec(hold_days=HOLD_AFTER_LAST_DAYS, target_frac=TARGET_FRACTION)
    got = exits_from_spec(close_wide, meta, combo)
    want = exits_after_last_or_target(
        close_wide, meta, HOLD_AFTER_LAST_DAYS, TARGET_FRACTION
    )
    if not got.equals(want):
        raise RuntimeError("exits_from_spec(30d-t75) != exits_after_last_or_target")
    print("Exit builder matches backtest 30d and 30d-or-75%.\n")


def ensure_prices(tickers, start, end=None):
    CACHE_DIR.mkdir(exist_ok=True)
    close_path = CACHE_DIR / "close.pkl"
    spy_path = CACHE_DIR / "spy.pkl"
    close = pd.read_pickle(close_path) if close_path.exists() else pd.DataFrame()
    missing = [t for t in tickers if t not in close.columns]
    if missing:
        extra = download_close(missing, start, end)
        close = extra if close.empty else close.join(extra, how="outer").sort_index()
        close.to_pickle(close_path)
        print(f"Cached {close.shape[1]} symbols → {close_path}")
    if spy_path.exists():
        spy = pd.read_pickle(spy_path)
    else:
        spy = download_close(SPY, start, end)
        spy.to_pickle(spy_path)
        print(f"Cached SPY → {spy_path}")
    return close, spy


def attach_spec(row, spec: SellSpec, buy=None):
    row = dict(row)
    row["tag"] = spec.tag
    row["hold_days_spec"] = spec.hold_days
    row["target_frac"] = spec.target_frac
    row["drawdown"] = spec.drawdown
    row["baseline"] = spec.baseline
    if buy is not None:
        for key in ("min_analysts", "min_projected", "min_percentile", "universe", "family"):
            if key in buy:
                row[key] = buy[key]
        row["buy_label"] = buy.get("label") or buy_label(buy)
    return row


def jsonable(row):
    out = {}
    for key, value in row.items():
        if hasattr(value, "item"):
            value = value.item()
        out[key] = value
    return out


def run_one(label, close, spy, signals, spec: SellSpec, write_csv=None):
    tickers = unique_tickers(signals)
    have = [t for t in tickers if t in close.columns]
    if not have:
        raise RuntimeError(f"No price data for {label}")
    close_wide, meta = signal_positions(close[have], signals)
    entries = entries_from_meta(close_wide, meta)
    exits = exits_from_spec(close_wide, meta, spec)
    init_cash = POSITION_VALUE * len(meta)
    row, positions = simulate(label, close_wide, entries, exits, init_cash, spy, len(meta))
    if write_csv is not None:
        positions.to_csv(write_csv, index=False)
        print(f"Wrote {write_csv} ({len(positions)} rows)")
    return row, positions, close_wide, meta, init_cash


def pick_winners(rows, n=WINNERS_N, twin_eps=TWIN_EPS):
    ranked = sorted(
        [r for r in rows if not r.get("baseline")],
        key=lambda r: (
            r["return_on_avg_invested_pct"],
            r["stock_pnl"],
            r["win_rate_pct"],
        ),
        reverse=True,
    )
    picks = []
    for row in ranked:
        twin = False
        for picked in picks:
            same_family = (
                row.get("hold_days_spec") == picked.get("hold_days_spec")
                and row.get("drawdown") == picked.get("drawdown")
            )
            close_ret = abs(
                row["return_on_avg_invested_pct"] - picked["return_on_avg_invested_pct"]
            )
            if same_family and close_ret < twin_eps:
                twin = True
                break
        if twin:
            continue
        picks.append(row)
        if len(picks) == n:
            break
    return picks


def money(x):
    return f"+${x:,.0f}" if x >= 0 else f"-${abs(x):,.0f}"


def ranked_table(rows, name_key="label"):
    head = (
        "| Rank | Sell | On invested | Stock P&L | Win rate | Trades | "
        "vs SPY | Max DD | Avg invested |"
    )
    sep = "| ---: | --- | ---: | ---: | ---: | --- | ---: | ---: | ---: |"
    lines = [head, sep]
    ordered = sorted(rows, key=lambda r: r["return_on_avg_invested_pct"], reverse=True)
    for i, row in enumerate(ordered, 1):
        mark = " *(baseline)*" if row.get("baseline") else ""
        lines.append(
            "| "
            + " | ".join(
                [
                    str(i),
                    row[name_key] + mark,
                    f"{row['return_on_avg_invested_pct']:+.1f}%",
                    money(row["stock_pnl"]),
                    f"{row['win_rate_pct']:.1f}%",
                    f"{row['n_trades']} ({row['n_closed']}c/{row['n_open']}o)",
                    f"{row['vs_spy_pct']:+.2f}%",
                    f"{row['max_drawdown_pct']:+.2f}%",
                    f"{row['avg_invested_pct']:.1f}%",
                ]
            )
            + " |"
        )
    return "\n".join(lines)


def buy_table(rows):
    head = (
        "| Rank | Buy | n | On invested | Stock P&L | Win rate | "
        "Trades | vs SPY | Max DD |"
    )
    sep = "| ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |"
    lines = [head, sep]
    ordered = sorted(rows, key=lambda r: r["return_on_avg_invested_pct"], reverse=True)
    freeze = freeze_buy_filter()
    for i, row in enumerate(ordered, 1):
        mark = ""
        if (
            row.get("min_analysts") == freeze["min_analysts"]
            and row.get("min_projected") == freeze["min_projected"]
        ):
            mark = " *(freeze)*"
        note = " †" if row["n_signals"] < 10 else ""
        lines.append(
            "| "
            + " | ".join(
                [
                    str(i),
                    row.get("buy_label", row["label"]) + mark + note,
                    str(row["n_signals"]),
                    f"{row['return_on_avg_invested_pct']:+.1f}%",
                    money(row["stock_pnl"]),
                    f"{row['win_rate_pct']:.1f}%",
                    f"{row['n_trades']} ({row['n_closed']}c/{row['n_open']}o)",
                    f"{row['vs_spy_pct']:+.2f}%",
                    f"{row['max_drawdown_pct']:+.2f}%",
                ]
            )
            + " |"
        )
    return "\n".join(lines)


def period_info(close_wide, init_cash, n, run_label, title, csvs=()):
    return {
        "title": title,
        "run": run_label,
        "start": pd.Timestamp(close_wide.index[0]).strftime("%Y-%m-%d"),
        "end": pd.Timestamp(close_wide.index[-1]).strftime("%Y-%m-%d"),
        "cal_days": int(
            (pd.Timestamp(close_wide.index[-1]) - pd.Timestamp(close_wide.index[0])).days
        ),
        "trading_days": len(close_wide),
        "cash": init_cash,
        "n": n,
        "csvs": list(csvs),
    }


def write_summary(path, sell_rows, buy_groups, info, winners, notes):
    freeze = freeze_buy_filter()
    body = [
        f"# {info['title']}",
        "",
        f"**Run:** {info['run']}",
        (
            f"**Period:** {info['start']} → {info['end']} · "
            f"{info['cal_days']} days ({info['trading_days']} trading)"
        ),
        (
            f"Buy freeze: analyst_count > {freeze['min_analysts']} and "
            f"average_projected > {freeze['min_projected']:.0f}% "
            f"({info['n']} signals). ${POSITION_VALUE:,.0f} per lot."
        ),
        (
            "Ranked by **return on avg invested** (stock P&L ÷ time-average $ in stocks). "
            "Exposure is not optimized; book vs SPY is secondary."
        ),
        "",
        "## Sell sweep (buy frozen)",
        "",
        "24 sells = 4 drawdowns × 3 target fractions × 2 time stops, OR-combined. "
        "Baselines: 30d only, and 30d or 75% of projection.",
        "",
        ranked_table(sell_rows),
        "",
        "Winning sells: " + ", ".join(f"**{r['label']}**" for r in winners) + ".",
        "",
    ]
    highlight = [r for r in sell_rows if r.get("baseline")] + winners
    if highlight:
        body += [
            "## Winners vs baselines",
            "",
        ]
        # write_report-style block without rewriting the file
        names = [r["label"] for r in highlight]
        head = "| | " + " | ".join(names) + " |"
        sep = "| --- | " + " | ".join("---:" for _ in names) + " |"

        def line(label, cell):
            return "| " + label + " | " + " | ".join(cell(r) for r in highlight) + " |"

        body += [
            head,
            sep,
            line("Stock P&L", lambda r: money(r["stock_pnl"])),
            line("Return on avg invested", lambda r: f"{r['return_on_avg_invested_pct']:+.1f}%"),
            line(
                "Trades",
                lambda r: f"{r['n_trades']} ({r['n_closed']} closed, {r['n_open']} open)",
            ),
            line("Win rate", lambda r: f"{r['win_rate_pct']:.1f}%"),
            line(
                "Book P&L (with SPY)",
                lambda r: f"{money(r['pnl'])} ({r['return_pct']:+.2f}%)",
            ),
            line("SPY buy-and-hold", lambda r: f"{r['spy_pct']:+.2f}%"),
            line("vs SPY", lambda r: f"{r['vs_spy_pct']:+.2f}%"),
            line(
                "Invested / positions",
                lambda r: (
                    f"{r['avg_invested_pct']:.1f}% (${r['avg_stock_invested'] / 1000:.0f}k, "
                    f"{r['avg_open_lots']:.1f} lots) avg · "
                    f"{r['peak_invested_pct']:.0f}% ({r['max_open_lots']} lots) peak"
                ),
            ),
            line(
                "Exposure (non-SPY)",
                lambda r: f"{r['avg_exposure_pct']:.1f}% avg, {r['peak_exposure_pct']:.0f}% peak",
            ),
            line("Max drawdown", lambda r: f"{r['max_drawdown_pct']:+.2f}%"),
            line("Mean lot vs SPY", lambda r: f"{r['mean_vs_spy_pct']:+.2f}%"),
            "",
        ]
    if buy_groups:
        body += [
            "## Buy sweep (winning sells)",
            "",
            "† n < 10 — treat as noisy.",
            "",
        ]
        for sell_label, rows in buy_groups:
            body += [f"### {sell_label}", "", buy_table(rows), ""]
    if notes:
        body += ["## Notes", ""] + [f"- {n}" for n in notes] + [""]
    path.write_text("\n".join(body))
    print(f"Wrote {path}")


def focus_lookup(rows):
    return {
        (r["tag"], r["min_analysts"], int(r["min_projected"])): r for r in rows
    }


def focus_matrix(rows, specs, buys, fmt):
    lookup = focus_lookup(rows)
    head = "| Buy \\ Sell | " + " | ".join(s.short for s in specs) + " |"
    sep = "| --- | " + " | ".join("---:" for _ in specs) + " |"
    lines = [head, sep]
    for filt in buys:
        cells = [
            fmt(lookup[(spec.tag, filt["min_analysts"], int(filt["min_projected"]))])
            for spec in specs
        ]
        lines.append("| " + buy_label(filt) + " | " + " | ".join(cells) + " |")
    return "\n".join(lines)


def focus_ranked_table(rows):
    head = (
        "| Rank | Sell | Buy | n | On invested | Stock P&L | Win rate | "
        "Trades | vs SPY | Avg invested |"
    )
    sep = "| ---: | --- | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |"
    lines = [head, sep]
    ordered = sorted(rows, key=lambda r: r["return_on_avg_invested_pct"], reverse=True)
    for i, row in enumerate(ordered, 1):
        lines.append(
            "| "
            + " | ".join(
                [
                    str(i),
                    row["tag"].replace("-", " "),
                    row.get("buy_label", ""),
                    str(row["n_signals"]),
                    f"{row['return_on_avg_invested_pct']:+.1f}%",
                    money(row["stock_pnl"]),
                    f"{row['win_rate_pct']:.1f}%",
                    f"{row['n_trades']} ({row['n_closed']}c/{row['n_open']}o)",
                    f"{row['vs_spy_pct']:+.2f}%",
                    f"{row['avg_invested_pct']:.1f}%",
                ]
            )
            + " |"
        )
    return "\n".join(lines)


def sell_ablation_table(rows, specs):
    head = (
        "| Sell | Mean on invested | Mean stock P&L | "
        "Mean win rate | Mean open trades | Mean avg invested |"
    )
    sep = "| --- | ---: | ---: | ---: | ---: | ---: |"
    lines = [head, sep]
    for spec in specs:
        block = [r for r in rows if r["tag"] == spec.tag]
        n = len(block)
        mean_roi = sum(r["return_on_avg_invested_pct"] for r in block) / n
        mean_pnl = sum(r["stock_pnl"] for r in block) / n
        mean_win = sum(r["win_rate_pct"] for r in block) / n
        mean_open = sum(r["n_open"] for r in block) / n
        mean_inv = sum(r["avg_invested_pct"] for r in block) / n
        lines.append(
            "| "
            + " | ".join(
                [
                    spec.short,
                    f"{mean_roi:+.1f}%",
                    money(mean_pnl),
                    f"{mean_win:.1f}%",
                    f"{mean_open:.1f}",
                    f"{mean_inv:.1f}%",
                ]
            )
            + " |"
        )
    return "\n".join(lines)


def signal_count_table(signals, buys):
    cuts = (20, 25, 30)
    analysts = (2, 3)
    head = "| | " + " | ".join(f">{p}%" for p in cuts) + " |"
    sep = "| --- | " + " | ".join("---:" for _ in cuts) + " |"
    lines = [head, sep]
    for n in analysts:
        cells = []
        for p in cuts:
            count = len(filter_signals(signals, n, float(p)))
            cells.append(str(count))
        lines.append("| " + f"analyst>{n}" + " | " + " | ".join(cells) + " |")
    return "\n".join(lines)


def write_focus_summary(path, rows, signals, info, notes):
    specs = focus_sell_grid()
    buys = focus_buy_grid()
    ordered = sorted(rows, key=lambda r: r["return_on_avg_invested_pct"], reverse=True)
    best_roi = ordered[0]
    best_pnl = max(rows, key=lambda r: r["stock_pnl"])
    body = [
        f"# {info['title']}",
        "",
        f"**Run:** {info['run']}",
        (
            f"**Period:** {info['start']} → {info['end']} · "
            f"{info['cal_days']} days ({info['trading_days']} trading)"
        ),
        (
            f"$5,000 per lot. Ranked by **return on avg invested** "
            f"(stock P&L ÷ time-average $ in stocks). Exposure is not optimized."
        ),
        "",
        "6 buys (analyst >2/>3 × proj >20/25/30%) × 4 sells (7.5% dd with/without "
        "30d and with/without 50% of projected target). Exits are OR-combined. "
        "A new signal resets the 30d clock and the target; drawdown peak is since entry.",
        "",
        "## Signal counts",
        "",
        signal_count_table(signals, buys),
        "",
        "## Ranked 24",
        "",
        focus_ranked_table(rows),
        "",
        "## Return on avg invested",
        "",
        focus_matrix(
            rows,
            specs,
            buys,
            lambda r: f"{r['return_on_avg_invested_pct']:+.1f}%",
        ),
        "",
        "## Stock P&L",
        "",
        focus_matrix(rows, specs, buys, lambda r: money(r["stock_pnl"])),
        "",
        "## Win rate",
        "",
        focus_matrix(rows, specs, buys, lambda r: f"{r['win_rate_pct']:.1f}%"),
        "",
        "## Avg invested",
        "",
        focus_matrix(rows, specs, buys, lambda r: f"{r['avg_invested_pct']:.1f}%"),
        "",
        "## Closed / open",
        "",
        focus_matrix(
            rows,
            specs,
            buys,
            lambda r: f"{r['n_closed']}c/{r['n_open']}o",
        ),
        "",
        "## Sell ablation (mean across 6 buys)",
        "",
        sell_ablation_table(rows, specs),
        "",
        (
            f"Best **return on invested**: **{best_roi.get('buy_label')}** on "
            f"**{best_roi['tag'].replace('-', ' ')}** → "
            f"{best_roi['return_on_avg_invested_pct']:+.1f}% "
            f"({best_roi['n_signals']} signals, {money(best_roi['stock_pnl'])})."
        ),
        "",
        (
            f"Best **stock P&L**: **{best_pnl.get('buy_label')}** on "
            f"**{best_pnl['tag'].replace('-', ' ')}** → "
            f"{money(best_pnl['stock_pnl'])} "
            f"({best_pnl['n_signals']} signals, "
            f"{best_pnl['return_on_avg_invested_pct']:+.1f}%)."
        ),
        "",
    ]
    if notes:
        body += ["## Notes", ""] + [f"- {n}" for n in notes] + [""]
    path.write_text("\n".join(body))
    print(f"Wrote {path}")


def save_json(path, rows):
    path = Path(path)
    path.write_text(json.dumps([jsonable(r) for r in rows], indent=2))
    print(f"Wrote {path}")


def load_json(path):
    return json.loads(Path(path).read_text())


def prepare(signals_path=SIGNALS_CSV, end=None):
    signals = load_signals(signals_path)
    start = signals["date"].min()
    close, spy = ensure_prices(unique_tickers(signals), start, end)
    close = clip_prices(close)
    spy = clip_prices(aligned_spy(spy, close.index))
    return signals, close, spy


def run_sells(signals, close, spy, hold_days=None, prefix=None, write_positions=False):
    freeze = freeze_buy_filter()
    bought = filter_signals(signals, freeze["min_analysts"], freeze["min_projected"])
    if bought.empty:
        raise RuntimeError("Freeze buy filter left no signals")
    specs = sell_grid()
    if hold_days is not None:
        specs = [
            s
            for s in specs
            if s.hold_days == hold_days or (s.baseline and hold_days == HOLD_AFTER_LAST_DAYS)
        ]
    tickers = [t for t in unique_tickers(bought) if t in close.columns]
    close_wide, meta = signal_positions(close[tickers], bought)
    verify_exits(close_wide, meta)
    rows = []
    init_cash = None
    for spec in specs:
        csv_path = None
        if write_positions and prefix is not None:
            csv_path = Path(f"{prefix}_{spec.tag}.csv")
        row, _, close_wide, meta, init_cash = run_one(
            spec.label, close, spy, bought, spec, write_csv=csv_path
        )
        rows.append(attach_spec(row, spec, freeze))
    return rows, close_wide, meta, init_cash, bought


def run_buys(signals, close, spy, sell_rows, prefix=None, sell_tags=None):
    if sell_tags:
        tags = set(sell_tags)
        sell_rows = [r for r in sell_rows if r.get("tag") in tags]
        if not sell_rows:
            raise RuntimeError(f"No winning sells match {sorted(tags)}")
    groups = []
    all_rows = []
    for sell_row in sell_rows:
        spec = spec_from_row(sell_row)
        block = []
        for filt in buy_grid():
            bought = filter_signals(signals, filt["min_analysts"], filt["min_projected"])
            if bought.empty:
                print(f"  skip {buy_label(filt)}: no signals")
                continue
            label = f"{spec.label} · {buy_label(filt)}"
            csv_path = None
            if prefix is not None:
                csv_path = Path(
                    f"{prefix}_{spec.tag}_a{filt['min_analysts']}_p{int(filt['min_projected'])}.csv"
                )
            row, _, _, _, _ = run_one(label, close, spy, bought, spec, write_csv=csv_path)
            row = attach_spec(row, spec, filt)
            row["label"] = label
            block.append(row)
            all_rows.append(row)
        groups.append((spec.label, block))
    return groups, all_rows


def run_focus(signals, close, spy):
    specs = focus_sell_grid()
    buys = focus_buy_grid()
    rows = []
    close_wide = None
    init_cash = None
    for spec in specs:
        for filt in buys:
            bought = filter_signals(
                signals, filt["min_analysts"], filt["min_projected"]
            )
            if bought.empty:
                print(f"  skip {spec.short} · {buy_label(filt)}: no signals")
                continue
            label = f"{spec.label} · {buy_label(filt)}"
            print(f"  {label} ({len(bought)} signals)")
            row, _, close_wide, _, init_cash = run_one(
                label, close, spy, bought, spec
            )
            row = attach_spec(row, spec, filt)
            row["label"] = label
            rows.append(row)
    return rows, close_wide, init_cash


def yahoo_symbol(symbol):
    return str(symbol).replace(".", "-")


def load_fortune_symbols(path=FORTUNE_CSV):
    df = pd.read_csv(path)
    return [yahoo_symbol(s) for s in df["Symbol"].tolist()]


def filter_percentile(signals, min_percentile):
    out = signals[signals["signal_percentile"] > min_percentile]
    return out.sort_values(["date", "signal_score"], ascending=[True, False]).reset_index(
        drop=True
    )


def download_close_yahoo(symbols, start, end):
    import yfinance as yf

    start_s = pd.Timestamp(start).strftime("%Y-%m-%d")
    end_s = (pd.Timestamp(end) + pd.Timedelta(days=1)).strftime("%Y-%m-%d")
    print(f"Downloading {len(symbols)} Yahoo closes {start_s} → {end_s} …")
    data = yf.download(
        tickers=list(symbols),
        start=start_s,
        end=end_s,
        auto_adjust=True,
        threads=True,
        group_by="column",
        progress=True,
    )
    if data.empty:
        raise RuntimeError("Yahoo returned no Fortune 500 prices")
    if isinstance(data.columns, pd.MultiIndex):
        close = data["Close"].copy()
    else:
        close = data.copy()
        if "Close" in close.columns:
            close = close[["Close"]]
        if len(symbols) == 1:
            close.columns = [symbols[0]]
    close = close.dropna(axis=1, how="all")
    idx = close.index
    naive = idx.tz_localize(None) if getattr(idx, "tz", None) is not None else idx
    close.index = pd.DatetimeIndex(pd.to_datetime(naive).normalize())
    close = close.groupby(level=0).last().sort_index()
    print(f"  {len(close)} days, {close.shape[1]} symbols\n")
    return close


def align_columns_to_index(extra, index):
    extra = extra.copy()
    idx = extra.index
    naive = idx.tz_localize(None) if getattr(idx, "tz", None) is not None else idx
    extra.index = pd.DatetimeIndex(pd.to_datetime(naive).normalize())
    extra = extra.groupby(level=0).last()
    index_naive = index.tz_localize(None) if getattr(index, "tz", None) is not None else index
    days = pd.DatetimeIndex(pd.to_datetime(index_naive).normalize())
    aligned = extra.reindex(days)
    aligned.index = index
    return aligned


def ensure_fortune_prices(close, start=None, end=PRICE_END):
    symbols = load_fortune_symbols()
    fortune_path = CACHE_DIR / "fortune_close.pkl"
    cached = pd.read_pickle(fortune_path) if fortune_path.exists() else pd.DataFrame()
    missing = [
        s for s in symbols if s not in close.columns and s not in cached.columns
    ]
    if missing:
        extra = download_close_yahoo(
            missing, start if start is not None else close.index.min(), end
        )
        cached = extra if cached.empty else cached.join(extra, how="outer")
        CACHE_DIR.mkdir(exist_ok=True)
        cached.to_pickle(fortune_path)
        print(f"Cached {cached.shape[1]} Fortune 500 symbols → {fortune_path}")
    if not cached.empty:
        aligned = align_columns_to_index(cached, close.index)
        new_cols = [c for c in aligned.columns if c not in close.columns]
        if new_cols:
            close = close.join(aligned[new_cols], how="left")
    return close


def fortune_entry_signals(close, symbols):
    first_day = pd.Timestamp(close.index[0]).normalize()
    rows = []
    skipped = []
    for ticker in symbols:
        if ticker not in close.columns:
            skipped.append({"ticker": ticker, "reason": "no prices"})
            continue
        if pd.isna(close[ticker].iloc[0]):
            skipped.append({"ticker": ticker, "reason": "no first-day price"})
            continue
        rows.append(
            {
                "date": first_day,
                "ticker": ticker,
                "average_projected": 0.0,
                "analyst_projections_count": 0,
                "signal_score": 0.0,
                "signal_percentile": 0.0,
            }
        )
    return pd.DataFrame(rows), skipped


def load_focus_winning_sell(path=None):
    path = Path(path) if path is not None else CACHE_DIR / "focus.json"
    rows = load_json(path)
    frozen = [r for r in rows if r.get("tag") == "30d-t50-dd7.5"]
    frozen.sort(key=lambda r: (r.get("min_analysts", 0), r.get("min_projected", 0)))
    if len(frozen) != 6:
        raise RuntimeError(f"Expected 6 frozen 30d-t50-dd7.5 rows, got {len(frozen)}")
    for row in frozen:
        row["family"] = "analyst"
    return frozen


def conclusion_compact_table(rows):
    freeze = freeze_buy_filter()
    head = "| Buy | n | On invested | Stock P&L |"
    sep = "| --- | ---: | ---: | ---: |"
    lines = [head, sep]
    best = max(rows, key=lambda r: r["return_on_avg_invested_pct"])
    for row in rows:
        name = row.get("buy_label", row["label"])
        if (
            row.get("family") == "analyst"
            and row.get("min_analysts") == freeze["min_analysts"]
            and row.get("min_projected") == freeze["min_projected"]
        ):
            name = f"{name} *(old freeze)*"
        if (
            row.get("family") == "analyst"
            and row.get("min_analysts") == 3
            and int(row.get("min_projected", 0)) == 30
        ):
            name = f"**ANALYST>3 · PROJ>30%**"
            cell_n = f"**{row['n_signals']}**"
            cell_roi = f"**{row['return_on_avg_invested_pct']:+.1f}%**"
            cell_pnl = f"**{money(row['stock_pnl'])}**"
        elif row is best:
            name = f"**{name}**"
            cell_n = f"**{row['n_signals']}**"
            cell_roi = f"**{row['return_on_avg_invested_pct']:+.1f}%**"
            cell_pnl = f"**{money(row['stock_pnl'])}**"
        else:
            cell_n = str(row["n_signals"])
            cell_roi = f"{row['return_on_avg_invested_pct']:+.1f}%"
            cell_pnl = money(row["stock_pnl"])
        lines.append(f"| {name} | {cell_n} | {cell_roi} | {cell_pnl} |")
    return "\n".join(lines)


def conclusion_detail_table(rows):
    head = (
        "| Buy | n | On invested | Stock P&L | Win rate | "
        "Trades | vs SPY | Avg invested |"
    )
    sep = "| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: |"
    lines = [head, sep]
    for row in rows:
        lines.append(
            "| "
            + " | ".join(
                [
                    row.get("buy_label", row["label"]),
                    str(row["n_signals"]),
                    f"{row['return_on_avg_invested_pct']:+.1f}%",
                    money(row["stock_pnl"]),
                    f"{row['win_rate_pct']:.1f}%",
                    f"{row['n_trades']} ({row['n_closed']}c/{row['n_open']}o)",
                    f"{row['vs_spy_pct']:+.2f}%",
                    f"{row['avg_invested_pct']:.1f}%",
                ]
            )
            + " |"
        )
    return "\n".join(lines)


def write_conclusion_summary(path, rows, info, notes, skipped=None):
    analysts = [r for r in rows if r.get("family") == "analyst"]
    percentiles = [r for r in rows if r.get("family") == "percentile"]
    universe = [r for r in rows if r.get("family") == "universe"]
    best = max(rows, key=lambda r: r["return_on_avg_invested_pct"])
    best_pnl = max(rows, key=lambda r: r["stock_pnl"])
    body = [
        f"# {info['title']}",
        "",
        f"**Run:** {info['run']}",
        (
            f"**Period:** {info['start']} → {info['end']} · "
            f"{info['cal_days']} days ({info['trading_days']} trading)"
        ),
        (
            "Sell frozen: **30d or 50% of projected target or 7.5% trailing dd**. "
            "$5,000 per lot. Ranked by **return on avg invested**. "
            "Analyst/proj rows reused from the 2026-09-21 20:41 focus run."
        ),
        "",
        "# WINNING COMBINATION",
        "",
        "# SELL: 30D OR 50% TARGET OR 7.5% DD",
        "",
        f"# BUY: {best.get('buy_label', best['label']).upper()}",
        "",
        (
            f"# {best['return_on_avg_invested_pct']:+.1f}% ON INVESTED · "
            f"{money(best['stock_pnl'])} · {best['n_signals']} SIGNALS · "
            f"{best['win_rate_pct']:.1f}% WIN RATE"
        ),
        "",
        "## 30d 50% 7.5dd — all buys",
        "",
        conclusion_compact_table(rows),
        "",
        "## Detail",
        "",
        conclusion_detail_table(rows),
        "",
        (
            f"Best **return on invested**: **{best.get('buy_label')}** → "
            f"{best['return_on_avg_invested_pct']:+.1f}% "
            f"({best['n_signals']} signals, {money(best['stock_pnl'])})."
        ),
        "",
        (
            f"Best **stock P&L**: **{best_pnl.get('buy_label')}** → "
            f"{money(best_pnl['stock_pnl'])} "
            f"({best_pnl['n_signals']} signals, "
            f"{best_pnl['return_on_avg_invested_pct']:+.1f}%)."
        ),
        "",
    ]
    conclusions = []
    if analysts and percentiles:
        weakest_a = min(analysts, key=lambda r: r["return_on_avg_invested_pct"])
        best_p = max(percentiles, key=lambda r: r["return_on_avg_invested_pct"])
        conclusions.append(
            "Analyst count + projected % beats signal_percentile. "
            f"The weakest analyst/proj cut (**{weakest_a['buy_label']}** "
            f"{weakest_a['return_on_avg_invested_pct']:+.1f}%) still beats the "
            f"tightest percentile (**{best_p['buy_label']}** "
            f"{best_p['return_on_avg_invested_pct']:+.1f}%)."
        )
        conclusions.append(
            "Percentile is monotonic on rate: tighter is better. "
            "Loosening adds dollars until >0.00, which is worse dollars than >0.20."
        )
    if universe:
        bits = []
        for u in universe:
            bits.append(
                f"**{u.get('buy_label')}**: {u['n_signals']} names, "
                f"{u['return_on_avg_invested_pct']:+.1f}% on invested, "
                f"{money(u['stock_pnl'])}, {u['win_rate_pct']:.1f}% win rate "
                f"({u['n_closed']}c/{u['n_open']}o)."
            )
        conclusions.append(
            "Fortune 500 at start is the floor on rate. "
            + " ".join(bits)
            + " No analyst projection, so the 50% target never fires."
        )
    conclusions.append(
        f"Keep **{best.get('buy_label')}** for rate. "
        f"Keep **{best_pnl.get('buy_label')}** if you want more dollars in play. "
        "Do not switch the buy filter to percentile or to the Fortune 500 universe."
    )
    body += ["## Conclusions", ""] + [f"- {c}" for c in conclusions] + [""]
    if skipped:
        reasons = {}
        names = []
        for item in skipped:
            reasons[item["reason"]] = reasons.get(item["reason"], 0) + 1
            names.append(item["ticker"])
        body += [
            "Skipped Fortune 500 names: "
            + ", ".join(names)
            + " ("
            + ", ".join(f"{k} {v}" for k, v in reasons.items())
            + ").",
            "",
        ]
    if notes:
        body += ["## Notes", ""] + [f"- {n}" for n in notes] + [""]
    path.write_text("\n".join(body))
    print(f"Wrote {path}")


def run_percentile(signals, close, spy):
    spec = WINNING_SELL
    rows = []
    close_wide = None
    init_cash = None
    for cut in PERCENTILE_CUTS:
        bought = filter_percentile(signals, cut)
        if bought.empty:
            print(f"  skip signal_percentile > {cut:.2f}: no signals")
            continue
        filt = {"min_percentile": cut, "family": "percentile"}
        label = f"{spec.label} · {buy_label(filt)}"
        print(f"  {label} ({len(bought)} signals)")
        row, _, close_wide, _, init_cash = run_one(label, close, spy, bought, spec)
        row = attach_spec(row, spec, filt)
        row["label"] = label
        rows.append(row)
    return rows, close_wide, init_cash


def write_percentile_summary(path, rows, info, notes):
    best = max(rows, key=lambda r: r["return_on_avg_invested_pct"])
    best_pnl = max(rows, key=lambda r: r["stock_pnl"])
    body = [
        f"# {info['title']}",
        "",
        f"**Run:** {info['run']}",
        (
            f"**Period:** {info['start']} → {info['end']} · "
            f"{info['cal_days']} days ({info['trading_days']} trading)"
        ),
        (
            "Sell frozen: **30d or 50% of projected target or 7.5% trailing dd**. "
            "$5,000 per lot. Ranked by **return on avg invested**."
        ),
        "",
        "# WINNING PERCENTILE CUT",
        "",
        "# SELL: 30D OR 50% TARGET OR 7.5% DD",
        "",
        f"# BUY: {best.get('buy_label', best['label']).upper()}",
        "",
        (
            f"# {best['return_on_avg_invested_pct']:+.1f}% ON INVESTED · "
            f"{money(best['stock_pnl'])} · {best['n_signals']} SIGNALS · "
            f"{best['win_rate_pct']:.1f}% WIN RATE"
        ),
        "",
        "## 30d 50% 7.5dd — signal_percentile buys",
        "",
        conclusion_compact_table(rows),
        "",
        "## Detail",
        "",
        conclusion_detail_table(rows),
        "",
        (
            f"Best **return on invested**: **{best.get('buy_label')}** → "
            f"{best['return_on_avg_invested_pct']:+.1f}% "
            f"({best['n_signals']} signals, {money(best['stock_pnl'])})."
        ),
        "",
        (
            f"Best **stock P&L**: **{best_pnl.get('buy_label')}** → "
            f"{money(best_pnl['stock_pnl'])} "
            f"({best_pnl['n_signals']} signals, "
            f"{best_pnl['return_on_avg_invested_pct']:+.1f}%)."
        ),
        "",
        "## Conclusions",
        "",
        (
            "- Percentile is monotonic on rate: tighter is better. "
            f"**{best.get('buy_label')}** is the best of these five."
        ),
        (
            f"- Best dollars: **{best_pnl.get('buy_label')}** "
            f"({money(best_pnl['stock_pnl'])})."
        ),
        "",
    ]
    if notes:
        body += ["## Notes", ""] + [f"- {n}" for n in notes] + [""]
    path.write_text("\n".join(body))
    print(f"Wrote {path}")


def run_conclusion(signals, close, spy):
    rows = load_focus_winning_sell()
    pct_rows, close_wide, init_cash = run_percentile(signals, close, spy)
    rows.extend(pct_rows)

    close = ensure_fortune_prices(close)
    symbols = load_fortune_symbols()
    f_signals, skipped = fortune_entry_signals(close, symbols)
    if f_signals.empty:
        raise RuntimeError("No Fortune 500 names aligned to first-day prices")
    for f_spec, f_label in (
        (SellSpec(hold_days=30, drawdown=0.075), "Fortune 500 at start · 30d 7.5dd"),
        (SellSpec(drawdown=0.075), "Fortune 500 at start · 7.5dd"),
    ):
        filt = {
            "universe": "fortune_500",
            "family": "universe",
            "label": f_label,
        }
        label = f"{f_spec.label} · {f_label}"
        print(f"  {label} ({len(f_signals)} names, skipped {len(skipped)})")
        row, _, close_wide, _, init_cash = run_one(label, close, spy, f_signals, f_spec)
        row = attach_spec(row, f_spec, filt)
        row["label"] = label
        row["n_skipped"] = len(skipped)
        row["n_listed"] = len(symbols)
        rows.append(row)
    return rows, close_wide, init_cash, skipped


def parse_args():
    p = argparse.ArgumentParser(description="Sweep sell/buy permutations")
    p.add_argument(
        "phase",
        nargs="?",
        default="all",
        choices=("download", "sells", "buys", "all", "focus", "conclusion", "percentile"),
    )
    p.add_argument("--signals", default=str(SIGNALS_CSV))
    p.add_argument("--end", default=None)
    p.add_argument("--hold-days", type=int, default=None)
    p.add_argument("--sells-json", default=str(CACHE_DIR / "sells.json"))
    p.add_argument("--buys-json", default=str(CACHE_DIR / "buys.json"))
    p.add_argument("--winners-json", default=str(CACHE_DIR / "winners.json"))
    p.add_argument("--report", default=None)
    p.add_argument("--positions", action="store_true")
    p.add_argument("--sell-tag", action="append", dest="sell_tags")
    return p.parse_args()


def main():
    args = parse_args()
    CACHE_DIR.mkdir(exist_ok=True)
    stamp, run_label = run_clock()
    prefix = OUT_DIR / f"simulation_{stamp}_optimize"
    report_path = Path(args.report) if args.report else Path(f"{prefix}.md")

    if args.phase == "download":
        prepare(args.signals, args.end)
        return

    signals, close, spy = prepare(args.signals, args.end)

    if args.phase == "focus":
        rows, close_wide, init_cash = run_focus(signals, close, spy)
        save_json(CACHE_DIR / "focus.json", rows)
        widest = filter_signals(signals, 2, 20.0)
        info = period_info(
            close_wide,
            init_cash,
            len(widest),
            run_label,
            "Focused 6×4 buy/sell sweep",
        )
        notes = [
            "Sells are 7.5% trailing drawdown, optionally OR'd with a 30d time stop "
            "and/or 50% of projected upside. Peak for drawdown is since entry.",
            "Comparison is on invested dollars, not book vs SPY. Exposure stays low.",
        ]
        write_focus_summary(report_path, rows, signals, info, notes)
        return

    if args.phase == "percentile":
        rows, close_wide, init_cash = run_percentile(signals, close, spy)
        save_json(CACHE_DIR / "percentile.json", rows)
        info = period_info(
            close_wide,
            init_cash,
            max(r["n_signals"] for r in rows),
            run_label,
            "30d 50% 7.5dd signal_percentile buys",
        )
        notes = [
            "Sell frozen at 30d or 50% of projected upside or 7.5% trailing drawdown. "
            "Peak for drawdown is since entry. A new signal resets the 30d clock and the target.",
            "signal_percentile > 0.00 excludes the single row with percentile 0.",
            "Comparison is on invested dollars, not book vs SPY. Exposure stays un-optimized.",
        ]
        write_percentile_summary(report_path, rows, info, notes)
        return

    if args.phase == "conclusion":
        rows, close_wide, init_cash, skipped = run_conclusion(signals, close, spy)
        save_json(CACHE_DIR / "conclusion.json", rows)
        info = period_info(
            close_wide,
            init_cash,
            max(r["n_signals"] for r in rows),
            run_label,
            "30d 50% 7.5dd buy comparison",
        )
        notes = [
            "Sell frozen at 30d or 50% of projected upside or 7.5% trailing drawdown. "
            "Peak for drawdown is since entry. A new signal resets the 30d clock and the target.",
            "The six analyst/proj rows are copied from VectorBT/.cache/focus.json "
            "(run 2026-09-21 20:41 UTC+3). They were not re-simulated.",
            "signal_percentile > 0.00 excludes the single row with percentile 0 (188 of 189).",
            "Fortune 500 has no analyst projection, so the 50% target never fires. "
            "Two F500 rows: 30d or 7.5% dd, and 7.5% dd alone. Bought on the first bar of the period.",
            "Comparison is on invested dollars, not book vs SPY. Exposure stays un-optimized.",
        ]
        write_conclusion_summary(report_path, rows, info, notes, skipped)
        return

    sell_rows = []
    buy_groups = []
    winners = []
    close_wide = None
    init_cash = None
    bought = None
    notes = []

    if args.phase in ("sells", "all"):
        sell_rows, close_wide, meta, init_cash, bought = run_sells(
            signals,
            close,
            spy,
            hold_days=args.hold_days,
            prefix=prefix if args.positions else None,
            write_positions=args.positions,
        )
        save_json(args.sells_json, sell_rows)
        if args.phase == "sells" and args.hold_days is None:
            winners = pick_winners(sell_rows)
            save_json(args.winners_json, winners)
            info = period_info(
                close_wide,
                init_cash,
                len(bought),
                run_label,
                "Sell sweep, buy frozen >3 and >20%",
            )
            write_summary(report_path, sell_rows, [], info, winners, notes)
        elif args.phase == "sells":
            return

    if args.phase in ("buys", "all"):
        if not sell_rows:
            sell_rows = load_json(args.sells_json)
        if Path(args.winners_json).exists() and args.phase == "buys":
            winners = load_json(args.winners_json)
        else:
            winners = pick_winners(sell_rows)
            save_json(args.winners_json, winners)
        buy_groups, buy_rows = run_buys(
            signals,
            close,
            spy,
            winners,
            prefix=prefix if args.positions else None,
            sell_tags=args.sell_tags,
        )
        save_json(args.buys_json, buy_rows)
        if args.sell_tags:
            return
        freeze = freeze_buy_filter()
        if close_wide is None:
            bought = filter_signals(signals, freeze["min_analysts"], freeze["min_projected"])
            tickers = [t for t in unique_tickers(bought) if t in close.columns]
            close_wide, _ = signal_positions(close[tickers], bought)
            init_cash = POSITION_VALUE * len(bought)
        info = period_info(
            close_wide,
            init_cash,
            len(bought),
            run_label,
            "Sell then buy parameter sweep",
        )
        notes.append(
            "All raw signals already have analyst_count ≥ 3 and average_projected ≥ 10%, "
            "so analyst>2 and proj>10% is the unfiltered file (189 rows)."
        )
        notes.append("† in buy tables: fewer than 10 signals.")
        write_summary(report_path, sell_rows, buy_groups, info, winners, notes)


if __name__ == "__main__":
    main()
