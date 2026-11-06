"""Round-trip the pending candidates through a confirmation subagent.

    --emit batch.json      write up to N pending rows as a JSON prompt
    --ingest answered.json  read decisions, update relations.csv and the
                             rejected list, then shrink pending

The subagent must return one object per row with: person, firm, confirmed
(yes/no/unknown), url (first supporting link), note (one line of reasoning
based on explicit knowledge from the search results).
"""

from __future__ import annotations

import argparse
import json
import logging
from pathlib import Path

import pandas as pd

from entities import (
    RELATION_COLUMNS,
    keep_one_firm,
    load_firms,
    load_people,
    load_relations,
    resolve_firm_id,
    save_relations,
    upsert_relation,
)
from paths import (
    CANDIDATES_PENDING_CSV,
    CANDIDATES_REJECTED_CSV,
    FIRMS_CSV,
    PEOPLE_CSV,
    RELATIONS_CSV,
)

logger = logging.getLogger("combine_sources.confirm_candidates")

REJECTED_COLUMNS = (
    "person_id",
    "firm_id",
    "person",
    "firm",
    "rule",
    "support_n",
    "support_share",
    "url",
    "note",
    "rejected_at",
)


def _canonical_lookup(table) -> dict[str, str]:
    out: dict[str, str] = {}
    for _, row in table.frame.iterrows():
        if row[table.id_column]:
            out[row[table.id_column]] = row["canonical"]
    return out


def _load_pending(path: Path) -> pd.DataFrame:
    if not path.exists():
        return pd.DataFrame(columns=list(RELATION_COLUMNS))
    frame = pd.read_csv(path, dtype=str).fillna("")
    for column in RELATION_COLUMNS:
        if column not in frame.columns:
            frame[column] = ""
    return frame[list(RELATION_COLUMNS)]


def emit_batch(pending: pd.DataFrame, firms, people, limit: int) -> list[dict[str, object]]:
    firm_names = _canonical_lookup(firms)
    person_names = _canonical_lookup(people)
    batch: list[dict[str, object]] = []
    for _, row in pending.head(limit).iterrows():
        firm_id = resolve_firm_id(row["firm_id"])
        person_id = row["person_id"]
        person_name = person_names.get(person_id, person_id)
        firm_name = firm_names.get(firm_id, firm_id)
        batch.append(
            {
                "person_id": person_id,
                "firm_id": firm_id,
                "person": person_name,
                "firm": firm_name,
                "rule": row["rule"],
                "support_n": int(row["support_n"] or 0),
                "support_share": float(row["support_share"] or 0.0),
                "query_suggestions": [
                    f'"{person_name}" "{firm_name}" analyst',
                    f'"{person_name}" analyst',
                ],
            }
        )
    return batch


def ingest_answers(
    answers: list[dict[str, object]],
    pending: pd.DataFrame,
    relations: pd.DataFrame,
    rejected_path: Path,
) -> tuple[pd.DataFrame, pd.DataFrame, int, int]:
    answered_keys: set[tuple[str, str]] = set()
    confirmed = 0
    rejected = 0
    rejected_rows: list[dict[str, str]] = []

    for answer in answers:
        person_id = str(answer.get("person_id") or "")
        firm_id = resolve_firm_id(str(answer.get("firm_id") or ""))
        if not person_id or not firm_id:
            continue
        decision = str(answer.get("confirmed") or "").strip().lower()
        key = (person_id, firm_id)
        answered_keys.add(key)
        pending_firm = pending["firm_id"].map(lambda value: resolve_firm_id(str(value))) if not pending.empty else pending["firm_id"]
        row_mask = (pending["person_id"] == person_id) & (pending_firm == firm_id)
        if not row_mask.any():
            continue
        pending_row = pending[row_mask].iloc[0]
        if decision == "yes":
            relations = upsert_relation(
                relations,
                person_id=person_id,
                firm_id=firm_id,
                rule="websearch_candidate",
                support_n=int(pending_row["support_n"] or 0),
                support_share=float(pending_row["support_share"] or 0.0),
                confirmed_by_agent="yes",
                agent_notes=str(answer.get("note") or ""),
                evidence_sample=str(answer.get("url") or ""),
                source_search="websearch",
            )
            relations = keep_one_firm(relations, person_id, firm_id)
            confirmed += 1
        else:
            rejected += 1
            rejected_rows.append(
                {
                    "person_id": person_id,
                    "firm_id": firm_id,
                    "person": str(answer.get("person") or ""),
                    "firm": str(answer.get("firm") or ""),
                    "rule": str(pending_row["rule"]),
                    "support_n": str(pending_row["support_n"]),
                    "support_share": str(pending_row["support_share"]),
                    "url": str(answer.get("url") or ""),
                    "note": str(answer.get("note") or ""),
                    "rejected_at": pd.Timestamp.utcnow().strftime("%Y-%m-%d"),
                }
            )

    if rejected_rows:
        new = pd.DataFrame(rejected_rows, columns=list(REJECTED_COLUMNS))
        if rejected_path.exists():
            existing = pd.read_csv(rejected_path, dtype=str).fillna("")
            new = pd.concat([existing, new], ignore_index=True)
        rejected_path.parent.mkdir(parents=True, exist_ok=True)
        new.drop_duplicates(subset=["person_id", "firm_id"], keep="last").sort_values(
            ["person_id", "firm_id"], kind="mergesort"
        ).to_csv(rejected_path, index=False, columns=list(REJECTED_COLUMNS))

    keep_mask = ~pending.apply(
        lambda row: (row["person_id"], resolve_firm_id(row["firm_id"])) in answered_keys, axis=1
    )
    pending = pending.loc[keep_mask].reset_index(drop=True)
    return relations, pending, confirmed, rejected


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Confirm pending person-firm candidates.")
    parser.add_argument("--pending", type=Path, default=CANDIDATES_PENDING_CSV)
    parser.add_argument("--relations", type=Path, default=RELATIONS_CSV)
    parser.add_argument("--rejected", type=Path, default=CANDIDATES_REJECTED_CSV)
    parser.add_argument("--firms", type=Path, default=FIRMS_CSV)
    parser.add_argument("--people", type=Path, default=PEOPLE_CSV)
    parser.add_argument("--emit", type=Path, help="write a batch JSON for the subagent")
    parser.add_argument("--ingest", type=Path, help="read answered JSON from the subagent")
    parser.add_argument("--limit", type=int, default=20, help="rows per --emit batch")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    args = parse_args(argv)
    if not args.emit and not args.ingest:
        raise SystemExit("pass --emit PATH or --ingest PATH")

    firms = load_firms(args.firms)
    people = load_people(args.people)
    pending = _load_pending(args.pending)
    relations = load_relations(args.relations)

    if args.emit:
        batch = emit_batch(pending, firms, people, args.limit)
        args.emit.parent.mkdir(parents=True, exist_ok=True)
        args.emit.write_text(json.dumps(batch, indent=2))
        logger.info("wrote %s rows=%s", args.emit, len(batch))

    if args.ingest:
        try:
            answers = json.loads(args.ingest.read_text())
        except (OSError, json.JSONDecodeError) as exc:
            raise SystemExit(f"could not read answers: {exc}")
        if not isinstance(answers, list):
            raise SystemExit("answers file must be a JSON list")
        relations, pending, confirmed, rejected = ingest_answers(
            answers, pending, relations, args.rejected
        )
        save_relations(relations, args.relations)
        args.pending.parent.mkdir(parents=True, exist_ok=True)
        pending.sort_values(["person_id", "firm_id"], kind="mergesort").to_csv(
            args.pending, index=False, columns=list(RELATION_COLUMNS)
        )
        logger.info("ingested confirmed=%s rejected=%s remaining=%s", confirmed, rejected, len(pending))


if __name__ == "__main__":
    main()
