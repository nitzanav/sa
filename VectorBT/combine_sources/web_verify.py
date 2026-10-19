"""Step 2. Confirm the best person-to-firm row with a web search.

Run from the repo root:

    ./penv python VectorBT/combine_sources/web_verify.py

Keys are read from the environment. Nothing is hardcoded.
GOOGLE_API_KEY and GOOGLE_CSE_ID, or SERPAPI_KEY, or BRAVE_API_KEY.
With none of those, --provider auto uses DuckDuckGo.
"""

from __future__ import annotations

import argparse
import logging
import time
from pathlib import Path

import pandas as pd

from mapping import MAP_COLUMNS, choose_final_status
from paths import ANALYST_MAP_CSV, ANALYST_MAP_WEB_CSV, CACHE_DB
from search_providers import SearchError, SearchProvider, build_query, make_provider, score_results
from web_cache import SearchCache

logger = logging.getLogger("combine_sources.web_verify")

WEB_COLUMNS = MAP_COLUMNS + ["web_hits", "web_link", "web_verified", "final_status"]


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Web-verify the best analyst firm for each person.")
    parser.add_argument("--map", type=Path, default=ANALYST_MAP_CSV)
    parser.add_argument("--out", type=Path, default=ANALYST_MAP_WEB_CSV)
    parser.add_argument("--cache", type=Path, default=CACHE_DB)
    parser.add_argument(
        "--provider",
        default="auto",
        choices=["auto", "google", "serpapi", "brave", "duckduckgo"],
    )
    parser.add_argument("--max-queries", type=int, default=100)
    parser.add_argument("--sleep", type=float, default=0.2)
    return parser.parse_args(argv)


def _as_bool(value: object) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        if isinstance(value, float) and pd.isna(value):
            return False
        return float(value) == 1.0
    return str(value).strip().lower() in {"true", "1", "1.0", "yes"}


def load_map(path: Path) -> pd.DataFrame:
    frame = pd.read_csv(path)
    missing = [column for column in MAP_COLUMNS if column not in frame.columns]
    if missing:
        raise SystemExit(f"{path} is missing columns: {', '.join(missing)}")
    frame["is_best"] = frame["is_best"].map(_as_bool)
    frame["n"] = frame["n"].astype(int)
    return frame


def _blank_web(frame: pd.DataFrame) -> pd.DataFrame:
    out = frame.copy()
    out["web_hits"] = pd.NA
    out["web_link"] = pd.NA
    out["web_verified"] = pd.NA
    return out


def apply_cache(frame: pd.DataFrame, cache: SearchCache) -> pd.DataFrame:
    out = _blank_web(frame)
    hits: list[object] = []
    links: list[object] = []
    flags: list[object] = []
    for person, firm, is_best in zip(out["analyst_google"], out["analyst_yahoo"], out["is_best"]):
        cached = cache.get(str(person), str(firm)) if is_best else None
        if cached is None:
            hits.append(pd.NA)
            links.append(pd.NA)
            flags.append(pd.NA)
        else:
            hits.append(cached.web_hits)
            links.append(cached.web_link)
            flags.append(cached.web_verified)
    out["web_hits"] = hits
    out["web_link"] = links
    out["web_verified"] = flags
    out["final_status"] = [
        choose_final_status(str(verified), flag if isinstance(flag, bool) else None)
        for verified, flag in zip(out["verified"], out["web_verified"])
    ]
    return out


def verify_best_rows(
    frame: pd.DataFrame,
    cache: SearchCache,
    provider: SearchProvider | None,
    provider_name: str,
    max_queries: int,
    sleep_s: float,
    stats: dict[str, int],
) -> None:
    """Search is_best pairs missing from the cache. Updates stats in place so a crash keeps the count."""
    best = frame[frame["is_best"]].sort_values(
        ["n", "analyst_google"],
        ascending=[False, True],
        kind="mergesort",
    )
    queries = 0
    cache_hits = 0
    network_calls = 0
    active = provider
    for person, firm in zip(best["analyst_google"], best["analyst_yahoo"]):
        person_s = str(person)
        firm_s = str(firm)
        if cache.get(person_s, firm_s) is not None:
            cache_hits += 1
            stats["cache_hits"] = cache_hits
            continue
        if queries >= max_queries:
            break
        if active is None:
            active = make_provider(provider_name)
            logger.info("search provider=%s", active.name)
        if network_calls > 0 and sleep_s > 0:
            time.sleep(sleep_s)
        query = build_query(person_s, firm_s)
        logger.info("search %s/%s %s", queries + 1, max_queries, query)
        results = active.search(query)
        web_hits, web_link = score_results(results, person_s, firm_s)
        cache.put(
            person_s,
            firm_s,
            query,
            active.name,
            web_hits,
            web_link,
            web_hits > 0,
        )
        queries += 1
        network_calls += 1
        stats["queries"] = queries
        stats["cache_hits"] = cache_hits
    stats["queries"] = queries
    stats["cache_hits"] = cache_hits


def write_verified(frame: pd.DataFrame, path: Path) -> None:
    out = frame[WEB_COLUMNS].copy()
    out["web_hits"] = out["web_hits"].apply(lambda value: "" if pd.isna(value) else int(value))
    out["web_link"] = out["web_link"].apply(lambda value: "" if pd.isna(value) else str(value))
    out["web_verified"] = out["web_verified"].apply(
        lambda value: "" if pd.isna(value) else ("True" if bool(value) else "False")
    )
    path.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(path, index=False)


def main(argv: list[str] | None = None) -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    args = parse_args(argv)
    if args.max_queries < 0:
        raise SystemExit("--max-queries must be >= 0")
    frame = load_map(args.map)
    cache = SearchCache(args.cache)
    failed: SearchError | None = None
    stats = {"queries": 0, "cache_hits": 0}
    try:
        try:
            verify_best_rows(
                frame,
                cache,
                provider=None,
                provider_name=args.provider,
                max_queries=args.max_queries,
                sleep_s=args.sleep,
                stats=stats,
            )
        except SearchError as exc:
            failed = exc
            logger.error("search failed: %s", exc)
        verified = apply_cache(frame, cache)
        write_verified(verified, args.out)
        best_rows = int(frame["is_best"].sum())
        searched = verified.loc[verified["is_best"], "web_verified"]
        done = int(searched.notna().sum()) if best_rows else 0
        logger.info(
            "wrote %s queries=%s cache_hits=%s best_rows=%s searched=%s",
            args.out,
            stats["queries"],
            stats["cache_hits"],
            best_rows,
            done,
        )
    finally:
        cache.close()
    if failed is not None:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
