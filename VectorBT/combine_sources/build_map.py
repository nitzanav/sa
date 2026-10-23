"""Step 1. Map Google analyst people to Yahoo firms by exact price matches.

Run from the repo root:

    ./penv python VectorBT/combine_sources/build_map.py
"""

from __future__ import annotations

import argparse
import logging
from pathlib import Path

from mapping import MAP_COLUMNS, build_analyst_map, load_recommendations
from paths import ANALYST_MAP_CSV, GOOGLE_CSV, YAHOO_CSV

logger = logging.getLogger("combine_sources.build_map")


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build the Google person to Yahoo firm map.")
    parser.add_argument("--google", type=Path, default=GOOGLE_CSV)
    parser.add_argument("--yahoo", type=Path, default=YAHOO_CSV)
    parser.add_argument("--out", type=Path, default=ANALYST_MAP_CSV)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    args = parse_args(argv)
    google = load_recommendations(args.google)
    yahoo = load_recommendations(args.yahoo)
    logger.info("loaded google=%s rows yahoo=%s rows", len(google), len(yahoo))
    analyst_map = build_analyst_map(google, yahoo)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    analyst_map.to_csv(args.out, index=False, columns=MAP_COLUMNS)
    counts = analyst_map["verified"].value_counts().to_dict() if not analyst_map.empty else {}
    people = analyst_map["analyst_google"].nunique() if not analyst_map.empty else 0
    logger.info(
        "wrote %s pairs=%s people=%s verified_data=%s likely=%s best_guess=%s unverified=%s",
        args.out,
        len(analyst_map),
        people,
        counts.get("verified_data", 0),
        counts.get("likely", 0),
        counts.get("best_guess", 0),
        counts.get("unverified", 0),
    )


if __name__ == "__main__":
    main()
