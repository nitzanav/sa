"""Repo paths for the Google/Yahoo analyst pipeline."""

from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = REPO_ROOT / "data" / "analyst_recomendation"
GOOGLE_CSV = DATA_DIR / "google" / "all_symbols.csv"
YAHOO_CSV = DATA_DIR / "yahoo" / "all_symbols.csv"
TIPRANKS_CSV = DATA_DIR / "tipranks" / "all_symbols.csv"
TIPRANKS_JSON_DIR = DATA_DIR / "tipranks"
ANALYST_MAP_CSV = DATA_DIR / "analyst_map.csv"
ANALYST_MAP_WEB_CSV = DATA_DIR / "analyst_map_web_verified.csv"
CACHE_DB = REPO_ROOT / "VectorBT" / ".cache" / "analyst_web_verify.sqlite"

ENTITIES_DIR = DATA_DIR / "entities"
FIRMS_CSV = ENTITIES_DIR / "firms.csv"
PEOPLE_CSV = ENTITIES_DIR / "people.csv"
RELATIONS_CSV = ENTITIES_DIR / "relations.csv"
CANDIDATES_PENDING_CSV = ENTITIES_DIR / "candidates_pending.csv"
CANDIDATES_REJECTED_CSV = ENTITIES_DIR / "candidates_rejected.csv"
ALIASES_UNKNOWN_CSV = ENTITIES_DIR / "aliases_unknown.csv"
