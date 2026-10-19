"""SQLite cache of web searches so reruns skip finished person/firm pairs."""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


@dataclass(frozen=True)
class CachedSearch:
    web_hits: int
    web_link: str
    web_verified: bool


class SearchCache:
    def __init__(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        self.path = path
        self.conn = sqlite3.connect(path)
        self.conn.execute(
            """
            CREATE TABLE IF NOT EXISTS search_cache (
                analyst_google TEXT NOT NULL,
                analyst_yahoo TEXT NOT NULL,
                query TEXT NOT NULL,
                provider TEXT NOT NULL,
                web_hits INTEGER NOT NULL,
                web_link TEXT,
                web_verified INTEGER NOT NULL,
                checked_at TEXT NOT NULL,
                PRIMARY KEY (analyst_google, analyst_yahoo)
            )
            """
        )
        self.conn.commit()

    def get(self, person: str, firm: str) -> CachedSearch | None:
        row = self.conn.execute(
            """
            SELECT web_hits, web_link, web_verified
            FROM search_cache
            WHERE analyst_google = ? AND analyst_yahoo = ?
            """,
            (person, firm),
        ).fetchone()
        if row is None:
            return None
        return CachedSearch(web_hits=int(row[0]), web_link=row[1] or "", web_verified=bool(row[2]))

    def put(
        self,
        person: str,
        firm: str,
        query: str,
        provider: str,
        web_hits: int,
        web_link: str,
        web_verified: bool,
    ) -> None:
        self.conn.execute(
            """
            INSERT OR REPLACE INTO search_cache (
                analyst_google, analyst_yahoo, query, provider,
                web_hits, web_link, web_verified, checked_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                person,
                firm,
                query,
                provider,
                int(web_hits),
                web_link,
                1 if web_verified else 0,
                datetime.now(timezone.utc).isoformat(),
            ),
        )
        self.conn.commit()

    def close(self) -> None:
        self.conn.close()
