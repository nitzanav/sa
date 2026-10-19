"""Normalize analyst person names and firm tokens."""

from __future__ import annotations

import re
import unicodedata

# Trailing credentials and generational suffixes, compared without dots.
_SUFFIXES = {
    "cfa",
    "fca",
    "cpa",
    "cfp",
    "caia",
    "frm",
    "mba",
    "phd",
    "md",
    "esq",
    "jr",
    "sr",
    "ii",
    "iii",
    "iv",
    "cmt",
    "chfc",
    "clu",
    "acca",
}

_UNKNOWN = "unknown analyst"


def _clean_text(name: object, *, commas_to_space: bool) -> str | None:
    if name is None:
        return None
    if isinstance(name, float):
        return None
    text = unicodedata.normalize("NFKC", str(name))
    text = "".join(ch for ch in text if unicodedata.category(ch) not in {"Cf", "Cc"})
    text = text.replace("`", "'").replace("’", "'").replace("‘", "'")
    if commas_to_space:
        text = text.replace(",", " ")
    text = re.sub(r"\s+", " ", text).strip()
    return text or None


def _is_suffix(token: str) -> bool:
    core = token.strip(".").lstrip("-").lower().replace(".", "")
    return core in _SUFFIXES


def normalize_person(name: object) -> str | None:
    """Strip a Google person name down to the name, or return None to drop it.

    Drops "Unknown Analyst". Removes trailing credentials (CFA, FCA, PhD, ...)
    and generational suffixes (Jr, Sr, III).
    """
    text = _clean_text(name, commas_to_space=True)
    if text is None or text.casefold() == _UNKNOWN:
        return None
    tokens = text.split(" ")
    while tokens and _is_suffix(tokens[-1]):
        tokens.pop()
    cleaned = " ".join(tokens).strip()
    return cleaned or None


def normalize_firm(name: object) -> str | None:
    """Strip a Yahoo firm name. Firm words themselves stay intact."""
    return _clean_text(name, commas_to_space=False)


def last_name(person: str) -> str:
    parts = person.split()
    return parts[-1] if parts else ""


def firm_first_word(firm: str) -> str:
    parts = firm.split()
    if not parts:
        return ""
    return parts[0].strip(".,&")


def contains_term(text: str, term: str) -> bool:
    """True when term appears as its own word, case-insensitive."""
    if not term:
        return False
    pattern = rf"(?<!\w){re.escape(term)}(?!\w)"
    return re.search(pattern, text, flags=re.IGNORECASE) is not None
