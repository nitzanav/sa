"""Thin driver: classify names, then build relation candidates.

    ./penv python VectorBT/combine_sources/build_map.py

Pass --skip-classify or --skip-candidates to run just one stage.
"""

from __future__ import annotations

import argparse
import logging

import candidates
import classify
from entities import load_firms, load_people, load_relations
from paths import (
    CANDIDATES_PENDING_CSV,
    FIRMS_CSV,
    PEOPLE_CSV,
    RELATIONS_CSV,
)


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Refresh entity tables and relation candidates.")
    parser.add_argument("--skip-classify", action="store_true")
    parser.add_argument("--skip-candidates", action="store_true")
    return parser.parse_args(argv)


def _count_pending() -> int:
    if not CANDIDATES_PENDING_CSV.exists():
        return 0
    with CANDIDATES_PENDING_CSV.open() as handle:
        lines = sum(1 for _ in handle)
    return max(0, lines - 1)


def main(argv: list[str] | None = None) -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    args = parse_args(argv)
    if not args.skip_classify:
        classify.main([])
    if not args.skip_candidates:
        candidates.main([])

    firms = load_firms(FIRMS_CSV)
    people = load_people(PEOPLE_CSV)
    relations = load_relations(RELATIONS_CSV)
    pending = _count_pending()
    confirmed = int((relations["confirmed_by_agent"] == "yes").sum()) if not relations.empty else 0

    print(
        f"firms={len(firms.frame)} people={len(people.frame)} "
        f"relations={len(relations)} confirmed={confirmed} pending={pending}"
    )


if __name__ == "__main__":
    main()
