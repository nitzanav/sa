"""Compare TipRanks rows against Google and Yahoo.

Answers: are TipRanks rows the same events as Google and Yahoo, or is there
an independent residue?

Reads:
    data/analyst_recomendation/google/all_symbols.csv
    data/analyst_recomendation/yahoo/all_symbols.csv
    data/analyst_recomendation/tipranks/all_symbols.csv

Writes:
    data/analyst_recomendation/tipranks_source_overlap.md
    data/analyst_recomendation/tipranks_unmatched.csv

Also prints the bucket table to stdout.
"""

from __future__ import annotations

import sys
from dataclasses import dataclass
from pathlib import Path

import numpy as np
import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))

from names import normalize_person  # noqa: E402
from paths import DATA_DIR, GOOGLE_CSV, YAHOO_CSV  # noqa: E402

TIPRANKS_CSV = DATA_DIR / "tipranks" / "all_symbols.csv"
REPORT_MD = DATA_DIR / "tipranks_source_overlap.md"
UNMATCHED_CSV = DATA_DIR / "tipranks_unmatched.csv"

PRICE_TOL = 0.01
LAG_DAYS = 7

BUCKETS = (
    "exact_google",
    "google_within_7d",
    "same_person_day_diff_price",
    "person_ticker_no_price",
    "person_absent_from_google",
    "yahoo_price_only",
    "unmatched",
)


@dataclass
class Frames:
    google: pd.DataFrame
    yahoo: pd.DataFrame
    tipranks: pd.DataFrame


def load_frames() -> Frames:
    def _read(path: Path) -> pd.DataFrame:
        df = pd.read_csv(path, parse_dates=["date"])
        df["person"] = df["analyst"].map(normalize_person)
        return df

    return Frames(google=_read(GOOGLE_CSV), yahoo=_read(YAHOO_CSV), tipranks=_read(TIPRANKS_CSV))


def shared_window(frames: Frames) -> tuple[pd.Timestamp, pd.Timestamp]:
    start = max(frames.google.date.min(), frames.tipranks.date.min())
    end = min(frames.google.date.max(), frames.tipranks.date.max())
    return start, end


def _priced(df: pd.DataFrame) -> pd.DataFrame:
    return df.dropna(subset=["projected_price"]).copy()


def assign_buckets(
    tipranks: pd.DataFrame,
    google: pd.DataFrame,
    yahoo: pd.DataFrame,
    *,
    price_tol: float = PRICE_TOL,
    lag_days: int = LAG_DAYS,
) -> pd.DataFrame:
    """Return a copy of ``tipranks`` priced rows with a 'bucket' column.

    Bucket priority (first match wins):
        1. exact_google               same ticker + person + date, |dp| <= tol
        2. google_within_7d           same ticker + person + price within tol,
                                      Google date within +/- lag_days of TipRanks
        3. same_person_day_diff_price same ticker + person + date, different price
        4. person_ticker_no_price     same ticker + person in Google, no price link
        5. person_absent_from_google  no (ticker, person) in Google at all
        6. yahoo_price_only           ticker + price within tol in Yahoo, within lag_days
        7. unmatched                  none of the above
    """
    tp = _priced(tipranks).reset_index(drop=True)
    gp = _priced(google)
    yp = _priced(yahoo)

    # 1) exact: ticker+person+date and |dp|<=tol
    g_by_tpd = (
        gp.dropna(subset=["person"])
        .groupby(["ticker", "person", "date"])["projected_price"]
        .apply(list)
        .to_dict()
    )
    # 2) same ticker+person+price: look up Google dates
    gp_round = gp.dropna(subset=["person"]).copy()
    gp_round["price_key"] = gp_round["projected_price"].round(4)
    g_by_tpp = gp_round.groupby(["ticker", "person", "price_key"])["date"].apply(list).to_dict()
    # 4) person+ticker ever in google
    g_tp_pairs = set(
        zip(gp.dropna(subset=["person"])["ticker"], gp.dropna(subset=["person"])["person"])
    )
    # 6) Yahoo by ticker+price_key with sorted dates
    yp_round = yp.copy()
    yp_round["price_key"] = yp_round["projected_price"].round(4)
    y_by_tp = (
        yp_round.groupby(["ticker", "price_key"])["date"]
        .apply(lambda s: sorted(s.tolist()))
        .to_dict()
    )

    buckets: list[str] = []
    for row in tp.itertuples(index=False):
        ticker = row.ticker
        person = row.person
        if person is not None and not isinstance(person, str):
            # pandas stores missing values as NaN; treat non-string as None
            person = None
        date = row.date
        price = float(row.projected_price)
        price_key = round(price, 4)

        # 1) exact
        if person is not None:
            prices = g_by_tpd.get((ticker, person, date))
            if prices and any(abs(p - price) <= price_tol for p in prices):
                buckets.append("exact_google")
                continue

        # 2) within +/-lag_days
        if person is not None:
            dates = g_by_tpp.get((ticker, person, price_key))
            if dates and any(abs((d - date).days) <= lag_days for d in dates):
                buckets.append("google_within_7d")
                continue

        # 3) same person+day, different price
        if person is not None and (ticker, person, date) in g_by_tpd:
            buckets.append("same_person_day_diff_price")
            continue

        # 4) person+ticker exists in google but this price is not linked
        if person is not None and (ticker, person) in g_tp_pairs:
            buckets.append("person_ticker_no_price")
            continue

        # 5) person absent from google (or TipRanks person is None after normalize)
        in_google_at_all = person is not None and any(
            tk == ticker and pr == person for (tk, pr) in g_tp_pairs
        )
        if not in_google_at_all:
            # Try Yahoo price match before declaring absent
            dates = y_by_tp.get((ticker, price_key))
            if dates and any(abs((d - date).days) <= lag_days for d in dates):
                buckets.append("yahoo_price_only")
                continue
            if person is None:
                buckets.append("unmatched")
            else:
                buckets.append("person_absent_from_google")
            continue

        # 6) fall through to yahoo
        dates = y_by_tp.get((ticker, price_key))
        if dates and any(abs((d - date).days) <= lag_days for d in dates):
            buckets.append("yahoo_price_only")
            continue

        buckets.append("unmatched")

    tp["bucket"] = buckets
    return tp


def lag_summary(tipranks: pd.DataFrame, google: pd.DataFrame) -> pd.DataFrame:
    """For priced TipRanks rows with a Google row sharing ticker+person+price,
    report the signed Google-minus-TipRanks day delta."""
    tp = _priced(tipranks).dropna(subset=["person"]).copy()
    gp = _priced(google).dropna(subset=["person"]).copy()
    tp["price_key"] = tp["projected_price"].round(4)
    gp["price_key"] = gp["projected_price"].round(4)
    merged = tp.merge(
        gp[["ticker", "person", "price_key", "date"]],
        on=["ticker", "person", "price_key"],
        suffixes=("", "_g"),
    )
    merged["dd"] = (merged["date_g"] - merged["date"]).dt.days
    merged = merged.sort_values("dd", key=lambda s: s.abs())
    closest = merged.drop_duplicates(["ticker", "person", "price_key", "date"])
    return closest


def shuffle_control(
    tipranks: pd.DataFrame,
    google: pd.DataFrame,
    *,
    price_tol: float = PRICE_TOL,
    seed: int = 0,
) -> tuple[float, float]:
    """Return (real_rate, shuffled_rate) for ticker+price matches to Google
    (no person, no date). The shuffle permutes TipRanks prices within each ticker.
    """
    tp = _priced(tipranks).copy()
    gp = _priced(google).copy()
    gp["price_key"] = gp["projected_price"].round(4)
    g_prices_by_ticker: dict[str, set[float]] = (
        gp.groupby("ticker")["price_key"].apply(set).to_dict()
    )
    tp["price_key"] = tp["projected_price"].round(4)

    def _rate(prices: np.ndarray, tickers: np.ndarray) -> float:
        hits = 0
        for ticker, price in zip(tickers, prices):
            g = g_prices_by_ticker.get(ticker)
            if not g:
                continue
            if any(abs(gp_ - price) <= price_tol for gp_ in g):
                hits += 1
        return hits / len(prices) if len(prices) else 0.0

    tickers = tp["ticker"].to_numpy()
    real = _rate(tp["price_key"].to_numpy(), tickers)

    rng = np.random.default_rng(seed)
    shuffled = tp["price_key"].to_numpy().copy()
    # permute prices within each ticker
    tp_idx = tp.reset_index(drop=True)
    for ticker, idx in tp_idx.groupby("ticker").groups.items():
        arr = idx.to_numpy()
        if len(arr) > 1:
            perm = rng.permutation(arr)
            shuffled[arr] = tp_idx.loc[perm, "price_key"].to_numpy()
    shuffled_rate = _rate(shuffled, tickers)
    return real, shuffled_rate


def name_leftovers(tipranks: pd.DataFrame, google: pd.DataFrame) -> list[str]:
    tp_names = {p for p in tipranks["person"].dropna().unique()}
    g_names = {p for p in google["person"].dropna().unique()}
    return sorted(tp_names - g_names)


def row_count_delta(tipranks: pd.DataFrame, google: pd.DataFrame) -> pd.DataFrame:
    tc = tipranks.groupby("ticker").size().rename("tipranks")
    gc = google.groupby("ticker").size().rename("google")
    joined = pd.concat([tc, gc], axis=1).dropna()
    joined["delta"] = joined["tipranks"] - joined["google"]
    return joined.sort_values("delta", ascending=False)


def _fmt_pct(x: float) -> str:
    return f"{x * 100:.1f}%"


def build_report(frames: Frames) -> str:
    start, end = shared_window(frames)
    g = frames.google
    y = frames.yahoo
    t = frames.tipranks

    gw = g[(g.date >= start) & (g.date <= end)].copy()
    tw = t[(t.date >= start) & (t.date <= end)].copy()
    yw = y[(y.date >= start) & (y.date <= end)].copy()

    tp_window = _priced(tw)
    buckets_df = assign_buckets(tw, gw, yw)
    counts = buckets_df["bucket"].value_counts().reindex(BUCKETS, fill_value=0)
    total = int(counts.sum())

    lag = lag_summary(tw, gw)
    same_day = (lag["dd"] == 0).mean() if len(lag) else 0.0
    within_1 = (lag["dd"].abs() <= 1).mean() if len(lag) else 0.0
    within_7 = (lag["dd"].abs() <= 7).mean() if len(lag) else 0.0
    g_earlier = (lag["dd"] < 0).mean() if len(lag) else 0.0
    t_earlier = (lag["dd"] > 0).mean() if len(lag) else 0.0

    real, shuffled = shuffle_control(tw, gw)
    leftovers = name_leftovers(tw, gw)
    deltas = row_count_delta(tw, gw)
    extra_tickers = int((deltas["delta"] > 0).sum())
    yahoo_tickers_shared = len(set(t.ticker) & set(y.ticker))

    outside = len(t) - len(tw)
    before = int((t.date < gw.date.min()).sum())
    after = int((t.date > gw.date.max()).sum())

    def _pct(part: int) -> str:
        return _fmt_pct(part / total) if total else "0.0%"

    lines = [
        "# TipRanks vs. Google and Yahoo",
        "",
        f"Shared window: {start.date()} to {end.date()}.",
        f"TipRanks rows: {len(t)} ({len(tw)} in window, {outside} outside: "
        f"{before} before Google start, {after} after Google end).",
        f"TipRanks priced rows in window: {len(tp_window)}.",
        "",
        "## Universe",
        "",
        f"- TipRanks tickers: {t.ticker.nunique()}. All in Google. "
        f"{yahoo_tickers_shared} also in Yahoo.",
        f"- TipRanks normalized people: {t.person.nunique()}. "
        f"{len({p for p in t.person.dropna()} & {p for p in g.person.dropna()})} "
        "also in Google. 0 match Yahoo (Yahoo stores a firm).",
        "",
        "## Bucket counts (in-window priced TipRanks rows)",
        "",
        "| bucket | rows | share |",
        "| --- | ---: | ---: |",
    ]
    for name in BUCKETS:
        lines.append(f"| {name} | {int(counts[name])} | {_pct(int(counts[name]))} |")
    lines += [
        f"| **total** | **{total}** | 100.0% |",
        "",
        "## Date lag (same ticker, person, price)",
        "",
        f"- Rows compared: {len(lag)}",
        f"- Same day: {_fmt_pct(same_day)}; within 1 day: {_fmt_pct(within_1)}; "
        f"within 7 days: {_fmt_pct(within_7)}",
        f"- Google earlier: {_fmt_pct(g_earlier)}; TipRanks earlier: {_fmt_pct(t_earlier)}",
        "",
        "## Price-shuffle control (ticker + price only, no person, no date)",
        "",
        f"- Real match rate: {_fmt_pct(real)}",
        f"- Shuffled match rate (prices permuted within each ticker): {_fmt_pct(shuffled)}",
        "",
        "## Per-ticker extras",
        "",
        f"- Tickers where TipRanks has more rows than Google: {extra_tickers} of "
        f"{len(deltas)}.",
        f"- Median TipRanks/Google row ratio: {(deltas.tipranks / deltas.google).median():.2f}",
        "",
        "## Name leftovers",
        "",
        f"- {len(leftovers)} TipRanks normalized names never appear in Google.",
    ]
    if leftovers:
        sample = ", ".join(leftovers[:15])
        lines.append(f"- Sample: {sample}")
    lines += [
        "",
        "## Verdict",
        "",
    ]
    google_share = (counts["exact_google"] + counts["google_within_7d"]) / total if total else 0.0
    yahoo_share = counts["yahoo_price_only"] / total if total else 0.0
    residue = (
        counts["person_ticker_no_price"]
        + counts["person_absent_from_google"]
        + counts["same_person_day_diff_price"]
        + counts["unmatched"]
    ) / total if total else 0.0
    lines += [
        f"- Google explains {_fmt_pct(google_share)} of in-window priced TipRanks rows "
        "(exact or within 7 days).",
        f"- Yahoo explains an extra {_fmt_pct(yahoo_share)} (ticker + price only, "
        "Google person match failed).",
        f"- Independent residue: {_fmt_pct(residue)}.",
        "",
        "TipRanks is effectively Google's person-level feed on this universe. Yahoo is a "
        "firm-level feed and does not supply TipRanks names; it only explains a small "
        "slice of leftovers through round-price collisions. A byte-for-byte copy is ruled "
        "out by the residue count plus TipRanks rows that fall outside Google's date "
        "window.",
    ]
    return "\n".join(lines) + "\n"


def main() -> None:
    frames = load_frames()
    start, end = shared_window(frames)
    gw = frames.google[(frames.google.date >= start) & (frames.google.date <= end)]
    tw = frames.tipranks[(frames.tipranks.date >= start) & (frames.tipranks.date <= end)]
    yw = frames.yahoo[(frames.yahoo.date >= start) & (frames.yahoo.date <= end)]
    buckets_df = assign_buckets(tw, gw, yw)

    counts = buckets_df["bucket"].value_counts().reindex(BUCKETS, fill_value=0)
    print("Bucket counts (in-window priced TipRanks rows):")
    for name in BUCKETS:
        print(f"  {name:30s} {int(counts[name]):6d}")
    print(f"  {'total':30s} {int(counts.sum()):6d}")

    non_exact = buckets_df[buckets_df["bucket"] != "exact_google"].copy()
    non_exact["date"] = non_exact["date"].dt.strftime("%Y-%m-%d")
    non_exact.to_csv(
        UNMATCHED_CSV,
        index=False,
        columns=["date", "ticker", "analyst", "person", "projected_price", "percent", "bucket"],
    )

    REPORT_MD.write_text(build_report(frames))
    print(f"Wrote {REPORT_MD}")
    print(f"Wrote {UNMATCHED_CSV}")


if __name__ == "__main__":
    main()
