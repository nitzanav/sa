"""Build person-firm relation candidates from deterministic rules.

One firm per person. A price match counts only when that (ticker, date, price)
is unique: one Google person and one Yahoo firm. Shared price targets on the
same day are dropped as ambiguous.

Rules (first match wins):

- exact_price_strong: unique Google-Yahoo price join, n >= 3 and share >= 0.8.
- exact_price_weak: same join with n == 2 or share in [0.5, 0.8). Goes to the
  pending queue for subagent confirmation.
- tipranks_json: Tipranks per-ticker `firm` next to the person, used only when
  that person has no unique-price firm. Most common Tipranks firm wins.
- Anything weaker is dropped.

Only rows inside the Yahoo intersect Tipranks intersect Google window are
considered, matching the all_sources filter in etl/etl.sql.
"""

from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path

import pandas as pd

from entities import (
    PRESERVED_RELATION_RULES,
    RELATION_COLUMNS,
    apply_firm_alias_map,
    apply_relation_overrides,
    load_firms,
    load_people,
    load_relations,
    rekey_firm_ids,
    resolve_firm_id,
    save_relations,
    slug,
    upsert_relation,
)
from mapping import coerce_recommendations
from names import normalize_firm, normalize_person
from paths import (
    CANDIDATES_PENDING_CSV,
    CANDIDATES_REJECTED_CSV,
    FIRMS_CSV,
    GOOGLE_CSV,
    PEOPLE_CSV,
    RELATIONS_CSV,
    TIPRANKS_CSV,
    TIPRANKS_JSON_DIR,
    YAHOO_CSV,
)

logger = logging.getLogger("combine_sources.candidates")

STRONG_N = 3
STRONG_SHARE = 0.8
WEAK_MIN_SHARE = 0.5


def _load_source(path: Path, canonical, column: str) -> pd.DataFrame:
    frame = coerce_recommendations(pd.read_csv(path))
    frame[column] = frame["analyst"].map(canonical)
    frame = frame.dropna(subset=[column])
    return frame.reset_index(drop=True)


def _tipranks_json_pairs(root: Path) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
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
            person = normalize_person(row.get("analyst"))
            firm = normalize_firm(row.get("firm"))
            if person and firm:
                out.append({"person": person, "firm": firm})
    return out


def overlap_window(frames: dict[str, pd.DataFrame]) -> tuple[str, str]:
    start = max(frame["date"].min() for frame in frames.values())
    end = min(frame["date"].max() for frame in frames.values())
    if not isinstance(start, str) or not isinstance(end, str):
        return "", ""
    return start, end


def _in_window(frame: pd.DataFrame, start: str, end: str) -> pd.DataFrame:
    if not start or not end:
        return frame.iloc[0:0]
    mask = (frame["date"] >= start) & (frame["date"] <= end)
    return frame.loc[mask].reset_index(drop=True)


def _evidence_sample(matches: pd.DataFrame, limit: int = 2) -> str:
    rows = matches.head(limit)
    return ";".join(f"{t}@{d}" for t, d in zip(rows["ticker"], rows["date"]))


def _bucket(share: float, n: int) -> str:
    if n >= STRONG_N and share >= STRONG_SHARE:
        return "exact_price_strong"
    if n == 2 or (share >= WEAK_MIN_SHARE and share < STRONG_SHARE and n >= 2):
        return "exact_price_weak"
    return ""


def _price_key(series: pd.Series) -> pd.Series:
    return series.round(2)


def unique_price_join(google: pd.DataFrame, yahoo: pd.DataFrame) -> pd.DataFrame:
    """Keep (ticker, date, price) only when one person and one firm posted it."""
    g = google.dropna(subset=["projected_price"]).copy()
    y = yahoo.dropna(subset=["projected_price"]).copy()
    g["price_key"] = _price_key(g["projected_price"])
    y["price_key"] = _price_key(y["projected_price"])
    g = g.drop_duplicates(["ticker", "date", "person", "price_key"])
    y = y.drop_duplicates(["ticker", "date", "firm", "price_key"])
    g = g[g.groupby(["ticker", "date", "price_key"])["person"].transform("nunique") == 1]
    y = y[y.groupby(["ticker", "date", "price_key"])["firm"].transform("nunique") == 1]
    if g.empty or y.empty:
        return g.iloc[0:0].merge(y.iloc[0:0], on=["ticker", "date", "price_key"])
    return g.merge(y, on=["ticker", "date", "price_key"])


def _best_firm_rows(grouped: pd.DataFrame) -> pd.DataFrame:
    ordered = grouped.sort_values(["person", "n", "firm"], ascending=[True, False, True])
    return ordered.groupby("person", as_index=False).head(1).reset_index(drop=True)


def _tipranks_best_pairs(pairs: list[dict[str, str]]) -> list[dict[str, str]]:
    counts: dict[str, dict[str, int]] = {}
    for pair in pairs:
        counts.setdefault(pair["person"], {})
        counts[pair["person"]][pair["firm"]] = counts[pair["person"]].get(pair["firm"], 0) + 1
    best: list[dict[str, str]] = []
    for person, firms in counts.items():
        firm = max(sorted(firms), key=lambda name: (firms[name], name))
        best.append({"person": person, "firm": firm})
    return best


def _ids(person: str, firm: str, people: dict[str, str], firms: dict[str, str]) -> tuple[str, str]:
    return people.get(person, slug(person)), resolve_firm_id(firms.get(firm, slug(firm)))


def build_candidates(
    google: pd.DataFrame,
    yahoo: pd.DataFrame,
    tipranks_pairs: list[dict[str, str]],
    firm_slug_by_canonical: dict[str, str],
    person_slug_by_canonical: dict[str, str],
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Return `(auto_rows, pending_rows)` with the full RELATION_COLUMNS schema."""
    auto_rows: list[dict[str, str]] = []
    pending_rows: list[dict[str, str]] = []
    taken: set[str] = set()

    joined = unique_price_join(google, yahoo)
    if not joined.empty:
        grouped = joined.groupby(["person", "firm"], as_index=False).size().rename(columns={"size": "n"})
        totals = grouped.groupby("person")["n"].transform("sum")
        grouped["share"] = grouped["n"] / totals
        for _, row in _best_firm_rows(grouped).iterrows():
            bucket = _bucket(float(row["share"]), int(row["n"]))
            if not bucket:
                continue
            person_id, firm_id = _ids(row["person"], row["firm"], person_slug_by_canonical, firm_slug_by_canonical)
            evidence = joined[(joined["person"] == row["person"]) & (joined["firm"] == row["firm"])]
            payload = dict(
                person_id=person_id,
                firm_id=firm_id,
                rule=bucket,
                support_n=int(row["n"]),
                support_share=float(row["share"]),
                confirmed_by_agent="yes" if bucket == "exact_price_strong" else "",
                agent_notes="",
                evidence_sample=_evidence_sample(evidence),
                source_search="etl",
            )
            taken.add(person_id)
            if bucket == "exact_price_strong":
                auto_rows.append(payload)
            else:
                pending_rows.append(payload)

    for pair in _tipranks_best_pairs(tipranks_pairs):
        person_id, firm_id = _ids(pair["person"], pair["firm"], person_slug_by_canonical, firm_slug_by_canonical)
        if person_id in taken:
            continue
        taken.add(person_id)
        auto_rows.append(
            dict(
                person_id=person_id,
                firm_id=firm_id,
                rule="tipranks_json",
                support_n=1,
                support_share=1.0,
                confirmed_by_agent="yes",
                agent_notes="tipranks per-ticker JSON firm column",
                evidence_sample="",
                source_search="tipranks_json",
            )
        )

    auto = pd.DataFrame(auto_rows) if auto_rows else pd.DataFrame(columns=list(RELATION_COLUMNS))
    pending = pd.DataFrame(pending_rows) if pending_rows else pd.DataFrame(columns=list(RELATION_COLUMNS))
    return auto, pending


def merge_auto_relations(existing: pd.DataFrame, auto: pd.DataFrame) -> pd.DataFrame:
    """Keep websearch and manual_override rows; replace every auto rule. One firm per person."""
    web = existing[existing["rule"].isin(PRESERVED_RELATION_RULES)].copy() if not existing.empty else existing
    if not web.empty:
        web = web.drop_duplicates(subset=["person_id"], keep="first")
    reserved = set(web["person_id"]) if not web.empty else set()
    relations = web.reset_index(drop=True) if not web.empty else pd.DataFrame(columns=list(RELATION_COLUMNS))
    if not relations.empty and not auto.empty:
        auto_by_person = auto.set_index("person_id", drop=False)
        for index, row in relations.iterrows():
            if row["person_id"] not in auto_by_person.index:
                continue
            fresh = auto_by_person.loc[row["person_id"]]
            if isinstance(fresh, pd.DataFrame):
                fresh = fresh.iloc[0]
            if str(fresh["firm_id"]) != str(row["firm_id"]):
                continue
            relations.at[index, "support_n"] = str(int(fresh["support_n"]))
            relations.at[index, "support_share"] = f"{float(fresh['support_share']):.4f}"
    for _, row in auto.iterrows():
        if row["person_id"] in reserved:
            continue
        relations = upsert_relation(
            relations,
            person_id=row["person_id"],
            firm_id=row["firm_id"],
            rule=row["rule"],
            support_n=int(row["support_n"]),
            support_share=float(row["support_share"]),
            confirmed_by_agent=str(row["confirmed_by_agent"]),
            agent_notes=str(row["agent_notes"]),
            evidence_sample=str(row["evidence_sample"]),
            source_search=str(row["source_search"]),
        )
    return relations[list(RELATION_COLUMNS)] if not relations.empty else pd.DataFrame(columns=list(RELATION_COLUMNS))


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build person-firm relation candidates.")
    parser.add_argument("--yahoo", type=Path, default=YAHOO_CSV)
    parser.add_argument("--google", type=Path, default=GOOGLE_CSV)
    parser.add_argument("--tipranks", type=Path, default=TIPRANKS_CSV)
    parser.add_argument("--tipranks-json", type=Path, default=TIPRANKS_JSON_DIR)
    parser.add_argument("--firms", type=Path, default=FIRMS_CSV)
    parser.add_argument("--people", type=Path, default=PEOPLE_CSV)
    parser.add_argument("--relations-out", type=Path, default=RELATIONS_CSV)
    parser.add_argument("--pending-out", type=Path, default=CANDIDATES_PENDING_CSV)
    return parser.parse_args(argv)


def _slug_lookup(table) -> dict[str, str]:
    out: dict[str, str] = {}
    for _, row in table.frame.iterrows():
        canonical = row["canonical"]
        if canonical:
            out.setdefault(canonical, row[table.id_column])
    return out


def _rekey_rejected(path: Path) -> None:
    if not path.exists():
        return
    frame = pd.read_csv(path, dtype=str).fillna("")
    if frame.empty or "firm_id" not in frame.columns:
        return
    frame["firm_id"] = frame["firm_id"].map(lambda value: resolve_firm_id(str(value)))
    frame.to_csv(path, index=False)


def main(argv: list[str] | None = None) -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    args = parse_args(argv)

    firms = load_firms(args.firms)
    apply_firm_alias_map(firms)
    firms.save()
    people = load_people(args.people)
    firm_slug_by_canonical = _slug_lookup(firms)
    person_slug_by_canonical = _slug_lookup(people)

    yahoo = _load_source(args.yahoo, normalize_firm, "firm")
    google = _load_source(args.google, normalize_person, "person")
    tipranks_csv = _load_source(args.tipranks, normalize_person, "person")

    start, end = overlap_window({"yahoo": yahoo, "google": google, "tipranks": tipranks_csv})
    logger.info("overlap window: %s to %s", start or "?", end or "?")

    yahoo_window = _in_window(yahoo, start, end).dropna(subset=["projected_price"])
    google_window = _in_window(google, start, end).dropna(subset=["projected_price"])
    yahoo_window = yahoo_window[["ticker", "date", "firm", "projected_price"]]
    google_window = google_window[["ticker", "date", "person", "projected_price"]]

    tipranks_pairs = _tipranks_json_pairs(args.tipranks_json)

    auto, pending = build_candidates(
        google_window,
        yahoo_window,
        tipranks_pairs,
        firm_slug_by_canonical,
        person_slug_by_canonical,
    )

    existing = rekey_firm_ids(load_relations(args.relations_out))
    relations = merge_auto_relations(existing, auto)
    relations = apply_relation_overrides(relations)
    save_relations(relations, args.relations_out)
    _rekey_rejected(CANDIDATES_REJECTED_CSV)

    confirmed_people = {
        row["person_id"]
        for _, row in relations.iterrows()
        if row["confirmed_by_agent"] == "yes"
    }
    pending_rows = []
    for _, row in pending.iterrows():
        if row["person_id"] in confirmed_people:
            continue
        pending_rows.append(row)
    pending_frame = pd.DataFrame(pending_rows, columns=list(RELATION_COLUMNS)) if pending_rows else pd.DataFrame(columns=list(RELATION_COLUMNS))
    args.pending_out.parent.mkdir(parents=True, exist_ok=True)
    pending_frame.sort_values(["person_id", "firm_id"], kind="mergesort").to_csv(
        args.pending_out, index=False, columns=list(RELATION_COLUMNS)
    )

    logger.info(
        "relations=%s pending=%s auto_new=%s tipranks_json=%s strong=%s",
        len(relations),
        len(pending_frame),
        len(auto),
        int((auto["rule"] == "tipranks_json").sum()) if not auto.empty else 0,
        int((auto["rule"] == "exact_price_strong").sum()) if not auto.empty else 0,
    )


if __name__ == "__main__":
    main()
