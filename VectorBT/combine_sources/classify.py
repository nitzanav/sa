"""Classify every raw analyst name as a firm or a person.

Firms = normalized names from Yahoo plus every `firm` key in the Tipranks
per-ticker JSON files. People = names from Google and Tipranks CSV that are
not in the firm set and are not "Unknown Analyst". Unknown names (which
should be empty under this rule) land in aliases_unknown.csv for review.

The CSVs are append-only: reruns only add new aliases.
"""

from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path

import pandas as pd

from entities import (
    apply_firm_alias_map,
    load_firms,
    load_people,
    record_unknown,
    resolve_firm_id,
    slug,
)
from names import normalize_firm, normalize_person
from paths import (
    ALIASES_UNKNOWN_CSV,
    FIRMS_CSV,
    GOOGLE_CSV,
    PEOPLE_CSV,
    TIPRANKS_CSV,
    TIPRANKS_JSON_DIR,
    YAHOO_CSV,
)

logger = logging.getLogger("combine_sources.classify")


def _read_csv_names(path: Path) -> list[str]:
    if not path.exists():
        return []
    frame = pd.read_csv(path, usecols=["analyst"], dtype=str)
    return [value for value in frame["analyst"].dropna().tolist() if value]


def _read_tipranks_json_firms(root: Path) -> list[tuple[str, str]]:
    """Return `(firm, person)` pairs from every per-ticker JSON file."""
    pairs: list[tuple[str, str]] = []
    for path in sorted(root.glob("*.json")):
        if path.name == "all_symbols.json":
            continue
        try:
            data = json.loads(path.read_text())
        except (OSError, json.JSONDecodeError):
            continue
        if not isinstance(data, list):
            continue
        for row in data:
            if not isinstance(row, dict):
                continue
            firm = row.get("firm")
            person = row.get("analyst")
            pairs.append((str(firm or ""), str(person or "")))
    return pairs


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Classify names into firms and people.")
    parser.add_argument("--yahoo", type=Path, default=YAHOO_CSV)
    parser.add_argument("--google", type=Path, default=GOOGLE_CSV)
    parser.add_argument("--tipranks", type=Path, default=TIPRANKS_CSV)
    parser.add_argument("--tipranks-json", type=Path, default=TIPRANKS_JSON_DIR)
    parser.add_argument("--firms-out", type=Path, default=FIRMS_CSV)
    parser.add_argument("--people-out", type=Path, default=PEOPLE_CSV)
    parser.add_argument("--unknown-out", type=Path, default=ALIASES_UNKNOWN_CSV)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    args = parse_args(argv)

    firms = load_firms(args.firms_out)
    people = load_people(args.people_out)

    firm_slugs: set[str] = set()
    new_firms = 0
    new_people = 0

    for raw in _read_csv_names(args.yahoo):
        canonical = normalize_firm(raw)
        if not canonical:
            continue
        raw_id = slug(canonical)
        firm_id = resolve_firm_id(raw_id)
        firm_slugs.add(raw_id)
        firm_slugs.add(firm_id)
        if firms.upsert(firm_id, canonical, "yahoo", canonical):
            new_firms += 1

    tipranks_pairs = _read_tipranks_json_firms(args.tipranks_json)
    for firm_raw, _ in tipranks_pairs:
        canonical = normalize_firm(firm_raw)
        if not canonical:
            continue
        raw_id = slug(canonical)
        firm_id = resolve_firm_id(raw_id)
        firm_slugs.add(raw_id)
        firm_slugs.add(firm_id)
        if firms.upsert(firm_id, canonical, "tipranks", canonical):
            new_firms += 1

    unknown: list[tuple[str, str]] = []

    def ingest_person(source: str, raw: str) -> None:
        nonlocal new_people
        canonical = normalize_person(raw)
        if not canonical:
            return
        person_id = slug(canonical)
        if person_id in firm_slugs:
            unknown.append((source, raw))
            return
        if people.upsert(person_id, canonical, source, canonical):
            new_people += 1

    for raw in _read_csv_names(args.google):
        ingest_person("google", raw)
    for _, person_raw in tipranks_pairs:
        ingest_person("tipranks", person_raw)
    for raw in _read_csv_names(args.tipranks):
        ingest_person("tipranks", raw)

    apply_firm_alias_map(firms)
    firms.save()
    people.save()
    record_unknown(args.unknown_out, unknown)

    logger.info(
        "firms total=%s new=%s | people total=%s new=%s | unknown=%s",
        len(firms.frame),
        new_firms,
        len(people.frame),
        new_people,
        len(unknown),
    )


if __name__ == "__main__":
    main()
