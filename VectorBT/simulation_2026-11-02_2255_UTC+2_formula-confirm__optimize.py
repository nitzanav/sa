"""Sweep sell and buy permutations on data/signals.csv.

Reuse the VectorBT engine in backtest.py. Rank by return on avg invested
(stock P&L / time-average dollars in stocks). Exposure is not optimized.

Phase 1 freezes buy at analyst_count > 3 and average_projected > 20%, then
runs 24 sell specs (drawdown × target fraction × time stop) plus two baselines.

Phase 2 takes the four winning sells and sweeps buy filters.

Phase focus runs a smaller 6×4 grid: analyst >2/>3 × proj >20/25/30%,
against 7.5% dd with/without 30d and with/without a 50% target.

Phase staged freezes buy at analyst > 2 and proj > 20%, then compares the
winning 30d/50%/7.5dd sell against 15 two-stage trailing stops (wide dd
until a profit lock, then a tighter dd).

Phase closed ignores the last N calendar days of signals (default 29) so
parameter picks are not driven by lots that are still open, while prices
are refreshed through today so older 30d clocks and trails can finish.
Five locked iterations (~200 combos) start from analyst>2 · proj>20% and
analyst>3 · proj>30% around the 30d / 50% / 7.5dd sell neighborhood.

Phase coarse is one wide pass, not a locked search: analyst >2–6 ×
projected >20/25/30% against hold 10/15/30 × target 25/50% × dd 7.5/10%.
Pass --one-lot to keep a single open lot per ticker: a later buy while
that lot is open does not add a lot, it restarts the hold clock.

Phase wide keeps that buy grid and appends the longer holds from the
2026-10-17 coarse canvas: hold 10/15/30/45/60/75/90/105/120 × target
25/50% × dd 7.5/10%. 15 buys × 36 sells.

Phase full is the catalog in optimization_params_full.md. Analysts >2–9 ×
projected >10/20/25/30/40/50 × hold 10/15/30/45/60/75/90/105/120 × target
25/50/75/100% × drawdown 5/7.5/10/15%. With no --signal-name it runs all
six all_sources, yahoo, and google books (daily and 7-day). Repeat
--signal-name to choose books. Each cell is one book. The canvas filters
them.

Buy filters also split on signal_name. The default pair outside full is
yahoo-daily and yahoo-7d-window. --signal-name also accepts google,
tipranks, and all_sources daily and 7d-window books. Sell and staged
freezes use the first selected name (yahoo-daily unless --signal-name
overrides it).

Phase protect keeps the daily winner buys and replaces the sell. There is
no hold and no profit target. While the close is below the entry, a loss
dropdown sells 2.5%, 5%, or 7.5% under that entry. Once a close has traded
above the entry, profit protection sells when the giveback from the highest
close reaches 5%, 10%, 20%, or 40% of the gain from entry to that peak.

Phase slots keeps those same buys and books. The book holds 8 lots. A new
signal takes a free slot. When the book is full, it sells the biggest loss,
or, if every lot is in profit, the least profitable lot only when that lot's
strength is below the new signal. Strength is sqrt(analysts, capped at 10)
times the target percent floored to 10-point steps.

Phase book is yahoo-daily only. The same 8-lot replacement rule runs inside
a swept book size, and each open lot also exits on a loss dropdown or on
profit protection. Loss dropdown is 1.25/2.5/7.5/10. Profit protection is
2.5/5/10/20/30. Book size is 4/6/8/12/16/20.

Phase park is that same yahoo grid. A slot still empty after the day's
buys holds TQQQ. A stop that is not reused for a new ticker buys SPY in
that slot. A new buy sells a SPY lot before it sells TQQQ or a stock.

Phase fillers is the same park grid with the stop filler swapped from SPY
to VOO, SSO, UPRO, SPXL, QQQ, QLD, or TQQQ. Free slots still hold TQQQ.

Phase scale is yahoo-daily with a 64-lot book. SPY filler and no SPY filler
are both options. A freed slot buys SPY only when the filler is on. Selling
a stock lot is either the biggest loss (ls) or that loss per day held (dls).
A signal opens one lot, or floor(analysts × target percent / 10) lots,
capped at 16.

Phase cash is yahoo-daily with no SPY and no TQQQ. Empty slots stay cash,
and cash is not invested in the SPY sleeve. Every signal opens
floor(analysts × target percent / 10) lots, capped at 16. Book size is
8/12/16/24/32/48/64. Buys add projected >10%.

Phase split keeps that stock-only book, but the total cash is fixed at
64 × $5,000. Fewer lots means more dollars in each lot. Eight lots are
$40,000 each. Sixty-four lots are $5,000 each.

Phase formulas keeps that fixed $320,000 book and sweeps four lot-size
formulas. at is floor(analysts × target percent / 10). sqra is analysts
squared. a is analysts × 3. sqra_target is floor(analysts² × target
percent / 40). Each is at least 1 lot and at most 16.

Phase counts keeps that formula grid and adds analyst >0 and analyst >1
beside >2, >3, and >4.

Phase low keeps the counts grid and adds projected >0% beside
>10/20/30/40/50%.

Phase books keeps that grid and runs every signal name in the export:
yahoo, google, tipranks, all_sources, and yahoo_and_google, each as a
daily book and a 7-day book. Each cell is still one book.

Phase daily keeps the fixed book and the four strength formulas, and
narrows the grid. Books are the five daily names only. Projected cuts
stop at >30%. Lot counts drop 24 and 48. Profit protection stops at 10%.
The sell pick is ls only. Win rate counts a position once: lots opened
together are one position.

Phase window is that same daily grid on the five 7-day books:
yahoo-7d-window, google-7d-window, tipranks-7d-window,
all_sources-7d-window, and yahoo_and_google-7d-window.

Phase horizon is that same fixed book on the 1–5 day books for yahoo,
tipranks, and yahoo_and_tipranks. Loss dropdown adds 5%. Profit
protection adds 7.5% of the gain from entry to the high.

Phase recency is that same horizon grid on yahoo_and_tipranks_1d_recency
through yahoo_and_tipranks_5d_recency. Older analyst points weigh
2.5 / trading days back. A slot book never opens a second position on a
ticker that is still held.

Phase ranges freezes the recency winner sell, 7.5dd 5pp · 12 × $26,667 ·
ls · at, and the analyst>3 buys at projected >0/10/20/30%. It runs those
buys on yahoo_and_tipranks_1d_recency through yahoo_and_tipranks_5d_recency.
Each cell keeps signals and prices inside one window from a single list:
1-month through 8-month ranges starting in January 2026 and ending in October.

Phase confirm keeps that frozen sell and moves one knob at a time:
loss dropdown 5/7.5/10, profit protection 2.5/5/7.5/10, lot count 8/12/16/32,
sell pick ls or dls, and strength formula at or a. Buys add analyst >2 and >4
beside >3, on the 1d, 2d, and 3d recency books. Windows are the ten months,
five disjoint two-month blocks, the two halves, and January–October.
"""

from __future__ import annotations

import argparse
import gc
import json
import math
import shlex
import sys
from collections import defaultdict
from dataclasses import dataclass
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))

from backtest import (  # noqa: E402
    HOLD_AFTER_LAST_DAYS,
    HOLD_NORM_DAYS,
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
IGNORE_LAST_DAYS_DEFAULT = 29


def quote_day(end=None):
    if end is None:
        return pd.Timestamp.today().normalize()
    return pd.Timestamp(end).normalize()


def normalize_price_index(obj):
    out = obj.copy()
    idx = out.index
    naive = idx.tz_localize(None) if getattr(idx, "tz", None) is not None else idx
    out.index = pd.DatetimeIndex(pd.to_datetime(naive).normalize())
    return out.groupby(level=0).last().sort_index()


def clip_prices(obj, end=None):
    end = quote_day(end)
    idx = obj.index
    naive = idx.tz_localize(None) if getattr(idx, "tz", None) is not None else idx
    days = pd.DatetimeIndex(pd.to_datetime(naive).normalize())
    mask = days <= end
    return obj.loc[mask]


FREEZE_ANALYSTS = 3
FREEZE_PROJECTED = 20.0
SIGNAL_NAMES = ("yahoo-daily", "yahoo-7d-window")
SIGNAL_NAME_CHOICES = SIGNAL_NAMES + (
    "google-daily",
    "google-7d-window",
    "tipranks-daily",
    "tipranks-7d-window",
    "all_sources-daily",
    "all_sources-7d-window",
    "yahoo_and_google-daily",
    "yahoo_and_google-7d-window",
    "yahoo-1d",
    "yahoo-2d",
    "yahoo-3d",
    "yahoo-4d",
    "yahoo-5d",
    "google-1d",
    "google-2d",
    "google-3d",
    "google-4d",
    "google-5d",
    "tipranks-1d",
    "tipranks-2d",
    "tipranks-3d",
    "tipranks-4d",
    "tipranks-5d",
    "yahoo_and_google-1d",
    "yahoo_and_google-2d",
    "yahoo_and_google-3d",
    "yahoo_and_google-4d",
    "yahoo_and_google-5d",
    "yahoo_and_tipranks-1d",
    "yahoo_and_tipranks-2d",
    "yahoo_and_tipranks-3d",
    "yahoo_and_tipranks-4d",
    "yahoo_and_tipranks-5d",
) + tuple(
    f"{source}_{day}d_recency"
    for source in ("yahoo", "google", "tipranks", "yahoo_and_tipranks", "yahoo_and_google")
    for day in range(1, 6)
)
FULL_SIGNAL_NAMES = (
    "all_sources-daily",
    "all_sources-7d-window",
    "yahoo-daily",
    "yahoo-7d-window",
    "google-daily",
    "google-7d-window",
)
_SELECTED_SIGNAL_NAMES = None
OUTPUT_STEM = "simulation_2026-10-24_1603_UTC+3_daily-winner-params__optimize"
PROTECT_STEM = "simulation_2026-10-24_2032_UTC+3_loss-dd-profit-protect__optimize"
SLOTS_STEM = "simulation_2026-10-24_2130_UTC+3_eight-lot-strength__optimize"
SLOT_COUNT = 8
BOOK_STEM = "simulation_2026-10-27_1141_UTC+2_yahoo-dd-pp-lots__optimize"
PARK_STEM = "simulation_2026-10-27_1203_UTC+2_yahoo-spy-tqqq__optimize"
FILLER_STEM = "simulation_2026-10-27_1221_UTC+2_yahoo-stop-fillers__optimize"
SCALE_STEM = "simulation_2026-10-27_1309_UTC+2_yahoo-64-dls__optimize"
CASH_STEM = "simulation_2026-10-27_1536_UTC+2_yahoo-cash-strength__optimize"
SPLIT_STEM = "simulation_2026-10-27_1552_UTC+2_yahoo-split-lots__optimize"
FORMULA_STEM = "simulation_2026-10-27_1631_UTC+2_yahoo-strength-formulas__optimize"
COUNT_STEM = "simulation_2026-10-27_2040_UTC+2_yahoo-analyst-counts__optimize"
LOW_STEM = "simulation_2026-10-27_2101_UTC+2_yahoo-upside-0__optimize"
BOOKS_STEM = "simulation_2026-10-27_2202_UTC+2_all-signal-books__optimize"
DAILY_STEM = "simulation_2026-10-31_1925_UTC+2_daily-ls-books__optimize"
WINDOW_STEM = "simulation_2026-10-31_2043_UTC+2_7d-ls-books__optimize"
HORIZON_STEM = "simulation_2026-10-31_2359_UTC+2_1-5d-ls-books__optimize"
RECENCY_STEM = "simulation_2026-11-01_2135_UTC+2_recency-ls-books__optimize"
RANGES_STEM = "simulation_2026-11-02_2217_UTC+2_recency-date-ranges__optimize"
CONFIRM_STEM = "simulation_2026-11-02_2255_UTC+2_formula-confirm__optimize"
EXPORT_SIGNAL_NAMES = (
    "yahoo-daily",
    "yahoo-7d-window",
    "google-daily",
    "google-7d-window",
    "tipranks-daily",
    "tipranks-7d-window",
    "all_sources-daily",
    "all_sources-7d-window",
    "yahoo_and_google-daily",
    "yahoo_and_google-7d-window",
)
DAILY_SIGNAL_NAMES = (
    "yahoo-daily",
    "google-daily",
    "tipranks-daily",
    "all_sources-daily",
    "yahoo_and_google-daily",
)
WINDOW_SIGNAL_NAMES = (
    "yahoo-7d-window",
    "google-7d-window",
    "tipranks-7d-window",
    "all_sources-7d-window",
    "yahoo_and_google-7d-window",
)
DAILY_SLOTS = (8, 12, 16, 32, 64)
DAILY_PROTECTS = (0.025, 0.05, 0.10)
DAILY_PROJECTED = (0, 10, 20, 30)
HORIZON_SIGNAL_NAMES = tuple(
    f"{source}-{day}d"
    for source in ("yahoo", "tipranks", "yahoo_and_tipranks")
    for day in range(1, 6)
)
RECENCY_SIGNAL_NAMES = tuple(
    f"yahoo_and_tipranks_{day}d_recency" for day in range(1, 6)
)
CONFIRM_SIGNAL_NAMES = tuple(
    f"yahoo_and_tipranks_{day}d_recency" for day in range(1, 4)
)
_RANGE_MONTHS = (
    (1, "Jan"),
    (2, "Feb"),
    (3, "Mar"),
    (4, "Apr"),
    (5, "May"),
    (6, "Jun"),
    (7, "Jul"),
    (8, "Aug"),
    (9, "Sep"),
    (10, "Oct"),
)
VALIDATION_RANGE_LABELS = (
    "1m_Jan",
    "1m_Feb",
    "1m_Mar",
    "1m_Apr",
    "1m_May",
    "1m_Jun",
    "1m_Jul",
    "1m_Aug",
    "1m_Sep",
    "1m_Oct",
    "2m_Jan-Feb",
    "2m_Feb-Mar",
    "2m_Mar-Apr",
    "2m_Apr-May",
    "2m_May-Jun",
    "2m_Jun-Jul",
    "2m_Jul-Aug",
    "2m_Aug-Sep",
    "2m_Sep-Oct",
    "3m_Jan-Mar",
    "3m_Feb-Apr",
    "3m_Mar-May",
    "3m_Apr-Jun",
    "3m_May-Jul",
    "3m_Jun-Aug",
    "3m_Jul-Sep",
    "3m_Aug-Oct",
    "4m_Jan-Apr",
    "4m_Feb-May",
    "4m_Mar-Jun",
    "4m_Apr-Jul",
    "4m_May-Aug",
    "4m_Jun-Sep",
    "4m_Jul-Oct",
    "5m_Jan-May",
    "5m_Feb-Jun",
    "5m_Mar-Jul",
    "5m_Apr-Aug",
    "5m_May-Sep",
    "5m_Jun-Oct",
    "6m_Jan-Jun",
    "6m_Feb-Jul",
    "6m_Mar-Aug",
    "6m_Apr-Sep",
    "6m_May-Oct",
    "7m_Jan-Jul",
    "7m_Feb-Aug",
    "7m_Mar-Sep",
    "7m_Apr-Oct",
    "8m_Jan-Aug",
    "8m_Feb-Sep",
    "8m_Mar-Oct",
)
HORIZON_DRAWDOWNS = (0.0125, 0.025, 0.05, 0.075, 0.10)
HORIZON_PROTECTS = (0.025, 0.05, 0.075, 0.10)
CASH_SLOTS = (8, 12, 16, 24, 32, 48, 64)
BOOK_CASH = 64 * 5_000
BOOK_DRAWDOWNS = (0.0125, 0.025, 0.075, 0.10)
BOOK_PROTECTS = (0.025, 0.05, 0.10, 0.20, 0.30)
BOOK_SLOTS = (4, 6, 8, 12, 16, 20)
SCALE_SLOTS = 64
LOT_CAP = 16
PARK_SPY = "SPY"
PARK_TQQQ = "TQQQ"
FILLERS = ("VOO", "SSO", "UPRO", "SPXL", "QQQ", "QLD", "TQQQ")
SCALE_FILLERS = ("SPY", "none")
LOSS_MODES = ("ls", "dls")
LOT_MODES = ("1", "str")
LOT_FORMULAS = ("at", "sqra", "a", "sqra_target")
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
    profit_protect: float | None = None
    baseline: bool = False
    dd_before: float | None = None
    dd_after: float | None = None
    lock_profit: float | None = None
    lock_proj_frac: float | None = None
    slots: int | None = None
    filler: str | None = None
    loss_mode: str | None = None
    lot_mode: str | None = None
    lot_amount: float | None = None

    @property
    def staged(self) -> bool:
        return self.dd_before is not None

    def _prefix_parts(self):
        parts = []
        if self.hold_days is not None:
            parts.append(f"{self.hold_days}d")
        if self.target_frac is not None:
            parts.append(f"t{int(round(self.target_frac * 100))}")
        return parts

    def _staged_core(self):
        before = f"dd{self.dd_before * 100:g}"
        if self.lock_proj_frac is not None:
            lock = f"p{int(round(self.lock_proj_frac * 100))}"
        else:
            lock = f"k{self.lock_profit * 100:g}"
        after = f"dd{self.dd_after * 100:g}"
        return f"{before}-{lock}-{after}"

    @property
    def tag(self) -> str:
        if self.slots is not None and self.profit_protect is not None:
            dd = f"dd{self.drawdown * 100:g}"
            pp = f"pp{self.profit_protect * 100:g}"
            core = f"{dd}-{pp}-slots{self.slots}"
            parts = []
            if self.filler:
                parts.append(self.filler.lower())
            parts.append(core)
            if self.loss_mode:
                parts.append(self.loss_mode)
            if self.lot_mode:
                parts.append(self.lot_mode)
            return "-".join(parts)
        if self.slots is not None:
            return f"slots{self.slots}"
        parts = self._prefix_parts()
        if self.staged:
            parts.append(self._staged_core())
        elif self.profit_protect is not None:
            dd = f"dd{self.drawdown * 100:g}" if self.drawdown is not None else "dd"
            parts.append(f"{dd}-pp{self.profit_protect * 100:g}")
        elif self.drawdown is not None:
            parts.append(f"dd{self.drawdown * 100:g}")
        return "-".join(parts) or "hold"

    @property
    def short(self) -> str:
        if self.slots is not None and self.profit_protect is not None:
            size = (
                f"{self.slots} × ${self.lot_amount:,.0f}"
                if self.lot_amount
                else f"{self.slots} lots"
            )
            text = (
                f"{self.drawdown * 100:g}dd {self.profit_protect * 100:g}pp"
                f" · {size}"
            )
            if self.filler:
                text = f"{text} · {self.filler}"
            if self.loss_mode:
                text = f"{text} · {self.loss_mode}"
            if self.lot_mode:
                text = f"{text} · {self.lot_mode}"
            return text
        if self.slots is not None:
            return f"{self.slots} lots"
        parts = []
        if self.hold_days is not None:
            parts.append(f"{self.hold_days}d")
        if self.target_frac is not None:
            parts.append(f"{int(round(self.target_frac * 100))}%")
        if self.staged:
            before = f"{self.dd_before * 100:g}dd"
            after = f"{self.dd_after * 100:g}dd"
            if self.lock_proj_frac is not None:
                lock = f"{int(round(self.lock_proj_frac * 100))}%proj"
            else:
                lock = f"{self.lock_profit * 100:g}%"
            parts.append(f"{before}→{lock}→{after}")
        elif self.profit_protect is not None:
            if self.drawdown is not None:
                parts.append(f"{self.drawdown * 100:g}dd")
            parts.append(f"{self.profit_protect * 100:g}pp")
        elif self.drawdown is not None:
            parts.append(f"{self.drawdown * 100:g}dd")
        return " ".join(parts) or "hold"

    @property
    def label(self) -> str:
        if self.slots is not None and self.profit_protect is not None:
            text = (
                f"{self.slots} lots, {self.drawdown * 100:g}% loss dd, "
                f"{self.profit_protect * 100:g}% of peak gain"
            )
            if self.filler:
                return f"{text}, stop filler {self.filler}"
            return text
        if self.slots is not None:
            return (
                f"{self.slots} lots. Sell the biggest loss for a new buy, "
                "or the least profitable winner when it is the weaker signal."
            )
        if self.staged:
            before = f"{self.dd_before * 100:g}% dd"
            after = f"{self.dd_after * 100:g}% dd"
            if self.lock_proj_frac is not None:
                lock = f"{int(round(self.lock_proj_frac * 100))}% of projection"
            else:
                lock = f"+{self.lock_profit * 100:g}%"
            bits = []
            if self.hold_days is not None:
                bits.append(f"{self.hold_days}d")
            if self.target_frac is not None:
                bits.append(f"{int(round(self.target_frac * 100))}% target")
            bits.append(f"{before} until {lock}, then {after}")
            return " or ".join(bits)
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
        if self.profit_protect is not None:
            if self.drawdown is not None:
                bits.append(f"{self.drawdown * 100:g}% loss dd")
            bits.append(f"{self.profit_protect * 100:g}% of peak gain")
            return " or ".join(bits)
        if self.drawdown is not None:
            bits.append(f"{self.drawdown * 100:g}% dd")
        return " or ".join(bits)


WINNING_SELL = SellSpec(hold_days=30, target_frac=0.50, drawdown=0.075)


def signal_names():
    return _SELECTED_SIGNAL_NAMES or SIGNAL_NAMES


def set_signal_names(names):
    global _SELECTED_SIGNAL_NAMES
    if not names:
        _SELECTED_SIGNAL_NAMES = None
        return
    unknown = [name for name in names if name not in SIGNAL_NAME_CHOICES]
    if unknown:
        raise SystemExit(
            f"Unknown signal_name {unknown}; choose from {list(SIGNAL_NAME_CHOICES)}"
        )
    chosen = []
    for name in names:
        if name not in chosen:
            chosen.append(name)
    _SELECTED_SIGNAL_NAMES = tuple(chosen)


def with_signal_names(buys, names=None):
    names = signal_names() if names is None else names
    expanded = []
    for buy in buys:
        if buy.get("signal_name"):
            expanded.append(dict(buy))
            continue
        for name in names:
            row = dict(buy)
            row["signal_name"] = name
            expanded.append(row)
    return expanded


def freeze_buy_filter():
    return {
        "min_analysts": FREEZE_ANALYSTS,
        "min_projected": FREEZE_PROJECTED,
        "signal_name": signal_names()[0],
    }


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
    return with_signal_names(
        [
            {"min_analysts": n, "min_projected": float(p)}
            for n in ANALYST_CUTS
            for p in PROJECTED_CUTS
        ]
    )


def staged_buy():
    return {
        "min_analysts": 2,
        "min_projected": 20.0,
        "signal_name": signal_names()[0],
    }


def staged_sell_grid():
    """Known 30d 50% 7.5dd plus 15 two-stage trailing stops."""
    specs = [WINNING_SELL]
    rows = (
        (0.15, 0.05, None, 0.05),
        (0.15, 0.075, None, 0.075),
        (0.15, 0.10, None, 0.10),
        (0.15, None, 0.25, 0.05),
        (0.15, None, 0.25, 0.075),
        (0.10, 0.05, None, 0.05),
        (0.10, 0.075, None, 0.075),
        (0.10, 0.10, None, 0.10),
        (0.10, None, 0.25, 0.05),
        (0.10, None, 0.25, 0.075),
        (0.075, 0.05, None, 0.05),
        (0.075, 0.075, None, 0.075),
        (0.075, 0.10, None, 0.10),
        (0.075, None, 0.25, 0.05),
        (0.075, None, 0.25, 0.075),
    )
    for dd_before, lock_profit, lock_proj_frac, dd_after in rows:
        specs.append(
            SellSpec(
                dd_before=dd_before,
                lock_profit=lock_profit,
                lock_proj_frac=lock_proj_frac,
                dd_after=dd_after,
            )
        )
    return specs


def focus_sell_grid():
    return [
        SellSpec(hold_days=30, target_frac=0.50, drawdown=0.075),
        SellSpec(hold_days=30, drawdown=0.075),
        SellSpec(target_frac=0.50, drawdown=0.075),
        SellSpec(drawdown=0.075),
    ]


def focus_buy_grid():
    return with_signal_names(
        [
            {"min_analysts": n, "min_projected": float(p)}
            for n in (2, 3)
            for p in (20, 25, 30)
        ]
    )


def buy_label(filt):
    if filt.get("label"):
        base = filt["label"]
    elif filt.get("universe") == "fortune_500":
        base = "Fortune 500 at start"
    elif "min_percentile" in filt:
        base = f"signal_percentile > {filt['min_percentile']:.2f}"
    else:
        base = f"analyst>{filt['min_analysts']} · proj>{filt['min_projected']:.0f}%"
    name = filt.get("signal_name")
    if name and name not in str(base):
        base = f"{name} · {base}"
    window = filt.get("range_label")
    if window and window not in str(base):
        return f"{window} · {base}"
    return base


def signal_file_tag(name):
    if not name:
        return ""
    return "_" + str(name).replace("-", "")


def restrict_signal_name(frame, signal_name):
    if signal_name is None:
        return frame
    if "signal_name" not in frame.columns:
        if signal_name == SIGNAL_NAMES[0]:
            return frame
        return frame.iloc[0:0]
    return frame.loc[frame["signal_name"] == signal_name]


def restrict_signal_names(frame, names):
    if "signal_name" not in frame.columns:
        if SIGNAL_NAMES[0] in names:
            return frame
        return frame.iloc[0:0]
    out = frame.loc[frame["signal_name"].isin(list(names))]
    return out.sort_values(["date", "signal_score"], ascending=[True, False]).reset_index(
        drop=True
    )


def filter_signals(signals, min_analysts, min_projected, signal_name=None):
    out = restrict_signal_name(signals, signal_name)
    out = out[
        (out["analyst_projections_count"] > min_analysts)
        & (out["average_projected"] > min_projected)
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
        profit_protect=row.get("profit_protect"),
        baseline=bool(row.get("baseline", False)),
        dd_before=row.get("dd_before"),
        dd_after=row.get("dd_after"),
        lock_profit=row.get("lock_profit"),
        lock_proj_frac=row.get("lock_proj_frac"),
    )


def _record_exit(stats, staged, locked, time_hit, tgt_hit, dd_hit):
    if time_hit:
        stats["n_exit_time"] += 1
    if tgt_hit:
        stats["n_exit_target"] += 1
    if dd_hit:
        stats["n_exit_dd"] += 1
        if staged:
            if locked:
                stats["n_exit_tight"] += 1
            else:
                stats["n_exit_wide"] += 1


def _protect_stops(px, peak, entry_px, drawdown, profit_protect):
    """Loss dropdown from the entry, or a giveback of the peak gain.

    Loss: while this close is under the entry, sell at entry * (1 - dd).
    Profit: once a close has traded above the entry, sell when
    (peak - price) >= pp * (peak - entry). A 10% stop on a $10 entry whose
    high close is $12 sells at $11.80. The peak is updated before the check,
    so a new high does not sell.
    """
    pp_hit = (
        profit_protect is not None
        and peak > entry_px
        and px <= peak - profit_protect * (peak - entry_px)
    )
    dd_hit = (
        drawdown is not None
        and px < entry_px
        and px <= entry_px * (1.0 - drawdown)
    )
    return pp_hit, dd_hit


def position_strength(analysts, projected_pct):
    """sqrt(analysts capped at 10) × target percent floored to 10-point steps.

    Two analysts and a 33% target is sqrt(2) × 30.
    """
    count = min(max(float(analysts), 0.0), 10.0)
    bucket = math.floor(float(projected_pct) / 10.0) * 10.0
    return math.sqrt(count) * bucket


def position_lots(analysts, projected_pct, mode="at"):
    """Lots one signal opens. At least 1, at most 16.

    at (and str): floor(analysts × target percent / 10).
    Two analysts and 10% is 2. Four analysts and 40% is 16.
    sqra: floor(analysts²). Two analysts is 4. Four is 16.
    a: floor(analysts × 3). Two analysts is 6. Four is 12.
    sqra_target: floor(analysts² × target percent / 40).
    Two analysts and 10% is 1. Three analysts and 30% is 6.
    """
    count = max(float(analysts), 0.0)
    proj = float(projected_pct)
    if mode in ("str", "at"):
        raw = math.floor(count * proj / 10.0)
    elif mode == "sqra":
        raw = math.floor(count * count)
    elif mode == "a":
        raw = math.floor(count * 3.0)
    elif mode == "sqra_target":
        raw = math.floor(count * count * proj / 40.0)
    else:
        raise RuntimeError(f"unknown lot formula {mode}")
    return max(1, min(LOT_CAP, raw))


def _slot_replacement(marked, new_strength):
    """Lot to sell so a new signal can enter a full book, or None.

    marked is (lot, return, price). A loss is a negative return. The biggest
    loss is sold with no strength test. If every lot is in profit, the least
    profitable is sold only when its strength is strictly below the new signal.
    A flat lot is neither, so it blocks the winner swap.
    """
    if not marked:
        return None
    losers = [item for item in marked if item[1] < 0]
    if losers:
        return min(losers, key=lambda item: (item[1], item[0]["strength"], item[0]["entry"]))
    if all(item[1] > 0 for item in marked):
        least = min(marked, key=lambda item: (item[1], item[0]["strength"], item[0]["entry"]))
        if least[0]["strength"] < new_strength:
            return least
    return None


def _check_slot_book():
    """Synthetic book: strength formula, loss swap, and the winner-strength gate."""
    got = position_strength(2, 33)
    want = math.sqrt(2) * 30
    if abs(got - want) > 1e-9:
        raise RuntimeError(f"strength(2, 33) {got} != {want}")
    if position_strength(12, 33) != math.sqrt(10) * 30:
        raise RuntimeError("analysts above 10 must cap at 10")
    if position_strength(2, 39.9) != math.sqrt(2) * 30:
        raise RuntimeError("39.9% must floor to 30")

    index = pd.bdate_range("2026-01-05", periods=4)
    close = pd.DataFrame(
        {
            "A": [10.0, 10.0, 8.0, 8.0],
            "B": [10.0, 11.0, 12.0, 12.0],
            "C": [10.0, 10.0, 10.0, 14.0],
            "D": [10.0, 10.0, 10.5, 10.5],
            "E": [10.0, 10.0, 10.0, 10.0],
        },
        index=index,
    )
    spy = pd.Series(100.0, index=index, name=SPY)

    def frame(rows):
        return pd.DataFrame(rows)

    # Full book, A is the loser: sell A even though the new signal is weaker.
    loss = frame(
        [
            {"date": index[0], "ticker": "A", "analyst_projections_count": 4, "average_projected": 40, "signal_score": 2},
            {"date": index[0], "ticker": "B", "analyst_projections_count": 4, "average_projected": 40, "signal_score": 1},
            {"date": index[2], "ticker": "C", "analyst_projections_count": 1, "average_projected": 20, "signal_score": 1},
        ]
    )
    row, positions, _, _ = run_slot_book("loss", close, spy, loss, slots=2)
    closed = positions[positions["status"] == "Closed"]
    if list(closed["ticker"]) != ["A"] or abs(closed["pnl"].iloc[0] - -1000) > 1e-6:
        raise RuntimeError(f"biggest loss should sell A at -1000, got\n{positions}")
    if set(positions.loc[positions["status"] == "Open", "ticker"]) != {"B", "C"}:
        raise RuntimeError(f"B and C should stay open\n{positions}")
    if row["max_open_lots"] > 2:
        raise RuntimeError("book exceeded 2 slots")

    # Both in profit. Least profitable A is still stronger than D, so D is skipped.
    keep = frame(
        [
            {"date": index[0], "ticker": "A", "analyst_projections_count": 4, "average_projected": 40, "signal_score": 2},
            {"date": index[2], "ticker": "D", "analyst_projections_count": 1, "average_projected": 20, "signal_score": 1},
        ]
    )
    # A is +5% on day 2 (10.5). Use a price path where A is profitable.
    up = close.copy()
    up["A"] = [10.0, 10.2, 10.5, 10.5]
    _, kept, _, _ = run_slot_book("keep", up, spy, keep, slots=1)
    if list(kept["ticker"]) != ["A"] or (kept["status"] != "Open").any():
        raise RuntimeError(f"weaker new signal must not replace a stronger winner\n{kept}")

    # Least profitable winner is weaker than the new signal, so it is replaced.
    swap = frame(
        [
            {"date": index[0], "ticker": "E", "analyst_projections_count": 1, "average_projected": 20, "signal_score": 1},
            {"date": index[0], "ticker": "B", "analyst_projections_count": 4, "average_projected": 40, "signal_score": 2},
            {"date": index[2], "ticker": "C", "analyst_projections_count": 9, "average_projected": 50, "signal_score": 3},
        ]
    )
    # Day 2: E is +5% (10.5), B is +20% (12). Least profitable is E, strength 20 < 150.
    up["E"] = [10.0, 10.2, 10.5, 10.5]
    _, swapped, _, _ = run_slot_book("swap", up, spy, swap, slots=2)
    sold = swapped[swapped["status"] == "Closed"]
    if list(sold["ticker"]) != ["E"]:
        raise RuntimeError(f"least profitable weaker winner E should be sold\n{swapped}")
    if set(swapped.loc[swapped["status"] == "Open", "ticker"]) != {"B", "C"}:
        raise RuntimeError(f"B and C should remain\n{swapped}")

    # Same day, one slot: the stronger signal gets it. The flat lot is not sold.
    same = frame(
        [
            {"date": index[0], "ticker": "A", "analyst_projections_count": 4, "average_projected": 40, "signal_score": 1},
            {"date": index[0], "ticker": "B", "analyst_projections_count": 1, "average_projected": 20, "signal_score": 9},
        ]
    )
    _, first, _, _ = run_slot_book("same", close, spy, same, slots=1)
    if list(first["ticker"]) != ["A"]:
        raise RuntimeError(f"stronger same-day signal should take the only slot\n{first}")

    stopped = frame(
        [
            {
                "date": index[0],
                "ticker": "A",
                "analyst_projections_count": 4,
                "average_projected": 40,
                "signal_score": 1,
            }
        ]
    )
    down = close.copy()
    down["A"] = [10.0, 10.0, 9.8, 9.8]
    _, hit, _, _ = run_slot_book(
        "dd", down, spy, stopped, slots=4, drawdown=0.0125, profit_protect=0.30
    )
    if list(hit["status"]) != ["Closed"] or hit["date_sell"].iloc[0] != index[2].strftime("%Y-%m-%d"):
        raise RuntimeError(f"1.25dd should sell a 9.80 close\n{hit}")
    _, held_dd, _, _ = run_slot_book(
        "dd-wide", down, spy, stopped, slots=4, drawdown=0.025, profit_protect=0.30
    )
    if list(held_dd["status"]) != ["Open"]:
        raise RuntimeError(f"2.5dd should keep a 9.80 close\n{held_dd}")

    trail = close.copy()
    trail["A"] = [10.0, 12.0, 11.8, 11.8]
    _, trailed, _, _ = run_slot_book(
        "pp", trail, spy, stopped, slots=4, drawdown=0.10, profit_protect=0.10
    )
    if list(trailed["status"]) != ["Closed"] or abs(trailed["price_sell"].iloc[0] - 11.8) > 1e-9:
        raise RuntimeError(f"10pp should sell the 11.80 giveback\n{trailed}")

    # A ticker that is still held does not open a second position.
    again = frame(
        [
            {"date": index[0], "ticker": "A", "analyst_projections_count": 4, "average_projected": 40, "signal_score": 2},
            {"date": index[2], "ticker": "A", "analyst_projections_count": 9, "average_projected": 50, "signal_score": 9},
            {"date": index[2], "ticker": "C", "analyst_projections_count": 1, "average_projected": 20, "signal_score": 1},
        ]
    )
    _, once, _, _ = run_slot_book("one-ticker", close, spy, again, slots=2)
    held_a = once[once["ticker"] == "A"]
    if len(held_a) != 1 or held_a["date_buy"].iloc[0] != index[0].strftime("%Y-%m-%d"):
        raise RuntimeError(f"a held ticker must keep its one position\n{once}")
    if set(once.loc[once["status"] == "Open", "ticker"]) != {"A", "C"}:
        raise RuntimeError(f"the other ticker should take the free slot\n{once}")

    same_name = frame(
        [
            {"date": index[0], "ticker": "A", "analyst_projections_count": 4, "average_projected": 40, "signal_score": 1},
            {"date": index[0], "ticker": "A", "analyst_projections_count": 1, "average_projected": 10, "signal_score": 9},
        ]
    )
    _, one_day, _, _ = run_slot_book("same-ticker", close, spy, same_name, slots=4)
    if len(one_day) != 1 or one_day["date_buy"].iloc[0] != index[0].strftime("%Y-%m-%d"):
        raise RuntimeError(f"same-day signals on one ticker are one position\n{one_day}")

    # After the position closes, the next signal opens a new one.
    reopen = frame(
        [
            {"date": index[0], "ticker": "A", "analyst_projections_count": 4, "average_projected": 40, "signal_score": 1},
            {"date": index[3], "ticker": "A", "analyst_projections_count": 4, "average_projected": 40, "signal_score": 1},
        ]
    )
    _, reopened, _, _ = run_slot_book(
        "reopen", down, spy, reopen, slots=2, drawdown=0.0125, profit_protect=0.30
    )
    closed_a = reopened[reopened["status"] == "Closed"]
    open_a = reopened[reopened["status"] == "Open"]
    if (
        list(closed_a["date_buy"]) != [index[0].strftime("%Y-%m-%d")]
        or list(open_a["date_buy"]) != [index[3].strftime("%Y-%m-%d")]
    ):
        raise RuntimeError(f"a closed ticker can open again\n{reopened}")
    print("Slot book checks passed.")


def _check_park_book():
    """Free slots hold TQQQ. A stop with no new ticker holds SPY. SPY is sold first."""
    index = pd.bdate_range("2026-01-05", periods=4)
    close = pd.DataFrame(
        {
            "A": [10.0, 10.0, 9.8, 9.8],
            "B": [10.0, 10.5, 11.0, 12.0],
            "C": [10.0, 10.0, 10.0, 10.0],
        },
        index=index,
    )
    spy = pd.Series(100.0, index=index, name=PARK_SPY)
    tqqq = pd.Series(50.0, index=index, name=PARK_TQQQ)

    def frame(rows):
        return pd.DataFrame(rows)

    both = frame(
        [
            {"date": index[0], "ticker": "A", "analyst_projections_count": 2, "average_projected": 40, "signal_score": 1},
            {"date": index[0], "ticker": "B", "analyst_projections_count": 4, "average_projected": 40, "signal_score": 2},
            {"date": index[3], "ticker": "C", "analyst_projections_count": 9, "average_projected": 50, "signal_score": 3},
        ]
    )
    _, parked, _, _ = run_slot_book(
        "spy-first", close, spy, both, slots=2, drawdown=0.0125, profit_protect=0.30, tqqq=tqqq
    )
    closed = parked[parked["status"] == "Closed"]
    opened = set(parked.loc[parked["status"] == "Open", "ticker"])
    if list(closed["ticker"]) != ["A", PARK_SPY] or opened != {"B", "C"}:
        raise RuntimeError(f"new buy should sell SPY before the stock\n{parked}")

    one = frame(
        [
            {"date": index[0], "ticker": "B", "analyst_projections_count": 4, "average_projected": 40, "signal_score": 1},
            {"date": index[3], "ticker": "C", "analyst_projections_count": 9, "average_projected": 50, "signal_score": 2},
        ]
    )
    _, filler, _, _ = run_slot_book(
        "tqqq", close, spy, one, slots=2, drawdown=0.10, profit_protect=0.30, tqqq=tqqq
    )
    if list(filler.loc[filler["status"] == "Closed", "ticker"]) != [PARK_TQQQ]:
        raise RuntimeError(f"free-slot TQQQ should be sold before the stock\n{filler}")
    if set(filler.loc[filler["status"] == "Open", "ticker"]) != {"B", "C"}:
        raise RuntimeError(f"B and C should remain after TQQQ is sold\n{filler}")

    reuse = frame(
        [
            {"date": index[0], "ticker": "A", "analyst_projections_count": 2, "average_projected": 40, "signal_score": 1},
            {"date": index[2], "ticker": "C", "analyst_projections_count": 4, "average_projected": 40, "signal_score": 1},
        ]
    )
    _, reused, _, _ = run_slot_book(
        "reuse", close, spy, reuse, slots=1, drawdown=0.0125, profit_protect=0.30, tqqq=tqqq
    )
    if PARK_SPY in set(reused["ticker"]) or list(reused.loc[reused["status"] == "Open", "ticker"]) != ["C"]:
        raise RuntimeError(f"a same-day signal should take the stopped slot, not buy SPY\n{reused}")
    print("Park checks passed.")


def _check_filler_book():
    """A stop fills the chosen ETF, and a new buy sells that ETF before TQQQ."""
    index = pd.bdate_range("2026-01-05", periods=4)
    close = pd.DataFrame(
        {"A": [10.0, 10.0, 9.8, 9.8], "C": [10.0, 10.0, 10.0, 10.0]},
        index=index,
    )
    spy = pd.Series(100.0, index=index, name=PARK_SPY)
    tqqq = pd.Series(50.0, index=index, name=PARK_TQQQ)
    voo = pd.Series(80.0, index=index, name="VOO")
    signals = pd.DataFrame(
        [
            {"date": index[0], "ticker": "A", "analyst_projections_count": 2, "average_projected": 40, "signal_score": 1},
            {"date": index[3], "ticker": "C", "analyst_projections_count": 4, "average_projected": 40, "signal_score": 1},
        ]
    )
    _, booked, _, _ = run_slot_book(
        "voo",
        close,
        spy,
        signals,
        slots=2,
        drawdown=0.0125,
        profit_protect=0.30,
        tqqq=tqqq,
        park=voo,
        park_ticker="VOO",
    )
    closed = list(booked.loc[booked["status"] == "Closed", "ticker"])
    opened = set(booked.loc[booked["status"] == "Open", "ticker"])
    if closed != ["A", "VOO"] or opened != {PARK_TQQQ, "C"}:
        raise RuntimeError(f"a new buy should sell the stop filler before TQQQ\n{booked}")
    print("Filler checks passed.")


def _check_scale_book():
    """Lot count, daily-loss victim, and a stop that stays empty when SPY filler is off."""
    if position_lots(2, 10) != 2 or position_lots(2, 20) != 4:
        raise RuntimeError("2 analysts at 10% and 20% must be 2 and 4 lots")
    if position_lots(3, 30) != 9 or position_lots(4, 40) != 16:
        raise RuntimeError("3×30% must be 9 lots and 4×40% must be 16")
    if position_lots(6, 50) != 16:
        raise RuntimeError("lot count caps at 16")

    index = pd.bdate_range("2026-01-05", periods=6)
    close = pd.DataFrame(
        {
            "A": [10.0, 9.6, 9.2, 8.8, 8.4, 8.0],
            "B": [10.0, 10.0, 10.0, 10.0, 10.0, 9.0],
            "C": [10.0, 10.0, 10.0, 10.0, 10.0, 10.0],
        },
        index=index,
    )
    spy = pd.Series(100.0, index=index, name=PARK_SPY)
    signals = pd.DataFrame(
        [
            {"date": index[0], "ticker": "A", "analyst_projections_count": 4, "average_projected": 40, "signal_score": 1},
            {"date": index[4], "ticker": "B", "analyst_projections_count": 4, "average_projected": 40, "signal_score": 1},
            {"date": index[5], "ticker": "C", "analyst_projections_count": 9, "average_projected": 50, "signal_score": 1},
        ]
    )
    _, by_loss, _, _ = run_slot_book("ls", close, spy, signals, slots=2)
    _, by_day, _, _ = run_slot_book("dls", close, spy, signals, slots=2, daily_loss=True)
    if list(by_loss.loc[by_loss["status"] == "Closed", "ticker"]) != ["A"]:
        raise RuntimeError(f"ls should sell the bigger loss\n{by_loss}")
    if list(by_day.loc[by_day["status"] == "Closed", "ticker"]) != ["B"]:
        raise RuntimeError(f"dls should sell the steeper daily loss\n{by_day}")

    stop_index = pd.bdate_range("2026-01-05", periods=4)
    stopped = pd.DataFrame({"A": [10.0, 10.0, 9.8, 9.8]}, index=stop_index)
    tqqq = pd.Series(50.0, index=stop_index, name=PARK_TQQQ)
    one = pd.DataFrame(
        [
            {
                "date": stop_index[0],
                "ticker": "A",
                "analyst_projections_count": 2,
                "average_projected": 40,
                "signal_score": 1,
            }
        ]
    )
    sleeve = pd.Series(100.0, index=stop_index, name=PARK_SPY)
    _, empty, _, _ = run_slot_book(
        "no-spy",
        stopped,
        sleeve,
        one,
        slots=2,
        drawdown=0.0125,
        profit_protect=0.30,
        tqqq=tqqq,
        spy_fill=False,
    )
    if PARK_SPY in set(empty["ticker"]) or list(empty.loc[empty["status"] == "Open", "ticker"]) != [PARK_TQQQ]:
        raise RuntimeError(f"a stop without SPY filler should leave the slot empty\n{empty}")
    print("Scale checks passed.")


def _check_cash_book():
    """Idle cash earns nothing, and a stop is not refilled with SPY or TQQQ."""
    index = pd.bdate_range("2026-01-05", periods=4)
    close = pd.DataFrame({"A": [10.0, 10.0, 10.0, 10.0]}, index=index)
    spy = pd.Series([100.0, 100.0, 100.0, 200.0], index=index, name=PARK_SPY)
    signals = pd.DataFrame(
        [
            {
                "date": index[0],
                "ticker": "A",
                "analyst_projections_count": 2,
                "average_projected": 40,
                "signal_score": 1,
            }
        ]
    )
    off, off_pos, _, _ = run_slot_book(
        "cash-off", close, spy, signals, slots=2, cash_sleeve=False
    )
    on, _, _, _ = run_slot_book(
        "cash-on", close, spy, signals, slots=2, cash_sleeve=True
    )
    if set(off_pos["ticker"]) != {"A"}:
        raise RuntimeError(f"cash book must hold only the stock\n{off_pos}")
    if abs(off["pnl"]) > 1:
        raise RuntimeError(f"idle cash must not earn SPY, pnl {off['pnl']}")
    if on["pnl"] < 1000:
        raise RuntimeError(f"SPY sleeve should earn when it is on, pnl {on['pnl']}")

    stopped = pd.DataFrame({"A": [10.0, 10.0, 9.8, 9.8]}, index=index)
    _, empty, _, _ = run_slot_book(
        "cash-stop",
        stopped,
        spy,
        signals,
        slots=2,
        drawdown=0.0125,
        profit_protect=0.30,
        cash_sleeve=False,
        lot_mode="str",
    )
    if set(empty["ticker"]) & {PARK_SPY, PARK_TQQQ} or (empty["status"] == "Open").any():
        raise RuntimeError(f"a stop must leave cash, not SPY or TQQQ\n{empty}")
    if len(empty) != 2:
        raise RuntimeError(f"strength should fill both slots, then stop\n{empty}")
    print("Cash checks passed.")


def _check_split_book():
    """A fixed book puts more dollars in each lot when there are fewer lots."""
    index = pd.bdate_range("2026-01-05", periods=3)
    close = pd.DataFrame({"A": [10.0, 10.0, 12.0]}, index=index)
    spy = pd.Series([100.0, 100.0, 200.0], index=index, name=PARK_SPY)
    signals = pd.DataFrame(
        [
            {
                "date": index[0],
                "ticker": "A",
                "analyst_projections_count": 2,
                "average_projected": 40,
                "signal_score": 1,
            }
        ]
    )
    row, positions, _, init = run_slot_book(
        "split",
        close,
        spy,
        signals,
        slots=2,
        cash_sleeve=False,
        lot_amount=40_000,
    )
    if init != 80_000:
        raise RuntimeError(f"two $40,000 lots must be an $80,000 book, got {init}")
    if abs(row["pnl"] - 8_000) > 1 or abs(row["avg_lot_amount"] - 40_000) > 1:
        raise RuntimeError(f"a 20% gain on one $40,000 lot must be $8,000\n{row}")
    if set(positions["ticker"]) != {"A"}:
        raise RuntimeError(f"split book must hold only the stock\n{positions}")
    if abs(row["lot_days_util_pct"] - 50.0) > 0.1:
        raise RuntimeError(
            f"one lot of two, held all 3 days, is 50% of lot-days, got {row['lot_days_util_pct']}"
        )
    print("Split checks passed.")


def _check_lot_formulas():
    """The four strength sizes, including the cap at 16."""
    cases = (
        ("at", 2, 10, 2),
        ("at", 2, 20, 4),
        ("at", 3, 30, 9),
        ("at", 4, 40, 16),
        ("at", 5, 50, 16),
        ("str", 2, 10, 2),
        ("sqra", 2, 99, 4),
        ("sqra", 3, 10, 9),
        ("sqra", 4, 10, 16),
        ("sqra", 5, 10, 16),
        ("a", 2, 10, 6),
        ("a", 3, 10, 9),
        ("a", 4, 10, 12),
        ("a", 6, 10, 16),
        ("sqra_target", 2, 10, 1),
        ("sqra_target", 2, 20, 2),
        ("sqra_target", 3, 30, 6),
        ("sqra_target", 4, 40, 16),
    )
    for mode, analysts, proj, want in cases:
        got = position_lots(analysts, proj, mode)
        if got != want:
            raise RuntimeError(f"{mode}({analysts}, {proj}) = {got}, want {want}")
    index = pd.bdate_range("2026-01-05", periods=2)
    close = pd.DataFrame({"A": [10.0, 10.0]}, index=index)
    spy = pd.Series(100.0, index=index, name=PARK_SPY)
    signals = pd.DataFrame(
        [
            {
                "date": index[0],
                "ticker": "A",
                "analyst_projections_count": 3,
                "average_projected": 30,
                "signal_score": 1,
            }
        ]
    )
    for mode, want in (("at", 9), ("sqra", 9), ("a", 9), ("sqra_target", 6)):
        _, positions, _, _ = run_slot_book(
            mode,
            close,
            spy,
            signals,
            slots=16,
            cash_sleeve=False,
            lot_mode=mode,
        )
        if len(positions) != want:
            raise RuntimeError(f"{mode} opened {len(positions)} lots, want {want}")
    print("Lot formula checks passed.")


def _check_position_win_rate():
    """A multi-lot entry is one position. Lot count does not weight the rate."""
    frame = pd.DataFrame(
        [
            {"ticker": "A", "date_buy": "2026-01-05", "price_buy": 10.0, "pnl": 100.0},
            {"ticker": "A", "date_buy": "2026-01-05", "price_buy": 10.0, "pnl": -40.0},
            {"ticker": "B", "date_buy": "2026-01-05", "price_buy": 10.0, "pnl": -10.0},
        ]
    )
    rate = position_win_rate(frame)
    if abs(rate - 50.0) > 0.1:
        raise RuntimeError(f"two lots netting a win and one loser is 50%, got {rate}")
    if position_win_rate(frame.iloc[0:0]) != 0.0:
        raise RuntimeError("an empty book must have a 0% win rate")

    index = pd.bdate_range("2026-01-05", periods=3)
    close = pd.DataFrame(
        {"A": [10.0, 10.0, 12.0], "B": [10.0, 10.0, 9.0]},
        index=index,
    )
    spy = pd.Series([100.0, 100.0, 100.0], index=index, name=PARK_SPY)
    signals = pd.DataFrame(
        [
            {
                "date": index[0],
                "ticker": "A",
                "analyst_projections_count": 2,
                "average_projected": 10,
                "signal_score": 1,
            },
            {
                "date": index[0],
                "ticker": "B",
                "analyst_projections_count": 1,
                "average_projected": 10,
                "signal_score": 1,
            },
        ]
    )
    row, positions, _, _ = run_slot_book(
        "position-win",
        close,
        spy,
        signals,
        slots=8,
        cash_sleeve=False,
        lot_mode="at",
    )
    if len(positions) != 3:
        raise RuntimeError(f"at should open 2 lots of A and 1 of B, got {len(positions)}")
    if abs(row["win_rate_pct"] - 50.0) > 0.1:
        raise RuntimeError(
            f"one winning position and one losing position is 50%, got {row['win_rate_pct']}"
        )
    if row["n_symbols"] != 2 or row["n_positions"] != 2:
        raise RuntimeError(
            f"two lots of A and one of B are 2 symbols and 2 positions, "
            f"got {row['n_symbols']} symbols and {row['n_positions']} positions"
        )
    print("Position win-rate checks passed.")


def position_win_rate(positions):
    """Share of positions with positive P&L.

    Lots opened together — the same ticker, buy date, and buy price — are
    one position. A four-lot winner counts once. The position wins when the
    sum of those lots' P&L is positive.
    """
    if positions is None or len(positions) == 0:
        return 0.0
    pnl = positions.groupby(["ticker", "date_buy", "price_buy"], sort=False)["pnl"].sum()
    n_positions = int(len(pnl))
    if not n_positions:
        return 0.0
    return float((pnl > 0).sum()) / n_positions * 100.0


def trade_counts(positions):
    """Distinct symbols and positions in a cell's lots.

    A symbol counts once when several lots, or several signals, use it.
    A position counts once: lots with the same ticker, buy date, and buy
    price are one position. SPY and TQQQ parks are left out.
    """
    if positions is None or len(positions) == 0:
        return 0, 0
    frame = positions.loc[~positions["ticker"].isin((PARK_SPY, PARK_TQQQ))]
    if len(frame) == 0:
        return 0, 0
    n_symbols = int(frame["ticker"].nunique())
    n_positions = int(frame.groupby(["ticker", "date_buy", "price_buy"], sort=False).ngroups)
    return n_symbols, n_positions


def run_slot_book(
    label,
    close,
    spy,
    signals,
    slots=SLOT_COUNT,
    drawdown=None,
    profit_protect=None,
    tqqq=None,
    park=None,
    park_ticker=None,
    spy_fill=None,
    daily_loss=False,
    lot_mode=None,
    cash_sleeve=True,
    lot_amount=None,
):
    """At most `slots` open lots.

    A signal buys at that day's close when a slot is free. On a full book it
    sells the biggest loss at that close and buys. If every open lot is in
    profit, it sells the least profitable one only when that lot's strength
    is strictly below the new signal's strength. A ticker that already has
    an open position is skipped. Lots opened by the signal in hand stay one
    position. After that position closes, a later signal can open a new one.
    Same-day signals are taken strongest first.

    When drawdown and profit_protect are set, those stops run first each day,
    before new signals. Loss dropdown sells while the close is under the
    entry. Profit protection sells a giveback of the gain from entry to the
    highest close. A new high does not sell. Stops do not apply to SPY or TQQQ.

    When tqqq is set, the book is filled at the close. A slot still empty
    after today's stock buys holds TQQQ. A slot freed by a stop and not reused
    for a new ticker holds the stop filler, SPY unless park_ticker is set.
    A new buy sells that filler before TQQQ, and TQQQ before a stock.

    cash_sleeve false keeps uninvested money as cash. The sleeve does not
    buy SPY, and with no tqqq the empty slots stay empty.
    """
    from backtest import bar_dates

    dates = bar_dates(close.index)
    n = len(dates)
    spy_px = aligned_spy(spy, close.index).to_numpy(dtype=float)
    held = [ticker for ticker in signals["ticker"].drop_duplicates() if ticker in close.columns]
    if not held or n == 0:
        raise RuntimeError(f"No price data for {label}")
    prices = {ticker: close[ticker].to_numpy(dtype=float) for ticker in held}
    tqqq_px = None
    stop_px = None
    stop_ticker = park_ticker or PARK_SPY
    use_spy_fill = True if spy_fill is None else bool(spy_fill)
    if tqqq is not None:
        tqqq_px = aligned_spy(tqqq, close.index).to_numpy(dtype=float)
        prices[PARK_TQQQ] = tqqq_px
        if use_spy_fill:
            if stop_ticker == PARK_TQQQ:
                stop_px = tqqq_px
            elif park is not None:
                stop_px = aligned_spy(park, close.index).to_numpy(dtype=float)
                prices[stop_ticker] = stop_px
            else:
                stop_px = spy_px
                prices[PARK_SPY] = spy_px
    located = signals.copy()
    if "signal_score" in located.columns:
        located["rank"] = located["signal_score"]
    else:
        located["rank"] = 0.0
    located["bar"] = dates.get_indexer(pd.to_datetime(located["date"]).dt.normalize(), method="bfill")
    by_day = defaultdict(list)
    n_signals = 0
    for row in located.itertuples(index=False):
        loc = int(row.bar)
        ticker = row.ticker
        blocked = {PARK_TQQQ}
        if use_spy_fill:
            blocked.add(stop_ticker)
        if tqqq_px is not None and ticker in blocked:
            continue
        if loc < 0 or loc >= n or ticker not in prices:
            continue
        px = float(prices[ticker][loc])
        if not math.isfinite(px) or px <= 0:
            continue
        n_signals += 1
        by_day[loc].append(
            {
                "ticker": ticker,
                "entry": loc,
                "strength": position_strength(row.analyst_projections_count, row.average_projected),
                "score": float(row.rank) if pd.notna(row.rank) else 0.0,
                "lots": (
                    1
                    if not lot_mode or lot_mode == "1"
                    else position_lots(
                        row.analyst_projections_count,
                        row.average_projected,
                        lot_mode,
                    )
                ),
            }
        )

    amount = float(POSITION_VALUE if lot_amount is None else lot_amount)
    init_cash = amount * slots
    if cash_sleeve:
        spy_shares = init_cash / float(spy_px[0])
        cash = 0.0
    else:
        spy_shares = 0.0
        cash = float(init_cash)
    open_lots = []
    records = []
    open_counts = []
    navs = []
    stocks = []
    idle_cash = 0

    def mark(lot, t):
        px = float(prices[lot["ticker"]][t])
        if not math.isfinite(px) or px <= 0:
            return None
        return px / lot["entry_px"] - 1.0, px

    def fund_buy(t):
        nonlocal spy_shares, cash
        cost = amount
        px = float(spy_px[t])
        take = min(spy_shares, cost / px)
        spy_shares -= take
        cash -= cost - take * px

    def fund_sell(proceeds, t):
        nonlocal spy_shares, cash
        left = proceeds
        if cash < 0:
            repay = min(left, -cash)
            cash += repay
            left -= repay
        if left:
            if cash_sleeve:
                spy_shares += left / float(spy_px[t])
            else:
                cash += left

    def record(lot, t, px, status):
        ret = (px / lot["entry_px"] - 1.0) * 100.0
        hold = max(t - lot["entry"] + 1, 1)
        spy_ret = (float(spy_px[t]) / float(spy_px[lot["entry"]]) - 1.0) * 100.0
        records.append(
            {
                "ticker": lot["ticker"],
                "date_buy": dates[lot["entry"]].strftime("%Y-%m-%d"),
                "date_sell": dates[t].strftime("%Y-%m-%d"),
                "price_buy": lot["entry_px"],
                "price_sell": px,
                "pnl": amount * ret / 100.0,
                "return_pct": ret,
                "return_pct_30d": ret * HOLD_NORM_DAYS / hold,
                "spy_pct": spy_ret,
                "vs_spy_pct": ret - spy_ret,
                "hold_days": hold,
                "status": status,
            }
        )

    def close_lot(lot, t, px):
        fund_sell(amount * px / lot["entry_px"], t)
        record(lot, t, px, "Closed")
        open_lots.remove(lot)

    def open_lot(signal, t, px, park=False):
        fund_buy(t)
        open_lots.append(
            {
                "ticker": signal["ticker"],
                "entry": t,
                "entry_px": px,
                "peak": px,
                "strength": signal["strength"],
                "park": park,
            }
        )

    def sell_park(ticker, t):
        for lot in list(open_lots):
            if lot["ticker"] != ticker:
                continue
            point = mark(lot, t)
            if point is None:
                continue
            close_lot(lot, t, point[1])
            return True
        return False

    for t in range(n):
        freed_by_stop = 0
        if drawdown is not None or profit_protect is not None:
            for lot in list(open_lots):
                if lot.get("park") or lot["entry"] >= t:
                    continue
                point = mark(lot, t)
                if point is None:
                    continue
                px = point[1]
                if px > lot["peak"]:
                    lot["peak"] = px
                pp_hit, dd_hit = _protect_stops(
                    px, lot["peak"], lot["entry_px"], drawdown, profit_protect
                )
                if pp_hit or dd_hit:
                    close_lot(lot, t, px)
                    freed_by_stop += 1
        todays = by_day.get(t, [])
        todays.sort(key=lambda signal: (signal["strength"], signal["score"]), reverse=True)
        for signal in todays:
            if any(
                lot["ticker"] == signal["ticker"] and not lot.get("park")
                for lot in open_lots
            ):
                continue
            px = float(prices[signal["ticker"]][t])
            if not math.isfinite(px) or px <= 0:
                continue
            for _ in range(int(signal["lots"])):
                if len(open_lots) < slots:
                    open_lot(signal, t, px)
                    if freed_by_stop > 0:
                        freed_by_stop -= 1
                    elif not use_spy_fill and idle_cash > 0:
                        idle_cash -= 1
                    continue
                if use_spy_fill and tqqq_px is not None and sell_park(stop_ticker, t):
                    open_lot(signal, t, px)
                    continue
                if (
                    tqqq_px is not None
                    and (not use_spy_fill or stop_ticker != PARK_TQQQ)
                    and sell_park(PARK_TQQQ, t)
                ):
                    open_lot(signal, t, px)
                    continue
                marked = []
                blocked = False
                for lot in open_lots:
                    if lot.get("park"):
                        continue
                    point = mark(lot, t)
                    if point is None:
                        blocked = True
                        break
                    ret = point[0]
                    if daily_loss:
                        held_days = max((dates[t] - dates[lot["entry"]]).days, 1)
                        ret = ret / held_days
                    marked.append((lot, ret, point[1]))
                if blocked or not marked:
                    break
                victim = _slot_replacement(marked, signal["strength"])
                if victim is None:
                    break
                close_lot(victim[0], t, victim[2])
                open_lot(signal, t, px)
        if tqqq_px is not None:
            if not use_spy_fill:
                idle_cash += freed_by_stop
                freed_by_stop = 0
            room = slots if use_spy_fill else slots - idle_cash
            while len(open_lots) < room:
                if use_spy_fill and freed_by_stop > 0:
                    fill_px = float(stop_px[t])
                    fill = stop_ticker
                else:
                    fill_px = float(tqqq_px[t])
                    fill = PARK_TQQQ
                if not math.isfinite(fill_px) or fill_px <= 0:
                    break
                if use_spy_fill and fill == stop_ticker and freed_by_stop > 0:
                    freed_by_stop -= 1
                open_lot({"ticker": fill, "strength": 0.0}, t, fill_px, park=True)
        stock = 0.0
        for lot in open_lots:
            point = mark(lot, t)
            if point is not None:
                stock += amount * (1.0 + point[0])
        navs.append(stock + spy_shares * float(spy_px[t]) + cash)
        stocks.append(stock)
        open_counts.append(len(open_lots))

    last = n - 1
    for lot in list(open_lots):
        point = mark(lot, last)
        px = point[1] if point is not None else lot["entry_px"]
        record(lot, last, px, "Open")

    positions = pd.DataFrame(
        records,
        columns=[
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
        ],
    )
    stock_pnl = float(positions["pnl"].sum()) if len(positions) else 0.0
    nav = pd.Series(navs, index=close.index)
    pnl = float(nav.iloc[-1]) - init_cash if len(nav) else 0.0
    spy_bnh = (float(spy_px[-1]) / float(spy_px[0]) - 1.0) * 100.0
    n_trades = len(positions)
    n_open = int((positions["status"] == "Open").sum()) if n_trades else 0
    n_closed = n_trades - n_open
    n_symbols, n_positions = trade_counts(positions)
    avg_lots = float(sum(open_counts) / len(open_counts)) if open_counts else 0.0
    max_lots = int(max(open_counts)) if open_counts else 0
    cost = avg_lots * amount
    weight = []
    for stock, value in zip(stocks, navs):
        if value:
            weight.append(stock / value)
    peak = nav.cummax()
    drawdown = float((nav / peak - 1.0).min()) * 100.0 if len(nav) else 0.0
    covered = set()
    lot_days = 0
    starts = []
    ends = []
    for buy, sell in zip(positions["date_buy"], positions["date_sell"]) if n_trades else []:
        start = pd.Timestamp(buy).normalize()
        end = pd.Timestamp(sell).normalize()
        span = int((end - start).days) + 1
        covered.update(start + pd.Timedelta(days=i) for i in range(span))
        lot_days += span
        starts.append(buy)
        ends.append(sell)
    period_days = int((pd.Timestamp(dates[-1]) - pd.Timestamp(dates[0])).days) + 1
    possible_lot_days = slots * period_days
    row = {
        "label": label,
        "n_signals": n_signals,
        "n_trades": n_trades,
        "n_closed": n_closed,
        "n_open": n_open,
        "n_symbols": n_symbols,
        "n_positions": n_positions,
        "stock_pnl": stock_pnl,
        "pnl": pnl,
        "return_pct": pnl / init_cash * 100.0 if init_cash else 0.0,
        "spy_pct": spy_bnh,
        "vs_spy_pct": (pnl / init_cash * 100.0 if init_cash else 0.0) - spy_bnh,
        "avg_stock_invested": cost,
        "avg_open_lots": avg_lots,
        "max_open_lots": max_lots,
        "avg_invested_pct": cost / init_cash * 100.0 if init_cash else 0.0,
        "peak_invested_pct": max_lots * amount / init_cash * 100.0 if init_cash else 0.0,
        "return_on_avg_invested_pct": stock_pnl / cost * 100.0 if cost else 0.0,
        "avg_exposure_pct": float(sum(weight) / len(weight)) * 100.0 if weight else 0.0,
        "peak_exposure_pct": float(max(weight)) * 100.0 if weight else 0.0,
        "win_rate_pct": position_win_rate(positions),
        "max_drawdown_pct": drawdown,
        "mean_lot_return_pct": float(positions["return_pct"].mean()) if n_trades else 0.0,
        "mean_vs_spy_pct": float(positions["vs_spy_pct"].mean()) if n_trades else 0.0,
        "trade_from": min(starts) if starts else "",
        "trade_to": max(ends) if ends else "",
        "days_exposed": len(covered),
        "lot_days": int(lot_days),
        "lot_days_util_pct": (
            lot_days / possible_lot_days * 100.0 if possible_lot_days else 0.0
        ),
        "slots": slots,
        "avg_lot_amount": amount if n_trades else 0.0,
    }
    return row, positions, close, init_cash


def exits_from_spec(close_wide, meta, spec: SellSpec, one_lot=False):
    """OR of time stop, target fraction of projected upside, trailing drawdown.

    Profit-protection specs skip that OR. They sell on a loss dropdown from
    the entry, or on a giveback of the highest close's gain. No time stop
    and no projection target.

    Default: each signal is its own lot. A new signal for the same ticker
    while a lot is open resets that lot's time stop and projection target.
    Peak for drawdown is since entry.

    one_lot: at most one open lot per ticker. A later buy while that lot is
    open does not open another lot. It restarts the hold clock from that
    bar. The target and the drawdown peak stay on the original entry.

    Two-stage specs use dd_before until the lock (fixed % from entry, or a
    fraction of analyst projection), then dd_after. Peak still starts at
    entry and does not reset.
    """
    exits = pd.DataFrame(False, index=close_wide.index, columns=close_wide.columns)
    n = len(close_wide)
    col_index = {name: i for i, name in enumerate(close_wide.columns)}
    hold_days = spec.hold_days
    target_frac = spec.target_frac
    drawdown = spec.drawdown
    profit_protect = spec.profit_protect
    dd_before = spec.dd_before
    dd_after = spec.dd_after
    lock_profit = spec.lock_profit
    lock_proj_frac = spec.lock_proj_frac
    staged = spec.staged
    stats = {
        "n_exit_wide": 0,
        "n_exit_tight": 0,
        "n_exit_time": 0,
        "n_exit_target": 0,
        "n_exit_dd": 0,
        "n_locked": 0,
        "n_still_open": 0,
        "n_lots": 0,
        "n_extended": 0,
        "opened_columns": [],
    }

    for _, group in meta.groupby("ticker"):
        group = group.sort_values("entry_loc", kind="mergesort")
        prices = close_wide[group["column"].iloc[0]].to_numpy()
        if one_lot:
            _exits_one_lot(
                list(group.itertuples(index=False)),
                prices,
                exits,
                col_index,
                n,
                stats,
                hold_days,
                target_frac,
                drawdown,
                profit_protect,
                dd_before,
                dd_after,
                lock_profit,
                lock_proj_frac,
                staged,
            )
            continue
        signal_locs = [int(loc) for loc in group["entry_loc"]]
        loc_to_proj = {
            int(loc): float(proj)
            for loc, proj in zip(group["entry_loc"], group["average_projected"])
        }
        signal_loc_set = set(signal_locs)

        for row in group.itertuples(index=False):
            stats["n_lots"] += 1
            stats["opened_columns"].append(row.column)
            entry = int(row.entry_loc)
            entry_px = float(prices[entry])
            deadline = entry + hold_days if hold_days is not None else n + 1
            proj_pct = float(row.average_projected)
            if target_frac is not None:
                target = entry_px * (1.0 + target_frac * proj_pct / 100.0)
            else:
                target = None
            peak = entry_px
            locked = False
            exited = False
            for t in range(entry + 1, n):
                if t in signal_loc_set:
                    if hold_days is not None:
                        deadline = t + hold_days
                    if target_frac is not None:
                        target = prices[t] * (
                            1.0 + target_frac * loc_to_proj[t] / 100.0
                        )
                    proj_pct = loc_to_proj[t]
                px = float(prices[t])
                if px > peak:
                    peak = px
                if profit_protect is not None:
                    pp_hit, dd_hit = _protect_stops(
                        px, peak, entry_px, drawdown, profit_protect
                    )
                    if pp_hit or dd_hit:
                        exits.iat[t, col_index[row.column]] = True
                        _record_exit(stats, False, False, False, pp_hit, dd_hit)
                        exited = True
                        break
                    continue
                if staged and not locked:
                    if lock_profit is not None:
                        threshold = lock_profit
                    elif lock_proj_frac is not None:
                        threshold = lock_proj_frac * (proj_pct / 100.0)
                    else:
                        threshold = None
                    if threshold is not None and peak >= entry_px * (1.0 + threshold):
                        locked = True
                time_hit = t >= deadline
                tgt_hit = target is not None and px >= target
                if staged:
                    active_dd = dd_after if locked else dd_before
                    dd_hit = px <= peak * (1.0 - active_dd)
                else:
                    dd_hit = drawdown is not None and px <= peak * (1.0 - drawdown)
                if time_hit or tgt_hit or dd_hit:
                    exits.iat[t, col_index[row.column]] = True
                    _record_exit(stats, staged, locked, time_hit, tgt_hit, dd_hit)
                    exited = True
                    break
            if locked:
                stats["n_locked"] += 1
            if not exited:
                stats["n_still_open"] += 1
    return exits, stats


def _exits_one_lot(
    ordered,
    prices,
    exits,
    col_index,
    n,
    stats,
    hold_days,
    target_frac,
    drawdown,
    profit_protect,
    dd_before,
    dd_after,
    lock_profit,
    lock_proj_frac,
    staged,
):
    """Open a lot only when the ticker is flat. Later signals restart the hold."""
    i = 0
    n_rows = len(ordered)
    while i < n_rows:
        row = ordered[i]
        entry = int(row.entry_loc)
        j = i + 1
        while j < n_rows and int(ordered[j].entry_loc) == entry:
            stats["n_extended"] += 1
            j += 1
        stats["n_lots"] += 1
        stats["opened_columns"].append(row.column)
        entry_px = float(prices[entry])
        deadline = entry + hold_days if hold_days is not None else n + 1
        proj_pct = float(row.average_projected)
        if target_frac is not None:
            target = entry_px * (1.0 + target_frac * proj_pct / 100.0)
        else:
            target = None
        peak = entry_px
        locked = False
        exited = False
        next_i = j
        for t in range(entry + 1, n):
            while next_i < n_rows and int(ordered[next_i].entry_loc) == t:
                if hold_days is not None:
                    deadline = t + hold_days
                stats["n_extended"] += 1
                next_i += 1
            px = float(prices[t])
            if px > peak:
                peak = px
            if profit_protect is not None:
                pp_hit, dd_hit = _protect_stops(
                    px, peak, entry_px, drawdown, profit_protect
                )
                if pp_hit or dd_hit:
                    exits.iat[t, col_index[row.column]] = True
                    _record_exit(stats, False, False, False, pp_hit, dd_hit)
                    exited = True
                    break
                continue
            if staged and not locked:
                if lock_profit is not None:
                    threshold = lock_profit
                elif lock_proj_frac is not None:
                    threshold = lock_proj_frac * (proj_pct / 100.0)
                else:
                    threshold = None
                if threshold is not None and peak >= entry_px * (1.0 + threshold):
                    locked = True
            time_hit = t >= deadline
            tgt_hit = target is not None and px >= target
            if staged:
                active_dd = dd_after if locked else dd_before
                dd_hit = px <= peak * (1.0 - active_dd)
            else:
                dd_hit = drawdown is not None and px <= peak * (1.0 - drawdown)
            if time_hit or tgt_hit or dd_hit:
                exits.iat[t, col_index[row.column]] = True
                _record_exit(stats, staged, locked, time_hit, tgt_hit, dd_hit)
                exited = True
                break
        if locked:
            stats["n_locked"] += 1
        if not exited:
            stats["n_still_open"] += 1
            break
        i = next_i


def verify_exits(close_wide, meta):
    time_only = SellSpec(hold_days=HOLD_AFTER_LAST_DAYS)
    got, _ = exits_from_spec(close_wide, meta, time_only)
    want = exits_after_last_signal(close_wide, meta, HOLD_AFTER_LAST_DAYS)
    if not got.equals(want):
        raise RuntimeError("exits_from_spec(30d) != exits_after_last_signal")
    combo = SellSpec(hold_days=HOLD_AFTER_LAST_DAYS, target_frac=TARGET_FRACTION)
    got, _ = exits_from_spec(close_wide, meta, combo)
    want = exits_after_last_or_target(
        close_wide, meta, HOLD_AFTER_LAST_DAYS, TARGET_FRACTION
    )
    if not got.equals(want):
        raise RuntimeError("exits_from_spec(30d-t75) != exits_after_last_or_target")
    print("Exit builder matches backtest 30d and 30d-or-75%.\n")


def ensure_prices(tickers, start, end=None, refresh=False):
    CACHE_DIR.mkdir(exist_ok=True)
    close_path = CACHE_DIR / "close.pkl"
    spy_path = CACHE_DIR / "spy.pkl"
    want_end = quote_day(end)
    close = pd.read_pickle(close_path) if close_path.exists() else pd.DataFrame()
    spy = pd.read_pickle(spy_path) if spy_path.exists() else None
    if not close.empty:
        close = normalize_price_index(close)
    if spy is not None:
        spy = normalize_price_index(spy if isinstance(spy, pd.DataFrame) else spy.to_frame(SPY))
        spy = spy.iloc[:, 0]
        spy.name = SPY

    def last_day(obj):
        if obj is None:
            return None
        if isinstance(obj, pd.DataFrame) and obj.empty:
            return None
        return pd.Timestamp(obj.index.max()).normalize()

    missing = [t for t in tickers if close.empty or t not in close.columns]
    stale = (
        last_day(close) is None
        or last_day(close) < want_end
        or last_day(spy) is None
        or last_day(spy) < want_end
    )
    if refresh or stale or missing:
        names = list(dict.fromkeys(list(tickers) + (list(close.columns) if not close.empty else [])))
        print(
            f"Refreshing {len(names)} symbols through {want_end.date()} "
            f"(refresh={refresh}, stale={stale}, missing={len(missing)})"
        )
        extra = download_close_yahoo(names, start, want_end)
        if close.empty:
            close = extra
        else:
            # Keep symbols the latest download omitted instead of dropping them.
            close = extra.combine_first(close)
        close = normalize_price_index(close)
        close.to_pickle(close_path)
        print(f"Cached {close.shape[1]} symbols → {close_path} · last {close.index.max().date()}")
        spy_df = download_close_yahoo([SPY], start, want_end)
        spy = normalize_price_index(spy_df).iloc[:, 0]
        spy.name = SPY
        spy.to_pickle(spy_path)
        print(f"Cached SPY → {spy_path} · last {spy.index.max().date()}")
    return close, spy


def attach_spec(row, spec: SellSpec, buy=None):
    row = dict(row)
    row["tag"] = spec.tag
    row["hold_days_spec"] = spec.hold_days
    row["target_frac"] = spec.target_frac
    row["drawdown"] = spec.drawdown
    row["profit_protect"] = spec.profit_protect
    row["baseline"] = spec.baseline
    row["dd_before"] = spec.dd_before
    row["dd_after"] = spec.dd_after
    row["lock_profit"] = spec.lock_profit
    row["lock_proj_frac"] = spec.lock_proj_frac
    row["staged"] = spec.staged
    row["short"] = spec.short
    if buy is not None:
        for key in (
            "min_analysts",
            "min_projected",
            "min_percentile",
            "universe",
            "family",
            "signal_name",
            "range_label",
            "date_from",
            "date_to",
        ):
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


def run_one(label, close, spy, signals, spec: SellSpec, write_csv=None, one_lot=False):
    tickers = unique_tickers(signals)
    have = [t for t in tickers if t in close.columns]
    if not have:
        raise RuntimeError(f"No price data for {label}")
    close_wide, meta = signal_positions(close[have], signals)
    exits, exit_stats = exits_from_spec(close_wide, meta, spec, one_lot=one_lot)
    opened = exit_stats.pop("opened_columns")
    if one_lot:
        entry_meta = meta[meta["column"].isin(opened)]
    else:
        entry_meta = meta
    entries = entries_from_meta(close_wide, entry_meta)
    init_cash = POSITION_VALUE * len(entry_meta)
    row, positions = simulate(label, close_wide, entries, exits, init_cash, spy, len(meta))
    row.update(exit_stats)
    n_symbols, n_positions = trade_counts(positions)
    row["n_symbols"] = n_symbols
    row["n_positions"] = n_positions
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
            and row.get("signal_name") == freeze.get("signal_name")
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
            f"Buy freeze: {buy_label(freeze)} "
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
        (
            r["tag"],
            r.get("signal_name"),
            r["min_analysts"],
            int(r["min_projected"]),
        ): r
        for r in rows
    }


def focus_matrix(rows, specs, buys, fmt):
    lookup = focus_lookup(rows)
    head = "| Buy \\ Sell | " + " | ".join(s.short for s in specs) + " |"
    sep = "| --- | " + " | ".join("---:" for _ in specs) + " |"
    lines = [head, sep]
    for filt in buys:
        cells = []
        for spec in specs:
            row = lookup.get(
                (
                    spec.tag,
                    filt.get("signal_name"),
                    filt["min_analysts"],
                    int(filt["min_projected"]),
                )
            )
            cells.append(fmt(row) if row is not None else "—")
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
        if not n:
            continue
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
    names = []
    for filt in buys:
        name = filt.get("signal_name")
        if name not in names:
            names.append(name)
    if not names:
        names = [None]
    head = "| | " + " | ".join(f">{p}%" for p in cuts) + " |"
    sep = "| --- | " + " | ".join("---:" for _ in cuts) + " |"
    lines = [head, sep]
    for name in names:
        for n in analysts:
            cells = [
                str(len(filter_signals(signals, n, float(p), name))) for p in cuts
            ]
            label = f"analyst>{n}" if not name else f"{name} · analyst>{n}"
            lines.append("| " + label + " | " + " | ".join(cells) + " |")
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
        (
            f"{len(buys)} buys ({len(signal_names())} signal names × analyst >2/>3 × "
            "proj >20/25/30%) × 4 sells (7.5% dd with/without "
            "30d and with/without 50% of projected target). Exits are OR-combined. "
            "A new signal resets the 30d clock and the target; drawdown peak is since entry."
        ),
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
        "## Sell ablation (mean across buys)",
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


def prepare(signals_path=SIGNALS_CSV, end=None, ignore_last_days=0, refresh=False):
    signals = load_signals(signals_path)
    n_file = len(signals)
    signals = restrict_signal_names(signals, signal_names())
    if len(signals) != n_file:
        print(
            f"signal_name {', '.join(signal_names())}: {n_file} → {len(signals)} rows"
        )
    if signals.empty:
        raise RuntimeError(
            f"No signals left for signal_name {list(signal_names())}"
        )
    n_raw = len(signals)
    quote_end = quote_day(end)
    dates = pd.to_datetime(signals["date"]).dt.normalize()
    in_book = dates <= quote_end
    if not bool(in_book.all()):
        print(f"Drop signals after {quote_end.date()}: {n_raw} → {int(in_book.sum())}")
        signals = signals.loc[in_book].reset_index(drop=True)
        n_raw = len(signals)
    signal_cutoff = quote_end - pd.Timedelta(days=ignore_last_days) if ignore_last_days else quote_end
    if ignore_last_days:
        dates = pd.to_datetime(signals["date"]).dt.normalize()
        signals = signals[dates <= signal_cutoff].reset_index(drop=True)
        print(
            f"Ignore last {ignore_last_days} calendar days of signals: "
            f"{n_raw} → {len(signals)} (cutoff {signal_cutoff.date()}, quotes through {quote_end.date()})"
        )
    if signals.empty:
        raise RuntimeError("No signals left after ignore-last-days cutoff")
    start = signals["date"].min()
    close, spy = ensure_prices(unique_tickers(signals), start, quote_end, refresh=refresh)
    close = clip_prices(close, quote_end)
    spy = clip_prices(aligned_spy(spy, close.index), quote_end)
    print(
        f"Prices {pd.Timestamp(close.index[0]).date()} → {pd.Timestamp(close.index[-1]).date()} "
        f"({len(close)} bars, {close.shape[1]} symbols)"
    )
    return signals, close, spy


def run_sells(signals, close, spy, hold_days=None, prefix=None, write_positions=False):
    freeze = freeze_buy_filter()
    bought = apply_buy(signals, freeze)
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
            bought = apply_buy(signals, filt)
            if bought.empty:
                print(f"  skip {buy_label(filt)}: no signals")
                continue
            label = f"{spec.label} · {buy_label(filt)}"
            csv_path = None
            if prefix is not None:
                csv_path = Path(
                    f"{prefix}_{spec.tag}{signal_file_tag(filt.get('signal_name'))}"
                    f"_a{filt['min_analysts']}_p{int(filt['min_projected'])}.csv"
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
            bought = apply_buy(signals, filt)
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


def filter_percentile(signals, min_percentile, signal_name=None):
    out = restrict_signal_name(signals, signal_name)
    out = out[out["signal_percentile"] > min_percentile]
    return out.sort_values(["date", "signal_score"], ascending=[True, False]).reset_index(
        drop=True
    )


def apply_buy(signals, buy):
    signal_name = buy.get("signal_name")
    if buy.get("min_percentile") is not None:
        out = filter_percentile(signals, buy["min_percentile"], signal_name)
    else:
        out = filter_signals(
            signals, buy["min_analysts"], buy["min_projected"], signal_name
        )
    start = buy.get("date_from")
    end = buy.get("date_to")
    if start and end and len(out):
        dates = pd.to_datetime(out["date"]).dt.normalize()
        out = out.loc[
            (dates >= pd.Timestamp(start)) & (dates <= pd.Timestamp(end))
        ].reset_index(drop=True)
    return out


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
    frozen.sort(
        key=lambda r: (
            r.get("signal_name") or "",
            r.get("min_analysts", 0),
            r.get("min_projected", 0),
        )
    )
    if not frozen:
        raise RuntimeError("No 30d-t50-dd7.5 rows in focus cache")
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
        same_signal = row.get("signal_name") in (None, freeze.get("signal_name"))
        if (
            row.get("family") == "analyst"
            and row.get("min_analysts") == freeze["min_analysts"]
            and row.get("min_projected") == freeze["min_projected"]
            and same_signal
        ):
            name = f"{name} *(old freeze)*"
        if (
            row.get("family") == "analyst"
            and row.get("min_analysts") == 3
            and int(row.get("min_projected", 0)) == 30
            and same_signal
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
    for signal_name in signal_names():
        for cut in PERCENTILE_CUTS:
            filt = {
                "min_percentile": cut,
                "family": "percentile",
                "signal_name": signal_name,
            }
            bought = apply_buy(signals, filt)
            if bought.empty:
                print(f"  skip {buy_label(filt)}: no signals")
                continue
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


def staged_exit_cell(row):
    if row.get("staged"):
        return (
            f"{int(row.get('n_exit_wide') or 0)} wide / "
            f"{int(row.get('n_exit_tight') or 0)} tight / "
            f"{int(row.get('n_still_open') or 0)} open · "
            f"{int(row.get('n_locked') or 0)} locked"
        )
    return (
        f"{int(row.get('n_exit_time') or 0)} 30d / "
        f"{int(row.get('n_exit_target') or 0)} target / "
        f"{int(row.get('n_exit_dd') or 0)} dd / "
        f"{int(row.get('n_still_open') or 0)} open"
    )


def staged_compact_table(rows):
    head = "| Rank | Sell | On invested | Stock P&L | Win rate | Exits |"
    sep = "| ---: | --- | ---: | ---: | ---: | --- |"
    lines = [head, sep]
    ordered = sorted(rows, key=lambda r: r["return_on_avg_invested_pct"], reverse=True)
    for i, row in enumerate(ordered, 1):
        name = row.get("short") or row["label"]
        if not row.get("staged"):
            name = f"**{name}** *(known)*"
        lines.append(
            "| "
            + " | ".join(
                [
                    str(i),
                    name,
                    f"{row['return_on_avg_invested_pct']:+.1f}%",
                    money(row["stock_pnl"]),
                    f"{row['win_rate_pct']:.1f}%",
                    staged_exit_cell(row),
                ]
            )
            + " |"
        )
    return "\n".join(lines)


def staged_detail_table(rows):
    head = (
        "| Rank | Sell | On invested | Stock P&L | Win rate | Trades | "
        "vs SPY | Avg invested |"
    )
    sep = "| ---: | --- | ---: | ---: | ---: | --- | ---: | ---: |"
    lines = [head, sep]
    ordered = sorted(rows, key=lambda r: r["return_on_avg_invested_pct"], reverse=True)
    for i, row in enumerate(ordered, 1):
        name = row.get("label") or row.get("short")
        lines.append(
            "| "
            + " | ".join(
                [
                    str(i),
                    name,
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


def staged_family_table(rows, key, fmt):
    groups = {}
    for row in rows:
        if not row.get("staged"):
            continue
        groups.setdefault(row.get(key), []).append(row)
    if not groups:
        return ""
    head = "| Group | Best sell | On invested | Stock P&L | n in group |"
    sep = "| --- | --- | ---: | ---: | ---: |"
    lines = [head, sep]
    for value in sorted(groups, key=lambda v: (v is None, v)):
        block = groups[value]
        best = max(block, key=lambda r: r["return_on_avg_invested_pct"])
        lines.append(
            "| "
            + " | ".join(
                [
                    fmt(value),
                    best.get("short") or best["label"],
                    f"{best['return_on_avg_invested_pct']:+.1f}%",
                    money(best["stock_pnl"]),
                    str(len(block)),
                ]
            )
            + " |"
        )
    return "\n".join(lines)


def write_staged_summary(path, rows, info, notes):
    known = next(r for r in rows if not r.get("staged"))
    staged = [r for r in rows if r.get("staged")]
    best = max(rows, key=lambda r: r["return_on_avg_invested_pct"])
    best_pnl = max(rows, key=lambda r: r["stock_pnl"])
    best_staged = max(staged, key=lambda r: r["return_on_avg_invested_pct"])
    worst_staged = min(staged, key=lambda r: r["return_on_avg_invested_pct"])
    body = [
        f"# {info['title']}",
        "",
        f"**Run:** {info['run']}",
        (
            f"**Period:** {info['start']} → {info['end']} · "
            f"{info['cal_days']} days ({info['trading_days']} trading)"
        ),
        (
            f"Buy freeze: **{buy_label(staged_buy())}** ({info['n']} signals). "
            "$5,000 per lot. Ranked by **return on avg invested**."
        ),
        (
            "Known sell: **30d or 50% of projected target or 7.5% trailing dd** "
            f"({known['return_on_avg_invested_pct']:+.1f}%, {money(known['stock_pnl'])}). "
            "15 two-stage trailing stops: wide dd from peak until a profit lock, "
            "then a tighter dd. No 30d, no target sell."
        ),
        "",
        "# WINNING COMBINATION",
        "",
        f"# SELL: {best.get('short', best['label']).upper()}",
        "",
        f"# BUY: {buy_label(staged_buy()).upper()}",
        "",
        (
            f"# {best['return_on_avg_invested_pct']:+.1f}% ON INVESTED · "
            f"{money(best['stock_pnl'])} · {best['n_signals']} SIGNALS · "
            f"{best['win_rate_pct']:.1f}% WIN RATE"
        ),
        "",
        "## All 16 sells",
        "",
        staged_compact_table(rows),
        "",
        "## Detail",
        "",
        staged_detail_table(rows),
        "",
        "## Best by initial (wide) dd",
        "",
        staged_family_table(
            rows,
            "dd_before",
            lambda v: f"{v * 100:g}% wide",
        ),
        "",
        "## Best by lock trigger",
        "",
        _staged_lock_table(staged),
        "",
        (
            f"Best **return on invested**: **{best.get('short') or best['label']}** → "
            f"{best['return_on_avg_invested_pct']:+.1f}% ({money(best['stock_pnl'])})."
        ),
        "",
        (
            f"Best **stock P&L**: **{best_pnl.get('short') or best_pnl['label']}** → "
            f"{money(best_pnl['stock_pnl'])} "
            f"({best_pnl['return_on_avg_invested_pct']:+.1f}%)."
        ),
        "",
        "## Conclusions",
        "",
    ]
    conclusions = _staged_conclusions(
        known, staged, best, best_pnl, best_staged, worst_staged
    )
    body += [f"- {c}" for c in conclusions] + [""]
    if notes:
        body += ["## Notes", ""] + [f"- {n}" for n in notes] + [""]
    path.write_text("\n".join(body))
    print(f"Wrote {path}")


def _staged_lock_table(staged):
    by_lock = {}
    for row in staged:
        key = (
            "p25"
            if row.get("lock_proj_frac") is not None
            else f"{row.get('lock_profit') * 100:g}%"
        )
        by_lock.setdefault(key, []).append(row)
    head = "| Lock | Best sell | On invested | Stock P&L | n |"
    sep = "| --- | --- | ---: | ---: | ---: |"
    lines = [head, sep]
    order = ["5%", "7.5%", "10%", "p25"]
    labels = {
        "5%": "+5% from entry",
        "7.5%": "+7.5% from entry",
        "10%": "+10% from entry",
        "p25": "25% of projection",
    }
    for key in order:
        block = by_lock.get(key)
        if not block:
            continue
        best = max(block, key=lambda r: r["return_on_avg_invested_pct"])
        lines.append(
            "| "
            + " | ".join(
                [
                    labels[key],
                    best.get("short") or best["label"],
                    f"{best['return_on_avg_invested_pct']:+.1f}%",
                    money(best["stock_pnl"]),
                    str(len(block)),
                ]
            )
            + " |"
        )
    return "\n".join(lines)


def _staged_conclusions(known, staged, best, best_pnl, best_staged, worst_staged):
    out = []
    known_roi = known["return_on_avg_invested_pct"]
    known_pnl = known["stock_pnl"]
    beat_roi = [r for r in staged if r["return_on_avg_invested_pct"] > known_roi]
    beat_pnl = [r for r in staged if r["stock_pnl"] > known_pnl]
    if best.get("staged"):
        out.append(
            f"Two-stage **{best_staged['short']}** beats the known 30d 50% 7.5dd "
            f"on invested ({best_staged['return_on_avg_invested_pct']:+.1f}% vs "
            f"{known_roi:+.1f}%)."
        )
    else:
        out.append(
            f"Known **30d 50% 7.5dd** still wins on invested "
            f"({known_roi:+.1f}%). Best two-stage is **{best_staged['short']}** "
            f"({best_staged['return_on_avg_invested_pct']:+.1f}%)."
        )
    out.append(
        f"{len(beat_roi)} of 15 two-stage sells beat known on rate; "
        f"{len(beat_pnl)} beat it on stock P&L."
    )
    by_wide = {}
    for row in staged:
        by_wide.setdefault(row["dd_before"], []).append(row)
    wide_means = {
        k: sum(r["return_on_avg_invested_pct"] for r in v) / len(v)
        for k, v in by_wide.items()
    }
    wide_best = max(wide_means, key=wide_means.get)
    wide_worst = min(wide_means, key=wide_means.get)
    family = (
        "tighter initial stop wins on average"
        if wide_best < wide_worst
        else "looser initial stop wins on average"
    )
    out.append(
        "Mean invested return by initial dd: "
        + ", ".join(
            f"**{k * 100:g}%** → {wide_means[k]:+.1f}%"
            for k in sorted(wide_means, reverse=True)
        )
        + f". {family.capitalize()}."
    )
    lock5 = [
        r
        for r in staged
        if r.get("lock_profit") == 0.05 and r.get("dd_after") == 0.05
    ]
    proj5 = [
        r
        for r in staged
        if r.get("lock_proj_frac") is not None and r.get("dd_after") == 0.05
    ]
    if lock5 and proj5:
        best5 = max(lock5, key=lambda r: r["return_on_avg_invested_pct"])
        bestp = max(proj5, key=lambda r: r["return_on_avg_invested_pct"])
        out.append(
            f"Best lock is **+5% then 5% dd** ({best5['short']} "
            f"{best5['return_on_avg_invested_pct']:+.1f}%) vs best "
            f"25% of projection then 5% dd ({bestp['short']} "
            f"{bestp['return_on_avg_invested_pct']:+.1f}%). "
            "Later locks (+7.5%, +10%) give the winner more room to give back."
        )
    const_75 = next(
        (
            r
            for r in staged
            if r.get("dd_before") == 0.075
            and r.get("dd_after") == 0.075
            and r.get("lock_profit") == 0.075
        ),
        None,
    )
    if const_75:
        out.append(
            f"Constant 7.5% trail (7.5dd→7.5%→7.5dd, no time/target) is "
            f"{const_75['return_on_avg_invested_pct']:+.1f}% / "
            f"{money(const_75['stock_pnl'])} vs known 30d 50% 7.5dd "
            f"{known_roi:+.1f}% / {money(known_pnl)}."
        )
    loosen = next(
        (
            r
            for r in staged
            if r.get("dd_before") == 0.075
            and r.get("dd_after") == 0.10
            and r.get("lock_profit") == 0.10
        ),
        None,
    )
    if loosen:
        worse = (
            const_75 is not None
            and loosen["return_on_avg_invested_pct"]
            < const_75["return_on_avg_invested_pct"]
        )
        out.append(
            f"Loosening after lock (7.5dd→10%→10dd) is "
            f"{loosen['return_on_avg_invested_pct']:+.1f}% / "
            f"{money(loosen['stock_pnl'])} — "
            + (
                "worse than keeping 7.5% the whole way."
                if worse
                else "does not justify widening the stop after a profit."
            )
        )
    out.append(
        f"Worst two-stage: **{worst_staged['short']}** "
        f"({worst_staged['return_on_avg_invested_pct']:+.1f}%, "
        f"{money(worst_staged['stock_pnl'])})."
    )
    if not best.get("staged"):
        out.append(
            "Keep **30d or 50% target or 7.5% dd**. Two-stage trailing without "
            "a time stop or target sell did not replace it on this buy."
        )
    elif best_pnl.get("tag") == known.get("tag"):
        out.append(
            "Use the two-stage winner for rate. Known 30d 50% 7.5dd still "
            "prints competitive dollars because it harvests targets and "
            "clears 30d losers."
        )
    else:
        out.append(
            f"Prefer **{best['short']}** on this buy. Re-check before "
            "replacing 30d 50% 7.5dd on tighter analyst/proj cuts."
        )
    return out


def run_staged(signals, close, spy):
    buy = staged_buy()
    bought = apply_buy(signals, buy)
    if bought.empty:
        raise RuntimeError("Staged buy filter left no signals")
    tickers = [t for t in unique_tickers(bought) if t in close.columns]
    close_wide, meta = signal_positions(close[tickers], bought)
    verify_exits(close_wide, meta)
    rows = []
    init_cash = None
    for spec in staged_sell_grid():
        print(f"  {spec.short} ({len(bought)} signals)")
        row, _, close_wide, _, init_cash = run_one(
            spec.label, close, spy, bought, spec
        )
        row = attach_spec(row, spec, buy)
        row["label"] = spec.label
        print(
            f"    invested {row['return_on_avg_invested_pct']:+.1f}%  "
            f"{money(row['stock_pnl'])}  {staged_exit_cell(row)}"
        )
        rows.append(row)
    return rows, close_wide, init_cash, bought


def anchor_buys():
    return with_signal_names(
        [
            {"min_analysts": 2, "min_projected": 20.0},
            {"min_analysts": 3, "min_projected": 30.0},
        ]
    )


def combo_key(buy, spec):
    return (buy_label(buy), spec.tag)


def neighborhood_sells(holds, targets, drawdowns):
    return [
        SellSpec(hold_days=h, target_frac=t, drawdown=d)
        for h in holds
        for t in targets
        for d in drawdowns
    ]


def iter4_buy_grid():
    buys = []
    for n, projs in ((2, (15, 20, 25, 30, 35)), (3, (20, 25, 30, 35)), (4, (20, 30))):
        for p in projs:
            buys.append({"min_analysts": n, "min_projected": float(p)})
    return with_signal_names(buys)


def mean_by(rows, keyfn):
    groups = defaultdict(list)
    for row in rows:
        groups[keyfn(row)].append(row)
    scored = []
    for key, block in groups.items():
        roi = sum(r["return_on_avg_invested_pct"] for r in block) / len(block)
        pnl = sum(r["stock_pnl"] for r in block) / len(block)
        scored.append((roi, pnl, key, block))
    scored.sort(key=lambda x: (x[0], x[1]), reverse=True)
    return scored


def best_hold_days(rows, default=30):
    scored = [
        item
        for item in mean_by(rows, lambda r: r.get("hold_days_spec"))
        if item[2] is not None
    ]
    return int(scored[0][2]) if scored else default


def best_target_dd_pairs(rows, n=2):
    def keyfn(row):
        if row.get("staged"):
            return None
        tf, dd = row.get("target_frac"), row.get("drawdown")
        if dd is None:
            return None
        return (tf, dd)

    scored = [item for item in mean_by(rows, keyfn) if item[2] is not None]
    return [item[2] for item in scored[:n]]


def unique_specs_from_rows(rows, n):
    scored = mean_by(rows, lambda r: r["tag"])
    return [spec_from_row(block[0]) for _, _, _, block in scored[:n]]


def unique_buys_from_rows(rows, n, extra=()):
    buys = []
    seen = set()
    for buy in extra:
        label = buy_label(buy)
        if label not in seen:
            seen.add(label)
            buys.append(buy)
    ordered = sorted(
        rows,
        key=lambda r: (r["return_on_avg_invested_pct"], r["stock_pnl"]),
        reverse=True,
    )
    for row in ordered:
        label = row.get("buy_label")
        if not label or label in seen:
            continue
        buy = {}
        if row.get("signal_name"):
            buy["signal_name"] = row["signal_name"]
        if row.get("min_percentile") is not None:
            buy["min_percentile"] = row["min_percentile"]
        else:
            buy["min_analysts"] = row.get("min_analysts")
            buy["min_projected"] = row.get("min_projected")
        seen.add(label)
        buys.append(buy)
        if len(buys) >= n:
            break
    return buys


POSITION_COLUMNS = [
    "sell",
    "buy",
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
    "trade_from",
    "trade_to",
    "days_exposed",
    "lot_days",
    "avg_lot_amount",
]


def tag_positions(positions, row):
    frame = positions.copy()
    frame.insert(0, "sell", row.get("short") or row.get("tag", ""))
    frame.insert(1, "buy", row.get("buy_label", ""))
    for key in ("trade_from", "trade_to", "days_exposed", "lot_days", "avg_lot_amount"):
        frame[key] = row.get(key)
    return frame[POSITION_COLUMNS]


def _avg_open_lots(intervals, n_days):
    """Mean open lots across every trading bar.

    A closed lot counts from its buy bar up to, but not including, its sell bar.
    An open lot counts through its last bar.
    """
    if n_days <= 0:
        return 0.0
    diff = [0] * (n_days + 1)
    for start, end, inclusive in intervals:
        if start < 0 or start >= n_days:
            continue
        last = end if inclusive else end - 1
        if last < start:
            continue
        last = min(last, n_days - 1)
        diff[start] += 1
        diff[last + 1] -= 1
    open_n = 0
    total = 0
    for i in range(n_days):
        open_n += diff[i]
        total += open_n
    return total / n_days


def resume_position_log(path, close, spy, signals, buys, specs):
    """Rebuild finished cell rows from the positions CSV and drop the last cell.

    The last cell may have been cut off when the process died, so it is truncated
    and left to be simulated again. Earlier cells stay in the file.
    """
    import csv
    import os

    from backtest import aligned_spy, bar_dates

    path = Path(path)
    dates = list(bar_dates(close.index))
    day_i = {pd.Timestamp(day).strftime("%Y-%m-%d"): i for i, day in enumerate(dates)}
    n_days = len(dates)
    spy_px = aligned_spy(spy, close.index).to_numpy(dtype=float)
    spy_bnh = (float(spy_px[-1]) / float(spy_px[0]) - 1.0) * 100.0
    period_days = int((pd.Timestamp(dates[-1]) - pd.Timestamp(dates[0])).days) + 1
    by_short = {spec.short: spec for spec in specs}
    by_buy = {buy_label(buy): buy for buy in buys}
    n_by_buy = {label: len(apply_buy(signals, buy)) for label, buy in by_buy.items()}

    def finish(acc):
        spec = by_short.get(acc["sell"])
        buy = by_buy.get(acc["buy"])
        if spec is None or buy is None:
            raise RuntimeError(f"positions row does not match this grid: {acc['sell']} · {acc['buy']}")
        amount = float(acc["amount"])
        slots = int(spec.slots)
        init_cash = amount * slots
        avg_lots = _avg_open_lots(acc["intervals"], n_days)
        cost = avg_lots * amount
        stock_pnl = acc["stock_pnl"]
        n_trades = acc["n_trades"]
        position_keys = list(acc["position_pnl"])
        position_wins = sum(1 for value in acc["position_pnl"].values() if value > 0)
        stock_keys = [key for key in position_keys if key[0] not in (PARK_SPY, PARK_TQQQ)]
        n_symbols = len({key[0] for key in stock_keys})
        n_positions = len(stock_keys)
        pnl = stock_pnl
        row = {
            "label": f"{spec.label} · {acc['buy']}",
            "n_signals": n_by_buy[acc["buy"]],
            "n_trades": n_trades,
            "n_closed": acc["n_closed"],
            "n_open": acc["n_open"],
            "n_symbols": n_symbols,
            "n_positions": n_positions,
            "stock_pnl": stock_pnl,
            "pnl": pnl,
            "return_pct": pnl / init_cash * 100.0 if init_cash else 0.0,
            "spy_pct": spy_bnh,
            "vs_spy_pct": (pnl / init_cash * 100.0 if init_cash else 0.0) - spy_bnh,
            "avg_stock_invested": cost,
            "avg_open_lots": avg_lots,
            "max_open_lots": 0,
            "avg_invested_pct": cost / init_cash * 100.0 if init_cash else 0.0,
            "peak_invested_pct": 0.0,
            "return_on_avg_invested_pct": stock_pnl / cost * 100.0 if cost else 0.0,
            "avg_exposure_pct": 0.0,
            "peak_exposure_pct": 0.0,
            "win_rate_pct": (
                position_wins / len(position_keys) * 100.0 if position_keys else 0.0
            ),
            "max_drawdown_pct": 0.0,
            "mean_lot_return_pct": 0.0,
            "mean_vs_spy_pct": 0.0,
            "trade_from": acc["trade_from"],
            "trade_to": acc["trade_to"],
            "days_exposed": int(acc["days_exposed"]),
            "lot_days": int(acc["lot_days"]),
            "lot_days_util_pct": (
                acc["lot_days"] / (slots * period_days) * 100.0 if slots and period_days else 0.0
            ),
            "slots": slots,
            "avg_lot_amount": amount,
        }
        row = attach_spec(row, spec, buy)
        row["label"] = f"{spec.short} · {acc['buy']}"
        row["iteration"] = "books"
        return row

    rows = []
    acc = None
    group_start = None
    last_start = None
    seen_lines = 0
    with path.open("rb") as handle:
        handle.readline()
        while True:
            start = handle.tell()
            raw = handle.readline()
            if not raw:
                break
            seen_lines += 1
            if seen_lines % 2_000_000 == 0:
                print(f"  resume scan {seen_lines:,} position rows", flush=True)
            line = raw.decode("utf-8").rstrip("\r\n")
            if not line:
                continue
            rec = next(csv.reader([line]))
            if len(rec) < 19:
                continue
            key = (rec[0], rec[1])
            if acc is None or key != acc["key"]:
                if acc is not None:
                    rows.append(finish(acc))
                last_start = start
                acc = {
                    "key": key,
                    "sell": rec[0],
                    "buy": rec[1],
                    "n_trades": 0,
                    "n_open": 0,
                    "n_closed": 0,
                    "position_pnl": {},
                    "stock_pnl": 0.0,
                    "intervals": [],
                    "trade_from": rec[14],
                    "trade_to": rec[15],
                    "days_exposed": float(rec[16]),
                    "lot_days": float(rec[17]),
                    "amount": float(rec[18]),
                }
            acc["n_trades"] += 1
            pnl = float(rec[7])
            acc["stock_pnl"] += pnl
            pos_key = (rec[2], rec[3], rec[5])
            acc["position_pnl"][pos_key] = acc["position_pnl"].get(pos_key, 0.0) + pnl
            if rec[13] == "Open":
                acc["n_open"] += 1
            else:
                acc["n_closed"] += 1
            i0 = day_i.get(rec[3], -1)
            i1 = day_i.get(rec[4], -1)
            acc["intervals"].append((i0, i1, rec[13] == "Open"))
    if acc is not None:
        group_start = last_start
    if group_start is None:
        raise RuntimeError(f"No position rows in {path}")
    # Drop the last cell. A kill during its write would leave a short group.
    os.truncate(path, group_start)
    print(
        f"Resumed {len(rows)} cells from {path.name}. "
        f"Truncated the last cell at byte {group_start:,} so it can be rerun.",
        flush=True,
    )
    seen = {(row["buy_label"], row["tag"]) for row in rows}
    return rows, seen


def run_combos(
    signals,
    close,
    spy,
    buys,
    specs,
    seen,
    iteration,
    one_lot=False,
    position_log=None,
    tqqq=None,
    parks=None,
    cash_sleeve=True,
    resume=False,
):
    rows = []
    close_wide = None
    init_cash = None
    position_path = None
    write_header = False
    if isinstance(position_log, (str, Path)):
        position_path = Path(position_log)
        if resume and position_path.exists() and position_path.stat().st_size > 0:
            resumed, resume_seen = resume_position_log(
                position_path, close, spy, signals, buys, specs
            )
            rows.extend(resumed)
            seen.update(resume_seen)
            write_header = False
        elif position_path.exists():
            position_path.unlink()
            write_header = True
        else:
            write_header = True
    planned = len(specs) * len(buys)
    done = len(rows)
    for spec in specs:
        for buy in buys:
            key = combo_key(buy, spec)
            if key in seen:
                continue
            bought = apply_buy(signals, buy)
            if bought.empty:
                print(f"  skip I{iteration} {spec.short} · {buy_label(buy)}: no signals")
                seen.add(key)
                done += 1
                continue
            done += 1
            print(
                f"  I{iteration} {done}/{planned} {spec.short} · {buy_label(buy)} "
                f"({len(bought)} signals)"
            )
            book_close = close
            if buy.get("date_from") and buy.get("date_to"):
                book_close = close.loc[
                    pd.Timestamp(buy["date_from"]) : pd.Timestamp(buy["date_to"])
                ]
                if book_close.empty:
                    raise RuntimeError(
                        f"no prices in {buy['date_from']} → {buy['date_to']}"
                        f" for {buy_label(buy)}"
                    )
            if spec.slots is not None:
                filler = spec.filler
                spy_fill = None
                park_ticker = filler
                park_series = None if parks is None or not filler else parks.get(filler)
                if filler == "none":
                    spy_fill = False
                    park_ticker = None
                    park_series = None
                elif filler == PARK_SPY:
                    spy_fill = True
                    park_ticker = PARK_SPY
                    park_series = None
                elif filler:
                    spy_fill = True
                row, positions, close_wide, init_cash = run_slot_book(
                    f"{spec.label} · {buy_label(buy)}",
                    book_close,
                    spy,
                    bought,
                    slots=spec.slots,
                    drawdown=spec.drawdown,
                    profit_protect=spec.profit_protect,
                    tqqq=tqqq,
                    park=park_series,
                    park_ticker=park_ticker,
                    spy_fill=spy_fill,
                    daily_loss=spec.loss_mode == "dls",
                    lot_mode=spec.lot_mode,
                    cash_sleeve=cash_sleeve,
                    lot_amount=spec.lot_amount,
                )
            else:
                row, positions, close_wide, _, init_cash = run_one(
                    f"{spec.label} · {buy_label(buy)}",
                    book_close,
                    spy,
                    bought,
                    spec,
                    one_lot=one_lot,
                )
            row = attach_spec(row, spec, buy)
            row["label"] = f"{spec.short} · {buy_label(buy)}"
            row["iteration"] = iteration
            print(
                f"    invested {row['return_on_avg_invested_pct']:+.1f}%  "
                f"{money(row['stock_pnl'])}  "
                f"{row['n_closed']}c/{row['n_open']}o  "
                f"exposed {row['days_exposed']}d  lot-days {row['lot_days']}"
            )
            rows.append(row)
            tagged = tag_positions(positions, row)
            if position_path is not None:
                tagged.to_csv(position_path, mode="a", header=write_header, index=False)
                write_header = False
            elif position_log is not None:
                position_log.append(tagged)
            del positions, tagged
            if done % 25 == 0:
                gc.collect()
            seen.add(key)
    return rows, close_wide, init_cash


def closed_plan_text(locks):
    anchors = ", ".join(f"**{buy_label(b)}**" for b in anchor_buys())
    lines = [
        "Five locked iterations. Duplicate (buy, sell) cells are skipped. "
        "Each buy filter includes signal_name.",
        "",
        f"1. Lock {anchors}. "
        "Sell neighborhood around 30d 50% 7.5dd: hold 20/25/30/40 × target 40/50/60% × dd 5/7.5/10%.",
        "2. Keep those anchor buys. Lock the best hold from iteration 1. "
        "Expand target 25/35/50/65/75% × dd 6/7.5/8.5/10/12.5%.",
        "3. Keep those anchor buys. Lock the two best (target, dd) pairs. "
        "Sweep hold None/10/15/21/25/30/35/45/50/60.",
        "4. Lock the three best sells so far. Sweep the buy neighborhood for each signal name: "
        "analyst>2 · proj>15/20/25/30/35%, analyst>3 · proj>20/25/30/35%, analyst>4 · proj>20/30%.",
        "5. Keep the anchor buys plus percentile >0.80/>0.60 on each signal name. "
        "Sells: known 30d 50% 7.5dd, next-best sell, and 7.5dd→5%→5dd with 30d and with 30d+50%.",
    ]
    if locks:
        lines.append("")
        lines.append("Locks this run: " + "; ".join(locks))
    return lines


def exposure_cells(row, with_util=False):
    window = f"{row.get('trade_from', '')} → {row.get('trade_to', '')}"
    lots_used = row.get("avg_invested_pct")
    lots_text = f"{lots_used:.1f}%" if lots_used is not None else ""
    cells = [
        window,
        str(row.get("days_exposed", "")),
        lots_text,
        str(row.get("lot_days", "")),
        f"${row.get('avg_lot_amount', 0):,.0f}",
    ]
    if with_util:
        util = row.get("lot_days_util_pct")
        cells.insert(4, f"{util:.1f}%" if util is not None else "")
    return cells


def closed_compact_table(rows, limit=None):
    ordered = sorted(
        rows,
        key=lambda r: (r["return_on_avg_invested_pct"], r["stock_pnl"]),
        reverse=True,
    )
    if limit is not None:
        ordered = ordered[:limit]
    with_util = any(r.get("lot_days_util_pct") is not None for r in ordered)
    util_head = " Lot-days utilized |" if with_util else ""
    util_sep = " ---: |" if with_util else ""
    head = (
        "| Rank | I | Sell | Buy | n | On invested | Stock P&L | Win | "
        "Trades | Symbols | Positions | vs SPY | Trade window | Days utilized | Lots utilized | Lot-days |"
        f"{util_head} Avg lot |"
    )
    sep = (
        "| ---: | ---: | --- | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | "
        "--- | ---: | ---: | ---: |"
        f"{util_sep} ---: |"
    )
    lines = [head, sep]
    for i, row in enumerate(ordered, 1):
        lines.append(
            "| "
            + " | ".join(
                [
                    str(i),
                    str(row.get("iteration", "")),
                    row.get("short") or row.get("tag", ""),
                    row.get("buy_label", ""),
                    str(row["n_signals"]),
                    f"{row['return_on_avg_invested_pct']:+.1f}%",
                    money(row["stock_pnl"]),
                    f"{row['win_rate_pct']:.1f}%",
                    f"{row['n_closed']}c/{row['n_open']}o",
                    str(row.get("n_symbols", "")),
                    str(row.get("n_positions", "")),
                    f"{row['vs_spy_pct']:+.2f}%",
                    *exposure_cells(row, with_util),
                ]
            )
            + " |"
        )
    return "\n".join(lines)


def write_closed_summary(path, rows, info, notes, locks, n_raw, n_kept, signal_cutoff):
    ordered = sorted(
        rows,
        key=lambda r: (r["return_on_avg_invested_pct"], r["stock_pnl"]),
        reverse=True,
    )
    usable = [r for r in ordered if r["n_signals"] >= 10]
    best = usable[0] if usable else ordered[0]
    best_pnl = max(usable or ordered, key=lambda r: r["stock_pnl"])
    known = [
        r
        for r in rows
        if r.get("tag") == WINNING_SELL.tag
        and r.get("buy_label") in {buy_label(b) for b in anchor_buys()}
    ]
    by_iter = defaultdict(list)
    for row in rows:
        by_iter[row.get("iteration", 0)].append(row)

    body = [
        f"# {info['title']}",
        "",
        f"**Run:** {info['run']}",
        (
            f"**Period:** {info['start']} → {info['end']} · "
            f"{info['cal_days']} days ({info['trading_days']} trading)"
        ),
        (
            f"Ignored last **{info['ignore_last_days']} calendar days** of signals "
            f"({n_raw} → {n_kept}, cutoff {signal_cutoff}). "
            f"Quotes through **{info['end']}**. ${POSITION_VALUE:,.0f} per lot. "
            f"Ranked by **return on avg invested**. {len(rows)} unique combos."
        ),
        "",
        "# WINNING COMBINATION",
        "",
        f"# SELL: {best.get('short', best.get('tag', '')).upper()}",
        "",
        f"# BUY: {best.get('buy_label', '').upper()}",
        "",
        (
            f"# {best['return_on_avg_invested_pct']:+.1f}% ON INVESTED · "
            f"{money(best['stock_pnl'])} · {best['n_signals']} SIGNALS · "
            f"{best['win_rate_pct']:.1f}% WIN RATE · "
            f"{best['n_closed']}c/{best['n_open']}o"
        ),
        "",
        "## Plan",
        "",
        *closed_plan_text(locks),
        "",
        "## Known sell on the anchor buys",
        "",
        closed_compact_table(known) if known else "_known sell cells missing_",
        "",
        "## Top 25 overall",
        "",
        closed_compact_table(rows, limit=25),
        "",
    ]
    for i in range(1, 6):
        block = by_iter.get(i, [])
        if not block:
            continue
        body += [
            f"## Iteration {i} ({len(block)} new combos)",
            "",
            closed_compact_table(block, limit=12),
            "",
        ]
    body += [
        "## Best stock P&L",
        "",
        (
            f"**{best_pnl.get('short')}** · **{best_pnl.get('buy_label')}** → "
            f"{money(best_pnl['stock_pnl'])} "
            f"({best_pnl['return_on_avg_invested_pct']:+.1f}%, {best_pnl['n_signals']} signals)."
        ),
        "",
        "## All combinations",
        "",
        closed_compact_table(rows),
        "",
        "## Conclusions",
        "",
    ]
    mean_open = sum(r["n_open"] for r in rows) / len(rows)
    known_open = (
        sum(r["n_open"] for r in known) / len(known) if known else float("nan")
    )
    body.append(
        f"- {len(rows)} unique combos after dropping signals after {signal_cutoff}. "
        f"Mean open lots at the last bar: {mean_open:.1f} "
        f"(known 30d 50% 7.5dd on the anchor buys: {known_open:.1f})."
    )
    body.append(
        f"- Best **return on invested** (n≥10): **{best.get('buy_label')}** on "
        f"**{best.get('short')}** → {best['return_on_avg_invested_pct']:+.1f}% "
        f"({money(best['stock_pnl'])}, {best['n_signals']} signals, "
        f"{best['n_closed']}c/{best['n_open']}o)."
    )
    body.append(
        f"- Best **stock P&L** (n≥10): **{best_pnl.get('buy_label')}** on "
        f"**{best_pnl.get('short')}** → {money(best_pnl['stock_pnl'])} "
        f"({best_pnl['return_on_avg_invested_pct']:+.1f}%)."
    )
    if known:
        body.append(
            "- Known **30d 50% 7.5dd** on the anchor buys after the cutoff:"
        )
        for row in sorted(known, key=lambda r: r["return_on_avg_invested_pct"], reverse=True):
            body.append(
                f"  - {row['buy_label']}: {row['return_on_avg_invested_pct']:+.1f}% / "
                f"{money(row['stock_pnl'])} / {row['n_signals']} "
                f"({row['n_closed']}c/{row['n_open']}o)."
            )
    top_sells = mean_by(rows, lambda r: r.get("short"))[:5]
    body.append("- Best sells by mean invested return across the buys they were paired with:")
    for roi, pnl, short, block in top_sells:
        body.append(
            f"  - **{short}**: mean {roi:+.1f}% / {money(pnl)} ({len(block)} cells)."
        )
    top_buys = mean_by(rows, lambda r: r.get("buy_label"))[:5]
    body.append("- Best buys by mean invested return across the sells they were paired with:")
    for roi, pnl, label, block in top_buys:
        n = block[0]["n_signals"]
        body.append(
            f"  - **{label}** (n={n}): mean {roi:+.1f}% / {money(pnl)} ({len(block)} cells)."
        )
    body += ["", "## Notes", ""] + [f"- {n}" for n in notes] + [""]
    path.write_text("\n".join(body))
    print(f"Wrote {path}")


def run_closed(signals, close, spy):
    seen = set()
    all_rows = []
    locks = []
    close_wide = None
    init_cash = None
    anchors = anchor_buys()

    print("\n=== Iteration 1: anchor buys × 30d/50%/7.5dd neighborhood ===")
    specs1 = neighborhood_sells((20, 25, 30, 40), (0.40, 0.50, 0.60), (0.05, 0.075, 0.10))
    rows, close_wide, init_cash = run_combos(
        signals, close, spy, anchors, specs1, seen, 1
    )
    all_rows.extend(rows)
    hold_lock = best_hold_days(rows)
    locks.append(f"I2 hold={hold_lock}d")
    print(f"Lock hold={hold_lock}d for iteration 2\n")

    print("=== Iteration 2: lock hold, expand target × dd ===")
    specs2 = [
        SellSpec(hold_days=hold_lock, target_frac=t, drawdown=d)
        for t in (0.25, 0.35, 0.50, 0.65, 0.75)
        for d in (0.06, 0.075, 0.085, 0.10, 0.125)
    ]
    rows, cw, ic = run_combos(signals, close, spy, anchors, specs2, seen, 2)
    all_rows.extend(rows)
    if cw is not None:
        close_wide, init_cash = cw, ic
    pairs = best_target_dd_pairs(all_rows, n=2)
    if not pairs:
        pairs = [(0.50, 0.075), (0.50, 0.10)]
    locks.append(
        "I3 target/dd="
        + ", ".join(
            f"{(t * 100 if t is not None else 0):g}%/{d * 100:g}dd" for t, d in pairs
        )
    )
    print(f"Lock {locks[-1]} for iteration 3\n")

    print("=== Iteration 3: lock target+dd, sweep hold ===")
    specs3 = [
        SellSpec(hold_days=h, target_frac=t, drawdown=d)
        for t, d in pairs
        for h in (None, 10, 15, 21, 25, 30, 35, 45, 50, 60)
    ]
    rows, cw, ic = run_combos(signals, close, spy, anchors, specs3, seen, 3)
    all_rows.extend(rows)
    if cw is not None:
        close_wide, init_cash = cw, ic
    sell_locks = unique_specs_from_rows(all_rows, 3)
    if all(s.tag != WINNING_SELL.tag for s in sell_locks):
        sell_locks = [WINNING_SELL] + sell_locks[:2]
    locks.append("I4 sells=" + ", ".join(s.short for s in sell_locks))
    print(f"Lock sells {locks[-1]} for iteration 4\n")

    print("=== Iteration 4: lock top sells, sweep buy neighborhood ===")
    rows, cw, ic = run_combos(
        signals, close, spy, iter4_buy_grid(), sell_locks, seen, 4
    )
    all_rows.extend(rows)
    if cw is not None:
        close_wide, init_cash = cw, ic

    print("=== Iteration 5: percentile buys + staged trail with 30d ===")
    buys5 = unique_buys_from_rows(
        all_rows,
        n=4,
        extra=anchors
        + with_signal_names(
            [
                {"min_percentile": 0.80},
                {"min_percentile": 0.60},
            ]
        ),
    )
    extra_sell = next((s for s in sell_locks if s.tag != WINNING_SELL.tag), sell_locks[0])
    specs5 = [
        WINNING_SELL,
        extra_sell,
        SellSpec(hold_days=30, dd_before=0.075, lock_profit=0.05, dd_after=0.05),
        SellSpec(
            hold_days=30,
            target_frac=0.50,
            dd_before=0.075,
            lock_profit=0.05,
            dd_after=0.05,
        ),
        SellSpec(
            hold_days=30,
            target_frac=0.50,
            dd_before=0.10,
            lock_profit=0.05,
            dd_after=0.05,
        ),
    ]
    unique5 = []
    tags = set()
    for spec in specs5:
        if spec.tag not in tags:
            tags.add(spec.tag)
            unique5.append(spec)
    locks.append("I5 buys=" + ", ".join(buy_label(b) for b in buys5))
    locks.append("I5 sells=" + ", ".join(s.short for s in unique5))
    rows, cw, ic = run_combos(signals, close, spy, buys5, unique5, seen, 5)
    all_rows.extend(rows)
    if cw is not None:
        close_wide, init_cash = cw, ic
    print(f"\nClosed window done: {len(all_rows)} unique combos")
    return all_rows, close_wide, init_cash, locks


def coarse_buy_grid():
    return with_signal_names(
        [
            {"min_analysts": n, "min_projected": float(p)}
            for n in (2, 3, 4, 5, 6)
            for p in (20, 25, 30)
        ]
    )


def coarse_sell_grid():
    return neighborhood_sells((10, 15, 30), (0.25, 0.50), (0.075, 0.10))


def wide_buy_grid():
    return coarse_buy_grid()


def wide_sell_grid():
    return neighborhood_sells(
        (10, 15, 30, 45, 60, 75, 90, 105, 120),
        (0.25, 0.50),
        (0.075, 0.10),
    )


def full_buy_grid():
    return with_signal_names(
        [
            {"min_analysts": n, "min_projected": float(p)}
            for n in (2, 3, 4, 5, 6)
            for p in (10, 20, 25, 30)
        ]
    )


def full_sell_grid():
    return neighborhood_sells(
        (10, 15, 30, 45, 60),
        (0.25, 0.50, 0.75),
        (0.05, 0.075),
    )


def winners_buy_grid():
    return with_signal_names(
        [
            {"min_analysts": n, "min_projected": float(p)}
            for n in (2, 3, 4)
            for p in (20, 30, 40, 50)
        ]
    )


def winners_sell_grid():
    return neighborhood_sells((10, 15), (0.25, 0.50), (0.05, 0.075, 0.10))


def protect_sell_grid():
    """Loss dropdown × fraction of the peak gain. No hold, no target."""
    return [
        SellSpec(drawdown=dd, profit_protect=pp)
        for dd in (0.025, 0.05, 0.075)
        for pp in (0.05, 0.10, 0.20, 0.40)
    ]


def slots_sell_grid():
    """One book size. Replacement is the sell."""
    return [SellSpec(slots=SLOT_COUNT)]


def book_sell_grid():
    """Book size × loss dropdown × profit protection, on the slot rule."""
    return [
        SellSpec(drawdown=dd, profit_protect=pp, slots=slots)
        for slots in BOOK_SLOTS
        for dd in BOOK_DRAWDOWNS
        for pp in BOOK_PROTECTS
    ]


def filler_sell_grid():
    """The yahoo book grid once for each stop filler that replaces SPY."""
    return [
        SellSpec(drawdown=dd, profit_protect=pp, slots=slots, filler=filler)
        for filler in FILLERS
        for slots in BOOK_SLOTS
        for dd in BOOK_DRAWDOWNS
        for pp in BOOK_PROTECTS
    ]


def cash_buy_grid():
    """Yahoo winner buys plus projected >10%."""
    return with_signal_names(
        [
            {"min_analysts": n, "min_projected": float(p)}
            for n in (2, 3, 4)
            for p in (10, 20, 30, 40, 50)
        ]
    )


def count_buy_grid():
    """Formula buys plus analyst >0 and analyst >1."""
    return with_signal_names(
        [
            {"min_analysts": n, "min_projected": float(p)}
            for n in (0, 1, 2, 3, 4)
            for p in (10, 20, 30, 40, 50)
        ]
    )


def low_buy_grid():
    """Count buys plus projected >0%."""
    return with_signal_names(
        [
            {"min_analysts": n, "min_projected": float(p)}
            for n in (0, 1, 2, 3, 4)
            for p in (0, 10, 20, 30, 40, 50)
        ]
    )


def daily_buy_grid():
    """Daily books. Analyst >0–4 and projected >0/10/20/30%."""
    return with_signal_names(
        [
            {"min_analysts": n, "min_projected": float(p)}
            for n in (0, 1, 2, 3, 4)
            for p in DAILY_PROJECTED
        ]
    )


def cash_sell_grid():
    """Book size × ls or dls × loss dropdown × profit protect. Strength lots only."""
    return [
        SellSpec(
            drawdown=dd,
            profit_protect=pp,
            slots=slots,
            loss_mode=loss,
            lot_mode="str",
        )
        for slots in CASH_SLOTS
        for loss in LOSS_MODES
        for dd in BOOK_DRAWDOWNS
        for pp in BOOK_PROTECTS
    ]


def formula_sell_grid():
    """Fixed $320,000 book, four strength formulas, same stops as the split."""
    return [
        SellSpec(
            drawdown=dd,
            profit_protect=pp,
            slots=slots,
            loss_mode=loss,
            lot_mode=mode,
            lot_amount=BOOK_CASH / slots,
        )
        for mode in LOT_FORMULAS
        for slots in CASH_SLOTS
        for loss in LOSS_MODES
        for dd in BOOK_DRAWDOWNS
        for pp in BOOK_PROTECTS
    ]


def daily_sell_grid():
    """Fixed $320,000 book. ls only, no 24 or 48 lots, profit protect through 10%."""
    return [
        SellSpec(
            drawdown=dd,
            profit_protect=pp,
            slots=slots,
            loss_mode="ls",
            lot_mode=mode,
            lot_amount=BOOK_CASH / slots,
        )
        for mode in LOT_FORMULAS
        for slots in DAILY_SLOTS
        for dd in BOOK_DRAWDOWNS
        for pp in DAILY_PROTECTS
    ]


def horizon_sell_grid():
    """Daily sell grid plus 5% loss dropdown and 7.5% profit protection."""
    return [
        SellSpec(
            drawdown=dd,
            profit_protect=pp,
            slots=slots,
            loss_mode="ls",
            lot_mode=mode,
            lot_amount=BOOK_CASH / slots,
        )
        for mode in LOT_FORMULAS
        for slots in DAILY_SLOTS
        for dd in HORIZON_DRAWDOWNS
        for pp in HORIZON_PROTECTS
    ]


def split_sell_grid():
    """Same stops as cash, with each lot count splitting one $320,000 book."""
    return [
        SellSpec(
            drawdown=dd,
            profit_protect=pp,
            slots=slots,
            loss_mode=loss,
            lot_mode="str",
            lot_amount=BOOK_CASH / slots,
        )
        for slots in CASH_SLOTS
        for loss in LOSS_MODES
        for dd in BOOK_DRAWDOWNS
        for pp in BOOK_PROTECTS
    ]


def scale_sell_grid():
    """64-lot book × SPY or none × ls or dls × one lot or strength sizing."""
    return [
        SellSpec(
            drawdown=dd,
            profit_protect=pp,
            slots=SCALE_SLOTS,
            filler=filler,
            loss_mode=loss,
            lot_mode=lot,
        )
        for filler in SCALE_FILLERS
        for loss in LOSS_MODES
        for lot in LOT_MODES
        for dd in BOOK_DRAWDOWNS
        for pp in BOOK_PROTECTS
    ]


def load_symbol(ticker, index):
    """One Yahoo close series aligned to the simulation calendar."""
    path = CACHE_DIR / f"{ticker.lower()}.pkl"
    series = None
    if path.exists():
        series = pd.read_pickle(path)
        if isinstance(series, pd.DataFrame):
            series = series.iloc[:, 0]
        series = normalize_price_index(series)
        series.name = ticker
    start = pd.Timestamp(index.min()).normalize()
    want = pd.Timestamp(index.max()).normalize()
    covered = (
        series is not None
        and not series.empty
        and pd.Timestamp(series.index.min()) <= start
        and pd.Timestamp(series.index.max()) >= want
    )
    if not covered:
        extra = download_close_yahoo([ticker], start, want)
        series = normalize_price_index(extra.iloc[:, 0])
        series.name = ticker
        CACHE_DIR.mkdir(exist_ok=True)
        series.to_pickle(path)
        print(f"Cached {ticker} → {path} · last {series.index.max().date()}")
    aligned = aligned_spy(series, index)
    if aligned.isna().any():
        raise RuntimeError(
            f"{ticker} prices do not cover {start.date()} → {want.date()}"
        )
    return aligned


def load_tqqq(index):
    """TQQQ closes aligned to the simulation calendar. Cached under VectorBT/.cache."""
    return load_symbol(PARK_TQQQ, index)


def run_book(signals, close, spy, position_log=None):
    _check_slot_book()
    buys = winners_buy_grid()
    specs = book_sell_grid()
    print(
        f"\n=== Yahoo book: {len(buys)} buys × {len(specs)} sells"
        f" · lots {', '.join(str(n) for n in BOOK_SLOTS)}"
        f" · {', '.join(signal_names())} ==="
    )
    return run_combos(
        signals,
        close,
        spy,
        buys,
        specs,
        set(),
        "book",
        position_log=position_log,
    )


def run_park(signals, close, spy, position_log=None):
    _check_slot_book()
    _check_park_book()
    tqqq = load_tqqq(close.index)
    buys = winners_buy_grid()
    specs = book_sell_grid()
    print(
        f"\n=== Yahoo park: {len(buys)} buys × {len(specs)} sells"
        f" · lots {', '.join(str(n) for n in BOOK_SLOTS)}"
        f" · free lots {PARK_TQQQ} · stop lots {PARK_SPY}"
        f" · {', '.join(signal_names())} ==="
    )
    return run_combos(
        signals,
        close,
        spy,
        buys,
        specs,
        set(),
        "park",
        position_log=position_log,
        tqqq=tqqq,
    )


def run_fillers(signals, close, spy, position_log=None):
    _check_slot_book()
    _check_park_book()
    _check_filler_book()
    tqqq = load_tqqq(close.index)
    parks = {ticker: load_symbol(ticker, close.index) for ticker in FILLERS}
    buys = winners_buy_grid()
    specs = filler_sell_grid()
    print(
        f"\n=== Yahoo stop fillers: {len(buys)} buys × {len(specs)} sells"
        f" · {', '.join(FILLERS)}"
        f" · free lots {PARK_TQQQ}"
        f" · {', '.join(signal_names())} ==="
    )
    return run_combos(
        signals,
        close,
        spy,
        buys,
        specs,
        set(),
        "fillers",
        position_log=position_log,
        tqqq=tqqq,
        parks=parks,
    )


def run_cash(signals, close, spy, position_log=None):
    _check_slot_book()
    _check_cash_book()
    buys = cash_buy_grid()
    specs = cash_sell_grid()
    print(
        f"\n=== Yahoo cash book: {len(buys)} buys × {len(specs)} sells"
        f" · lots {', '.join(str(n) for n in CASH_SLOTS)}"
        f" · {', '.join(LOSS_MODES)} · strength"
        f" · no SPY · no TQQQ"
        f" · {', '.join(signal_names())} ==="
    )
    return run_combos(
        signals,
        close,
        spy,
        buys,
        specs,
        set(),
        "cash",
        position_log=position_log,
        cash_sleeve=False,
    )


def run_low(signals, close, spy, position_log=None):
    _check_slot_book()
    _check_cash_book()
    _check_split_book()
    _check_lot_formulas()
    buys = low_buy_grid()
    specs = formula_sell_grid()
    print(
        f"\n=== Yahoo upside >0: {len(buys)} buys × {len(specs)} sells"
        f" · ${BOOK_CASH:,.0f} total"
        f" · analysts >0/>1/>2/>3/>4"
        f" · projected >0/>10/>20/>30/>40/>50%"
        f" · lots {', '.join(str(n) for n in CASH_SLOTS)}"
        f" · {', '.join(LOT_FORMULAS)}"
        f" · {', '.join(LOSS_MODES)}"
        f" · no SPY · no TQQQ"
        f" · {', '.join(signal_names())} ==="
    )
    return run_combos(
        signals,
        close,
        spy,
        buys,
        specs,
        set(),
        "low",
        position_log=position_log,
        cash_sleeve=False,
    )


def run_books(signals, close, spy, position_log=None):
    _check_slot_book()
    _check_cash_book()
    _check_split_book()
    _check_lot_formulas()
    buys = low_buy_grid()
    specs = formula_sell_grid()
    print(
        f"\n=== All signal books: {len(buys)} buys × {len(specs)} sells"
        f" · ${BOOK_CASH:,.0f} total"
        f" · analysts >0/>1/>2/>3/>4"
        f" · projected >0/>10/>20/>30/>40/>50%"
        f" · lots {', '.join(str(n) for n in CASH_SLOTS)}"
        f" · {', '.join(LOT_FORMULAS)}"
        f" · {', '.join(LOSS_MODES)}"
        f" · no SPY · no TQQQ"
        f" · {', '.join(signal_names())} ==="
    )
    return run_combos(
        signals,
        close,
        spy,
        buys,
        specs,
        set(),
        "books",
        position_log=position_log,
        cash_sleeve=False,
        resume=True,
    )


def run_daily(signals, close, spy, position_log=None):
    _check_slot_book()
    _check_cash_book()
    _check_split_book()
    _check_lot_formulas()
    _check_position_win_rate()
    buys = daily_buy_grid()
    specs = daily_sell_grid()
    print(
        f"\n=== Daily books: {len(buys)} buys × {len(specs)} sells"
        f" · ${BOOK_CASH:,.0f} total"
        f" · analysts >0/>1/>2/>3/>4"
        f" · projected >0/>10/>20/>30%"
        f" · lots {', '.join(str(n) for n in DAILY_SLOTS)}"
        f" · {', '.join(LOT_FORMULAS)}"
        f" · ls"
        f" · no SPY · no TQQQ"
        f" · {', '.join(signal_names())} ==="
    )
    return run_combos(
        signals,
        close,
        spy,
        buys,
        specs,
        set(),
        "daily",
        position_log=position_log,
        cash_sleeve=False,
        resume=True,
    )


def run_horizon(signals, close, spy, position_log=None):
    _check_slot_book()
    _check_cash_book()
    _check_split_book()
    _check_lot_formulas()
    _check_position_win_rate()
    buys = daily_buy_grid()
    specs = horizon_sell_grid()
    print(
        f"\n=== 1-5 day books: {len(buys)} buys × {len(specs)} sells"
        f" · ${BOOK_CASH:,.0f} total"
        f" · analysts >0/>1/>2/>3/>4"
        f" · projected >0/>10/>20/>30%"
        f" · lots {', '.join(str(n) for n in DAILY_SLOTS)}"
        f" · loss {', '.join(f'{dd * 100:g}dd' for dd in HORIZON_DRAWDOWNS)}"
        f" · protect {', '.join(f'{pp * 100:g}pp' for pp in HORIZON_PROTECTS)}"
        f" · {', '.join(LOT_FORMULAS)}"
        f" · ls"
        f" · no SPY · no TQQQ"
        f" · {', '.join(signal_names())} ==="
    )
    return run_combos(
        signals,
        close,
        spy,
        buys,
        specs,
        set(),
        "horizon",
        position_log=position_log,
        cash_sleeve=False,
        resume=True,
    )


def validation_ranges(year=2026):
    """One flat list of windows. Not a separate phase per length."""
    built = []
    n = len(_RANGE_MONTHS)
    for length in range(1, 9):
        for i in range(n - length + 1):
            start_num, start_name = _RANGE_MONTHS[i]
            end_num, end_name = _RANGE_MONTHS[i + length - 1]
            label = (
                f"{length}m_{start_name}"
                if length == 1
                else f"{length}m_{start_name}-{end_name}"
            )
            start = pd.Timestamp(year=year, month=start_num, day=1)
            if end_num == 12:
                end = pd.Timestamp(year=year, month=12, day=31)
            else:
                end = pd.Timestamp(year=year, month=end_num + 1, day=1) - pd.Timedelta(
                    days=1
                )
            built.append(
                {
                    "label": label,
                    "start": start.strftime("%Y-%m-%d"),
                    "end": end.strftime("%Y-%m-%d"),
                }
            )
    labels = tuple(item["label"] for item in built)
    if labels != VALIDATION_RANGE_LABELS:
        raise RuntimeError("validation range labels drifted from the hardcoded list")
    return built


def _check_validation_ranges():
    ranges = validation_ranges()
    if len(ranges) != 52:
        raise RuntimeError(f"expected 52 ranges, got {len(ranges)}")
    by_label = {item["label"]: item for item in ranges}
    checks = {
        "1m_Jan": ("2026-01-01", "2026-01-31"),
        "1m_Oct": ("2026-10-01", "2026-10-31"),
        "2m_Sep-Oct": ("2026-09-01", "2026-10-31"),
        "3m_Jan-Mar": ("2026-01-01", "2026-03-31"),
        "7m_Apr-Oct": ("2026-04-01", "2026-10-31"),
        "8m_Jan-Aug": ("2026-01-01", "2026-08-31"),
        "8m_Mar-Oct": ("2026-03-01", "2026-10-31"),
    }
    for label, (start, end) in checks.items():
        got = by_label[label]
        if got["start"] != start or got["end"] != end:
            raise RuntimeError(f"{label} is {got['start']} → {got['end']}")
    counts = {length: 0 for length in range(1, 9)}
    for item in ranges:
        counts[int(item["label"].split("m_", 1)[0])] += 1
    if counts != {1: 10, 2: 9, 3: 8, 4: 7, 5: 6, 6: 5, 7: 4, 8: 3}:
        raise RuntimeError(f"range counts {counts}")


def validation_sell():
    """Frozen recency winner: 7.5dd 5pp · 12 × $26,667 · ls · at."""
    spec = SellSpec(
        drawdown=0.075,
        profit_protect=0.05,
        slots=12,
        loss_mode="ls",
        lot_mode="at",
        lot_amount=BOOK_CASH / 12,
    )
    if spec.short != "7.5dd 5pp · 12 × $26,667 · ls · at":
        raise RuntimeError(f"frozen sell label drifted: {spec.short}")
    return spec


def validation_buys():
    """Analyst >3 and projected >0/10/20/30% on each selected book, in every window."""
    buys = []
    for window in validation_ranges():
        for name in signal_names():
            for projected in (0, 10, 20, 30):
                buys.append(
                    {
                        "min_analysts": 3,
                        "min_projected": float(projected),
                        "signal_name": name,
                        "range_label": window["label"],
                        "date_from": window["start"],
                        "date_to": window["end"],
                    }
                )
    return buys


def run_ranges(signals, close, spy, position_log=None):
    _check_slot_book()
    _check_cash_book()
    _check_split_book()
    _check_lot_formulas()
    _check_position_win_rate()
    _check_validation_ranges()
    buys = validation_buys()
    spec = validation_sell()
    print(
        f"\n=== Recency date ranges: {len(buys)} buys × 1 sell"
        f" · ${BOOK_CASH:,.0f} total"
        f" · {spec.short}"
        f" · analysts >3"
        f" · projected >0/>10/>20/>30%"
        f" · {len(validation_ranges())} ranges"
        f" · one position per ticker"
        f" · no SPY · no TQQQ"
        f" · {', '.join(signal_names())} ==="
    )
    rows, _sliced, init_cash = run_combos(
        signals,
        close,
        spy,
        buys,
        [spec],
        set(),
        "ranges",
        position_log=position_log,
        cash_sleeve=False,
        resume=True,
    )
    return rows, close, init_cash or BOOK_CASH


CONFIRM_BLOCKS = (
    "2m_Jan-Feb",
    "2m_Mar-Apr",
    "2m_May-Jun",
    "2m_Jul-Aug",
    "2m_Sep-Oct",
)
CONFIRM_HALVES = ("5m_Jan-May", "5m_Jun-Oct")
CONFIRM_FULL = "10m_Jan-Oct"


def _range_window(label, start_num, end_num, year=2026):
    start = pd.Timestamp(year=year, month=start_num, day=1)
    if end_num == 12:
        end = pd.Timestamp(year=year, month=12, day=31)
    else:
        end = pd.Timestamp(year=year, month=end_num + 1, day=1) - pd.Timedelta(days=1)
    return {
        "label": label,
        "start": start.strftime("%Y-%m-%d"),
        "end": end.strftime("%Y-%m-%d"),
    }


def confirm_ranges(year=2026):
    """Months, disjoint two-month blocks, both halves, and the full year."""
    built = [
        _range_window(f"1m_{name}", num, num, year) for num, name in _RANGE_MONTHS
    ]
    pairs = (
        (1, 2, "Jan", "Feb"),
        (3, 4, "Mar", "Apr"),
        (5, 6, "May", "Jun"),
        (7, 8, "Jul", "Aug"),
        (9, 10, "Sep", "Oct"),
    )
    for start_num, end_num, start_name, end_name in pairs:
        built.append(
            _range_window(
                f"2m_{start_name}-{end_name}", start_num, end_num, year
            )
        )
    built.append(_range_window("5m_Jan-May", 1, 5, year))
    built.append(_range_window("5m_Jun-Oct", 6, 10, year))
    built.append(_range_window(CONFIRM_FULL, 1, 10, year))
    labels = [item["label"] for item in built]
    if labels != [
        "1m_Jan",
        "1m_Feb",
        "1m_Mar",
        "1m_Apr",
        "1m_May",
        "1m_Jun",
        "1m_Jul",
        "1m_Aug",
        "1m_Sep",
        "1m_Oct",
        *CONFIRM_BLOCKS,
        *CONFIRM_HALVES,
        CONFIRM_FULL,
    ]:
        raise RuntimeError(f"confirm ranges drifted: {labels}")
    return built


def _book_sell(drawdown, profit_protect, slots, loss_mode, lot_mode):
    return SellSpec(
        drawdown=drawdown,
        profit_protect=profit_protect,
        slots=slots,
        loss_mode=loss_mode,
        lot_mode=lot_mode,
        lot_amount=BOOK_CASH / slots,
    )


def confirm_sells():
    """Frozen sell, then one moved knob at a time."""
    specs = [
        validation_sell(),
        _book_sell(0.05, 0.05, 12, "ls", "at"),
        _book_sell(0.10, 0.05, 12, "ls", "at"),
        _book_sell(0.075, 0.025, 12, "ls", "at"),
        _book_sell(0.075, 0.075, 12, "ls", "at"),
        _book_sell(0.075, 0.10, 12, "ls", "at"),
        _book_sell(0.075, 0.05, 8, "ls", "at"),
        _book_sell(0.075, 0.05, 16, "ls", "at"),
        _book_sell(0.075, 0.05, 32, "ls", "at"),
        _book_sell(0.075, 0.05, 12, "dls", "at"),
        _book_sell(0.075, 0.05, 12, "ls", "a"),
    ]
    shorts = [spec.short for spec in specs]
    if len(shorts) != len(set(shorts)):
        raise RuntimeError(f"duplicate confirm sells: {shorts}")
    if shorts[0] != "7.5dd 5pp · 12 × $26,667 · ls · at":
        raise RuntimeError(f"anchor drifted: {shorts[0]}")
    return specs


def confirm_buys():
    """Analyst >2/>3/>4 and projected >0/10/20/30% on each confirm book and window."""
    buys = []
    for window in confirm_ranges():
        for name in CONFIRM_SIGNAL_NAMES:
            for analysts in (2, 3, 4):
                for projected in (0, 10, 20, 30):
                    buys.append(
                        {
                            "min_analysts": analysts,
                            "min_projected": float(projected),
                            "signal_name": name,
                            "range_label": window["label"],
                            "date_from": window["start"],
                            "date_to": window["end"],
                        }
                    )
    return buys


def run_confirm(signals, close, spy, position_log=None):
    _check_slot_book()
    _check_cash_book()
    _check_split_book()
    _check_lot_formulas()
    _check_position_win_rate()
    buys = confirm_buys()
    specs = confirm_sells()
    print(
        f"\n=== Formula confirm: {len(buys)} buys × {len(specs)} sells"
        f" · ${BOOK_CASH:,.0f} total"
        f" · anchor {specs[0].short}"
        f" · analysts >2/>3/>4"
        f" · projected >0/>10/>20/>30%"
        f" · {len(confirm_ranges())} windows"
        f" · one position per ticker"
        f" · no SPY · no TQQQ"
        f" · {', '.join(CONFIRM_SIGNAL_NAMES)} ==="
    )
    rows, _sliced, init_cash = run_combos(
        signals,
        close,
        spy,
        buys,
        specs,
        set(),
        "confirm",
        position_log=position_log,
        cash_sleeve=False,
        resume=True,
    )
    return rows, close, init_cash or BOOK_CASH


def _median(values):
    ordered = sorted(values)
    if not ordered:
        return float("nan")
    mid = len(ordered) // 2
    if len(ordered) % 2:
        return ordered[mid]
    return (ordered[mid - 1] + ordered[mid]) / 2.0


def _book_day(name):
    return str(name).split("_")[-2]


def _window_tail(label):
    return str(label).split("_", 1)[1]


def _top_shares(position_path):
    path = Path(position_path) if position_path else None
    if path is None or not path.exists():
        return {}
    frame = pd.read_csv(path, usecols=["sell", "buy", "ticker", "pnl"])
    frame = frame[frame["buy"].astype(str).str.startswith(CONFIRM_FULL)]
    shares = {}
    for (sell, buy), block in frame.groupby(["sell", "buy"], sort=False):
        by_ticker = block.groupby("ticker")["pnl"].sum().sort_values(ascending=False)
        total = float(by_ticker.sum())
        if total <= 0 or by_ticker.empty:
            shares[(sell, buy)] = None
            continue
        top5 = float(by_ticker.head(5).sum()) / total * 100.0
        shares[(sell, buy)] = top5
    return shares


def _blank_window(template, label):
    """A window with no signals is a flat month, not a missing formula."""
    return {
        "range_label": label,
        "return_on_avg_invested_pct": 0.0,
        "stock_pnl": 0.0,
        "n_symbols": 0,
        "n_signals": 0,
        "win_rate_pct": 0.0,
        "signal_name": template.get("signal_name"),
        "min_analysts": template.get("min_analysts"),
        "min_projected": template.get("min_projected"),
        "short": template.get("short"),
        "buy_label": "",
    }


def _formula_stats(block):
    by_label = {row["range_label"]: row for row in block}
    template = block[0]

    def need(label):
        return by_label.get(label) or _blank_window(template, label)

    full = by_label.get(CONFIRM_FULL)
    if full is None:
        return None
    blocks = [need(label) for label in CONFIRM_BLOCKS]
    halves = [need(label) for label in CONFIRM_HALVES]
    months = [need(f"1m_{name}") for _num, name in _RANGE_MONTHS]
    negative = [
        _window_tail(row["range_label"])
        for row in blocks
        if row["return_on_avg_invested_pct"] <= 0
    ]
    return {
        "full": full,
        "blocks": blocks,
        "halves": halves,
        "months": months,
        "negative": negative,
        "block_pos": 5 - len(negative),
        "block_median": _median(
            [row["return_on_avg_invested_pct"] for row in blocks]
        ),
        "block_worst": min(row["return_on_avg_invested_pct"] for row in blocks),
        "month_pos": sum(
            1 for row in months if row["return_on_avg_invested_pct"] > 0
        ),
        "block_win": _median([row["win_rate_pct"] for row in blocks]),
        "block_symbols": _median([row["n_symbols"] for row in blocks]),
    }


def _held(stats):
    full = stats["full"]
    half_ok = all(row["return_on_avg_invested_pct"] > 0 for row in stats["halves"])
    return (
        full["n_signals"] >= 30
        and full["n_symbols"] >= 30
        and half_ok
        and stats["block_pos"] >= 4
    )


def _formula_line(stats, top5):
    full = stats["full"]
    h1, h2 = stats["halves"]
    share = "—" if top5 is None else f"{top5:.0f}%"
    lost = ", ".join(stats["negative"]) if stats["negative"] else "—"
    return (
        f"| {_book_day(full['signal_name'])} · >{int(full['min_analysts'])}"
        f" · >{int(full['min_projected'])}% "
        f"| {full['return_on_avg_invested_pct']:+.1f}% "
        f"| {money(full['stock_pnl'])} "
        f"| {full['n_symbols']} "
        f"| {full['win_rate_pct']:.1f}% "
        f"| {full['n_signals']} "
        f"| {stats['block_pos']}/5 "
        f"| {stats['block_median']:+.1f}% "
        f"| {stats['block_worst']:+.1f}% "
        f"| {lost} "
        f"| {stats['month_pos']}/10 "
        f"| {h1['return_on_avg_invested_pct']:+.1f}% "
        f"| {h2['return_on_avg_invested_pct']:+.1f}% "
        f"| {share} |"
    )


def confirm_validation_markdown(rows, position_path=None):
    """Score each formula on disjoint blocks, both halves, and the full year."""
    grouped = defaultdict(list)
    for row in rows:
        grouped[
            (
                row.get("short") or "",
                row.get("signal_name"),
                int(row["min_analysts"]),
                int(row["min_projected"]),
            )
        ].append(row)
    shares = _top_shares(position_path)
    scored = []
    for key, block in grouped.items():
        stats = _formula_stats(block)
        if stats is None:
            continue
        full = stats["full"]
        top5 = shares.get((full.get("short") or "", full.get("buy_label")))
        scored.append((key, stats, top5))
    anchor = "7.5dd 5pp · 12 × $26,667 · ls · at"
    held = [item for item in scored if _held(item[1])]
    held.sort(
        key=lambda item: (
            item[1]["full"]["return_on_avg_invested_pct"],
            item[1]["full"]["stock_pnl"],
        ),
        reverse=True,
    )
    head = (
        "| Formula | On invested | Stock P&L | Symbols | Win | Signals "
        "| Blocks + | Block med | Worst block | Blocks lost "
        "| Months + | Jan–May | Jun–Oct | Top 5 share |"
    )
    sep = (
        "| --- | ---: | ---: | ---: | ---: | ---: "
        "| ---: | ---: | ---: | --- "
        "| ---: | ---: | ---: | ---: |"
    )
    lines = [
        "## Validation score",
        "",
        "A formula is **held** only when January–October has at least 30 signals "
        "and 30 symbols, both halves make money, and at least 4 of the 5 "
        "disjoint two-month blocks make money. Those blocks are Jan–Feb, "
        "Mar–Apr, May–Jun, Jul–Aug, and Sep–Oct. They do not share a month. "
        "Rank among held formulas is January–October return on invested. "
        "Top 5 share is the best five symbols' profit divided by the full-window "
        "stock P&L. The single best cell further down is a different ranking.",
        "",
        f"Held formulas: **{len(held)}** of {len(scored)}.",
        "",
    ]
    if held:
        lines += [
            "### Held, by January–October return on invested",
            "",
            head,
            sep,
        ]
        for key, stats, top5 in held[:20]:
            sell = key[0]
            lines.append(f"| {sell} · " + _formula_line(stats, top5)[2:])
        lines.append("")
    else:
        lines += [
            "No formula is held. The nearest rows are the ones with the most "
            "positive disjoint blocks, then the higher full-window return.",
            "",
        ]
        nearest = sorted(
            scored,
            key=lambda item: (
                item[1]["block_pos"],
                item[1]["full"]["return_on_avg_invested_pct"],
                item[1]["full"]["n_symbols"],
            ),
            reverse=True,
        )[:15]
        lines += [head, sep]
        for key, stats, top5 in nearest:
            lines.append(f"| {key[0]} · " + _formula_line(stats, top5)[2:])
        lines.append("")

    lines += [
        "### Frozen sell on every book and cut",
        "",
        head,
        sep,
    ]
    frozen = [item for item in scored if item[0][0] == anchor]
    frozen.sort(
        key=lambda item: item[1]["full"]["return_on_avg_invested_pct"],
        reverse=True,
    )
    for _key, stats, top5 in frozen:
        lines.append(_formula_line(stats, top5))
    lines.append("")

    lines += [
        "### One knob off the frozen sell, 2d · analyst>3",
        "",
        head,
        sep,
    ]
    neighbors = [
        item
        for item in scored
        if _book_day(item[0][1]) == "2d" and item[0][2] == 3
    ]
    neighbors.sort(
        key=lambda item: (
            int(item[0][3]),
            item[0][0] != anchor,
            -item[1]["full"]["return_on_avg_invested_pct"],
        )
    )
    for key, stats, top5 in neighbors:
        lines.append(f"| {key[0]} · " + _formula_line(stats, top5)[2:])
    lines.append("")

    beats = []
    anchor_by_buy = {
        (item[0][1], item[0][2], item[0][3]): item[1]
        for item in scored
        if item[0][0] == anchor
    }
    for key, stats, top5 in scored:
        if key[0] == anchor:
            continue
        base = anchor_by_buy.get((key[1], key[2], key[3]))
        if base is None:
            continue
        better_return = (
            stats["full"]["return_on_avg_invested_pct"]
            > base["full"]["return_on_avg_invested_pct"]
        )
        better_blocks = stats["block_pos"] > base["block_pos"]
        keeps_symbols = stats["full"]["n_symbols"] >= base["full"]["n_symbols"]
        if better_blocks and better_return and keeps_symbols:
            beats.append((key, stats, top5, base))
    lines += [
        "### Neighbors that beat the frozen sell on the same buy",
        "",
        "Same book, analyst cut, and upside cut. Higher full-window return, "
        "more positive disjoint blocks, and at least as many symbols.",
        "",
    ]
    if not beats:
        lines += ["None.", ""]
    else:
        lines += [head, sep]
        beats.sort(
            key=lambda item: (
                item[1]["block_pos"],
                item[1]["full"]["return_on_avg_invested_pct"],
            ),
            reverse=True,
        )
        for key, stats, top5, _base in beats[:20]:
            lines.append(f"| {key[0]} · " + _formula_line(stats, top5)[2:])
        lines.append("")
    return "\n".join(lines)


def run_recency(signals, close, spy, position_log=None):
    _check_slot_book()
    _check_cash_book()
    _check_split_book()
    _check_lot_formulas()
    _check_position_win_rate()
    buys = daily_buy_grid()
    specs = horizon_sell_grid()
    print(
        f"\n=== Recency books: {len(buys)} buys × {len(specs)} sells"
        f" · ${BOOK_CASH:,.0f} total"
        f" · analysts >0/>1/>2/>3/>4"
        f" · projected >0/>10/>20/>30%"
        f" · lots {', '.join(str(n) for n in DAILY_SLOTS)}"
        f" · loss {', '.join(f'{dd * 100:g}dd' for dd in HORIZON_DRAWDOWNS)}"
        f" · protect {', '.join(f'{pp * 100:g}pp' for pp in HORIZON_PROTECTS)}"
        f" · {', '.join(LOT_FORMULAS)}"
        f" · ls"
        f" · one position per ticker"
        f" · no SPY · no TQQQ"
        f" · {', '.join(signal_names())} ==="
    )
    return run_combos(
        signals,
        close,
        spy,
        buys,
        specs,
        set(),
        "recency",
        position_log=position_log,
        cash_sleeve=False,
        resume=True,
    )


def run_window(signals, close, spy, position_log=None):
    _check_slot_book()
    _check_cash_book()
    _check_split_book()
    _check_lot_formulas()
    _check_position_win_rate()
    buys = daily_buy_grid()
    specs = daily_sell_grid()
    print(
        f"\n=== 7-day books: {len(buys)} buys × {len(specs)} sells"
        f" · ${BOOK_CASH:,.0f} total"
        f" · analysts >0/>1/>2/>3/>4"
        f" · projected >0/>10/>20/>30%"
        f" · lots {', '.join(str(n) for n in DAILY_SLOTS)}"
        f" · {', '.join(LOT_FORMULAS)}"
        f" · ls"
        f" · no SPY · no TQQQ"
        f" · {', '.join(signal_names())} ==="
    )
    return run_combos(
        signals,
        close,
        spy,
        buys,
        specs,
        set(),
        "window",
        position_log=position_log,
        cash_sleeve=False,
        resume=True,
    )


def run_counts(signals, close, spy, position_log=None):
    _check_slot_book()
    _check_cash_book()
    _check_split_book()
    _check_lot_formulas()
    buys = count_buy_grid()
    specs = formula_sell_grid()
    print(
        f"\n=== Yahoo analyst counts: {len(buys)} buys × {len(specs)} sells"
        f" · ${BOOK_CASH:,.0f} total"
        f" · analysts >0/>1/>2/>3/>4"
        f" · lots {', '.join(str(n) for n in CASH_SLOTS)}"
        f" · {', '.join(LOT_FORMULAS)}"
        f" · {', '.join(LOSS_MODES)}"
        f" · no SPY · no TQQQ"
        f" · upside >10%"
        f" · {', '.join(signal_names())} ==="
    )
    return run_combos(
        signals,
        close,
        spy,
        buys,
        specs,
        set(),
        "counts",
        position_log=position_log,
        cash_sleeve=False,
    )


def run_formulas(signals, close, spy, position_log=None):
    _check_slot_book()
    _check_cash_book()
    _check_split_book()
    _check_lot_formulas()
    buys = cash_buy_grid()
    specs = formula_sell_grid()
    print(
        f"\n=== Yahoo strength formulas: {len(buys)} buys × {len(specs)} sells"
        f" · ${BOOK_CASH:,.0f} total"
        f" · lots {', '.join(str(n) for n in CASH_SLOTS)}"
        f" · {', '.join(LOT_FORMULAS)}"
        f" · {', '.join(LOSS_MODES)}"
        f" · no SPY · no TQQQ"
        f" · upside >10%"
        f" · {', '.join(signal_names())} ==="
    )
    return run_combos(
        signals,
        close,
        spy,
        buys,
        specs,
        set(),
        "formulas",
        position_log=position_log,
        cash_sleeve=False,
    )


def run_fixed_book(signals, close, spy, position_log=None):
    _check_slot_book()
    _check_cash_book()
    _check_split_book()
    buys = cash_buy_grid()
    specs = split_sell_grid()
    print(
        f"\n=== Yahoo split book: {len(buys)} buys × {len(specs)} sells"
        f" · ${BOOK_CASH:,.0f} total"
        f" · lots {', '.join(str(n) for n in CASH_SLOTS)}"
        f" · {', '.join(LOSS_MODES)} · strength"
        f" · no SPY · no TQQQ"
        f" · upside >10%"
        f" · {', '.join(signal_names())} ==="
    )
    return run_combos(
        signals,
        close,
        spy,
        buys,
        specs,
        set(),
        "split",
        position_log=position_log,
        cash_sleeve=False,
    )


def run_scale(signals, close, spy, position_log=None):
    _check_slot_book()
    _check_park_book()
    _check_filler_book()
    _check_scale_book()
    tqqq = load_tqqq(close.index)
    buys = winners_buy_grid()
    specs = scale_sell_grid()
    print(
        f"\n=== Yahoo 64-lot scale: {len(buys)} buys × {len(specs)} sells"
        f" · fillers {', '.join(SCALE_FILLERS)}"
        f" · {', '.join(LOSS_MODES)} · {', '.join(LOT_MODES)}"
        f" · free lots {PARK_TQQQ}"
        f" · {', '.join(signal_names())} ==="
    )
    return run_combos(
        signals,
        close,
        spy,
        buys,
        specs,
        set(),
        "scale",
        position_log=position_log,
        tqqq=tqqq,
    )


def run_slots(signals, close, spy, position_log=None):
    _check_slot_book()
    buys = winners_buy_grid()
    specs = slots_sell_grid()
    print(
        f"\n=== Slot book: {len(buys)} buys × {len(specs)} sells"
        f" · {SLOT_COUNT} lots · {', '.join(signal_names())} ==="
    )
    return run_combos(
        signals,
        close,
        spy,
        buys,
        specs,
        set(),
        "slots",
        position_log=position_log,
    )


def run_protect(signals, close, spy, position_log=None, one_lot=False):
    buys = winners_buy_grid()
    specs = protect_sell_grid()
    print(
        f"\n=== Protect grid: {len(buys)} buys × {len(specs)} sells"
        f" · {', '.join(signal_names())}"
        f"{' · one lot' if one_lot else ''} ==="
    )
    return run_combos(
        signals,
        close,
        spy,
        buys,
        specs,
        set(),
        "protect",
        one_lot=one_lot,
        position_log=position_log,
    )


def run_winners(signals, close, spy, position_log=None, one_lot=False):
    buys = winners_buy_grid()
    specs = winners_sell_grid()
    print(
        f"\n=== Winners grid: {len(buys)} buys × {len(specs)} sells"
        f" · {', '.join(signal_names())}"
        f"{' · one lot' if one_lot else ''} ==="
    )
    return run_combos(
        signals,
        close,
        spy,
        buys,
        specs,
        set(),
        "winners",
        one_lot=one_lot,
        position_log=position_log,
    )


def run_full(signals, close, spy, position_log=None, one_lot=False):
    buys = full_buy_grid()
    specs = full_sell_grid()
    print(
        f"\n=== Full grid: {len(buys)} buys × {len(specs)} sells"
        f" · {', '.join(signal_names())}"
        f"{' · one lot' if one_lot else ''} ==="
    )
    return run_combos(
        signals,
        close,
        spy,
        buys,
        specs,
        set(),
        "full",
        one_lot=one_lot,
        position_log=position_log,
    )


def run_wide(signals, close, spy, position_log=None, one_lot=False):
    buys = wide_buy_grid()
    specs = wide_sell_grid()
    print(
        f"\n=== Wide grid: {len(buys)} buys × {len(specs)} sells"
        f"{' · one lot' if one_lot else ''} ==="
    )
    return run_combos(
        signals,
        close,
        spy,
        buys,
        specs,
        set(),
        "wide",
        one_lot=one_lot,
        position_log=position_log,
    )


def coarse_count_table(signals, buys):
    cuts = []
    analysts = []
    names = []
    for filt in buys:
        name = filt.get("signal_name")
        if name not in names:
            names.append(name)
        n = filt["min_analysts"]
        if n not in analysts:
            analysts.append(n)
        projected = int(filt["min_projected"])
        if projected not in cuts:
            cuts.append(projected)
    cuts = tuple(sorted(cuts))
    analysts = tuple(sorted(analysts))
    head = "| | " + " | ".join(f">{p}%" for p in cuts) + " |"
    sep = "| --- | " + " | ".join("---:" for _ in cuts) + " |"
    lines = [head, sep]
    for name in names:
        for n in analysts:
            cells = [
                str(len(filter_signals(signals, n, float(p), name))) for p in cuts
            ]
            label = f"analyst>{n}" if not name else f"{name} · analyst>{n}"
            lines.append("| " + label + " | " + " | ".join(cells) + " |")
    return "\n".join(lines)


def run_coarse(signals, close, spy, one_lot=False):
    buys = coarse_buy_grid()
    specs = coarse_sell_grid()
    print(
        f"\n=== Coarse grid: {len(buys)} buys × {len(specs)} sells"
        f"{' · one lot' if one_lot else ''} ==="
    )
    return run_combos(signals, close, spy, buys, specs, set(), "coarse", one_lot=one_lot)


def _climb_lines(known_rows):
    groups = defaultdict(dict)
    for row in known_rows:
        groups[(row.get("signal_name"), row.get("min_analysts"))][
            int(row["min_projected"])
        ] = row
    lines = []
    for key in sorted(groups, key=lambda k: (str(k[0]), k[1] or 0)):
        block = groups[key]
        vals = []
        bits = []
        cuts = sorted(block)
        for projected in cuts:
            row = block[projected]
            vals.append(row["return_on_avg_invested_pct"])
            bits.append(
                f">{projected}% {row['return_on_avg_invested_pct']:+.1f}% "
                f"(n={row['n_signals']}, {money(row['stock_pnl'])})"
            )
        trend = "keeps rising" if len(vals) >= 2 and vals == sorted(vals) else "peaks before the tightest cut"
        name = f"{key[0]} · " if key[0] else ""
        lines.append(f"{name}analyst>{key[1]} {trend}: " + ", ".join(bits))
    return lines


def write_grid_summary(path, rows, signals, info, notes, buys, specs, anchor, trust_n=30):
    trusted = [r for r in rows if r["n_signals"] >= trust_n]
    pool = trusted or rows
    best = max(pool, key=lambda r: (r["return_on_avg_invested_pct"], r["stock_pnl"]))
    best_pnl = max(pool, key=lambda r: r["stock_pnl"])
    known_tag = anchor.tag
    known_rows = [r for r in rows if r.get("tag") == known_tag]
    by_buy = defaultdict(list)
    for row in rows:
        by_buy[row.get("buy_label")].append(row)
    lot_note = (
        f"One book of ${BOOK_CASH:,.0f}. The lot count splits that cash. "
        if any(getattr(spec, "lot_amount", None) for spec in specs)
        else f"${POSITION_VALUE:,.0f} per lot. "
    )

    body = [
        f"# {info['title']}",
        "",
        f"**Run:** {info['run']}",
        (
            f"**Period:** {info['start']} → {info['end']} · "
            f"{info['cal_days']} days ({info['trading_days']} trading)"
        ),
        (
            f"{lot_note}Ranked by **return on avg invested**. "
            f"{len(rows)} combos. Trusted set is n≥{trust_n} ({len(trusted)} cells)."
        ),
        "",
        (
            f"{len(buys)} buys × {len(specs)} sells. One pass. "
            + (
                "Each cell is one book size, one loss dropdown, and one profit "
                "protect. Stops run first. A full book then sells the biggest "
                "loss, or the least profitable winner when that lot is the weaker signal."
                if any(
                    spec.slots is not None and spec.profit_protect is not None
                    for spec in specs
                )
                else "The book holds a fixed number of lots. A full book sells the "
                "biggest loss, or the least profitable winner when that lot is "
                "the weaker signal. No time stop and no drawdown."
                if any(spec.slots is not None for spec in specs)
                else "Each sell is a loss dropdown from the entry plus a giveback "
                "of the peak gain. No time stop and no profit target."
                if any(spec.profit_protect is not None for spec in specs)
                else "Sells are OR-combined."
            )
        ),
        "",
        "# WINNING COMBINATION",
        "",
        f"# SELL: {(best.get('short') or '').upper()}",
        "",
        f"# BUY: {best.get('buy_label', '').upper()}",
        "",
        (
            f"# {best['return_on_avg_invested_pct']:+.1f}% ON INVESTED · "
            f"{money(best['stock_pnl'])} · {best['n_signals']} SIGNALS · "
            f"{best['win_rate_pct']:.1f}% WIN RATE · "
            f"{best['n_closed']}c/{best['n_open']}o"
        ),
        "",
        (
            f"# TRADES {best.get('trade_from', '')} → {best.get('trade_to', '')} · "
            f"{best.get('days_exposed', 0)} DAYS UTILIZED · "
            f"{best.get('avg_invested_pct', 0):.1f}% LOTS UTILIZED · "
            f"{best.get('lot_days', 0)} LOT-DAYS · "
            f"{best.get('lot_days_util_pct', 0):.1f}% OF LOT-DAYS INVESTED · "
            f"AVG LOT ${best.get('avg_lot_amount', 0):,.0f}"
        ),
        "",
        "## Signal counts",
        "",
        coarse_count_table(signals, buys),
        "",
        f"## Anchor sell on every buy",
        "",
        f"{anchor.short}.",
        "",
        closed_compact_table(known_rows) if known_rows else "_known sell missing_",
        "",
        f"## Top 30 with n≥{trust_n}",
        "",
        closed_compact_table(trusted or rows, limit=30),
        "",
        "## Best sell for each buy",
        "",
    ]

    head = f"| Buy | n | Best sell | On invested | Stock P&L | Anchor {anchor.short} |"
    sep = "| --- | ---: | --- | ---: | ---: | --- |"
    lines = [head, sep]
    for filt in buys:
        label = buy_label(filt)
        block = by_buy.get(label, [])
        if not block:
            continue
        top = max(block, key=lambda r: r["return_on_avg_invested_pct"])
        known = next((r for r in block if r.get("tag") == known_tag), None)
        known_cell = (
            f"{known['return_on_avg_invested_pct']:+.1f}% / {money(known['stock_pnl'])}"
            if known
            else "—"
        )
        lines.append(
            "| "
            + " | ".join(
                [
                    label,
                    str(top["n_signals"]),
                    top.get("short") or top["tag"],
                    f"{top['return_on_avg_invested_pct']:+.1f}%",
                    money(top["stock_pnl"]),
                    known_cell,
                ]
            )
            + " |"
        )
    body += ["\n".join(lines), ""]

    if len(specs) <= 16:
        body += ["## Return on avg invested", "", focus_matrix(
            rows, specs, buys, lambda r: f"{r['return_on_avg_invested_pct']:+.1f}%"
        ), ""]
        body += ["## Stock P&L", "", focus_matrix(rows, specs, buys, lambda r: money(r["stock_pnl"])), ""]

    body += [f"## Mean by sell (n≥{trust_n})", ""]
    head = "| Sell | Cells | Mean on invested | Mean stock P&L |"
    sep = "| --- | ---: | ---: | ---: |"
    lines = [head, sep]
    for roi, pnl, short, block in mean_by(trusted or rows, lambda r: r.get("short")):
        lines.append(f"| {short} | {len(block)} | {roi:+.1f}% | {money(pnl)} |")
    body += ["\n".join(lines), ""]

    body += [f"## Mean by buy (n≥{trust_n})", ""]
    head = "| Buy | n | Cells | Mean on invested | Mean stock P&L |"
    sep = "| --- | ---: | ---: | ---: | ---: |"
    lines = [head, sep]
    for roi, pnl, label, block in mean_by(trusted or rows, lambda r: r.get("buy_label")):
        lines.append(
            f"| {label} | {block[0]['n_signals']} | {len(block)} | {roi:+.1f}% | {money(pnl)} |"
        )
    body += ["\n".join(lines), ""]

    body += [
        f"## Best stock P&L (n≥{trust_n})",
        "",
        (
            f"**{best_pnl.get('short')}** · **{best_pnl.get('buy_label')}** → "
            f"{money(best_pnl['stock_pnl'])} "
            f"({best_pnl['return_on_avg_invested_pct']:+.1f}%, {best_pnl['n_signals']} signals)."
        ),
        "",
        f"## Upside steps on {anchor.short}",
        "",
    ]
    body += [f"- {line}" for line in _climb_lines(known_rows)] + [""]
    if notes:
        body += ["## Notes", ""] + [f"- {n}" for n in notes] + [""]
    path.write_text("\n".join(body))
    print(f"Wrote {path}")


COARSE_PEAK = SellSpec(hold_days=10, target_frac=0.25, drawdown=0.075)


def fine_buy_grid():
    return with_signal_names(
        [
            {"min_analysts": 2, "min_projected": 30.0},
            {"min_analysts": 3, "min_projected": 30.0},
            {"min_analysts": 2, "min_projected": 35.0},
            {"min_analysts": 3, "min_projected": 35.0},
            {"min_analysts": 3, "min_projected": 25.0},
            {"min_analysts": 4, "min_projected": 30.0},
        ]
    )


def fine_sell_grid():
    return neighborhood_sells(
        (5, 7, 10, 12),
        (0.20, 0.25, 0.30, 0.35, 0.40),
        (0.06, 0.075, 0.085),
    )


def run_fine(signals, close, spy, position_log=None):
    buys = fine_buy_grid()
    specs = fine_sell_grid()
    print(f"\n=== Fine grid: {len(buys)} buys × {len(specs)} sells ===")
    return run_combos(
        signals, close, spy, buys, specs, set(), "fine", position_log=position_log
    )


def cohort_frames(signals):
    raw = load_signals(SIGNALS_CSV)
    daily = raw[raw["signal_name"] == "yahoo-daily"]
    keys = set(
        zip(pd.to_datetime(daily["date"]).dt.normalize(), daily["ticker"].astype(str))
    )
    dates = pd.to_datetime(signals["date"]).dt.normalize()
    shared = [
        (d, t) in keys
        for d, t in zip(dates, signals["ticker"].astype(str))
    ]
    shared = pd.Series(shared, index=signals.index)
    return (
        ("all", signals),
        ("new", signals.loc[~shared].reset_index(drop=True)),
        ("shared", signals.loc[shared].reset_index(drop=True)),
    )


def run_split(signals, close, spy, buys, specs, position_log=None):
    rows = []
    close_wide = None
    init_cash = None
    frames = cohort_frames(signals)
    planned = len(frames) * len(buys) * len(specs)
    done = 0
    for cohort, frame in frames:
        for buy in buys:
            bought_filter = dict(buy)
            for spec in specs:
                done += 1
                bought = apply_buy(frame, bought_filter)
                label = f"{cohort} · {buy_label(bought_filter)}"
                if bought.empty:
                    print(f"  skip split {done}/{planned} {spec.short} · {label}")
                    continue
                print(
                    f"  split {done}/{planned} {spec.short} · {label} ({len(bought)} signals)"
                )
                row, positions, close_wide, _, init_cash = run_one(
                    f"{spec.label} · {label}", close, spy, bought, spec
                )
                tagged = dict(bought_filter)
                tagged["label"] = label
                row = attach_spec(row, spec, tagged)
                row["label"] = f"{spec.short} · {label}"
                row["cohort"] = cohort
                print(
                    f"    invested {row['return_on_avg_invested_pct']:+.1f}%  "
                    f"{money(row['stock_pnl'])}  {row['n_closed']}c/{row['n_open']}o"
                )
                rows.append(row)
                if position_log is not None:
                    position_log.append(tag_positions(positions, row))
    return rows, close_wide, init_cash


def append_split_summary(path, rows):
    lines = [
        "",
        "## New names vs shared names",
        "",
        "Same sell on three books: every 7-day row, rows with no same-day daily twin, and rows that also appear on daily.",
        "",
        closed_compact_table(rows),
        "",
    ]
    path.write_text(path.read_text() + "\n".join(lines))
    print(f"Appended split table → {path}")


GRID_CANVAS = r'''import {
  Grid,
  H1,
  H2,
  Pill,
  Row,
  Stack,
  Stat,
  Table,
  Text,
  useCanvasState,
  useHostTheme,
  useMemo,
  type CSSProperties,
} from "cursor/canvas";

const SOURCE = __SOURCE__;
const TITLE = __TITLE__;

const SIGNALS = __SIGNALS__;
const ANALYSTS = __ANALYSTS__;
const UPSIDES = __UPSIDES__;
const HOLDS = __HOLDS__;
const TARGETS = __TARGETS__;
const DROPS = __DROPS__;
const PROTECTS = __PROTECTS__;
const FILLERS: string[] = __FILLERS__;
const RULES: string[] = __RULES__;
const SIZES: string[] = __SIZES__;
const RANGES: string[] = __RANGES__;
const SELL_MODE: string = __SELL_MODE__;

type Buy = { s: string; a: number; p: number; n: number; sym: number; w: string };
type Sell = { h: number; t: number; d: number; p: number; f: string; r: string; z: string; m: number };

const BUYS: Buy[] = __BUYS__;
const SELLS: Sell[] = __SELLS__;
const ROI: number[][] = __ROI__;
const PNL: number[][] = __PNL__;
const EXPOSED: number[][] = __EXPOSED__;
const LOTUTIL: number[][] = __LOTUTIL__;
const LOTDAYS: number[][] = __LOTDAYS__;
const LOTDAYUTIL: number[][] = __LOTDAYUTIL__;
const AVGLOT: number[][] = __AVGLOT__;
const WIN: number[][] = __WIN__;
const CLOSED: number[][] = __CLOSED__;
const OPENN: number[][] = __OPEN__;
const SYMBOLS: number[][] = __SYMBOLS__;
const POSITIONS: number[][] = __POSITIONS__;
const FROM: string[][] = __FROM__;
const TO: string[][] = __TO__;

const LOT_MONEY: Record<number, number> = {};
for (const sell of SELLS) if (sell.m) LOT_MONEY[sell.h] = sell.m;

function lotSplit(slots: number): string {
  const dollars = LOT_MONEY[slots];
  if (!dollars) return `${slots} lots`;
  return `${slots} × $${Math.round(dollars).toLocaleString("en-US")}`;
}

function lotSizeLabel(value: string): string {
  if (value === "str") return "strength";
  if (value === "1") return "1 lot";
  return value;
}

function buyLabel(buy: Buy): string {
  const cut = `>${buy.a},>${buy.p}%`;
  const book = buy.s ? `${buy.s} · ${cut}` : cut;
  return buy.w ? `${buy.w} · ${book}` : book;
}

function sellLabel(sell: Sell): string {
  if (SELL_MODE === "book") {
    const base = `${sell.d}dd ${sell.p}pp · ${lotSplit(sell.h)}`;
    const fillerName = sell.f === "none" ? "no SPY" : sell.f;
    const ruleName = sell.r === "ls" ? "ls" : sell.r === "dls" ? "dls" : sell.r;
    const lotName = lotSizeLabel(sell.z);
    return [base, fillerName, ruleName, lotName].filter(Boolean).join(" · ");
  }
  if (SELL_MODE === "slots") return `${sell.h} lots`;
  if (SELL_MODE === "protect") return `${sell.d}dd ${sell.p}pp`;
  return `${sell.h}d ${sell.t}% ${sell.d}dd`;
}

function money(n: number): string {
  const sign = n >= 0 ? "+" : "-";
  return `${sign}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;
}

function pct(n: number): string {
  return `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
}

function share(n: number): string {
  return `${n.toFixed(1)}%`;
}

function lotMoney(n: number): string {
  return `$${Math.round(n).toLocaleString("en-US")}`;
}

function parseHex(value: string): { r: number; g: number; b: number } | null {
  const raw = value.trim().replace("#", "");
  const hex = raw.length === 8 || raw.length === 4 ? raw.slice(0, raw.length === 8 ? 6 : 3) : raw;
  const full = hex.length === 3 ? hex.split("").map((c) => c + c).join("") : hex;
  if (full.length !== 6 || Number.isNaN(parseInt(full, 16))) return null;
  return {
    r: parseInt(full.slice(0, 2), 16),
    g: parseInt(full.slice(2, 4), 16),
    b: parseInt(full.slice(4, 6), 16),
  };
}

function parseColor(value: string): { r: number; g: number; b: number } | null {
  const hex = parseHex(value);
  if (hex) return hex;
  const match = value.match(/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/i);
  if (!match) return null;
  return { r: Number(match[1]), g: Number(match[2]), b: Number(match[3]) };
}

function mix(a: string, b: string, t: number, fallback: string): string {
  const pa = parseColor(a);
  const pb = parseColor(b);
  if (!pa || !pb) return fallback;
  const clamp = Math.min(1, Math.max(0, t));
  const r = Math.round(pa.r + (pb.r - pa.r) * clamp);
  const g = Math.round(pa.g + (pb.g - pa.g) * clamp);
  const bl = Math.round(pa.b + (pb.b - pa.b) * clamp);
  return `rgb(${r}, ${g}, ${bl})`;
}

function heat(t: number, yellow: string, orange: string, red: string, fallback: string): string {
  const clamp = Math.min(1, Math.max(0, t));
  return clamp < 0.5
    ? mix(yellow, orange, clamp * 2, fallback)
    : mix(orange, red, (clamp - 0.5) * 2, fallback);
}

function channel(c: number): number {
  const x = c / 255;
  return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
}

function luminance(rgb: { r: number; g: number; b: number }): number {
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

function readable(bg: string, primary: string, editor: string): string {
  const b = parseColor(bg);
  const p = parseColor(primary);
  const e = parseColor(editor);
  if (!b || !p || !e) return primary;
  const score = (ink: { r: number; g: number; b: number }) => {
    const lighter = Math.max(luminance(b), luminance(ink));
    const darker = Math.min(luminance(b), luminance(ink));
    return (lighter + 0.05) / (darker + 0.05);
  };
  return score(p) >= score(e) ? primary : editor;
}

function span(values: number[]): { min: number; max: number } {
  let min = values[0];
  let max = values[0];
  for (const value of values) {
    if (value < min) min = value;
    if (value > max) max = value;
  }
  return { min, max };
}

function unit(value: number, min: number, max: number): number {
  if (max === min) return 0.5;
  return (value - min) / (max - min);
}

const STAT_NAMES = ["min", "avg", "max"] as const;
type StatName = (typeof STAT_NAMES)[number];
type Stats = Record<StatName, number>;
const SHOW_MODES = ["pct", "pnl", "both"] as const;
type ShowMode = (typeof SHOW_MODES)[number];
type Metric = "pct" | "pnl";
const SYMBOL_FLOORS = [0, 2, 4, 7, 8, 9, 10, 12, 14, 16, 18, 20, 40, 80, 160, 320] as const;

function mean(values: number[]): number {
  return values.reduce((total, value) => total + value, 0) / values.length;
}

function pack(values: number[]): Stats {
  return { min: Math.min(...values), avg: mean(values), max: Math.max(...values) };
}

function cornerOf(perRow: Stats[]): Record<StatName, Stats> {
  const out = {} as Record<StatName, Stats>;
  for (const rowStat of STAT_NAMES) {
    const row = {} as Stats;
    for (const colStat of STAT_NAMES) {
      row[colStat] = pack(perRow.map((item) => item[colStat]))[rowStat];
    }
    out[rowStat] = row;
  }
  return out;
}

function statLabel(name: StatName): string {
  if (name === "min") return "Min";
  if (name === "avg") return "Avg";
  return "Max";
}

function toggleItem<T extends string | number>(current: T[], value: T, all: readonly T[]): T[] {
  const has = current.includes(value);
  if (has && current.length === 1) return current;
  const next = has ? current.filter((item) => item !== value) : [...current, value];
  return all.filter((item) => next.includes(item));
}

function emptyBuckets(options: readonly (string | number)[]): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const option of options) out[String(option)] = [];
  return out;
}

type SliceStats = { roi: Stats | null; pnl: Stats | null; sym: Stats | null; win: Stats | null };

function packSlice(
  roiGroups: Record<string, number[]>,
  pnlGroups: Record<string, number[]>,
  symGroups: Record<string, number[]>,
  winGroups: Record<string, number[]>,
): Record<string, SliceStats> {
  const out: Record<string, SliceStats> = {};
  for (const key of Object.keys(roiGroups)) {
    const roi = roiGroups[key];
    const pnl = pnlGroups[key] ?? [];
    const sym = symGroups[key];
    const win = winGroups[key];
    out[key] = {
      roi: roi.length ? pack(roi) : null,
      pnl: pnl.length ? pack(pnl) : null,
      sym: sym.length ? pack(sym) : null,
      win: win.length ? pack(win) : null,
    };
  }
  return out;
}

function countText(value: number | undefined): string {
  return value === undefined ? "—" : String(Math.round(value));
}

function winText(value: number | undefined): string {
  return value === undefined ? "—" : `${value.toFixed(1)}%`;
}

function FilterColumn<T extends string | number>({
  label,
  options,
  selected,
  onChange,
  format,
  stats,
  moneyMode = false,
  exclusive = false,
}: {
  label: string;
  options: readonly T[];
  selected: T[];
  onChange: (next: T[]) => void;
  format: (value: T) => string;
  stats: Record<string, SliceStats>;
  moneyMode?: boolean;
  exclusive?: boolean;
}) {
  const figure = {
    textAlign: "right" as const,
    fontVariantNumeric: "tabular-nums" as const,
  };
  const lead = (statsFor: Stats | null | undefined, name: StatName) => {
    if (!statsFor) return "—";
    return moneyMode ? money(statsFor[name]) : pct(statsFor[name]);
  };
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: moneyMode
          ? "minmax(0, 1fr) 6.6em 6.6em 6.6em 3.2em 3.2em 3.2em 4.2em 4.2em 4.2em"
          : "minmax(0, 1fr) 4.5em 4.5em 4.5em 3.2em 3.2em 3.2em 4.2em 4.2em 4.2em",
        columnGap: 6,
        rowGap: 2,
        alignItems: "center",
      }}
    >
      <span />
      <Text as="span" size="small" tone="tertiary" style={{ gridColumn: "2 / span 3", textAlign: "center" }}>
        {moneyMode ? "P&L" : "Return"}
      </Text>
      <Text as="span" size="small" tone="tertiary" style={{ gridColumn: "5 / span 3", textAlign: "center" }}>
        Symbols
      </Text>
      <Text as="span" size="small" tone="tertiary" style={{ gridColumn: "8 / span 3", textAlign: "center" }}>
        Win rate
      </Text>
      <Text size="small" tone="secondary" weight="semibold">
        {label}
      </Text>
      {["Min", "Avg", "Max", "Min", "Avg", "Max", "Min", "Avg", "Max"].map((name, index) => (
        <Text key={`${name}-${index}`} as="span" size="small" tone="tertiary" style={figure}>
          {name}
        </Text>
      ))}
      {options.map((option) => {
        const stat = stats[String(option)];
        const active = selected.includes(option);
        const tone = active ? "primary" : "tertiary";
        return (
          <div key={String(option)} style={{ display: "contents" }}>
            <div style={{ minWidth: 0, justifySelf: "start" }}>
              <Pill
                size="sm"
                active={active}
                onClick={() =>
                  onChange(exclusive ? [option] : toggleItem(selected, option, options))
                }
              >
                {format(option)}
              </Pill>
            </div>
            <Text as="span" size="small" tone={tone} style={figure}>
              {lead(moneyMode ? stat?.pnl : stat?.roi, "min")}
            </Text>
            <Text as="span" size="small" tone={tone} style={figure}>
              {lead(moneyMode ? stat?.pnl : stat?.roi, "avg")}
            </Text>
            <Text as="span" size="small" tone={tone} style={figure}>
              {lead(moneyMode ? stat?.pnl : stat?.roi, "max")}
            </Text>
            <Text as="span" size="small" tone={tone} style={figure}>
              {countText(stat?.sym?.min)}
            </Text>
            <Text as="span" size="small" tone={tone} style={figure}>
              {countText(stat?.sym?.avg)}
            </Text>
            <Text as="span" size="small" tone={tone} style={figure}>
              {countText(stat?.sym?.max)}
            </Text>
            <Text as="span" size="small" tone={tone} style={figure}>
              {winText(stat?.win?.min)}
            </Text>
            <Text as="span" size="small" tone={tone} style={figure}>
              {winText(stat?.win?.avg)}
            </Text>
            <Text as="span" size="small" tone={tone} style={figure}>
              {winText(stat?.win?.max)}
            </Text>
          </div>
        );
      })}
    </div>
  );
}

function FilterGroup<T extends string | number>({
  label,
  options,
  selected,
  onChange,
  format,
  exclusive = false,
}: {
  label: string;
  options: readonly T[];
  selected: T[];
  onChange: (next: T[]) => void;
  format: (value: T) => string;
  exclusive?: boolean;
}) {
  return (
    <Row gap={6} align="center" wrap>
      <Text size="small" tone="secondary" weight="semibold">
        {label}
      </Text>
      {options.map((option) => (
        <Pill
          key={String(option)}
          size="sm"
          active={selected.includes(option)}
          onClick={() =>
            onChange(exclusive ? [option] : toggleItem(selected, option, options))
          }
        >
          {format(option)}
        </Pill>
      ))}
    </Row>
  );
}

function Scale({
  label,
  range,
  format,
  yellow,
  orange,
  red,
  fallback,
}: {
  label: string;
  range: { min: number; max: number };
  format: (n: number) => string;
  yellow: string;
  orange: string;
  red: string;
  fallback: string;
}) {
  const steps = [0, 0.25, 0.5, 0.75, 1];
  return (
    <Row gap={8} align="center" wrap>
      <Text size="small" tone="secondary" weight="semibold">
        {label}
      </Text>
      <Text size="small" tone="tertiary">
        {format(range.min)}
      </Text>
      {steps.map((step) => (
        <div
          key={step}
          style={{
            width: 28,
            height: 14,
            background: heat(step, yellow, orange, red, fallback),
          }}
        />
      ))}
      <Text size="small" tone="tertiary">
        {format(range.max)}
      </Text>
    </Row>
  );
}

export default function FineGridCanvas() {
  const theme = useHostTheme();
  const [books, setBooks] = useCanvasState<string[]>("grid-signals", SIGNALS);
  const [analysts, setAnalysts] = useCanvasState<number[]>("fine-analysts", ANALYSTS);
  const [upsideFloor, setUpsideFloor] = useCanvasState<number>("fine-upside-floor", UPSIDES[0]);
  const [holds, setHolds] = useCanvasState<number[]>("fine-holds", HOLDS);
  const [targets, setTargets] = useCanvasState<number[]>("fine-targets", TARGETS);
  const [drops, setDrops] = useCanvasState<number[]>("fine-drops", DROPS);
  const [protects, setProtects] = useCanvasState<number[]>("fine-protects", PROTECTS);
  const [showMode, setShowMode] = useCanvasState<ShowMode>("fine-show-mode", "both");
  const [sortKey, setSortKey] = useCanvasState<string>("grid-sort-key", "");
  const [sortDir, setSortDir] = useCanvasState<"asc" | "desc">("grid-sort-dir", "desc");
  const [symbolFloor, setSymbolFloor] = useCanvasState<number>("fine-symbol-floor", 0);
  const [filler, setFiller] = useCanvasState<string>("grid-filler", FILLERS[0] ?? "");
  const [rule, setRule] = useCanvasState<string>("grid-rule", RULES[0] ?? "");
  const [sizes, setSizes] = useCanvasState<string[]>("grid-sizes", SIZES);
  const [ranges, setRanges] = useCanvasState<string[]>("grid-ranges", RANGES);

  const view = useMemo(() => {
    const buys = BUYS.map((buy, row) => ({ buy, row })).filter(
      ({ buy }) =>
        books.includes(buy.s) &&
        analysts.includes(buy.a) &&
        buy.p >= upsideFloor &&
        buy.sym > symbolFloor &&
        (RANGES.length === 0 || ranges.includes(buy.w)),
    );
    const bookMode = SELL_MODE === "book";
    const protectMode = SELL_MODE === "protect";
    const slotsMode = SELL_MODE === "slots";
    const sells = SELLS.map((sell, col) => ({ sell, col })).filter(({ sell }) =>
      bookMode
        ? holds.includes(sell.h) &&
          protects.includes(sell.p) &&
          drops.includes(sell.d) &&
          (FILLERS.length === 0 || sell.f === filler) &&
          (RULES.length === 0 || sell.r === rule) &&
          (SIZES.length === 0 || sizes.includes(sell.z))
        : slotsMode
          ? true
          : protectMode
            ? protects.includes(sell.p) && drops.includes(sell.d)
            : holds.includes(sell.h) && targets.includes(sell.t) && drops.includes(sell.d),
    );
    const rowRoi = buys.map(({ row }) => pack(sells.map(({ col }) => ROI[row][col])));
    const rowPnl = buys.map(({ row }) => pack(sells.map(({ col }) => PNL[row][col])));
    const colRoi = sells.map(({ col }) => pack(buys.map(({ row }) => ROI[row][col])));
    const colPnl = sells.map(({ col }) => pack(buys.map(({ row }) => PNL[row][col])));
    return {
      buys,
      sells,
      rowRoi,
      rowPnl,
      colRoi,
      colPnl,
      cornerRoi: buys.length && sells.length ? cornerOf(rowRoi) : null,
      cornerPnl: buys.length && sells.length ? cornerOf(rowPnl) : null,
    };
  }, [books, analysts, upsideFloor, holds, targets, drops, protects, symbolFloor, filler, rule, sizes, ranges]);

  const filterStats = useMemo(() => {
    const signalRoi = emptyBuckets(SIGNALS);
    const signalPnl = emptyBuckets(SIGNALS);
    const signalSym = emptyBuckets(SIGNALS);
    const signalWin = emptyBuckets(SIGNALS);
    const analystRoi = emptyBuckets(ANALYSTS);
    const analystPnl = emptyBuckets(ANALYSTS);
    const analystSym = emptyBuckets(ANALYSTS);
    const analystWin = emptyBuckets(ANALYSTS);
    const upsideRoi = emptyBuckets(UPSIDES);
    const upsidePnl = emptyBuckets(UPSIDES);
    const upsideSym = emptyBuckets(UPSIDES);
    const upsideWin = emptyBuckets(UPSIDES);
    const symbolRoi = emptyBuckets(SYMBOL_FLOORS);
    const symbolPnl = emptyBuckets(SYMBOL_FLOORS);
    const symbolSym = emptyBuckets(SYMBOL_FLOORS);
    const symbolWin = emptyBuckets(SYMBOL_FLOORS);
    const holdRoi = emptyBuckets(HOLDS);
    const holdPnl = emptyBuckets(HOLDS);
    const holdSym = emptyBuckets(HOLDS);
    const holdWin = emptyBuckets(HOLDS);
    const targetRoi = emptyBuckets(TARGETS);
    const targetPnl = emptyBuckets(TARGETS);
    const targetSym = emptyBuckets(TARGETS);
    const targetWin = emptyBuckets(TARGETS);
    const dropRoi = emptyBuckets(DROPS);
    const dropPnl = emptyBuckets(DROPS);
    const dropSym = emptyBuckets(DROPS);
    const dropWin = emptyBuckets(DROPS);
    const protectRoi = emptyBuckets(PROTECTS);
    const protectPnl = emptyBuckets(PROTECTS);
    const protectSym = emptyBuckets(PROTECTS);
    const protectWin = emptyBuckets(PROTECTS);
    const fillerRoi = emptyBuckets(FILLERS);
    const fillerPnl = emptyBuckets(FILLERS);
    const fillerSym = emptyBuckets(FILLERS);
    const fillerWin = emptyBuckets(FILLERS);
    const ruleRoi = emptyBuckets(RULES);
    const rulePnl = emptyBuckets(RULES);
    const ruleSym = emptyBuckets(RULES);
    const ruleWin = emptyBuckets(RULES);
    const sizeRoi = emptyBuckets(SIZES);
    const sizePnl = emptyBuckets(SIZES);
    const sizeSym = emptyBuckets(SIZES);
    const sizeWin = emptyBuckets(SIZES);
    const rangeRoi = emptyBuckets(RANGES);
    const rangePnl = emptyBuckets(RANGES);
    const rangeSym = emptyBuckets(RANGES);
    const rangeWin = emptyBuckets(RANGES);
    const bookMode = SELL_MODE === "book";
    const protectMode = SELL_MODE === "protect";
    const slotsMode = SELL_MODE === "slots";
    const push = (
      roiBucket: Record<string, number[]>,
      pnlBucket: Record<string, number[]>,
      symBucket: Record<string, number[]>,
      winBucket: Record<string, number[]>,
      key: string,
      roi: number,
      pnl: number,
      sym: number,
      win: number,
    ) => {
      roiBucket[key]?.push(roi);
      pnlBucket[key]?.push(pnl);
      symBucket[key]?.push(sym);
      if (Number.isFinite(win)) winBucket[key]?.push(win);
    };
    BUYS.forEach((buy, row) => {
      const signalOk = books.includes(buy.s);
      const analystOk = analysts.includes(buy.a);
      const upsideOk = buy.p >= upsideFloor;
      const symbolOk = buy.sym > symbolFloor;
      const rangeOk = RANGES.length === 0 || ranges.includes(buy.w);
      SELLS.forEach((sell, col) => {
        const roi = ROI[row][col];
        const pnl = PNL[row][col];
        const win = WIN[row][col];
        if (!Number.isFinite(roi) || !Number.isFinite(pnl)) return;
        const fillerOn = FILLERS.length === 0 || sell.f === filler;
        const ruleOn = RULES.length === 0 || sell.r === rule;
        const sizeOn = SIZES.length === 0 || sizes.includes(sell.z);
        const holdOk = bookMode
          ? holds.includes(sell.h)
          : slotsMode || protectMode || holds.includes(sell.h);
        const targetOk = bookMode
          ? protects.includes(sell.p)
          : slotsMode || (protectMode ? protects.includes(sell.p) : targets.includes(sell.t));
        const dropOk = bookMode ? drops.includes(sell.d) : slotsMode || drops.includes(sell.d);
        const sellsOk = holdOk && targetOk && dropOk;
        const buysOk = signalOk && analystOk && upsideOk && symbolOk && rangeOk;
        if (FILLERS.length && buysOk && sellsOk && ruleOn && sizeOn) push(fillerRoi, fillerPnl, fillerSym, fillerWin, sell.f, roi, pnl, buy.sym, win);
        if (RULES.length && buysOk && sellsOk && fillerOn && sizeOn) push(ruleRoi, rulePnl, ruleSym, ruleWin, sell.r, roi, pnl, buy.sym, win);
        if (SIZES.length && buysOk && sellsOk && fillerOn && ruleOn) push(sizeRoi, sizePnl, sizeSym, sizeWin, sell.z, roi, pnl, buy.sym, win);
        if (fillerOn && ruleOn && sizeOn && analystOk && upsideOk && symbolOk && sellsOk && rangeOk) push(signalRoi, signalPnl, signalSym, signalWin, buy.s, roi, pnl, buy.sym, win);
        if (fillerOn && ruleOn && sizeOn && signalOk && upsideOk && symbolOk && sellsOk && rangeOk) push(analystRoi, analystPnl, analystSym, analystWin, String(buy.a), roi, pnl, buy.sym, win);
        if (fillerOn && ruleOn && sizeOn && signalOk && analystOk && symbolOk && sellsOk && rangeOk) {
          for (const floor of UPSIDES) {
            if (buy.p >= floor) push(upsideRoi, upsidePnl, upsideSym, upsideWin, String(floor), roi, pnl, buy.sym, win);
          }
        }
        if (RANGES.length && fillerOn && ruleOn && sizeOn && signalOk && analystOk && upsideOk && symbolOk && sellsOk) push(rangeRoi, rangePnl, rangeSym, rangeWin, buy.w, roi, pnl, buy.sym, win);
        if (fillerOn && ruleOn && sizeOn && signalOk && analystOk && upsideOk && sellsOk && rangeOk) {
          for (const floor of SYMBOL_FLOORS) {
            if (buy.sym > floor) push(symbolRoi, symbolPnl, symbolSym, symbolWin, String(floor), roi, pnl, buy.sym, win);
          }
        }
        if (fillerOn && ruleOn && sizeOn && !protectMode && buysOk && targetOk && dropOk) push(holdRoi, holdPnl, holdSym, holdWin, String(sell.h), roi, pnl, buy.sym, win);
        if (fillerOn && ruleOn && sizeOn && !protectMode && buysOk && holdOk && dropOk) push(targetRoi, targetPnl, targetSym, targetWin, String(sell.t), roi, pnl, buy.sym, win);
        if (fillerOn && ruleOn && sizeOn && ((protectMode && buysOk && dropOk) || (bookMode && buysOk && holds.includes(sell.h) && drops.includes(sell.d)))) push(protectRoi, protectPnl, protectSym, protectWin, String(sell.p), roi, pnl, buy.sym, win);
        if (fillerOn && ruleOn && sizeOn && buysOk && holdOk && targetOk) push(dropRoi, dropPnl, dropSym, dropWin, String(sell.d), roi, pnl, buy.sym, win);
      });
    });
    return {
      signal: packSlice(signalRoi, signalPnl, signalSym, signalWin),
      analyst: packSlice(analystRoi, analystPnl, analystSym, analystWin),
      upside: packSlice(upsideRoi, upsidePnl, upsideSym, upsideWin),
      symbol: packSlice(symbolRoi, symbolPnl, symbolSym, symbolWin),
      hold: packSlice(holdRoi, holdPnl, holdSym, holdWin),
      target: packSlice(targetRoi, targetPnl, targetSym, targetWin),
      drop: packSlice(dropRoi, dropPnl, dropSym, dropWin),
      protect: packSlice(protectRoi, protectPnl, protectSym, protectWin),
      filler: packSlice(fillerRoi, fillerPnl, fillerSym, fillerWin),
      rule: packSlice(ruleRoi, rulePnl, ruleSym, ruleWin),
      size: packSlice(sizeRoi, sizePnl, sizeSym, sizeWin),
      range: packSlice(rangeRoi, rangePnl, rangeSym, rangeWin),
    };
  }, [books, analysts, upsideFloor, holds, targets, drops, protects, symbolFloor, filler, rule, sizes, ranges]);

  const roiRange = span(ROI.flat());
  const pnlRange = span(PNL.flat());
  const showPct = showMode !== "pnl";
  const showPnl = showMode !== "pct";

  const cells = view.buys.flatMap(({ buy, row }) =>
    view.sells.map(({ sell, col }) => ({
      label: `${buyLabel(buy)} · ${sellLabel(sell)}`,
      sell: sellLabel(sell),
      buy: buyLabel(buy),
      roi: ROI[row][col],
      pnl: PNL[row][col],
      n: buy.n,
      from: FROM[row][col],
      to: TO[row][col],
      exposed: EXPOSED[row][col],
      lotsUtil: LOTUTIL[row][col],
      lotDays: LOTDAYS[row][col],
      lotDayUtil: LOTDAYUTIL[row][col],
      avgLot: AVGLOT[row][col],
      win: WIN[row][col],
      closed: CLOSED[row][col],
      open: OPENN[row][col],
      symbols: SYMBOLS[row][col],
      positions: POSITIONS[row][col],
    })),
  );
  const topScore = cells.reduce((best, cell) => (cell.roi > best.roi ? cell : best), cells[0]);
  const topCash = cells.reduce((best, cell) => (cell.pnl > best.pnl ? cell : best), cells[0]);
  const byMoney = showMode === "pnl";
  const ranked = [...cells]
    .sort((a, b) => (byMoney ? b.pnl - a.pnl || b.roi - a.roi : b.roi - a.roi || b.pnl - a.pnl))
    .slice(0, 30);

  const yellow = theme.category.yellow;
  const orange = theme.category.orange;
  const red = theme.category.red;
  const fallback = theme.fill.tertiary;
  const paint = (
    key: string,
    value: number,
    range: { min: number; max: number },
    text: string,
    title: string,
    edge = false,
  ) => {
    const background = heat(unit(value, range.min, range.max), yellow, orange, red, fallback);
    return (
      <td
        key={key}
        title={title}
        style={{
          background,
          color: readable(background, theme.text.primary, theme.bg.editor),
          textAlign: "right",
          padding: "6px 7px",
          fontSize: 12,
          lineHeight: "16px",
          fontVariantNumeric: "tabular-nums",
          whiteSpace: "nowrap",
          borderLeft: edge ? `1px solid ${theme.stroke.secondary}` : undefined,
        }}
      >
        {text}
      </td>
    );
  };

  const labelCell = (text: string, sticky: boolean, strong: boolean) => (
    <td
      style={{
        position: sticky ? "sticky" : undefined,
        left: sticky ? 0 : undefined,
        zIndex: sticky ? 1 : undefined,
        background: theme.bg.editor,
        padding: "6px 8px",
        whiteSpace: "nowrap",
        borderTop: strong ? `1px solid ${theme.stroke.secondary}` : undefined,
        borderLeft: strong && !sticky ? `1px solid ${theme.stroke.secondary}` : undefined,
      }}
    >
      <Text size="small" weight={strong ? "semibold" : "medium"}>
        {text}
      </Text>
    </td>
  );

  const countCell = (value: string, strong: boolean) => (
    <td
      style={{
        textAlign: "right",
        padding: "6px 8px",
        whiteSpace: "nowrap",
        borderTop: strong ? `1px solid ${theme.stroke.secondary}` : undefined,
      }}
    >
      <Text size="small" tone={strong ? "primary" : "secondary"} weight={strong ? "semibold" : "normal"}>
        {value}
      </Text>
    </td>
  );

  const head: CSSProperties = {
    textAlign: "center",
    padding: "4px 6px",
    fontSize: 12,
    lineHeight: "16px",
    fontWeight: 590,
    color: theme.text.secondary,
    whiteSpace: "nowrap",
    background: theme.bg.editor,
  };
  const both = showPct && showPnl;
  const activeMetric: Metric = showPct ? "pct" : "pnl";
  const chooseSort = (key: string, numeric: boolean) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortDir(numeric ? "desc" : "asc");
    }
  };
  const sortMark = (key: string) => (sortKey === key ? (sortDir === "asc" ? " ↑" : " ↓") : "");
  const sortStyle = (extra?: CSSProperties): CSSProperties => ({
    ...head,
    cursor: "pointer",
    userSelect: "none",
    ...extra,
  });
  const orderedBuys = [...view.buys.map((item, index) => ({ ...item, index }))].sort((a, b) => {
    if (!sortKey) return 0;
    const dir = sortDir === "asc" ? 1 : -1;
    const read = (item: { buy: Buy; row: number; index: number }): number | string => {
      if (sortKey === "buy") return buyLabel(item.buy);
      if (sortKey === "sym") return item.buy.sym;
      if (sortKey === "n") return item.buy.n;
      const [kind, id, metric] = sortKey.split(":");
      if (kind === "stat") {
        const stats = metric === "pnl" ? view.rowPnl[item.index] : view.rowRoi[item.index];
        return stats[id as StatName];
      }
      const col = Number(id);
      return metric === "pnl" ? PNL[item.row][col] : ROI[item.row][col];
    };
    const av = read(a);
    const bv = read(b);
    if (typeof av === "string" && typeof bv === "string") return av.localeCompare(bv) * dir;
    const left = Number.isFinite(av as number) ? (av as number) : dir === 1 ? Infinity : -Infinity;
    const right = Number.isFinite(bv as number) ? (bv as number) : dir === 1 ? Infinity : -Infinity;
    return (left - right) * dir;
  });
  const pair = (key: string, roi: number, pnl: number, title: string, edge = false) => {
    const out = [];
    if (showPct) out.push(paint(`${key}-pct`, roi, roiRange, pct(roi), `${title} · return`, edge));
    if (showPnl) out.push(paint(`${key}-pnl`, pnl, pnlRange, money(pnl), `${title} · profit`, edge && !showPct));
    return out;
  };
  const filled = view.buys.length > 0 && view.sells.length > 0 && topScore && topCash && view.cornerRoi && view.cornerPnl;

  return (
    <Stack gap={20}>
      <Stack gap={6}>
        <H1>{TITLE}</H1>
        <Text size="small" tone="secondary">
          {SOURCE}
        </Text>
      </Stack>

      {filled ? (
        <Row gap={16} wrap>
          {showPct ? (
            <Stat value={pct(topScore.roi)} label={`Best return · ${topScore.label}`} tone="success" />
          ) : null}
          {showPnl ? <Stat value={money(topCash.pnl)} label={`Most cash · ${topCash.label}`} /> : null}
          <Stat value={`${topScore.from} → ${topScore.to}`} label="Best return · trade window" />
          <Stat value={pct(topScore.lotsUtil)} label="Best return · lots utilized" />
          <Stat value={String(topScore.exposed)} label="Best return · days utilized" />
          <Stat value={String(topScore.lotDays)} label="Best return · lot-days" />
          {SELL_MODE === "book" ? (
            <Stat value={share(topScore.lotDayUtil)} label="Best return · lot-days invested" />
          ) : null}
          <Stat value={lotMoney(topScore.avgLot)} label="Best return · average lot" />
          <Stat value={String(cells.length)} label="Combinations shown" />
        </Row>
      ) : null}

      <Stack gap={8}>
        <Text size="small" tone="secondary">
          {showMode === "pnl"
            ? "Min, avg, and max are the stock P&L for that value with the other filters applied."
            : "Min, avg, and max are the return for that value with the other filters applied."}{" "}
          The next three figures are that value's symbol count. The last three are its win rate.
        </Text>
        {RANGES.length > 0 ? (
          <FilterColumn
            label="Range"
            options={RANGES}
            selected={ranges}
            onChange={setRanges}
            format={(value) => value}
            moneyMode={showMode === "pnl"}
            stats={filterStats.range}
          />
        ) : null}
        <Grid columns={2} gap={16} align="start">
          <FilterColumn
            label="Signal"
            options={SIGNALS}
            selected={books}
            onChange={setBooks}
            format={(value) => value}
            moneyMode={showMode === "pnl"}
            stats={filterStats.signal}
          />
          {SELL_MODE === "slots" ? (
            <Stack gap={4}>
              <Text>8 lots</Text>
              <Text size="small" tone="secondary">
                A new signal takes a free lot. On a full book, sell the biggest loss.
                If every lot is in profit, sell the least profitable one only when its
                strength is below the new signal. Strength is sqrt(analysts, capped at
                10) times the target percent floored to 10% steps.
              </Text>
            </Stack>
          ) : SELL_MODE === "book" || SELL_MODE === "protect" ? (
            <FilterColumn
              label="Loss dd"
              options={DROPS}
              selected={drops}
              onChange={setDrops}
              format={(value) => `${value}dd`}
              moneyMode={showMode === "pnl"}
            stats={filterStats.drop}
            />
          ) : (
            <FilterColumn
              label="Hold"
              options={HOLDS}
              selected={holds}
              onChange={setHolds}
              format={(value) => `${value}d`}
              moneyMode={showMode === "pnl"}
            stats={filterStats.hold}
            />
          )}
          <FilterColumn
            label="Analysts"
            options={ANALYSTS}
            selected={analysts}
            onChange={setAnalysts}
            format={(value) => `>${value}`}
            moneyMode={showMode === "pnl"}
            stats={filterStats.analyst}
          />
          {SELL_MODE === "slots" ? (
            <div />
          ) : SELL_MODE === "book" || SELL_MODE === "protect" ? (
            <FilterColumn
              label="Profit protect"
              options={PROTECTS}
              selected={protects}
              onChange={setProtects}
              format={(value) => `${value}pp`}
              moneyMode={showMode === "pnl"}
            stats={filterStats.protect}
            />
          ) : (
            <FilterColumn
              label="Target"
              options={TARGETS}
              selected={targets}
              onChange={setTargets}
              format={(value) => `${value}%`}
              moneyMode={showMode === "pnl"}
            stats={filterStats.target}
            />
          )}
          <FilterColumn
            label="Upside"
            options={UPSIDES}
            selected={[upsideFloor]}
            onChange={(next) => setUpsideFloor(next[0])}
            format={(value) => `>${value}%`}
            moneyMode={showMode === "pnl"}
            stats={filterStats.upside}
            exclusive
          />
          {SELL_MODE === "book" ? (
            <FilterColumn
              label="Lots"
              options={HOLDS}
              selected={holds}
              onChange={setHolds}
              format={(value) => lotSplit(value)}
              moneyMode={showMode === "pnl"}
            stats={filterStats.hold}
            />
          ) : SELL_MODE === "slots" || SELL_MODE === "protect" ? (
            <div />
          ) : (
            <FilterColumn
              label="Drop"
              options={DROPS}
              selected={drops}
              onChange={setDrops}
              format={(value) => `${value}dd`}
              moneyMode={showMode === "pnl"}
            stats={filterStats.drop}
            />
          )}
          <FilterColumn
            label="Symbols"
            options={SYMBOL_FLOORS}
            selected={[symbolFloor]}
            onChange={(next) => setSymbolFloor(next[0])}
            format={(value) => `>${value}`}
            moneyMode={showMode === "pnl"}
            stats={filterStats.symbol}
            exclusive
          />
          {FILLERS.length > 0 ? (
            <FilterColumn
              label="Stop filler"
              options={FILLERS}
              selected={[filler]}
              onChange={(next) => setFiller(next[0])}
              format={(value) => (value === "none" ? "no SPY" : value)}
              moneyMode={showMode === "pnl"}
            stats={filterStats.filler}
              exclusive
            />
          ) : null}
          {RULES.length > 0 ? (
            <FilterColumn
              label="Sell pick"
              options={RULES}
              selected={[rule]}
              onChange={(next) => setRule(next[0])}
              format={(value) => (value === "dls" ? "dls" : "ls")}
              moneyMode={showMode === "pnl"}
              stats={filterStats.rule}
              exclusive
            />
          ) : null}
          {SIZES.length > 0 ? (
            <FilterColumn
              label={SIZES.includes("at") ? "Strength" : "Lot size"}
              options={SIZES}
              selected={sizes}
              onChange={setSizes}
              format={(value) => lotSizeLabel(value)}
              moneyMode={showMode === "pnl"}
              stats={filterStats.size}
            />
          ) : null}
        </Grid>
        <FilterGroup
          label="Show"
          options={SHOW_MODES}
          selected={[showMode]}
          onChange={(next) => setShowMode(next[0])}
          format={(value) => (value === "pct" ? "%" : value === "pnl" ? "$" : "Both")}
          exclusive
        />
      </Stack>

      {filled ? (
        <Stack gap={8}>
          <H2>Buy × sell</H2>
          <Text size="small" tone="secondary">
            Yellow is the smaller number and red is the larger one, on a scale fixed to the full
            grid. The min, average, and max columns sit on the left and summarize that buy across
            the sells in view. The min, average, and max rows sit at the top and do the same for
            each sell across the buys in view. Symbols are
            unique tickers in that buy, and the Symbols pill keeps buys above that floor. Signals
            are the lots opened. Click a heading to sort the buys. Click it again to reverse the
            order. The total rows stay at the top.
          </Text>
          {showPct ? (
            <Scale label="Return" range={roiRange} format={pct} yellow={yellow} orange={orange} red={red} fallback={fallback} />
          ) : null}
          {showPnl ? (
            <Scale label="Profit" range={pnlRange} format={money} yellow={yellow} orange={orange} red={red} fallback={fallback} />
          ) : null}
          <div style={{ overflowX: "auto" }}>
            <table style={{ borderCollapse: "separate", borderSpacing: 2 }}>
              <thead>
                <tr>
                  <th
                    rowSpan={both ? 2 : 1}
                    onClick={() => chooseSort("buy", false)}
                    style={sortStyle({ textAlign: "left", position: "sticky", left: 0, zIndex: 2 })}
                  >
                    Buy{sortMark("buy")}
                  </th>
                  <th
                    rowSpan={both ? 2 : 1}
                    onClick={() => chooseSort("sym", true)}
                    style={sortStyle({ textAlign: "right" })}
                  >
                    Symbols{sortMark("sym")}
                  </th>
                  <th
                    rowSpan={both ? 2 : 1}
                    onClick={() => chooseSort("n", true)}
                    style={sortStyle({ textAlign: "right" })}
                  >
                    Signals{sortMark("n")}
                  </th>
                  {STAT_NAMES.map((name) =>
                    both ? (
                      <th key={name} colSpan={2} style={head}>
                        {statLabel(name)}
                      </th>
                    ) : (
                      <th
                        key={name}
                        onClick={() => chooseSort(`stat:${name}:${activeMetric}`, true)}
                        style={sortStyle()}
                      >
                        {statLabel(name)}
                        {sortMark(`stat:${name}:${activeMetric}`)}
                      </th>
                    ),
                  )}
                  {view.sells.map(({ sell, col }, index) =>
                    both ? (
                      <th
                        key={sellLabel(sell)}
                        colSpan={2}
                        style={{
                          ...head,
                          borderLeft: index === 0 ? `1px solid ${theme.stroke.secondary}` : undefined,
                        }}
                      >
                        {sellLabel(sell)}
                      </th>
                    ) : (
                      <th
                        key={sellLabel(sell)}
                        onClick={() => chooseSort(`sell:${col}:${activeMetric}`, true)}
                        style={sortStyle({
                          borderLeft: index === 0 ? `1px solid ${theme.stroke.secondary}` : undefined,
                        })}
                      >
                        {sellLabel(sell)}
                        {sortMark(`sell:${col}:${activeMetric}`)}
                      </th>
                    ),
                  )}
                </tr>
                {both ? (
                  <tr>
                    {STAT_NAMES.flatMap((name) => [
                      <th
                        key={`${name}-pct`}
                        onClick={() => chooseSort(`stat:${name}:pct`, true)}
                        style={sortStyle()}
                      >
                        %{sortMark(`stat:${name}:pct`)}
                      </th>,
                      <th
                        key={`${name}-pnl`}
                        onClick={() => chooseSort(`stat:${name}:pnl`, true)}
                        style={sortStyle()}
                      >
                        ${sortMark(`stat:${name}:pnl`)}
                      </th>,
                    ])}
                    {view.sells.flatMap(({ sell, col }, index) => {
                      const name = sellLabel(sell);
                      const edge =
                        index === 0
                          ? { borderLeft: `1px solid ${theme.stroke.secondary}` }
                          : undefined;
                      return [
                        <th
                          key={`${name}-pct`}
                          onClick={() => chooseSort(`sell:${col}:pct`, true)}
                          style={sortStyle(edge)}
                        >
                          %{sortMark(`sell:${col}:pct`)}
                        </th>,
                        <th
                          key={`${name}-pnl`}
                          onClick={() => chooseSort(`sell:${col}:pnl`, true)}
                          style={sortStyle()}
                        >
                          ${sortMark(`sell:${col}:pnl`)}
                        </th>,
                      ];
                    })}
                  </tr>
                ) : null}
              </thead>
              <tbody>
                {STAT_NAMES.map((rowStat) => (
                  <tr key={rowStat}>
                    {labelCell(statLabel(rowStat), true, false)}
                    {countCell("—", false)}
                    {countCell("—", false)}
                    {STAT_NAMES.flatMap((colStat) =>
                      pair(
                        `${rowStat}-${colStat}`,
                        view.cornerRoi![rowStat][colStat],
                        view.cornerPnl![rowStat][colStat],
                        `${statLabel(rowStat)} of each buy's ${statLabel(colStat).toLowerCase()}`,
                      ),
                    )}
                    {view.sells.flatMap(({ sell }, index) => {
                      const name = sellLabel(sell);
                      return pair(
                        `${rowStat}-${name}`,
                        view.colRoi[index][rowStat],
                        view.colPnl[index][rowStat],
                        `${name} · ${statLabel(rowStat)} across buys`,
                        index === 0,
                      );
                    })}
                  </tr>
                ))}
                {orderedBuys.map(({ buy, row, index }, position) => (
                  <tr key={buyLabel(buy)}>
                    {labelCell(buy.n < 30 ? `${buyLabel(buy)} · thin` : buyLabel(buy), true, position === 0)}
                    {countCell(String(buy.sym), position === 0)}
                    {countCell(String(buy.n), position === 0)}
                    {STAT_NAMES.flatMap((name) =>
                      pair(
                        `${buyLabel(buy)}-${name}`,
                        view.rowRoi[index][name],
                        view.rowPnl[index][name],
                        `${buyLabel(buy)} · ${statLabel(name)} across sells`,
                      ),
                    )}
                    {view.sells.flatMap(({ sell, col }, sellIndex) => {
                      const name = `${buyLabel(buy)} · ${sellLabel(sell)}`;
                      const title = `${name} · ${FROM[row][col]} → ${TO[row][col]} · ${EXPOSED[row][col]} days exposed · ${LOTDAYS[row][col]} lot-days · ${share(LOTDAYUTIL[row][col])} of lot-days invested · avg lot ${lotMoney(AVGLOT[row][col])}`;
                      return pair(name, ROI[row][col], PNL[row][col], title, sellIndex === 0);
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Stack>
      ) : (
        <Text size="small" tone="secondary">
          These pills leave out every buy in this grid.
        </Text>
      )}

      {filled ? (
        <Stack gap={8}>
          <H2>{byMoney ? "Lot exposure on the largest stock P&L" : "Lot exposure on the best returns"}</H2>
          <Text size="small" tone="secondary">
            {byMoney
              ? "Top 30 visible cells by stock P&L. "
              : "Top 30 visible cells by return on invested. "}
            Days utilized are distinct calendar days with a lot open. Lots utilized is the
            average share of the lot count that was open, including empty days. Lot-days are the
            sum of each lot's calendar hold. A 3-day lot, a 1-day lot, and another 3-day lot are
            6 lot-days. Lot-days invested is that sum divided by the lot count times the calendar
            days in the test, so a full book held every day is 100%. Symbols are distinct tickers
            in that cell: a ticker counts once when it has more than one lot or more than one
            signal. Positions are distinct entries: lots with the same ticker, buy date, and buy
            price count once. The lowest
            upside pill is the floor, and it includes 0% when that cut is in the run.
          </Text>
          <Table
            headers={
              SELL_MODE === "book"
                ? ["Sell", "Buy", "On invested", "Stock P&L", "Trade window", "Days utilized", "Lots utilized", "Lot-days", "Lot-days invested", "Avg lot", "Win", "Lots", "Symbols", "Positions"]
                : ["Sell", "Buy", "On invested", "Stock P&L", "Trade window", "Days utilized", "Lots utilized", "Lot-days", "Avg lot", "Win", "Lots", "Symbols", "Positions"]
            }
            columnAlign={
              SELL_MODE === "book"
                ? ["left", "left", "right", "right", "left", "right", "right", "right", "right", "right", "right", "right", "right", "right"]
                : ["left", "left", "right", "right", "left", "right", "right", "right", "right", "right", "right", "right", "right"]
            }
            rows={ranked.map((cell) =>
              SELL_MODE === "book"
                ? [
                    cell.sell,
                    cell.buy,
                    pct(cell.roi),
                    money(cell.pnl),
                    `${cell.from} → ${cell.to}`,
                    String(cell.exposed),
                    pct(cell.lotsUtil),
                    String(cell.lotDays),
                    share(cell.lotDayUtil),
                    lotMoney(cell.avgLot),
                    pct(cell.win),
                    `${cell.closed}c/${cell.open}o`,
                    String(cell.symbols),
                    String(cell.positions),
                  ]
                : [
                    cell.sell,
                    cell.buy,
                    pct(cell.roi),
                    money(cell.pnl),
                    `${cell.from} → ${cell.to}`,
                    String(cell.exposed),
                    pct(cell.lotsUtil),
                    String(cell.lotDays),
                    lotMoney(cell.avgLot),
                    pct(cell.win),
                    `${cell.closed}c/${cell.open}o`,
                    String(cell.symbols),
                    String(cell.positions),
                  ],
            )}
            striped
            stickyHeader
          />
        </Stack>
      ) : null}
    </Stack>
  );
}
'''


CANVAS_DIR = Path.home() / ".cursor/projects/Users-nitzan-dev-sa/canvases"


def _compress_positions_csv(csv_path, rows):
    """Compress the plain lot CSV to .csv.xz with Finder-openable xz and delete the plain CSV."""
    csv_path = Path(csv_path)
    if not csv_path.exists():
        return
    xz_path = csv_path.with_suffix(csv_path.suffix + ".xz")
    if xz_path.exists():
        xz_path.unlink()
    # Delegate to the xz CLI: multi-threaded (-T0) and keeps default level.
    # Falls back to the lzma stdlib if xz is missing.
    try:
        import subprocess
        subprocess.run(["xz", "-T0", "-f", str(csv_path)], check=True)
    except (FileNotFoundError, subprocess.CalledProcessError):
        import lzma, shutil
        with csv_path.open("rb") as src, lzma.open(xz_path, "wb", preset=6) as dst:
            shutil.copyfileobj(src, dst, length=16 * 1024 * 1024)
        csv_path.unlink()
    print(f"Compressed {csv_path.name} → {xz_path.name} ({rows} rows, {xz_path.stat().st_size / 1024 / 1024:.1f} MB)")


def write_positions_log(path, frames):
    if isinstance(frames, (str, Path)):
        logged = Path(frames)
        n = 0
        if logged.exists():
            with logged.open() as handle:
                n = max(sum(1 for _ in handle) - 1, 0)
        print(f"Wrote {logged} ({n} rows)")
        _compress_positions_csv(logged, n)
        return
    out = pd.concat(frames, ignore_index=True) if frames else pd.DataFrame(columns=POSITION_COLUMNS)
    out.to_csv(path, index=False)
    print(f"Wrote {path} ({len(out)} rows)")
    _compress_positions_csv(path, len(out))


def write_code_snapshot(prefix, argv):
    py_path = Path(f"{prefix}.py")
    py_path.write_bytes(Path(__file__).read_bytes())
    script = Path(__file__).name
    command = f"./penv python VectorBT/{script} " + " ".join(
        shlex.quote(str(arg)) for arg in argv
    )
    sh_path = Path(f"{prefix}.sh")
    sh_path.write_text(
        "#!/bin/sh\n"
        'cd "$(dirname "$0")/.." || exit 1\n'
        f"{command}\n"
    )
    sh_path.chmod(0o755)
    print(f"Wrote {py_path}")
    print(f"Wrote {sh_path}")


def _pct_number(value):
    number = round(float(value) * 100, 2)
    return int(number) if number == int(number) else number


def write_grid_canvas(prefix, rows, signals, buys, specs, info):
    by_key = {(row["buy_label"], row["tag"]): row for row in rows}
    buy_rows = []
    for buy in buys:
        bought = apply_buy(signals, buy)
        buy_rows.append(
            {
                "s": buy.get("signal_name") or "",
                "a": int(buy["min_analysts"]),
                "p": int(buy["min_projected"]),
                "n": int(len(bought)),
                "sym": int(bought["ticker"].nunique()) if len(bought) else 0,
                "w": buy.get("range_label") or "",
            }
        )
    book_mode = any(
        spec.slots is not None and spec.profit_protect is not None for spec in specs
    )
    protect_mode = any(spec.profit_protect is not None for spec in specs) and not book_mode
    slots_mode = any(spec.slots is not None for spec in specs) and not book_mode
    sell_rows = []
    for spec in specs:
        if book_mode:
            sell_rows.append(
                {
                    "h": int(spec.slots),
                    "t": 0,
                    "d": _pct_number(spec.drawdown),
                    "p": _pct_number(spec.profit_protect),
                    "f": spec.filler or "",
                    "r": spec.loss_mode or "",
                    "z": spec.lot_mode or "",
                    "m": round(float(spec.lot_amount), 2) if spec.lot_amount else 0,
                }
            )
        elif slots_mode:
            sell_rows.append({"h": int(spec.slots), "t": 0, "d": 0, "p": 0, "f": "", "r": "", "z": "", "m": round(float(spec.lot_amount), 2) if spec.lot_amount else 0})
        elif protect_mode:
            sell_rows.append(
                {
                    "h": 0,
                    "t": 0,
                    "d": _pct_number(spec.drawdown),
                    "p": _pct_number(spec.profit_protect),
                    "f": "",
                    "r": "",
                    "z": "",
                    "m": 0,
                }
            )
        else:
            sell_rows.append(
                {
                    "h": int(spec.hold_days),
                    "t": int(round(spec.target_frac * 100)),
                    "d": _pct_number(spec.drawdown),
                    "p": 0,
                    "f": "",
                    "r": "",
                    "z": "",
                    "m": 0,
                }
            )
    matrices = {key: [] for key in ("roi", "pnl", "exposed", "lotUtil", "lotDays", "lotDayUtil", "avgLot", "win", "closed", "open", "symbols", "positions")}
    windows_from = []
    windows_to = []
    for buy in buys:
        label = buy_label(buy)
        block = {key: [] for key in matrices}
        from_row = []
        to_row = []
        for spec in specs:
            row = by_key.get((label, spec.tag))
            if row is None:
                raise RuntimeError(f"missing canvas cell {spec.short} · {label}")
            block["roi"].append(round(float(row["return_on_avg_invested_pct"]), 4))
            block["pnl"].append(round(float(row["stock_pnl"]), 2))
            block["exposed"].append(int(row["days_exposed"]))
            block["lotUtil"].append(round(float(row["avg_invested_pct"]), 4))
            block["lotDays"].append(int(row["lot_days"]))
            block["lotDayUtil"].append(round(float(row.get("lot_days_util_pct") or 0.0), 4))
            block["avgLot"].append(round(float(row["avg_lot_amount"]), 2))
            block["win"].append(round(float(row["win_rate_pct"]), 4))
            block["closed"].append(int(row["n_closed"]))
            block["open"].append(int(row["n_open"]))
            block["symbols"].append(int(row.get("n_symbols") or 0))
            block["positions"].append(int(row.get("n_positions") or 0))
            from_row.append(row.get("trade_from") or "")
            to_row.append(row.get("trade_to") or "")
        for key, values in block.items():
            matrices[key].append(values)
        windows_from.append(from_row)
        windows_to.append(to_row)

    signal_order = []
    for buy in buy_rows:
        if buy["s"] not in signal_order:
            signal_order.append(buy["s"])
    analysts = sorted({buy["a"] for buy in buy_rows})
    upsides = sorted({buy["p"] for buy in buy_rows})
    holds = sorted({sell["h"] for sell in sell_rows})
    targets = sorted({sell["t"] for sell in sell_rows})
    drops = sorted({sell["d"] for sell in sell_rows}, key=float)
    protects = sorted({sell["p"] for sell in sell_rows}, key=float)
    fillers = []
    rules = []
    sizes = []
    for spec in specs:
        if spec.filler and spec.filler not in fillers:
            fillers.append(spec.filler)
        if spec.loss_mode and spec.loss_mode not in rules:
            rules.append(spec.loss_mode)
        if spec.lot_mode and spec.lot_mode not in sizes:
            sizes.append(spec.lot_mode)
    fixed = any(spec.lot_amount for spec in specs)
    if fixed:
        sizing = (
            f"one book of ${BOOK_CASH:,.0f}. "
            "The lot count splits that cash, so fewer lots means more dollars in each lot. "
            + (
                "Upside filter includes >0%. "
                if 0 in upsides
                else "Upside filter includes >10%. "
            )
        )
    else:
        sizing = "$5,000 per lot. "
    caption = (
        f"{' · '.join(signal_names())} · {info['start']} → {info['end']} · "
        f"{info['trading_days']} trading days · {sizing}"
        "Days utilized are calendar days with at least one lot open. "
        "Lots utilized is the average open lots divided by the lot count. "
        "Lot-days invested is the sum of each lot's calendar hold divided by "
        "the lot count times the calendar days in the test. "
        "Lot-days add each lot's calendar hold, so overlapping lots count again. "
        "Win rate counts a position once: lots with the same ticker, buy date, "
        "and buy price are one position."
    )
    if any(buy.get("range_label") for buy in buys):
        caption += (
            " Each cell keeps signals and prices inside one date range. "
            "A lot still open on the last day of that range stays open."
        )
    data = {
        "__SOURCE__": json.dumps(caption),
        "__TITLE__": json.dumps(info.get("title") or "Buy × sell"),
        "__SIGNALS__": json.dumps(signal_order),
        "__ANALYSTS__": json.dumps(analysts),
        "__UPSIDES__": json.dumps(upsides),
        "__HOLDS__": json.dumps(holds),
        "__TARGETS__": json.dumps(targets),
        "__DROPS__": json.dumps(drops),
        "__PROTECTS__": json.dumps(protects if protect_mode or book_mode else [0]),
        "__FILLERS__": json.dumps(fillers),
        "__RULES__": json.dumps(rules),
        "__SIZES__": json.dumps(sizes),
        "__RANGES__": json.dumps(
            list(
                dict.fromkeys(
                    buy["range_label"] for buy in buys if buy.get("range_label")
                )
            )
        ),
        "__SELL_MODE__": json.dumps(
            "book" if book_mode else "slots" if slots_mode else "protect" if protect_mode else "hold"
        ),
        "__BUYS__": json.dumps(buy_rows, separators=(",", ":")),
        "__SELLS__": json.dumps(sell_rows, separators=(",", ":")),
        "__ROI__": json.dumps(matrices["roi"], separators=(",", ":")),
        "__PNL__": json.dumps(matrices["pnl"], separators=(",", ":")),
        "__EXPOSED__": json.dumps(matrices["exposed"], separators=(",", ":")),
        "__LOTUTIL__": json.dumps(matrices["lotUtil"], separators=(",", ":")),
        "__LOTDAYS__": json.dumps(matrices["lotDays"], separators=(",", ":")),
        "__LOTDAYUTIL__": json.dumps(matrices["lotDayUtil"], separators=(",", ":")),
        "__AVGLOT__": json.dumps(matrices["avgLot"], separators=(",", ":")),
        "__WIN__": json.dumps(matrices["win"], separators=(",", ":")),
        "__CLOSED__": json.dumps(matrices["closed"], separators=(",", ":")),
        "__OPEN__": json.dumps(matrices["open"], separators=(",", ":")),
        "__SYMBOLS__": json.dumps(matrices["symbols"], separators=(",", ":")),
        "__POSITIONS__": json.dumps(matrices["positions"], separators=(",", ":")),
        "__FROM__": json.dumps(windows_from, separators=(",", ":")),
        "__TO__": json.dumps(windows_to, separators=(",", ":")),
    }
    source = GRID_CANVAS
    for key, value in data.items():
        source = source.replace(key, value)
    tsx_path = Path(f"{prefix}.tsx")
    canvas_path = CANVAS_DIR / f"{prefix.name}.canvas.tsx"
    tsx_path.write_text(source)
    canvas_path.write_text(source)
    print(f"Wrote {tsx_path}")
    print(f"Wrote {canvas_path}")


def parse_args():
    p = argparse.ArgumentParser(description="Sweep sell/buy permutations")
    p.add_argument(
        "phase",
        nargs="?",
        default="all",
        choices=(
            "download",
            "sells",
            "buys",
            "all",
            "focus",
            "conclusion",
            "percentile",
            "staged",
            "closed",
            "coarse",
            "fine",
            "wide",
            "full",
            "winners",
            "protect",
            "slots",
            "book",
            "park",
            "fillers",
            "scale",
            "cash",
            "fixed",
            "formulas",
            "counts",
            "low",
            "books",
            "daily",
            "window",
            "horizon",
            "recency",
            "ranges",
            "confirm",
        ),
    )
    p.add_argument("--signals", default=str(SIGNALS_CSV))
    p.add_argument("--end", default=None)
    p.add_argument("--ignore-last-days", type=int, default=None)
    p.add_argument("--refresh", action="store_true")
    p.add_argument("--hold-days", type=int, default=None)
    p.add_argument("--sells-json", default=str(CACHE_DIR / "sells.json"))
    p.add_argument("--buys-json", default=str(CACHE_DIR / "buys.json"))
    p.add_argument("--winners-json", default=str(CACHE_DIR / "winners.json"))
    p.add_argument("--report", default=None)
    p.add_argument("--positions", action="store_true")
    p.add_argument(
        "--one-lot",
        action="store_true",
        help=(
            "One open lot per ticker. A later buy while it is held restarts "
            "the hold clock and does not open another lot."
        ),
    )
    p.add_argument("--sell-tag", action="append", dest="sell_tags")
    p.add_argument(
        "--signal-name",
        action="append",
        dest="signal_names",
        choices=SIGNAL_NAME_CHOICES,
        help=(
            "Keep this signal_name. Repeat for several books in one run. "
            "Each cell stays one book. full with no flag uses all_sources, "
            "yahoo, and google, daily and 7-day. books with no flag uses "
            "every name in the signal export. daily with no flag uses the "
            "five daily names. window with no flag uses the five 7-day names. "
            "horizon with no flag uses yahoo, tipranks, and yahoo_and_tipranks "
            "for 1d through 5d. "
            "recency with no flag uses yahoo_and_tipranks_1d_recency through "
            "yahoo_and_tipranks_5d_recency. "
            "ranges with no flag uses those same five recency books. "
            "confirm with no flag uses yahoo_and_tipranks_1d_recency through "
            "yahoo_and_tipranks_3d_recency. "
            "Other phases default to "
            "yahoo-daily and yahoo-7d-window."
        ),
    )
    return p.parse_args()


def append_filler_comparison(path, rows):
    """Same-sell and best-sell results for each stop filler, next to the prior SPY run."""
    buy = "yahoo-daily · analyst>2 · proj>20%"
    same_sell = "10dd 10pp · 4 lots"
    lines = [
        "",
        "## Stop filler vs SPY",
        "",
        "Free leftover slots stay TQQQ. The stop filler is the ETF that replaces SPY. "
        "On this buy, the prior SPY filler at 10dd 10pp · 4 lots was +25.9% and +$5,185.",
        "",
        "| Stop filler | 10dd 10pp · 4 lots | P&L | Best trusted sell | Best return | Best P&L |",
        "| --- | ---: | ---: | --- | ---: | ---: |",
        "| SPY (prior) | +25.9% | +$5,185 | 10dd 10pp · 4 lots | +25.9% | +$5,185 |",
    ]
    for filler in FILLERS:
        subset = [
            row
            for row in rows
            if row.get("buy_label") == buy and str(row.get("short", "")).endswith(f" · {filler}")
        ]
        if not subset:
            continue
        best = max(subset, key=lambda row: (row["return_on_avg_invested_pct"], row["stock_pnl"]))
        same = next(row for row in subset if row["short"] == f"{same_sell} · {filler}")
        best_sell = best["short"][: -len(f" · {filler}")]
        lines.append(
            f"| {filler} | {same['return_on_avg_invested_pct']:+.1f}% | {money(same['stock_pnl'])} | "
            f"{best_sell} | {best['return_on_avg_invested_pct']:+.1f}% | {money(best['stock_pnl'])} |"
        )
    path.write_text(path.read_text() + "\n".join(lines) + "\n")


def main():
    args = parse_args()
    if args.phase == "confirm" and not args.signal_names:
        set_signal_names(CONFIRM_SIGNAL_NAMES)
    elif args.phase in ("recency", "ranges") and not args.signal_names:
        set_signal_names(RECENCY_SIGNAL_NAMES)
    elif args.phase == "horizon" and not args.signal_names:
        set_signal_names(HORIZON_SIGNAL_NAMES)
    elif args.phase == "window" and not args.signal_names:
        set_signal_names(WINDOW_SIGNAL_NAMES)
    elif args.phase == "daily" and not args.signal_names:
        set_signal_names(DAILY_SIGNAL_NAMES)
    elif args.phase == "books" and not args.signal_names:
        set_signal_names(EXPORT_SIGNAL_NAMES)
    elif args.phase == "full" and not args.signal_names:
        set_signal_names(FULL_SIGNAL_NAMES)
    elif args.phase in ("book", "park", "fillers", "scale", "cash", "fixed", "formulas", "counts", "low") and not args.signal_names:
        set_signal_names(("yahoo-daily",))
    elif args.signal_names:
        set_signal_names(args.signal_names)
    CACHE_DIR.mkdir(exist_ok=True)
    stamp, run_label = run_clock()
    if args.phase == "confirm":
        prefix = OUT_DIR / CONFIRM_STEM
    elif args.phase == "ranges":
        prefix = OUT_DIR / RANGES_STEM
    elif args.phase == "recency":
        prefix = OUT_DIR / RECENCY_STEM
    elif args.phase == "horizon":
        prefix = OUT_DIR / HORIZON_STEM
    elif args.phase == "window":
        prefix = OUT_DIR / WINDOW_STEM
    elif args.phase == "daily":
        prefix = OUT_DIR / DAILY_STEM
    elif args.phase == "books":
        prefix = OUT_DIR / BOOKS_STEM
    elif args.phase == "low":
        prefix = OUT_DIR / LOW_STEM
    elif args.phase == "counts":
        prefix = OUT_DIR / COUNT_STEM
    elif args.phase == "formulas":
        prefix = OUT_DIR / FORMULA_STEM
    elif args.phase == "fixed":
        prefix = OUT_DIR / SPLIT_STEM
    elif args.phase == "cash":
        prefix = OUT_DIR / CASH_STEM
    elif args.phase == "scale":
        prefix = OUT_DIR / SCALE_STEM
    elif args.phase == "fillers":
        prefix = OUT_DIR / FILLER_STEM
    elif args.phase == "park":
        prefix = OUT_DIR / PARK_STEM
    elif args.phase == "book":
        prefix = OUT_DIR / BOOK_STEM
    elif args.phase == "slots":
        prefix = OUT_DIR / SLOTS_STEM
    elif args.phase == "protect":
        prefix = OUT_DIR / PROTECT_STEM
    elif args.phase in ("wide", "full", "winners"):
        prefix = OUT_DIR / OUTPUT_STEM
    elif args.phase == "fine":
        prefix = OUT_DIR / f"simulation_7d-fine-grid_{stamp}_optimize"
    else:
        prefix = OUT_DIR / f"simulation_{stamp}_optimize"
    report_path = Path(args.report) if args.report else Path(f"{prefix}.md")
    ignore_last_days = args.ignore_last_days
    if ignore_last_days is None:
        ignore_last_days = IGNORE_LAST_DAYS_DEFAULT if args.phase == "closed" else 0
    refresh = args.refresh or args.phase == "closed"
    n_raw = len(restrict_signal_names(load_signals(args.signals), signal_names()))
    quote_end = quote_day(args.end)
    signal_cutoff = (
        (quote_end - pd.Timedelta(days=ignore_last_days)).strftime("%Y-%m-%d")
        if ignore_last_days
        else quote_end.strftime("%Y-%m-%d")
    )

    if args.phase == "download":
        prepare(
            args.signals,
            args.end,
            ignore_last_days=ignore_last_days,
            refresh=refresh,
        )
        return

    signals, close, spy = prepare(
        args.signals,
        args.end,
        ignore_last_days=ignore_last_days,
        refresh=refresh,
    )

    if args.phase == "confirm":
        position_path = Path(f"{prefix}.csv")
        rows, close_wide, init_cash = run_confirm(
            signals, close, spy, position_log=position_path
        )
        save_json(CACHE_DIR / "confirm.json", rows)
        specs = confirm_sells()
        info = period_info(
            close_wide,
            init_cash,
            max((r["n_signals"] for r in rows), default=0),
            run_label,
            "Formula confirm, frozen 7.5dd 5pp · 12 × $26,667 · ls · at and one-knob neighbors",
        )
        notes = [
            "Anchor sell: 7.5% loss dropdown, 5% of the peak gain, 12 lots "
            "of $26,667, ls, strength formula at. "
            "Each other sell moves one knob: loss dropdown 5% or 10%, "
            "profit protection 2.5%, 7.5%, or 10%, lot count 8, 16, or 32, "
            "sell pick dls, or strength formula a.",
            "Buys are analyst >2, >3, and >4 at projected >0/10/20/30% on "
            "yahoo_and_tipranks_1d_recency, yahoo_and_tipranks_2d_recency, "
            "and yahoo_and_tipranks_3d_recency.",
            "Windows are a flat list: the ten months, five disjoint two-month "
            "blocks (Jan–Feb, Mar–Apr, May–Jun, Jul–Aug, Sep–Oct), "
            "Jan–May, Jun–Oct, and January–October.",
            "A formula is held when January–October has at least 30 signals "
            "and 30 symbols, both halves are profitable, and at least 4 of "
            "the 5 disjoint blocks are profitable.",
            "Each cell keeps signals dated inside that window and prices "
            "through the window's last day. A lot still open on that day "
            "stays open.",
            "A ticker that already has an open position is skipped. "
            "No SPY and no TQQQ.",
            "3 books × 3 analyst cuts × 4 upside cuts × 18 windows × 11 sells "
            "= 7,128 cells. Trusted cells have at least 30 signals.",
        ]
        buys = confirm_buys()
        write_grid_summary(
            report_path,
            rows,
            signals,
            info,
            notes,
            buys,
            specs,
            specs[0],
        )
        write_positions_log(position_path, position_path)
        score = confirm_validation_markdown(rows, Path(f"{prefix}.csv.xz"))
        report_text = report_path.read_text()
        report_path.write_text(
            report_text.replace(
                "# WINNING COMBINATION",
                score + "\n# WINNING COMBINATION",
                1,
            )
        )
        write_code_snapshot(prefix, sys.argv[1:])
        present = {row["buy_label"] for row in rows}
        canvas_buys = [buy for buy in buys if buy_label(buy) in present]
        write_grid_canvas(prefix, rows, signals, canvas_buys, specs, info)
        return

    if args.phase == "ranges":
        position_path = Path(f"{prefix}.csv")
        rows, close_wide, init_cash = run_ranges(
            signals, close, spy, position_log=position_path
        )
        save_json(CACHE_DIR / "ranges.json", rows)
        spec = validation_sell()
        info = period_info(
            close_wide,
            init_cash,
            max(r["n_signals"] for r in rows),
            run_label,
            "Recency validation, frozen 7.5dd 5pp · 12 × $26,667 · ls · at",
        )
        notes = [
            "Frozen sell: 7.5% loss dropdown, 5% of the peak gain, 12 lots "
            "of $26,667, ls, strength formula at. "
            "Frozen buys: analyst >3 and projected >0/10/20/30% on "
            "yahoo_and_tipranks_1d_recency through yahoo_and_tipranks_5d_recency.",
            "One flat list of date ranges, from January 2026 through October. "
            "1 month is 10 windows, January through October. "
            "2 months is 9 windows, starting January through September. "
            "3 months is 8, starting January through August. "
            "4 months is 7, starting January through July. "
            "5 months is 6, starting January through June. "
            "6 months is 5, starting January through May. "
            "7 months is 4, starting January through April. "
            "8 months is 3, starting January through March: "
            "8m_Jan-Aug, 8m_Feb-Sep, and 8m_Mar-Oct.",
            "Each cell keeps signals dated inside that window and prices "
            "through the window's last day. A lot still open on that day "
            "stays open. Lot-days invested uses that window's calendar, "
            "not the full January–October span.",
            "A ticker that already has an open position is skipped. "
            "No SPY and no TQQQ.",
            "20 buys × 52 ranges = 1,040 cells. Trusted cells have at least 30 signals.",
        ]
        buys = validation_buys()
        write_grid_summary(
            report_path,
            rows,
            signals,
            info,
            notes,
            buys,
            [spec],
            spec,
        )
        write_positions_log(position_path, position_path)
        write_code_snapshot(prefix, sys.argv[1:])
        present = {row["buy_label"] for row in rows}
        canvas_buys = [buy for buy in buys if buy_label(buy) in present]
        write_grid_canvas(prefix, rows, signals, canvas_buys, [spec], info)
        return

    if args.phase == "recency":
        position_path = Path(f"{prefix}.csv")
        rows, close_wide, init_cash = run_recency(
            signals, close, spy, position_log=position_path
        )
        save_json(CACHE_DIR / "recency.json", rows)
        info = period_info(
            close_wide,
            init_cash,
            max(r["n_signals"] for r in rows),
            run_label,
            "Recency books, fixed $320,000, one position per ticker, no SPY or TQQQ",
        )
        specs = horizon_sell_grid()
        notes = [
            "Recency books: yahoo_and_tipranks_1d_recency through "
            "yahoo_and_tipranks_5d_recency. "
            "A point on the signal session weighs 2.5. Each older session "
            "weighs 2.5 divided by how many trading days back it is, counting "
            "the signal session as 1. The analyst count is that weight sum. "
            "The projected upside is the weighted mean. "
            "Analyst >0/>1/>2/>3/>4 × projected >0/10/20/30%. "
            "Each cell is one book.",
            f"One book of ${BOOK_CASH:,.0f}. Lot count splits that cash: "
            "8 lots are $40,000 each, 64 lots are $5,000 each. "
            "Counts are 8/12/16/32/64.",
            "No SPY and no TQQQ. An empty slot stays cash. A stop that is not "
            "reused stays cash. Uninvested money is cash, not a SPY sleeve.",
            "A ticker that already has an open position is skipped. Lots opened "
            "by one signal stay one position. After that position closes, a "
            "later signal can open a new one.",
            "Four strength formulas, each at least 1 lot and at most 16. "
            "at is floor(analysts × target percent / 10). "
            "sqra is floor(analysts²). "
            "a is floor(analysts × 3). "
            "sqra_target is floor(analysts² × target percent / 40).",
            "ls sells the biggest loss. If every stock lot is in profit, the "
            "least profitable one is sold only when its strength is strictly "
            "below the new signal.",
            "Loss dropdown, while the close is below the entry: 1.25%, 2.5%, "
            "5%, 7.5%, and 10%. Profit protection, once a close has traded "
            "above the entry: 2.5%, 5%, 7.5%, and 10% of the gain from entry "
            "to the highest close.",
            "Win rate is positions, not lots. Lots opened together — the same "
            "ticker, buy date, and buy price — are one position, and that "
            "position wins when their P&L sums to more than zero. "
            "The top 30 table counts Symbols once per ticker and Positions "
            "once per entry, even when a symbol has several lots or several signals.",
            "Lot-days invested is invested lot-days divided by the lot count "
            "times the calendar days in the test. A full book held every day is 100%.",
            "100 buys × 400 sells = 40,000 cells. Trusted cells have at least 30 signals.",
        ]
        write_grid_summary(
            report_path,
            rows,
            signals,
            info,
            notes,
            daily_buy_grid(),
            specs,
            SellSpec(
                drawdown=0.10,
                profit_protect=0.10,
                slots=32,
                loss_mode="ls",
                lot_mode="at",
                lot_amount=BOOK_CASH / 32,
            ),
        )
        write_positions_log(position_path, position_path)
        write_code_snapshot(prefix, sys.argv[1:])
        present = {row["buy_label"] for row in rows}
        canvas_buys = [buy for buy in daily_buy_grid() if buy_label(buy) in present]
        write_grid_canvas(prefix, rows, signals, canvas_buys, specs, info)
        return

    if args.phase == "horizon":
        position_path = Path(f"{prefix}.csv")
        rows, close_wide, init_cash = run_horizon(
            signals, close, spy, position_log=position_path
        )
        save_json(CACHE_DIR / "horizon.json", rows)
        info = period_info(
            close_wide,
            init_cash,
            max(r["n_signals"] for r in rows),
            run_label,
            "1-5 day books, fixed $320,000, ls only, no SPY or TQQQ",
        )
        specs = horizon_sell_grid()
        notes = [
            "1-5 day books: yahoo, tipranks, and yahoo_and_tipranks, each "
            "for 1d, 2d, 3d, 4d, and 5d. "
            "Analyst >0/>1/>2/>3/>4 × projected >0/10/20/30%. "
            "Each cell is one book.",
            f"One book of ${BOOK_CASH:,.0f}. Lot count splits that cash: "
            "8 lots are $40,000 each, 64 lots are $5,000 each. "
            "Counts are 8/12/16/32/64.",
            "No SPY and no TQQQ. An empty slot stays cash. A stop that is not "
            "reused stays cash. Uninvested money is cash, not a SPY sleeve.",
            "Four strength formulas, each at least 1 lot and at most 16. "
            "at is floor(analysts × target percent / 10). "
            "sqra is floor(analysts²). "
            "a is floor(analysts × 3). "
            "sqra_target is floor(analysts² × target percent / 40).",
            "ls sells the biggest loss. If every stock lot is in profit, the "
            "least profitable one is sold only when its strength is strictly "
            "below the new signal.",
            "Loss dropdown, while the close is below the entry: 1.25%, 2.5%, "
            "5%, 7.5%, and 10%. Profit protection, once a close has traded "
            "above the entry: 2.5%, 5%, 7.5%, and 10% of the gain from entry "
            "to the highest close.",
            "Win rate is positions, not lots. Lots opened together — the same "
            "ticker, buy date, and buy price — are one position, and that "
            "position wins when their P&L sums to more than zero. "
            "The top 30 table counts Symbols once per ticker and Positions "
            "once per entry, even when a symbol has several lots or several signals.",
            "Lot-days invested is invested lot-days divided by the lot count "
            "times the calendar days in the test. A full book held every day is 100%.",
            "300 buys × 400 sells = 120,000 cells. Trusted cells have at least 30 signals.",
        ]
        write_grid_summary(
            report_path,
            rows,
            signals,
            info,
            notes,
            daily_buy_grid(),
            specs,
            SellSpec(
                drawdown=0.10,
                profit_protect=0.10,
                slots=32,
                loss_mode="ls",
                lot_mode="at",
                lot_amount=BOOK_CASH / 32,
            ),
        )
        write_positions_log(position_path, position_path)
        write_code_snapshot(prefix, sys.argv[1:])
        present = {row["buy_label"] for row in rows}
        canvas_buys = [buy for buy in daily_buy_grid() if buy_label(buy) in present]
        write_grid_canvas(prefix, rows, signals, canvas_buys, specs, info)
        return

    if args.phase == "window":
        position_path = Path(f"{prefix}.csv")
        rows, close_wide, init_cash = run_window(
            signals, close, spy, position_log=position_path
        )
        save_json(CACHE_DIR / "window.json", rows)
        info = period_info(
            close_wide,
            init_cash,
            max(r["n_signals"] for r in rows),
            run_label,
            "7-day books, fixed $320,000, ls only, no SPY or TQQQ",
        )
        specs = daily_sell_grid()
        notes = [
            "7-day books only: yahoo-7d-window, google-7d-window, "
            "tipranks-7d-window, all_sources-7d-window, and "
            "yahoo_and_google-7d-window. "
            "Analyst >0/>1/>2/>3/>4 × projected >0/10/20/30%. "
            "Each cell is one book. Same sell grid as the daily sweep.",
            f"One book of ${BOOK_CASH:,.0f}. Lot count splits that cash: "
            "8 lots are $40,000 each, 64 lots are $5,000 each. "
            "Counts are 8/12/16/32/64.",
            "No SPY and no TQQQ. An empty slot stays cash. A stop that is not "
            "reused stays cash. Uninvested money is cash, not a SPY sleeve.",
            "Four strength formulas, each at least 1 lot and at most 16. "
            "at is floor(analysts × target percent / 10). "
            "sqra is floor(analysts²). "
            "a is floor(analysts × 3). "
            "sqra_target is floor(analysts² × target percent / 40).",
            "ls sells the biggest loss. If every stock lot is in profit, the "
            "least profitable one is sold only when its strength is strictly "
            "below the new signal.",
            "Win rate is positions, not lots. Lots opened together — the same "
            "ticker, buy date, and buy price — are one position, and that "
            "position wins when their P&L sums to more than zero. "
            "The top 30 table counts Symbols once per ticker and Positions "
            "once per entry, even when a symbol has several lots or several signals.",
            "Lot-days invested is invested lot-days divided by the lot count "
            "times the calendar days in the test. A full book held every day is 100%.",
            "100 buys × 240 sells = 24,000 cells. Trusted cells have at least 30 signals.",
        ]
        write_grid_summary(
            report_path,
            rows,
            signals,
            info,
            notes,
            daily_buy_grid(),
            specs,
            SellSpec(
                drawdown=0.10,
                profit_protect=0.10,
                slots=32,
                loss_mode="ls",
                lot_mode="at",
                lot_amount=BOOK_CASH / 32,
            ),
        )
        write_positions_log(position_path, position_path)
        write_code_snapshot(prefix, sys.argv[1:])
        present = {row["buy_label"] for row in rows}
        canvas_buys = [buy for buy in daily_buy_grid() if buy_label(buy) in present]
        write_grid_canvas(prefix, rows, signals, canvas_buys, specs, info)
        return

    if args.phase == "daily":
        position_path = Path(f"{prefix}.csv")
        rows, close_wide, init_cash = run_daily(
            signals, close, spy, position_log=position_path
        )
        save_json(CACHE_DIR / "daily.json", rows)
        info = period_info(
            close_wide,
            init_cash,
            max(r["n_signals"] for r in rows),
            run_label,
            "Daily books, fixed $320,000, ls only, no SPY or TQQQ",
        )
        specs = daily_sell_grid()
        notes = [
            "Daily books only: yahoo-daily, google-daily, tipranks-daily, "
            "all_sources-daily, and yahoo_and_google-daily. "
            "Analyst >0/>1/>2/>3/>4 × projected >0/10/20/30%. "
            "Each cell is one book.",
            f"One book of ${BOOK_CASH:,.0f}. Lot count splits that cash: "
            "8 lots are $40,000 each, 64 lots are $5,000 each. "
            "Counts are 8/12/16/32/64.",
            "No SPY and no TQQQ. An empty slot stays cash. A stop that is not "
            "reused stays cash. Uninvested money is cash, not a SPY sleeve.",
            "Four strength formulas, each at least 1 lot and at most 16. "
            "at is floor(analysts × target percent / 10). "
            "sqra is floor(analysts²). "
            "a is floor(analysts × 3). "
            "sqra_target is floor(analysts² × target percent / 40).",
            "ls sells the biggest loss. If every stock lot is in profit, the "
            "least profitable one is sold only when its strength is strictly "
            "below the new signal.",
            "Win rate is positions, not lots. Lots opened together — the same "
            "ticker, buy date, and buy price — are one position, and that "
            "position wins when their P&L sums to more than zero. "
            "The top 30 table counts Symbols once per ticker and Positions "
            "once per entry, even when a symbol has several lots or several signals.",
            "Lot-days invested is invested lot-days divided by the lot count "
            "times the calendar days in the test. A full book held every day is 100%.",
            "100 buys × 240 sells = 24,000 cells. Trusted cells have at least 30 signals.",
        ]
        write_grid_summary(
            report_path,
            rows,
            signals,
            info,
            notes,
            daily_buy_grid(),
            specs,
            SellSpec(
                drawdown=0.10,
                profit_protect=0.10,
                slots=32,
                loss_mode="ls",
                lot_mode="at",
                lot_amount=BOOK_CASH / 32,
            ),
        )
        write_positions_log(position_path, position_path)
        write_code_snapshot(prefix, sys.argv[1:])
        present = {row["buy_label"] for row in rows}
        canvas_buys = [buy for buy in daily_buy_grid() if buy_label(buy) in present]
        write_grid_canvas(prefix, rows, signals, canvas_buys, specs, info)
        return

    if args.phase == "books":
        position_path = Path(f"{prefix}.csv")
        rows, close_wide, init_cash = run_books(
            signals, close, spy, position_log=position_path
        )
        save_json(CACHE_DIR / "books.json", rows)
        info = period_info(
            close_wide,
            init_cash,
            max(r["n_signals"] for r in rows),
            run_label,
            "All signal books, fixed $320,000, no SPY or TQQQ",
        )
        specs = formula_sell_grid()
        notes = [
            "Every signal name in the export: yahoo, google, tipranks, "
            "all_sources, and yahoo_and_google, each daily and 7-day. "
            "Analyst >0/>1/>2/>3/>4 × projected >0/10/20/30/40/50%. "
            "Each cell is one book.",
            f"One book of ${BOOK_CASH:,.0f}. Lot count splits that cash: "
            "8 lots are $40,000 each, 64 lots are $5,000 each. "
            "Counts are 8/12/16/24/32/48/64.",
            "No SPY and no TQQQ. An empty slot stays cash. A stop that is not "
            "reused stays cash. Uninvested money is cash, not a SPY sleeve.",
            "Four strength formulas, each at least 1 lot and at most 16. "
            "at is floor(analysts × target percent / 10). "
            "sqra is floor(analysts²). "
            "a is floor(analysts × 3). "
            "sqra_target is floor(analysts² × target percent / 40).",
            "ls sells the biggest loss. dls sells the loss divided by calendar "
            "days held. If every stock lot is in profit, the least profitable "
            "one is sold only when its strength is strictly below the new signal.",
            "Lot-days invested is invested lot-days divided by the lot count "
            "times the calendar days in the test. A full book held every day is 100%.",
            "The Signal pills are the ten export names. The Upside pills include "
            ">0%. The Analyst pills include >0 and >1. The Strength pills are "
            "at, sqra, a, and sqra_target. Trusted cells have at least 30 signals.",
            "The published low cell 7.5dd 2.5pp · 16 × $20,000 · ls · sqra "
            "on yahoo-daily · analyst >3 · proj >10% was +209.5% and +$186,593.",
        ]
        write_grid_summary(
            report_path,
            rows,
            signals,
            info,
            notes,
            low_buy_grid(),
            specs,
            SellSpec(
                drawdown=0.10,
                profit_protect=0.10,
                slots=32,
                loss_mode="ls",
                lot_mode="at",
                lot_amount=BOOK_CASH / 32,
            ),
        )
        write_positions_log(position_path, position_path)
        write_code_snapshot(prefix, sys.argv[1:])
        present = {row["buy_label"] for row in rows}
        canvas_buys = [buy for buy in low_buy_grid() if buy_label(buy) in present]
        write_grid_canvas(prefix, rows, signals, canvas_buys, specs, info)
        return

    if args.phase == "low":
        position_path = Path(f"{prefix}.csv")
        rows, close_wide, init_cash = run_low(
            signals, close, spy, position_log=position_path
        )
        save_json(CACHE_DIR / "low.json", rows)
        info = period_info(
            close_wide,
            init_cash,
            max(r["n_signals"] for r in rows),
            run_label,
            "Yahoo upside above 0%, fixed $320,000, no SPY or TQQQ",
        )
        specs = formula_sell_grid()
        notes = [
            "yahoo-daily only. Analyst >0/>1/>2/>3/>4 × projected >0/10/20/30/40/50%.",
            f"One book of ${BOOK_CASH:,.0f}. Lot count splits that cash: "
            "8 lots are $40,000 each, 64 lots are $5,000 each. "
            "Counts are 8/12/16/24/32/48/64.",
            "No SPY and no TQQQ. An empty slot stays cash. A stop that is not "
            "reused stays cash. Uninvested money is cash, not a SPY sleeve.",
            "Signals now include 1 and 2 analysts, and projected upside above 0% "
            "rather than only above 10%.",
            "Four strength formulas, each at least 1 lot and at most 16. "
            "at is floor(analysts × target percent / 10). "
            "sqra is floor(analysts²). "
            "a is floor(analysts × 3). "
            "sqra_target is floor(analysts² × target percent / 40).",
            "ls sells the biggest loss. dls sells the loss divided by calendar "
            "days held. If every stock lot is in profit, the least profitable "
            "one is sold only when its strength is strictly below the new signal.",
            "Lot-days invested is invested lot-days divided by the lot count "
            "times the calendar days in the test. A full book held every day is 100%.",
            "The Upside pills include >0%. The Analyst pills include >0 and >1. "
            "The Strength pills are at, sqra, a, and sqra_target. Trusted cells "
            "have at least 30 signals.",
            "The published formulas cell 7.5dd 2.5pp · 16 × $20,000 · ls · sqra "
            "on analyst >3 · proj >10% was +207.4% and +$186,593.",
        ]
        write_grid_summary(
            report_path,
            rows,
            signals,
            info,
            notes,
            low_buy_grid(),
            specs,
            SellSpec(
                drawdown=0.10,
                profit_protect=0.10,
                slots=32,
                loss_mode="ls",
                lot_mode="at",
                lot_amount=BOOK_CASH / 32,
            ),
        )
        write_positions_log(position_path, position_path)
        write_code_snapshot(prefix, sys.argv[1:])
        present = {row["buy_label"] for row in rows}
        canvas_buys = [buy for buy in low_buy_grid() if buy_label(buy) in present]
        write_grid_canvas(prefix, rows, signals, canvas_buys, specs, info)
        return

    if args.phase == "counts":
        position_path = Path(f"{prefix}.csv")
        rows, close_wide, init_cash = run_counts(
            signals, close, spy, position_log=position_path
        )
        save_json(CACHE_DIR / "counts.json", rows)
        info = period_info(
            close_wide,
            init_cash,
            max(r["n_signals"] for r in rows),
            run_label,
            "Yahoo analyst counts, fixed $320,000, no SPY or TQQQ",
        )
        specs = formula_sell_grid()
        notes = [
            "yahoo-daily only. Analyst >0/>1/>2/>3/>4 × projected >10/20/30/40/50%.",
            f"One book of ${BOOK_CASH:,.0f}. Lot count splits that cash: "
            "8 lots are $40,000 each, 64 lots are $5,000 each. "
            "Counts are 8/12/16/24/32/48/64.",
            "No SPY and no TQQQ. An empty slot stays cash. A stop that is not "
            "reused stays cash. Uninvested money is cash, not a SPY sleeve.",
            "Four strength formulas, each at least 1 lot and at most 16. "
            "at is floor(analysts × target percent / 10). "
            "sqra is floor(analysts²). "
            "a is floor(analysts × 3). "
            "sqra_target is floor(analysts² × target percent / 40). "
            "One analyst is 1 lot for at at 10%, 1 lot for sqra, 3 lots for a, "
            "and 1 lot for sqra_target at 10%.",
            "ls sells the biggest loss. dls sells the loss divided by calendar "
            "days held. If every stock lot is in profit, the least profitable "
            "one is sold only when its strength is strictly below the new signal.",
            "Lot-days invested is invested lot-days divided by the lot count "
            "times the calendar days in the test. A full book held every day is 100%. "
            "Lots utilized is the average open lots divided by the lot count.",
            "The Upside filter includes >10%. The Analyst pills include >0 and >1. "
            "The Strength pills are at, sqra, a, and sqra_target. Trusted cells "
            "have at least 30 signals. Show $ switches the filter figures and "
            "the top 30 to stock P&L.",
            "The published formulas cell 7.5dd 2.5pp · 16 × $20,000 · ls · sqra "
            "on analyst >3 · proj >10% was +207.4% and +$186,593.",
        ]
        write_grid_summary(
            report_path,
            rows,
            signals,
            info,
            notes,
            count_buy_grid(),
            specs,
            SellSpec(
                drawdown=0.10,
                profit_protect=0.10,
                slots=32,
                loss_mode="ls",
                lot_mode="at",
                lot_amount=BOOK_CASH / 32,
            ),
        )
        write_positions_log(position_path, position_path)
        write_code_snapshot(prefix, sys.argv[1:])
        present = {row["buy_label"] for row in rows}
        canvas_buys = [buy for buy in count_buy_grid() if buy_label(buy) in present]
        write_grid_canvas(prefix, rows, signals, canvas_buys, specs, info)
        return

    if args.phase == "formulas":
        position_path = Path(f"{prefix}.csv")
        rows, close_wide, init_cash = run_formulas(
            signals, close, spy, position_log=position_path
        )
        save_json(CACHE_DIR / "formulas.json", rows)
        info = period_info(
            close_wide,
            init_cash,
            max(r["n_signals"] for r in rows),
            run_label,
            "Yahoo strength formulas, fixed $320,000, no SPY or TQQQ",
        )
        specs = formula_sell_grid()
        notes = [
            "yahoo-daily only. Analyst >2/>3/>4 × projected >10/20/30/40/50%.",
            f"One book of ${BOOK_CASH:,.0f}. Lot count splits that cash: "
            "8 lots are $40,000 each, 64 lots are $5,000 each. "
            "Counts are 8/12/16/24/32/48/64.",
            "No SPY and no TQQQ. An empty slot stays cash. A stop that is not "
            "reused stays cash. Uninvested money is cash, not a SPY sleeve.",
            "Four strength formulas, each at least 1 lot and at most 16. "
            "at is floor(analysts × target percent / 10): 2 analysts and 10% is 2 lots, "
            "4 analysts and 40% is 16. "
            "sqra is floor(analysts²): 2 analysts is 4 lots, 4 is 16. "
            "a is floor(analysts × 3): 2 analysts is 6 lots, 4 is 12. "
            "sqra_target is floor(analysts² × target percent / 40): "
            "2 analysts and 10% is 1 lot, 3 analysts and 30% is 6, 4 analysts and 40% is 16.",
            "ls sells the biggest loss. dls sells the loss divided by calendar "
            "days held. If every stock lot is in profit, the least profitable "
            "one is sold only when its strength is strictly below the new signal.",
            "Lot-days invested is invested lot-days divided by the lot count "
            "times the calendar days in the test. A full book held every day is 100%. "
            "Lots utilized is the average open lots divided by the lot count.",
            "The Upside filter includes >10%. The Strength pills are at, sqra, a, "
            "and sqra_target. Trusted cells have at least 30 signals. Show $ "
            "switches the filter figures and the top 30 to stock P&L.",
        ]
        write_grid_summary(
            report_path,
            rows,
            signals,
            info,
            notes,
            cash_buy_grid(),
            specs,
            SellSpec(
                drawdown=0.10,
                profit_protect=0.10,
                slots=32,
                loss_mode="ls",
                lot_mode="at",
                lot_amount=BOOK_CASH / 32,
            ),
        )
        write_positions_log(position_path, position_path)
        write_code_snapshot(prefix, sys.argv[1:])
        present = {row["buy_label"] for row in rows}
        canvas_buys = [buy for buy in cash_buy_grid() if buy_label(buy) in present]
        write_grid_canvas(prefix, rows, signals, canvas_buys, specs, info)
        return

    if args.phase == "fixed":
        position_path = Path(f"{prefix}.csv")
        rows, close_wide, init_cash = run_fixed_book(
            signals, close, spy, position_log=position_path
        )
        save_json(CACHE_DIR / "fixed.json", rows)
        info = period_info(
            close_wide,
            init_cash,
            max(r["n_signals"] for r in rows),
            run_label,
            "Yahoo strength book, fixed $320,000, no SPY or TQQQ",
        )
        specs = split_sell_grid()
        notes = [
            "yahoo-daily only. Analyst >2/>3/>4 × projected >10/20/30/40/50%.",
            f"One book of ${BOOK_CASH:,.0f}. Lot count splits that cash: "
            "8 lots are $40,000 each, 64 lots are $5,000 each. "
            "Counts are 8/12/16/24/32/48/64.",
            "No SPY and no TQQQ. An empty slot stays cash. A stop that is not "
            "reused stays cash. Uninvested money is cash, not a SPY sleeve.",
            "Every signal opens floor(analysts × target percent / 10) lots, "
            "at least 1 and at most 16. There is no one-lot size.",
            "ls sells the biggest loss. dls sells the loss divided by calendar "
            "days held. If every stock lot is in profit, the least profitable "
            "one is sold only when its strength is strictly below the new signal.",
            "Lots utilized is the average open lots divided by the lot count, "
            "over every trading day, including empty days. Days utilized is "
            "the count of calendar days with at least one lot open.",
            "The Upside filter includes >10%. Trusted cells have at least 30 "
            "signals. Show $ switches the filter figures and the top 30 to "
            "stock P&L.",
        ]
        write_grid_summary(
            report_path,
            rows,
            signals,
            info,
            notes,
            cash_buy_grid(),
            specs,
            SellSpec(
                drawdown=0.10,
                profit_protect=0.10,
                slots=32,
                loss_mode="ls",
                lot_mode="str",
                lot_amount=BOOK_CASH / 32,
            ),
        )
        write_positions_log(position_path, position_path)
        write_code_snapshot(prefix, sys.argv[1:])
        present = {row["buy_label"] for row in rows}
        canvas_buys = [buy for buy in cash_buy_grid() if buy_label(buy) in present]
        write_grid_canvas(prefix, rows, signals, canvas_buys, specs, info)
        return

    if args.phase == "cash":
        position_path = Path(f"{prefix}.csv")
        rows, close_wide, init_cash = run_cash(
            signals, close, spy, position_log=position_path
        )
        save_json(CACHE_DIR / "cash.json", rows)
        info = period_info(
            close_wide,
            init_cash,
            max(r["n_signals"] for r in rows),
            run_label,
            "Yahoo strength book, cash only, no SPY or TQQQ",
        )
        specs = cash_sell_grid()
        notes = [
            "yahoo-daily only. Analyst >2/>3/>4 × projected >10/20/30/40/50%.",
            "Book size 8/12/16/24/32/48/64 lots of $5,000. Loss dropdown "
            "1.25/2.5/7.5/10. Profit protection 2.5/5/10/20/30.",
            "No SPY and no TQQQ. An empty slot stays cash. A stop that is not "
            "reused for a new ticker stays cash. Uninvested money is cash, not "
            "a SPY sleeve.",
            "Every signal opens floor(analysts × target percent / 10) lots, "
            "at least 1 and at most 16. There is no one-lot size.",
            "ls sells the biggest loss. dls sells the loss divided by calendar "
            "days held, with a same-day lot counted as one day. If every stock "
            "lot is in profit, the least profitable one is sold only when its "
            "strength is strictly below the new signal.",
            "Trusted cells have at least 30 signals. The Lots pills are "
            "8, 12, 16, 24, 32, 48, and 64. Show $ switches the filter figures "
            "and the top 30 to stock P&L.",
        ]
        write_grid_summary(
            report_path,
            rows,
            signals,
            info,
            notes,
            cash_buy_grid(),
            specs,
            SellSpec(
                drawdown=0.10,
                profit_protect=0.10,
                slots=32,
                loss_mode="ls",
                lot_mode="str",
            ),
        )
        write_positions_log(position_path, position_path)
        write_code_snapshot(prefix, sys.argv[1:])
        present = {row["buy_label"] for row in rows}
        canvas_buys = [buy for buy in cash_buy_grid() if buy_label(buy) in present]
        write_grid_canvas(prefix, rows, signals, canvas_buys, specs, info)
        return

    if args.phase == "scale":
        position_path = Path(f"{prefix}.csv")
        rows, close_wide, init_cash = run_scale(
            signals, close, spy, position_log=position_path
        )
        save_json(CACHE_DIR / "scale.json", rows)
        info = period_info(
            close_wide,
            init_cash,
            max(r["n_signals"] for r in rows),
            run_label,
            "Yahoo 64-lot book, SPY filler, daily loss, strength lots",
        )
        specs = scale_sell_grid()
        notes = [
            "yahoo-daily only. Winner buys: analyst >2/>3/>4 × projected >20/30/40/50%.",
            "One book of 64 lots of $5,000. Loss dropdown 1.25/2.5/7.5/10. "
            "Profit protection 2.5/5/10/20/30. Stops do not apply to SPY or TQQQ.",
            "Free leftover slots hold TQQQ. SPY filler on: a stop that is not reused "
            "for a new ticker buys SPY, and a new buy sells SPY before TQQQ. "
            "SPY filler off: that slot stays empty.",
            "ls sells the biggest loss. dls sells the loss divided by calendar days "
            "held, with a same-day lot counted as one day. If every stock lot is in "
            "profit, the least profitable one is sold only when its strength is "
            "strictly below the new signal.",
            "Lot size 1 opens one lot per signal. Strength opens "
            "floor(analysts × target percent / 10) lots, at least 1 and at most 16. "
            "Two analysts and 10% is 2 lots. Four analysts and 40% is 16.",
            "Trusted cells have at least 30 signals. Show $ switches the filter "
            "figures and the top 30 to stock P&L.",
        ]
        write_grid_summary(
            report_path,
            rows,
            signals,
            info,
            notes,
            winners_buy_grid(),
            specs,
            SellSpec(
                drawdown=0.025,
                profit_protect=0.10,
                slots=SCALE_SLOTS,
                filler="SPY",
                loss_mode="ls",
                lot_mode="1",
            ),
        )
        write_positions_log(position_path, position_path)
        write_code_snapshot(prefix, sys.argv[1:])
        present = {row["buy_label"] for row in rows}
        canvas_buys = [buy for buy in winners_buy_grid() if buy_label(buy) in present]
        write_grid_canvas(prefix, rows, signals, canvas_buys, specs, info)
        return

    if args.phase == "fillers":
        position_path = Path(f"{prefix}.csv")
        rows, close_wide, init_cash = run_fillers(
            signals, close, spy, position_log=position_path
        )
        save_json(CACHE_DIR / "fillers.json", rows)
        info = period_info(
            close_wide,
            init_cash,
            max(r["n_signals"] for r in rows),
            run_label,
            "Yahoo book, stop filler instead of SPY",
        )
        specs = filler_sell_grid()
        notes = [
            "yahoo-daily only. Winner buys: analyst >2/>3/>4 × projected >20/30/40/50%.",
            "Same book as the SPY and TQQQ filler run. Loss dropdown 1.25/2.5/7.5/10. "
            "Profit protection 2.5/5/10/20/30. Book size 4/6/8/12/16/20. "
            "Stops do not apply to filler lots.",
            "A slot still empty after the day's stock buys holds TQQQ. A slot freed "
            "by a stop and not reused for a new ticker holds the stop filler: "
            "VOO, SSO, UPRO, SPXL, QQQ, QLD, or TQQQ. A new buy sells that filler "
            "before it sells TQQQ, and TQQQ before it sells a stock.",
            "The cash sleeve stays SPY. A filler lot is a separate $5,000 position.",
            "Trusted cells have at least 30 signals. The Stop filler pill on the "
            "canvas is one ETF at a time. Its min, avg, and max are that ETF "
            "with the other filters applied.",
            "Days exposed counts calendar days with at least one lot open. "
            "Lot-days sums each lot's calendar hold. Filler lots are included "
            "in the stock P&L.",
        ]
        write_grid_summary(
            report_path,
            rows,
            signals,
            info,
            notes,
            winners_buy_grid(),
            specs,
            SellSpec(drawdown=0.10, profit_protect=0.10, slots=4, filler="VOO"),
        )
        append_filler_comparison(report_path, rows)
        write_positions_log(position_path, position_path)
        write_code_snapshot(prefix, sys.argv[1:])
        present = {row["buy_label"] for row in rows}
        canvas_buys = [buy for buy in winners_buy_grid() if buy_label(buy) in present]
        write_grid_canvas(prefix, rows, signals, canvas_buys, specs, info)
        return

    if args.phase == "park":
        position_path = Path(f"{prefix}.csv")
        rows, close_wide, init_cash = run_park(
            signals, close, spy, position_log=position_path
        )
        save_json(CACHE_DIR / "park.json", rows)
        info = period_info(
            close_wide,
            init_cash,
            max(r["n_signals"] for r in rows),
            run_label,
            "Yahoo book with SPY and TQQQ fillers",
        )
        notes = [
            "yahoo-daily only. Winner buys: analyst >2/>3/>4 × projected >20/30/40/50%.",
            "Loss dropdown, while the close is below the entry: 1.25dd, 2.5dd, "
            "7.5dd, 10dd from that entry. Profit protection, once a close has "
            "traded above the entry: 2.5pp, 5pp, 10pp, 20pp, 30pp of the gain "
            "from entry to the highest close. Stops are checked before new signals "
            "and do not apply to SPY or TQQQ lots. A new high does not sell.",
            "Book size is 4, 6, 8, 12, 16, or 20 lots of $5,000. A signal buys "
            "at that close when a slot is free. A ticker that already has an "
            "open position is skipped.",
            "A slot still empty after the day's stock buys holds TQQQ. A slot "
            "freed by a stop and not reused for a new ticker holds SPY. A new "
            "buy sells a SPY lot before it sells TQQQ, and TQQQ before it sells "
            "a stock.",
            "When the book is full of stocks and any lot is at a loss, sell the "
            "biggest loss and buy the new signal. When every stock lot is in "
            "profit, sell the least profitable one only if its strength is "
            "strictly below the new signal. Strength is sqrt(analysts, capped at "
            "10) times the target percent floored to 10-point steps.",
            "Same-day signals are taken strongest first. A filler that is never "
            "sold stays open through the last quote day.",
            "Trusted cells have at least 30 signals. Smaller cells stay in the matrices.",
            "Signals dated after --end are dropped.",
            "Days exposed counts calendar days with at least one lot open. "
            "Lot-days sums each lot's calendar hold, so overlapping lots count again. "
            "SPY and TQQQ lots are included in the stock P&L.",
            "Comparison is on invested dollars, not book vs SPY.",
        ]
        write_grid_summary(
            report_path,
            rows,
            signals,
            info,
            notes,
            winners_buy_grid(),
            book_sell_grid(),
            SellSpec(drawdown=0.025, profit_protect=0.05, slots=8),
        )
        write_positions_log(position_path, position_path)
        write_code_snapshot(prefix, sys.argv[1:])
        present = {row["buy_label"] for row in rows}
        canvas_buys = [buy for buy in winners_buy_grid() if buy_label(buy) in present]
        write_grid_canvas(
            prefix,
            rows,
            signals,
            canvas_buys,
            book_sell_grid(),
            info,
        )
        return

    if args.phase == "book":
        position_path = Path(f"{prefix}.csv")
        rows, close_wide, init_cash = run_book(
            signals, close, spy, position_log=position_path
        )
        save_json(CACHE_DIR / "book.json", rows)
        info = period_info(
            close_wide,
            init_cash,
            max(r["n_signals"] for r in rows),
            run_label,
            "Yahoo book, loss dropdown, profit protection",
        )
        notes = [
            "yahoo-daily only. Winner buys: analyst >2/>3/>4 × projected >20/30/40/50%.",
            "Loss dropdown, while the close is below the entry: 1.25dd, 2.5dd, "
            "7.5dd, 10dd from that entry. Profit protection, once a close has "
            "traded above the entry: 2.5pp, 5pp, 10pp, 20pp, 30pp of the gain "
            "from entry to the highest close. Stops are checked before new signals. "
            "A new high does not sell.",
            "Book size is 4, 6, 8, 12, 16, or 20 lots of $5,000. A signal buys "
            "at that close when a slot is free. A ticker that already has an "
            "open position is skipped.",
            "When the book is full and any lot is at a loss, sell the biggest "
            "loss and buy the new signal. When every open lot is in profit, sell "
            "the least profitable one only if its strength is strictly below the "
            "new signal. Strength is sqrt(analysts, capped at 10) times the target "
            "percent floored to 10-point steps. A flat lot is not sold to make room.",
            "Same-day signals are taken strongest first. A lot that never stops "
            "and is never replaced stays open through the last quote day.",
            "Trusted cells have at least 30 signals. Smaller cells stay in the matrices.",
            "Signals dated after --end are dropped.",
            "Days exposed counts calendar days with at least one lot open. "
            "Lot-days sums each lot's calendar hold, so overlapping lots count again.",
            "Comparison is on invested dollars, not book vs SPY.",
        ]
        write_grid_summary(
            report_path,
            rows,
            signals,
            info,
            notes,
            winners_buy_grid(),
            book_sell_grid(),
            SellSpec(drawdown=0.025, profit_protect=0.05, slots=8),
        )
        write_positions_log(position_path, position_path)
        write_code_snapshot(prefix, sys.argv[1:])
        present = {row["buy_label"] for row in rows}
        canvas_buys = [buy for buy in winners_buy_grid() if buy_label(buy) in present]
        write_grid_canvas(
            prefix,
            rows,
            signals,
            canvas_buys,
            book_sell_grid(),
            info,
        )
        return

    if args.phase == "slots":
        position_path = Path(f"{prefix}.csv")
        rows, close_wide, init_cash = run_slots(
            signals, close, spy, position_log=position_path
        )
        save_json(CACHE_DIR / "slots.json", rows)
        info = period_info(
            close_wide,
            init_cash,
            max(r["n_signals"] for r in rows),
            run_label,
            "Eight-lot book",
        )
        notes = [
            "Same daily books and the same winner buys: analyst >2/>3/>4 × "
            "projected >20/30/40/50%.",
            f"The book starts with {SLOT_COUNT} lots of ${POSITION_VALUE:,.0f}. "
            "A signal buys at that close when a slot is free. A ticker that "
            "already has an open position is skipped.",
            "When the book is full and any lot is at a loss, sell the biggest "
            "loss at that close and buy the new signal. Strength is not consulted.",
            "When every open lot is in profit, sell the least profitable one only "
            "if its strength is strictly below the new signal. Strength is "
            "sqrt(analysts, capped at 10) times the target percent floored to "
            "10, 20, 30, 40, 50, …. Two analysts at a 33% target score sqrt(2)×30. "
            "A flat lot is not a loss and not a profit, so it is not sold.",
            "Same-day signals are taken strongest first. A lot opened earlier "
            "the same day is flat, so a later signal that day cannot replace it.",
            "No hold, no profit target, and no drawdown. A lot that is never "
            "replaced stays open through the last quote day.",
            "Signal books: " + ", ".join(signal_names()) + ". Each cell is one book.",
            "Trusted cells have at least 30 signals. Smaller cells stay in the matrices.",
            "Signals dated after --end are dropped. An open lot runs through the last quote day.",
            "Days exposed counts calendar days with at least one lot open. "
            "Lot-days sums each lot's calendar hold, so overlapping lots count again. "
            "Avg lot is the mean dollars used to open a lot.",
            "Comparison is on invested dollars, not book vs SPY.",
        ]
        write_grid_summary(
            report_path,
            rows,
            signals,
            info,
            notes,
            winners_buy_grid(),
            slots_sell_grid(),
            SellSpec(slots=SLOT_COUNT),
        )
        write_positions_log(position_path, position_path)
        write_code_snapshot(prefix, sys.argv[1:])
        present = {row["buy_label"] for row in rows}
        canvas_buys = [buy for buy in winners_buy_grid() if buy_label(buy) in present]
        write_grid_canvas(
            prefix,
            rows,
            signals,
            canvas_buys,
            slots_sell_grid(),
            info,
        )
        return

    if args.phase == "protect":
        position_path = Path(f"{prefix}.csv")
        rows, close_wide, init_cash = run_protect(
            signals, close, spy, position_log=position_path, one_lot=args.one_lot
        )
        save_json(CACHE_DIR / "protect.json", rows)
        title = "Loss dropdown and profit protection"
        if args.one_lot:
            title += " · one lot"
        info = period_info(
            close_wide,
            init_cash,
            max(r["n_signals"] for r in rows),
            run_label,
            title,
        )
        if args.one_lot:
            overlap = (
                "One open lot per ticker. A later buy while that ticker is already "
                "held does not open another lot and does not move the entry or the "
                "peak. n is the signal count; trades are the lots opened."
            )
        else:
            overlap = (
                "A new signal opens its own lot. It does not move the entry or the "
                "peak of a lot that is still open."
            )
        notes = [
            "Same daily books and the same winner buys: analyst >2/>3/>4 × "
            "projected >20/30/40/50%.",
            "No hold and no profit target. Loss dropdown, while the close is "
            "below the entry: 2.5dd, 5dd, 7.5dd from that entry. Profit "
            "protection, once a close has traded above the entry: sell when the "
            "giveback from the highest close reaches 5%, 10%, 20%, or 40% of "
            "the gain from entry to that peak. A $10 buy with a $12 high and "
            "10pp sells at $11.80.",
            "Signal books: " + ", ".join(signal_names()) + ". Each cell is one book.",
            "Trusted cells have at least 30 signals. Smaller cells stay in the matrices.",
            overlap,
            "A lot that never hits either stop stays open through the last quote day.",
            "Signals dated after --end are dropped. An open lot runs through the last quote day.",
            "Days exposed counts calendar days with at least one lot open. "
            "Lot-days sums each lot's calendar hold, so overlapping lots count again. "
            "Avg lot is the mean dollars used to open a lot.",
            "Comparison is on invested dollars, not book vs SPY.",
        ]
        write_grid_summary(
            report_path,
            rows,
            signals,
            info,
            notes,
            winners_buy_grid(),
            protect_sell_grid(),
            SellSpec(drawdown=0.05, profit_protect=0.10),
        )
        write_positions_log(position_path, position_path)
        write_code_snapshot(prefix, sys.argv[1:])
        present = {row["buy_label"] for row in rows}
        canvas_buys = [buy for buy in winners_buy_grid() if buy_label(buy) in present]
        write_grid_canvas(
            prefix,
            rows,
            signals,
            canvas_buys,
            protect_sell_grid(),
            info,
        )
        return

    if args.phase == "winners":
        position_path = Path(f"{prefix}.csv")
        rows, close_wide, init_cash = run_winners(
            signals, close, spy, position_log=position_path, one_lot=args.one_lot
        )
        save_json(CACHE_DIR / "winners.json", rows)
        title = "Daily winner-parameter grid"
        if args.one_lot:
            title += " · one lot, hold extends"
        info = period_info(
            close_wide,
            init_cash,
            max(r["n_signals"] for r in rows),
            run_label,
            title,
        )
        if args.one_lot:
            overlap = (
                "One open lot per ticker. A later buy while that ticker is already "
                "held does not open another lot; it restarts the hold clock from "
                "that bar. The profit target and the drawdown peak stay on the "
                "original entry. n is the signal count; trades are the lots opened."
            )
        else:
            overlap = (
                "A new signal opens its own lot and resets the time stop and target "
                "on lots of that ticker still open. Drawdown peak is since entry."
            )
        notes = [
            "Daily winner cuts: analyst >2/>3/>4, projected >20/30/40/50%, "
            "hold 10/15, target 25/50%, drawdown 5/7.5/10%.",
            "Signal books: " + ", ".join(signal_names()) + ". Each cell is one book.",
            "Trusted cells have at least 30 signals. Smaller cells stay in the matrices.",
            overlap,
            "Signals dated after --end are dropped. An open lot runs through the last quote day.",
            "Days exposed counts calendar days with at least one lot open. "
            "Lot-days sums each lot's calendar hold, so overlapping lots count again. "
            "Avg lot is the mean dollars used to open a lot.",
            "Comparison is on invested dollars, not book vs SPY.",
        ]
        write_grid_summary(
            report_path,
            rows,
            signals,
            info,
            notes,
            winners_buy_grid(),
            winners_sell_grid(),
            SellSpec(hold_days=15, target_frac=0.50, drawdown=0.075),
        )
        write_positions_log(position_path, position_path)
        write_code_snapshot(prefix, sys.argv[1:])
        present = {row["buy_label"] for row in rows}
        canvas_buys = [buy for buy in winners_buy_grid() if buy_label(buy) in present]
        write_grid_canvas(
            prefix,
            rows,
            signals,
            canvas_buys,
            winners_sell_grid(),
            info,
        )
        return

    if args.phase == "full":
        position_path = Path(f"{prefix}.csv")
        rows, close_wide, init_cash = run_full(
            signals, close, spy, position_log=position_path, one_lot=args.one_lot
        )
        save_json(CACHE_DIR / "full.json", rows)
        title = "Full buy/sell grid"
        if args.one_lot:
            title += " · one lot, hold extends"
        info = period_info(
            close_wide,
            init_cash,
            max(r["n_signals"] for r in rows),
            run_label,
            title,
        )
        if args.one_lot:
            overlap = (
                "One open lot per ticker. A later buy while that ticker is already "
                "held does not open another lot; it restarts the hold clock from "
                "that bar. The profit target and the drawdown peak stay on the "
                "original entry. n is the signal count; trades are the lots opened."
            )
        else:
            overlap = (
                "A new signal opens its own lot and resets the time stop and target "
                "on lots of that ticker still open. Drawdown peak is since entry."
            )
        notes = [
            "Full catalog: analyst >2–9, projected >10/20/25/30/40/50%, "
            "hold 10/15/30/45/60/75/90/105/120, target 25/50/75/100%, "
            "drawdown 5/7.5/10/15%.",
            "Signal books: " + ", ".join(signal_names()) + ". Each cell is one book.",
            "Trusted cells have at least 30 signals. Smaller cells stay in the matrices.",
            overlap,
            "Signals dated after --end are dropped. An open lot runs through the last quote day.",
            "Days exposed counts calendar days with at least one lot open. "
            "Lot-days sums each lot's calendar hold, so overlapping lots count again. "
            "Avg lot is the mean dollars used to open a lot.",
            "Comparison is on invested dollars, not book vs SPY.",
        ]
        write_grid_summary(
            report_path,
            rows,
            signals,
            info,
            notes,
            full_buy_grid(),
            full_sell_grid(),
            WINNING_SELL,
        )
        write_positions_log(position_path, position_path)
        write_code_snapshot(prefix, sys.argv[1:])
        present = {row["buy_label"] for row in rows}
        canvas_buys = [buy for buy in full_buy_grid() if buy_label(buy) in present]
        write_grid_canvas(
            prefix,
            rows,
            signals,
            canvas_buys,
            full_sell_grid(),
            info,
        )
        return

    if args.phase == "wide":
        position_log = []
        rows, close_wide, init_cash = run_wide(
            signals, close, spy, position_log=position_log, one_lot=args.one_lot
        )
        save_json(CACHE_DIR / "wide.json", rows)
        title = "Wide all_sources buy/sell grid"
        if args.one_lot:
            title += " · one lot, hold extends"
        info = period_info(
            close_wide,
            init_cash,
            max(r["n_signals"] for r in rows),
            run_label,
            title,
        )
        if args.one_lot:
            overlap = (
                "One open lot per ticker. A later buy while that ticker is already "
                "held does not open another lot; it restarts the hold clock from "
                "that bar. The profit target and the drawdown peak stay on the "
                "original entry. n is the signal count; trades are the lots opened."
            )
        else:
            overlap = (
                "A new signal opens its own lot and resets the time stop and target "
                "on lots of that ticker still open. Drawdown peak is since entry."
            )
        notes = [
            "Wide pass from the 2026-10-17 coarse canvas: analyst >2–6, "
            "projected >20/25/30%, hold 10/15/30/45/60/75/90/105/120, "
            "target 25/50%, drawdown 7.5/10%.",
            "One signal book: " + ", ".join(signal_names()) + ".",
            "Trusted cells have at least 30 signals. Smaller cells stay in the matrices.",
            overlap,
            "Signals dated after --end are dropped. An open lot runs through the last quote day.",
            "Days exposed counts calendar days with at least one lot open. "
            "Lot-days sums each lot's calendar hold, so overlapping lots count again. "
            "Avg lot is the mean dollars used to open a lot.",
            "Comparison is on invested dollars, not book vs SPY.",
        ]
        write_grid_summary(
            report_path,
            rows,
            signals,
            info,
            notes,
            wide_buy_grid(),
            wide_sell_grid(),
            WINNING_SELL,
        )
        write_positions_log(Path(f"{prefix}.csv"), position_log)
        write_code_snapshot(prefix, sys.argv[1:])
        write_grid_canvas(
            prefix,
            rows,
            signals,
            wide_buy_grid(),
            wide_sell_grid(),
            info,
        )
        return

    if args.phase == "coarse":
        rows, close_wide, init_cash = run_coarse(
            signals, close, spy, one_lot=args.one_lot
        )
        save_json(CACHE_DIR / "coarse.json", rows)
        title = "Coarse 7d-style buy/sell grid"
        if args.one_lot:
            title += " · one lot, hold extends"
        info = period_info(
            close_wide,
            init_cash,
            max(r["n_signals"] for r in rows),
            run_label,
            title,
        )
        if args.one_lot:
            overlap = (
                "One open lot per ticker. A later buy while that ticker is already "
                "held does not open another lot; it restarts the 10/15/30-day hold "
                "from that bar. The profit target and the drawdown peak stay on the "
                "original entry. n is the signal count; trades are the lots opened."
            )
        else:
            overlap = (
                "A new signal opens its own lot and resets the time stop and target "
                "on lots of that ticker still open. Drawdown peak is since entry."
            )
        notes = [
            "One pass: analyst >2–6, projected >20/25/30%, hold 10/15/30, "
            "target 25/50%, drawdown 7.5/10%. No locked iterations.",
            "Trusted cells have at least 30 signals. Smaller cells stay in the matrices.",
            overlap,
            "Comparison is on invested dollars, not book vs SPY.",
        ]
        write_grid_summary(
            report_path,
            rows,
            signals,
            info,
            notes,
            coarse_buy_grid(),
            coarse_sell_grid(),
            WINNING_SELL,
        )
        return

    if args.phase == "fine":
        position_log = []
        rows, close_wide, init_cash = run_fine(signals, close, spy, position_log)
        save_json(CACHE_DIR / "fine.json", rows)
        info = period_info(
            close_wide,
            init_cash,
            max(r["n_signals"] for r in rows),
            run_label,
            "Fine grid around 10d 25% 7.5dd",
        )
        notes = [
            "Neighborhood of the coarse peak: holds 5/7/10/12, targets 20–40%, "
            "drawdown 6/7.5/8.5%, on the two best buys and the nearby cuts.",
            "Trusted cells have at least 30 signals.",
            "Days exposed counts calendar days with at least one lot open. "
            "Lot-days sums each lot's calendar hold, so overlapping lots count again. "
            "An open lot runs through the last quote day. "
            "Avg lot is the mean dollars used to open a lot.",
            "The 2026-10-17 13:37 fine run, on the previous signals.csv, "
            "won with 5d 25% 7.5dd · yahoo-7d-window · analyst>3 · proj>35% "
            "at +146.7% and +$9,313 on 48 signals.",
            "Comparison is on invested dollars, not book vs SPY.",
        ]
        write_grid_summary(
            report_path,
            rows,
            signals,
            info,
            notes,
            fine_buy_grid(),
            fine_sell_grid(),
            COARSE_PEAK,
        )
        trusted = [r for r in rows if r["n_signals"] >= 30]
        best = max(
            trusted or rows,
            key=lambda r: (r["return_on_avg_invested_pct"], r["stock_pnl"]),
        )
        peak = spec_from_row(best)
        specs = [COARSE_PEAK]
        if peak.tag != COARSE_PEAK.tag:
            specs.append(peak)
        split_buys = with_signal_names(
            [
                {"min_analysts": 2, "min_projected": 0.0, "label": "every row"},
                {"min_analysts": 2, "min_projected": 30.0},
                {"min_analysts": 3, "min_projected": 30.0},
            ]
        )
        if best.get("min_percentile") is None and best.get("min_analysts") is not None:
            winner_buy = {
                "min_analysts": best["min_analysts"],
                "min_projected": best["min_projected"],
                "signal_name": best.get("signal_name"),
            }
            if buy_label(winner_buy) not in {buy_label(b) for b in split_buys}:
                split_buys.append(winner_buy)
        split_rows, _, _ = run_split(
            signals, close, spy, split_buys, specs, position_log
        )
        save_json(CACHE_DIR / "split.json", split_rows)
        append_split_summary(report_path, split_rows)
        write_positions_log(Path(f"{prefix}.csv"), position_log)
        write_code_snapshot(prefix, sys.argv[1:])
        write_grid_canvas(
            prefix,
            rows,
            signals,
            fine_buy_grid(),
            fine_sell_grid(),
            info,
        )
        return

    if args.phase == "focus":
        rows, close_wide, init_cash = run_focus(signals, close, spy)
        save_json(CACHE_DIR / "focus.json", rows)
        widest_n = max(
            len(
                apply_buy(
                    signals,
                    {
                        "min_analysts": 2,
                        "min_projected": 20.0,
                        "signal_name": name,
                    },
                )
            )
            for name in signal_names()
        )
        info = period_info(
            close_wide,
            init_cash,
            widest_n,
            run_label,
            "Focused buy/sell sweep by signal name",
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

    if args.phase == "staged":
        rows, close_wide, init_cash, bought = run_staged(signals, close, spy)
        save_json(CACHE_DIR / "staged.json", rows)
        info = period_info(
            close_wide,
            init_cash,
            len(bought),
            run_label,
            f"Two-stage trailing sells, buy frozen {buy_label(staged_buy())}",
        )
        notes = [
            "Peak for drawdown is since entry and does not reset on a new signal. "
            "Profit lock is the first close at or above the lock threshold from entry.",
            "25% of projection lock = entry × (1 + 0.25 × average_projected/100). "
            "After lock, trailing dd switches from dd_before to dd_after.",
            "Two-stage sells have no 30d time stop and no target-price sell. "
            "Lots that never hit the trail stay open to the last bar.",
            "Comparison is on invested dollars, not book vs SPY. Exposure stays un-optimized.",
        ]
        write_staged_summary(report_path, rows, info, notes)
        return

    if args.phase == "closed":
        rows, close_wide, init_cash, locks = run_closed(signals, close, spy)
        save_json(CACHE_DIR / "closed.json", rows)
        info = period_info(
            close_wide,
            init_cash,
            max(r["n_signals"] for r in rows),
            run_label,
            "Closed-window 5-iteration sweep (ignore last 29d of signals)",
        )
        info["ignore_last_days"] = ignore_last_days
        notes = [
            f"Signals after {signal_cutoff} were dropped so parameter picks are not "
            "driven by lots that could not finish a ~30d hold. Prices run through today.",
            "30 trading days is longer than 29 calendar days, so a 30d clock on a "
            "signal near the cutoff can still be open at the last bar; target and "
            "drawdown can still close those lots.",
            "Peak for drawdown is since entry and does not reset on a new signal. "
            "A new signal resets the time stop and the projection target.",
            "Comparison is on invested dollars, not book vs SPY. Exposure stays un-optimized.",
        ]
        write_closed_summary(
            report_path,
            rows,
            info,
            notes,
            locks,
            n_raw,
            len(signals),
            signal_cutoff,
        )
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
                f"Sell sweep, buy frozen {buy_label(freeze_buy_filter())}",
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
            bought = apply_buy(signals, freeze)
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
            "Rows are filtered by signal_name before analyst and projected cuts. "
            "analyst>2 and proj>10% is the full export for that signal name."
        )
        notes.append("† in buy tables: fewer than 10 signals.")
        write_summary(report_path, sell_rows, buy_groups, info, winners, notes)


if __name__ == "__main__":
    main()
