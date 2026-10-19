"""Build the person-to-firm map from exact projected-price matches."""

from __future__ import annotations

from pathlib import Path

import pandas as pd

from names import normalize_firm, normalize_person

SOURCE_COLUMNS = ["date", "ticker", "analyst", "percent", "projected_price"]
MAP_COLUMNS = [
    "analyst_google",
    "analyst_yahoo",
    "n",
    "share",
    "is_best",
    "verified",
]

EXACT_PRICE_ABS = 0.01
SHARE_MIN = 0.8


def assign_verified(n: int, total: int, is_best: bool) -> str:
    """Data-only status for one (person, firm) row.

    verified_data: best firm, n >= 3, share >= 0.8
    likely: best firm, n >= 2, share >= 0.8
    best_guess: best firm otherwise
    unverified: any firm that is not the top one
    """
    if not is_best:
        return "unverified"
    share_ok = total > 0 and (n / total) >= SHARE_MIN - 1e-12
    if n >= 3 and share_ok:
        return "verified_data"
    if n >= 2 and share_ok:
        return "likely"
    return "best_guess"


def choose_final_status(verified: str, web_verified: bool | None) -> str:
    if web_verified:
        return "web_verified"
    return verified


def load_recommendations(path: Path) -> pd.DataFrame:
    frame = pd.read_csv(path)
    missing = [column for column in SOURCE_COLUMNS if column not in frame.columns]
    if missing:
        raise SystemExit(f"{path} is missing columns: {', '.join(missing)}")
    return coerce_recommendations(frame)


def coerce_recommendations(frame: pd.DataFrame) -> pd.DataFrame:
    out = frame.copy()
    missing = [column for column in SOURCE_COLUMNS if column not in out.columns]
    if missing:
        raise SystemExit(f"recommendations are missing columns: {', '.join(missing)}")
    out["date"] = pd.to_datetime(out["date"], errors="coerce").dt.strftime("%Y-%m-%d")
    out["ticker"] = out["ticker"].astype(str).str.strip()
    out["analyst"] = out["analyst"].astype(str)
    out["percent"] = pd.to_numeric(out["percent"], errors="coerce")
    out["projected_price"] = pd.to_numeric(out["projected_price"], errors="coerce")
    out = out.dropna(subset=["date"])
    out = out[out["date"].ne("NaT")]
    out = out[out["ticker"].ne("") & out["ticker"].str.lower().ne("nan")]
    return out.reset_index(drop=True)


def prepare_google(frame: pd.DataFrame) -> pd.DataFrame:
    out = coerce_recommendations(frame)
    out["analyst_google"] = out["analyst"].map(normalize_person)
    out = out.dropna(subset=["analyst_google"])
    out = out.drop_duplicates(
        subset=["date", "ticker", "analyst_google", "percent", "projected_price"]
    )
    return out.reset_index(drop=True)


def prepare_yahoo(frame: pd.DataFrame) -> pd.DataFrame:
    out = coerce_recommendations(frame)
    out["analyst_yahoo"] = out["analyst"].map(normalize_firm)
    out = out.dropna(subset=["analyst_yahoo"])
    out = out.drop_duplicates(
        subset=["date", "ticker", "analyst_yahoo", "percent", "projected_price"]
    )
    return out.reset_index(drop=True)


def _empty_map() -> pd.DataFrame:
    return pd.DataFrame(columns=MAP_COLUMNS)


def build_analyst_map(google: pd.DataFrame, yahoo: pd.DataFrame) -> pd.DataFrame:
    """Inner-join on ticker+date and keep pairs whose prices match within $0.01."""
    g = prepare_google(google).dropna(subset=["projected_price"])
    y = prepare_yahoo(yahoo).dropna(subset=["projected_price"])
    if g.empty or y.empty:
        return _empty_map()

    g = g[["ticker", "date", "analyst_google", "projected_price"]]
    y = y[["ticker", "date", "analyst_yahoo", "projected_price"]]
    merged = g.merge(y, on=["ticker", "date"], how="inner", suffixes=("_google", "_yahoo"))
    price_diff = merged["projected_price_google"] - merged["projected_price_yahoo"]
    matched = merged[price_diff.abs() < EXACT_PRICE_ABS]
    if matched.empty:
        return _empty_map()

    grouped = (
        matched.groupby(["analyst_google", "analyst_yahoo"], as_index=False)
        .size()
        .rename(columns={"size": "n"})
    )
    grouped["total"] = grouped.groupby("analyst_google")["n"].transform("sum")
    grouped = grouped.sort_values(
        ["analyst_google", "n", "analyst_yahoo"],
        ascending=[True, False, True],
        kind="mergesort",
    )
    grouped["is_best"] = ~grouped.duplicated("analyst_google", keep="first")
    grouped["share"] = (grouped["n"] / grouped["total"]).round(4)
    grouped["verified"] = [
        assign_verified(int(n), int(total), bool(best))
        for n, total, best in zip(grouped["n"], grouped["total"], grouped["is_best"])
    ]
    grouped["n"] = grouped["n"].astype(int)
    grouped["is_best"] = grouped["is_best"].astype(bool)
    out = grouped[MAP_COLUMNS].sort_values(
        ["n", "analyst_google", "analyst_yahoo"],
        ascending=[False, True, True],
        kind="mergesort",
    )
    return out.reset_index(drop=True)
