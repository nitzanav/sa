"""Firms, people, and relations stored as small append-only CSVs.

Each entity has one row keyed by a slug. Aliases per source live in separate
columns so we can see where every spelling came from. The canonical name of a
new entity falls back in source order: yahoo, google, tipranks, manual.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

import pandas as pd

SOURCE_PRIORITY = ("yahoo", "google", "tipranks", "manual")
ALIAS_COLUMNS = ("yahoo_aliases", "google_aliases", "tipranks_aliases", "other_aliases")

FIRM_COLUMNS = ("firm_id", "canonical", *ALIAS_COLUMNS, "source", "added_at")
PERSON_COLUMNS = ("person_id", "canonical", *ALIAS_COLUMNS, "source", "added_at")
RELATION_COLUMNS = (
    "person_id",
    "firm_id",
    "rule",
    "support_n",
    "support_share",
    "confirmed_by_agent",
    "agent_notes",
    "evidence_sample",
    "source_search",
    "added_at",
)

FIRM_ALIASES = {
    "jp-morgan": "j-p-morgan",
    "citi": "citigroup",
    "b-of-a-securities": "bank-of-america-securities",
    "evercore-isi-group": "evercore-isi",
    "baird": "robert-w-baird",
    "stifel": "stifel-nicolaus",
    "da-davidson": "d-a-davidson",
    "stephens-and-co": "stephens",
    "mizuho": "mizuho-securities",
    "keefe-bruyette-and-woods": "kbw",
    "truist-financial": "truist-securities",
    "hc-wainwright-and-co": "h-c-wainwright",
    "ladenburg-thalmann": "ladenburg-thalmann-and-co",
    "loop-capital": "loop-capital-markets",
    "rosenblatt": "rosenblatt-securities",
    "telsey-advisory": "telsey-advisory-group",
    "barrington": "barrington-research",
    "berenberg": "berenberg-bank",
    "gordon-haskett": "gordon-haskett-capital-corporation",
    "northland-capital-markets": "northland-securities",
    "roth-capital": "roth-mkm",
    "jmp-securities": "citizens-jmp",
    "citizens": "citizens-jmp",
    "benchmark-co": "benchmark",
}
PREFERRED_FIRM_NAMES = {
    "j-p-morgan": "J.P. Morgan",
    "citigroup": "Citigroup",
    "bank-of-america-securities": "Bank of America Securities",
    "evercore-isi": "Evercore ISI",
    "robert-w-baird": "Robert W. Baird",
    "stifel-nicolaus": "Stifel Nicolaus",
    "d-a-davidson": "D.A. Davidson",
    "stephens": "Stephens",
    "mizuho-securities": "Mizuho Securities",
    "kbw": "KBW",
    "truist-securities": "Truist Securities",
    "h-c-wainwright": "H.C. Wainwright",
    "ladenburg-thalmann-and-co": "Ladenburg Thalmann & Co.",
    "loop-capital-markets": "Loop Capital Markets",
    "rosenblatt-securities": "Rosenblatt Securities",
    "telsey-advisory-group": "Telsey Advisory Group",
    "barrington-research": "Barrington Research",
    "berenberg-bank": "Berenberg Bank",
    "gordon-haskett-capital-corporation": "Gordon Haskett Capital Corporation",
    "northland-securities": "Northland Securities",
    "roth-mkm": "Roth MKM",
    "citizens-jmp": "Citizens JMP",
    "benchmark": "Benchmark",
}
RELATION_OVERRIDES = (
    {"person_id": "julian-mitchell", "action": "set", "firm_id": "j-p-morgan", "rule": "manual_override", "support_n": 1, "support_share": 1.0, "confirmed_by_agent": "yes", "agent_notes": "Joined J.P. Morgan Sep 2026; override stale Barclays websearch.", "evidence_sample": "", "source_search": "manual"},
    {"person_id": "jack-meehan", "action": "drop", "firm_id": "", "rule": "manual_override", "agent_notes": "Left Nephron May 2026 for Operon Research; no sell-side ratings.", "source_search": "manual"},
)
PRESERVED_RELATION_RULES = ("websearch_candidate", "manual_override")
_RULE_RANK = {
    "manual_override": 0,
    "websearch_candidate": 1,
    "exact_price_strong": 2,
    "tipranks_json": 3,
}


def slug(name: str) -> str:
    """Lowercase ASCII hyphen slug. Strips dots, commas, ampersands, and 'the'."""
    if name is None:
        return ""
    text = unicodedata.normalize("NFKD", str(name))
    text = text.encode("ascii", "ignore").decode("ascii").lower()
    text = text.replace("&", " and ")
    text = re.sub(r"[^a-z0-9]+", "-", text).strip("-")
    return re.sub(r"-+", "-", text)


def resolve_firm_id(firm_id: str) -> str:
    """Walk FIRM_ALIASES to the canonical slug. Identity if unlisted."""
    current = str(firm_id or "")
    if not current:
        return current
    seen: set[str] = set()
    while current in FIRM_ALIASES:
        if current in seen:
            break
        seen.add(current)
        current = FIRM_ALIASES[current]
    return current


def _alias_column(source: str) -> str:
    if source in {"yahoo", "google", "tipranks"}:
        return f"{source}_aliases"
    return "other_aliases"


def _split_aliases(raw: object) -> list[str]:
    if raw is None or (isinstance(raw, float) and pd.isna(raw)):
        return []
    text = str(raw).strip()
    if not text:
        return []
    return [piece.strip() for piece in text.split("|") if piece.strip()]


def _join_aliases(aliases: Iterable[str]) -> str:
    seen: list[str] = []
    for alias in aliases:
        if alias and alias not in seen:
            seen.append(alias)
    return "|".join(seen)


def _now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


@dataclass
class EntityTable:
    """A thin wrapper over a CSV so appends and alias merges stay idempotent."""

    path: Path
    id_column: str
    columns: tuple[str, ...]
    frame: pd.DataFrame

    @classmethod
    def load(cls, path: Path, id_column: str, columns: tuple[str, ...]) -> "EntityTable":
        if path.exists():
            frame = pd.read_csv(path, dtype=str).fillna("")
            for column in columns:
                if column not in frame.columns:
                    frame[column] = ""
            frame = frame[list(columns)]
        else:
            frame = pd.DataFrame({column: pd.Series(dtype=str) for column in columns})
        return cls(path=path, id_column=id_column, columns=columns, frame=frame)

    def save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        frame = self.frame.sort_values(self.id_column, kind="mergesort")
        frame.to_csv(self.path, index=False, columns=list(self.columns))

    def contains(self, entity_id: str) -> bool:
        return bool((self.frame[self.id_column] == entity_id).any())

    def row_index(self, entity_id: str) -> int | None:
        hits = self.frame.index[self.frame[self.id_column] == entity_id]
        return int(hits[0]) if len(hits) else None

    def upsert(self, entity_id: str, canonical: str, source: str, alias: str) -> bool:
        """Insert or merge an alias. Returns True if a new entity was created."""
        column = _alias_column(source)
        index = self.row_index(entity_id)
        if index is None:
            row = {name: "" for name in self.columns}
            row[self.id_column] = entity_id
            row["canonical"] = canonical
            row[column] = alias
            row["source"] = source
            row["added_at"] = _now()
            self.frame.loc[len(self.frame)] = row
            return True
        current = _split_aliases(self.frame.at[index, column])
        merged = _join_aliases([*current, alias])
        if merged != self.frame.at[index, column]:
            self.frame.at[index, column] = merged
        if not self.frame.at[index, "canonical"]:
            self.frame.at[index, "canonical"] = canonical
        else:
            existing_source = self.frame.at[index, "source"]
            if _priority(source) < _priority(existing_source):
                self.frame.at[index, "canonical"] = canonical
                self.frame.at[index, "source"] = source
        return False


def apply_firm_alias_map(table: EntityTable) -> None:
    """Merge alias firm rows onto canonical ids and freeze preferred names."""
    if table.frame.empty:
        return
    for alias_id in list(FIRM_ALIASES):
        canonical_id = resolve_firm_id(alias_id)
        if not alias_id or alias_id == canonical_id:
            continue
        alias_idx = table.row_index(alias_id)
        if alias_idx is None:
            continue
        canon_idx = table.row_index(canonical_id)
        if canon_idx is None:
            table.frame.at[alias_idx, table.id_column] = canonical_id
            continue
        for column in ALIAS_COLUMNS:
            table.frame.at[canon_idx, column] = _join_aliases(
                [
                    *_split_aliases(table.frame.at[canon_idx, column]),
                    *_split_aliases(table.frame.at[alias_idx, column]),
                ]
            )
        table.frame = table.frame.drop(index=alias_idx).reset_index(drop=True)
    for firm_id, name in PREFERRED_FIRM_NAMES.items():
        index = table.row_index(firm_id)
        if index is not None:
            table.frame.at[index, "canonical"] = name


def _priority(source: str) -> int:
    try:
        return SOURCE_PRIORITY.index(source)
    except ValueError:
        return len(SOURCE_PRIORITY)


def load_firms(path: Path) -> EntityTable:
    return EntityTable.load(path, "firm_id", FIRM_COLUMNS)


def load_people(path: Path) -> EntityTable:
    return EntityTable.load(path, "person_id", PERSON_COLUMNS)


def load_relations(path: Path) -> pd.DataFrame:
    if path.exists():
        frame = pd.read_csv(path, dtype=str).fillna("")
        for column in RELATION_COLUMNS:
            if column not in frame.columns:
                frame[column] = ""
        return frame[list(RELATION_COLUMNS)]
    return pd.DataFrame({column: pd.Series(dtype=str) for column in RELATION_COLUMNS})


def save_relations(frame: pd.DataFrame, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    frame = frame.sort_values(["person_id", "firm_id"], kind="mergesort")
    frame.to_csv(path, index=False, columns=list(RELATION_COLUMNS))


def relation_key(person_id: str, firm_id: str) -> tuple[str, str]:
    return (person_id, firm_id)


def upsert_relation(
    relations: pd.DataFrame,
    *,
    person_id: str,
    firm_id: str,
    rule: str,
    support_n: int,
    support_share: float,
    confirmed_by_agent: str,
    agent_notes: str,
    evidence_sample: str,
    source_search: str,
) -> pd.DataFrame:
    mask = (relations["person_id"] == person_id) & (relations["firm_id"] == firm_id)
    row = {
        "person_id": person_id,
        "firm_id": firm_id,
        "rule": rule,
        "support_n": str(int(support_n)),
        "support_share": f"{support_share:.4f}",
        "confirmed_by_agent": confirmed_by_agent,
        "agent_notes": agent_notes,
        "evidence_sample": evidence_sample,
        "source_search": source_search,
        "added_at": _now(),
    }
    if mask.any():
        index = int(relations.index[mask][0])
        for key, value in row.items():
            relations.at[index, key] = value
        return relations
    relations.loc[len(relations)] = row
    return relations


def keep_one_firm(relations: pd.DataFrame, person_id: str, firm_id: str) -> pd.DataFrame:
    """Drop every other firm for this person so each person has one relation."""
    if relations.empty:
        return relations
    other = (relations["person_id"] == person_id) & (relations["firm_id"] != firm_id)
    return relations.loc[~other].reset_index(drop=True)


def _rule_rank(rule: object) -> int:
    return _RULE_RANK.get(str(rule), len(_RULE_RANK) + 1)


def _support_n(value: object) -> int:
    try:
        return int(float(value))
    except (TypeError, ValueError):
        return 0


def rekey_firm_ids(frame: pd.DataFrame) -> pd.DataFrame:
    """Map firm_id through aliases; collapse duplicate person-firm rows to one firm."""
    if frame.empty:
        return frame
    out = frame.copy()
    out["firm_id"] = out["firm_id"].map(lambda value: resolve_firm_id(str(value)))
    ranked = out.assign(_rank=out["rule"].map(_rule_rank), _n=out["support_n"].map(_support_n))
    ranked = ranked.sort_values(
        ["person_id", "firm_id", "_rank", "_n"],
        ascending=[True, True, True, False],
        kind="mergesort",
    )
    ranked = ranked.drop_duplicates(subset=["person_id", "firm_id"], keep="first")
    ranked = ranked.sort_values(
        ["person_id", "_rank", "_n"],
        ascending=[True, True, False],
        kind="mergesort",
    )
    winners = ranked.drop_duplicates(subset=["person_id"], keep="first")
    for _, winner in winners.iterrows():
        ranked = keep_one_firm(ranked, str(winner["person_id"]), str(winner["firm_id"]))
    ranked = ranked.drop(columns=["_rank", "_n"], errors="ignore")
    return ranked.reset_index(drop=True)


def apply_relation_overrides(relations: pd.DataFrame) -> pd.DataFrame:
    """Apply RELATION_OVERRIDES: set a firm or drop every relation for a person."""
    out = relations.copy() if not relations.empty else relations
    for override in RELATION_OVERRIDES:
        person_id = str(override.get("person_id") or "")
        if not person_id:
            continue
        action = str(override.get("action") or "")
        if action == "drop":
            if out.empty:
                continue
            out = out.loc[out["person_id"] != person_id].reset_index(drop=True)
            continue
        if action != "set":
            continue
        firm_id = resolve_firm_id(str(override.get("firm_id") or ""))
        if not firm_id:
            continue
        out = upsert_relation(
            out,
            person_id=person_id,
            firm_id=firm_id,
            rule=str(override.get("rule") or "manual_override"),
            support_n=int(override.get("support_n") or 0),
            support_share=float(override.get("support_share") or 0.0),
            confirmed_by_agent=str(override.get("confirmed_by_agent") or ""),
            agent_notes=str(override.get("agent_notes") or ""),
            evidence_sample=str(override.get("evidence_sample") or ""),
            source_search=str(override.get("source_search") or ""),
        )
        out = keep_one_firm(out, person_id, firm_id)
    return out


def record_unknown(path: Path, raws: Iterable[tuple[str, str]]) -> None:
    """Append `(source, raw_name)` pairs we could not classify."""
    rows = [{"source": source, "raw": raw, "seen_at": _now()} for source, raw in raws if raw]
    if not rows:
        return
    path.parent.mkdir(parents=True, exist_ok=True)
    frame = pd.DataFrame(rows)
    if path.exists():
        existing = pd.read_csv(path, dtype=str).fillna("")
        frame = pd.concat([existing, frame], ignore_index=True)
    frame = frame.drop_duplicates(subset=["source", "raw"]).sort_values(["source", "raw"], kind="mergesort")
    frame.to_csv(path, index=False)
