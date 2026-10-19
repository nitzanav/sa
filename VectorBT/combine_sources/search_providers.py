"""Web search providers. Google Custom Search is the default when keys are set."""

from __future__ import annotations

import os
import re
import time
from dataclasses import dataclass
from html.parser import HTMLParser
from typing import Protocol
from urllib.parse import parse_qs, unquote, urlparse

import requests

from names import contains_term, firm_first_word, last_name

GOOGLE_CSE_URL = "https://www.googleapis.com/customsearch/v1"
SERPAPI_URL = "https://serpapi.com/search.json"
BRAVE_URL = "https://api.search.brave.com/res/v1/web/search"
DUCKDUCKGO_URL = "https://html.duckduckgo.com/html/"

_USER_AGENT = "analyst-map-verify/1.0"


@dataclass(frozen=True)
class SearchHit:
    title: str
    snippet: str
    link: str


class SearchError(RuntimeError):
    pass


class SearchProvider(Protocol):
    name: str

    def search(self, query: str) -> list[SearchHit]:
        """Return up to five results."""


def build_query(person: str, firm: str) -> str:
    return f'"{person}" "{firm}" analyst'


def score_results(results: list[SearchHit], person: str, firm: str) -> tuple[int, str]:
    """Count hits in the top 5. A hit contains the last name and the firm's first word."""
    last = last_name(person)
    word = firm_first_word(firm)
    hits = 0
    link = ""
    for result in results[:5]:
        text = f"{result.title} {result.snippet}"
        if contains_term(text, last) and contains_term(text, word):
            hits += 1
            if not link and result.link:
                link = result.link
    return hits, link


def request_with_retry(
    session: requests.Session,
    method: str,
    url: str,
    *,
    retries: int = 5,
    **kwargs: object,
) -> requests.Response:
    delay = 1.0
    last_error: Exception | None = None
    for attempt in range(retries):
        try:
            response = session.request(method, url, timeout=30, **kwargs)  # type: ignore[arg-type]
        except requests.RequestException as exc:
            last_error = exc
            if attempt == retries - 1:
                break
            time.sleep(delay)
            delay = min(delay * 2, 30)
            continue
        if response.status_code == 429 or 500 <= response.status_code <= 599:
            last_error = SearchError(f"{response.status_code} from {url}")
            if attempt == retries - 1:
                break
            time.sleep(delay)
            delay = min(delay * 2, 30)
            continue
        if response.status_code >= 400:
            raise SearchError(f"{response.status_code} from {url}: {response.text[:300]}")
        return response
    raise SearchError(f"search failed after {retries} tries: {last_error}")


class GoogleCseProvider:
    name = "google"

    def __init__(
        self,
        api_key: str,
        cse_id: str,
        session: requests.Session | None = None,
    ) -> None:
        self.api_key = api_key
        self.cse_id = cse_id
        self.session = session or requests.Session()

    def search(self, query: str) -> list[SearchHit]:
        response = request_with_retry(
            self.session,
            "GET",
            GOOGLE_CSE_URL,
            params={"key": self.api_key, "cx": self.cse_id, "q": query, "num": 5},
        )
        payload = response.json()
        hits: list[SearchHit] = []
        for item in payload.get("items") or []:
            hits.append(
                SearchHit(
                    title=str(item.get("title") or ""),
                    snippet=str(item.get("snippet") or ""),
                    link=str(item.get("link") or ""),
                )
            )
        return hits


class SerpApiProvider:
    name = "serpapi"

    def __init__(self, api_key: str, session: requests.Session | None = None) -> None:
        self.api_key = api_key
        self.session = session or requests.Session()

    def search(self, query: str) -> list[SearchHit]:
        response = request_with_retry(
            self.session,
            "GET",
            SERPAPI_URL,
            params={"engine": "google", "q": query, "api_key": self.api_key, "num": 5},
        )
        payload = response.json()
        hits: list[SearchHit] = []
        for item in payload.get("organic_results") or []:
            hits.append(
                SearchHit(
                    title=str(item.get("title") or ""),
                    snippet=str(item.get("snippet") or ""),
                    link=str(item.get("link") or ""),
                )
            )
        return hits


class BraveProvider:
    name = "brave"

    def __init__(self, api_key: str, session: requests.Session | None = None) -> None:
        self.api_key = api_key
        self.session = session or requests.Session()

    def search(self, query: str) -> list[SearchHit]:
        response = request_with_retry(
            self.session,
            "GET",
            BRAVE_URL,
            params={"q": query, "count": 5},
            headers={
                "X-Subscription-Token": self.api_key,
                "Accept": "application/json",
            },
        )
        payload = response.json()
        web = payload.get("web") or {}
        hits: list[SearchHit] = []
        for item in web.get("results") or []:
            hits.append(
                SearchHit(
                    title=str(item.get("title") or ""),
                    snippet=str(item.get("description") or ""),
                    link=str(item.get("url") or ""),
                )
            )
        return hits


def decode_ddg_link(href: str) -> str:
    if not href:
        return ""
    if href.startswith("//"):
        href = "https:" + href
    parsed = urlparse(href)
    uddg = parse_qs(parsed.query).get("uddg")
    if uddg:
        return unquote(uddg[0])
    return href


class _DdgParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.results: list[SearchHit] = []
        self._capture: str | None = None
        self._capture_tag = ""
        self._href = ""
        self._buf: list[str] = []
        self._title = ""
        self._link = ""

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        attr = {key: value or "" for key, value in attrs}
        classes = set(attr.get("class", "").split())
        if "result__a" in classes:
            self._flush_title_only()
            self._capture = "title"
            self._capture_tag = tag
            self._href = attr.get("href", "")
            self._buf = []
        elif "result__snippet" in classes:
            self._capture = "snippet"
            self._capture_tag = tag
            self._buf = []

    def handle_data(self, data: str) -> None:
        if self._capture:
            self._buf.append(data)

    def handle_endtag(self, tag: str) -> None:
        if self._capture is None or tag != self._capture_tag:
            return
        text = re.sub(r"\s+", " ", "".join(self._buf)).strip()
        if self._capture == "title":
            self._title = text
            self._link = decode_ddg_link(self._href)
        elif self._capture == "snippet" and self._title:
            self.results.append(SearchHit(self._title, text, self._link))
            self._title = ""
            self._link = ""
        self._capture = None
        self._buf = []

    def _flush_title_only(self) -> None:
        if self._title:
            self.results.append(SearchHit(self._title, "", self._link))
            self._title = ""
            self._link = ""

    def close(self) -> None:
        self._flush_title_only()
        super().close()


def parse_duckduckgo_html(html: str) -> list[SearchHit]:
    parser = _DdgParser()
    parser.feed(html)
    parser.close()
    return parser.results[:5]


class DuckDuckGoProvider:
    name = "duckduckgo"

    def __init__(self, session: requests.Session | None = None) -> None:
        self.session = session or requests.Session()

    def search(self, query: str) -> list[SearchHit]:
        response = request_with_retry(
            self.session,
            "POST",
            DUCKDUCKGO_URL,
            data={"q": query},
            headers={"User-Agent": _USER_AGENT},
        )
        return parse_duckduckgo_html(response.text)


def make_provider(name: str) -> SearchProvider:
    """Pick a provider. `auto` uses Google, then SerpAPI, then Brave, then DuckDuckGo."""
    choice = name.strip().lower()
    if choice == "auto":
        if os.environ.get("GOOGLE_API_KEY") and os.environ.get("GOOGLE_CSE_ID"):
            choice = "google"
        elif os.environ.get("SERPAPI_KEY"):
            choice = "serpapi"
        elif os.environ.get("BRAVE_API_KEY"):
            choice = "brave"
        else:
            choice = "duckduckgo"

    if choice == "google":
        api_key = os.environ.get("GOOGLE_API_KEY", "")
        cse_id = os.environ.get("GOOGLE_CSE_ID", "")
        if not api_key or not cse_id:
            raise SystemExit("GOOGLE_API_KEY and GOOGLE_CSE_ID are required for --provider google")
        return GoogleCseProvider(api_key, cse_id)
    if choice == "serpapi":
        api_key = os.environ.get("SERPAPI_KEY", "")
        if not api_key:
            raise SystemExit("SERPAPI_KEY is required for --provider serpapi")
        return SerpApiProvider(api_key)
    if choice == "brave":
        api_key = os.environ.get("BRAVE_API_KEY", "")
        if not api_key:
            raise SystemExit("BRAVE_API_KEY is required for --provider brave")
        return BraveProvider(api_key)
    if choice == "duckduckgo":
        return DuckDuckGoProvider()
    raise SystemExit(f"unknown search provider: {name}")
