"""Name normalization and web-hit matching."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from names import (  # noqa: E402
    contains_term,
    firm_first_word,
    last_name,
    normalize_firm,
    normalize_person,
)
from search_providers import SearchHit, build_query, decode_ddg_link, parse_duckduckgo_html, score_results  # noqa: E402


class NormalizePersonTest(unittest.TestCase):
    def test_strips_credentials_and_space(self) -> None:
        self.assertEqual(normalize_person("  Elizabeth Anderson CFA  "), "Elizabeth Anderson")
        self.assertEqual(normalize_person("Matthew Smith, CFA"), "Matthew Smith")
        self.assertEqual(normalize_person("David Smith -CFA"), "David Smith")
        self.assertEqual(normalize_person("Mark Jordan, CFA"), "Mark Jordan")
        self.assertEqual(normalize_person("Foo Bar FCA"), "Foo Bar")
        self.assertEqual(normalize_person("Ada Lovelace Ph.D."), "Ada Lovelace")

    def test_strips_generational_suffixes(self) -> None:
        self.assertEqual(normalize_person("John Smith Jr."), "John Smith")
        self.assertEqual(normalize_person("John Smith Jr"), "John Smith")
        self.assertEqual(normalize_person("John Smith Sr"), "John Smith")
        self.assertEqual(normalize_person("John Smith III"), "John Smith")
        self.assertEqual(normalize_person("John Smith Jr CFA"), "John Smith")

    def test_drops_unknown_analyst(self) -> None:
        self.assertIsNone(normalize_person("Unknown Analyst"))
        self.assertIsNone(normalize_person("  unknown analyst "))
        self.assertIsNone(normalize_person(None))

    def test_cleans_unicode_and_apostrophe(self) -> None:
        self.assertEqual(normalize_person("Chris O`Cull"), "Chris O'Cull")
        self.assertEqual(normalize_person("\u200fAvantika Dhabaria\u200f"), "Avantika Dhabaria")
        self.assertEqual(normalize_person("Daniel Zhu\u200f"), "Daniel Zhu")

    def test_keeps_real_name_tokens(self) -> None:
        self.assertEqual(normalize_person("Mary Ann Lee"), "Mary Ann Lee")
        self.assertEqual(normalize_person("Nicholas Jones"), "Nicholas Jones")
        self.assertEqual(normalize_person("Ana Thomas-Martin"), "Ana Thomas-Martin")

    def test_firm_strip_keeps_words(self) -> None:
        self.assertEqual(normalize_firm("  JP Morgan "), "JP Morgan")
        self.assertEqual(normalize_firm("Keefe, Bruyette & Woods"), "Keefe, Bruyette & Woods")


class HitMatchTest(unittest.TestCase):
    def test_last_name_and_firm_word(self) -> None:
        self.assertEqual(last_name("Yaron Kinar"), "Kinar")
        self.assertEqual(firm_first_word("JP Morgan"), "JP")
        self.assertEqual(firm_first_word("Keefe, Bruyette & Woods"), "Keefe")
        results = [
            SearchHit("Other Bank", "Nothing here", "https://example.com/no"),
            SearchHit("Yaron Kinar", "Analyst at Mizuho Group", "https://www.mizuhogroup.com/yaron"),
        ]
        hits, link = score_results(results, "Yaron Kinar", "Mizuho")
        self.assertEqual(hits, 1)
        self.assertEqual(link, "https://www.mizuhogroup.com/yaron")

    def test_requires_both_terms_and_ignores_substrings(self) -> None:
        results = [
            SearchHit("Mizuho outlook", "No person here", "https://example.com/a"),
            SearchHit("Kinar interview", "Independent research", "https://example.com/b"),
            SearchHit("blacksmith weekly", "Home of Barclays notes", "https://example.com/c"),
        ]
        hits, link = score_results(results, "Jane Smith", "Barclays")
        self.assertEqual((hits, link), (0, ""))
        self.assertFalse(contains_term("blacksmith", "Smith"))
        self.assertFalse(contains_term("Home", "Ho"))
        self.assertTrue(contains_term("Jane Smith at Barclays", "Smith"))

    def test_only_top_five_count(self) -> None:
        filler = [SearchHit("noise", "noise", "https://example.com/n") for _ in range(5)]
        late = SearchHit("Yaron Kinar joins Mizuho", "analyst", "https://example.com/late")
        hits, link = score_results(filler + [late], "Yaron Kinar", "Mizuho")
        self.assertEqual((hits, link), (0, ""))

    def test_query_and_ddg_link(self) -> None:
        self.assertEqual(build_query("Yaron Kinar", "Mizuho"), '"Yaron Kinar" "Mizuho" analyst')
        html = """
        <a class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.mizuhogroup.com%2Fa">
          Yaron Kinar - Mizuho
        </a>
        <a class="result__snippet">Analyst Yaron Kinar at Mizuho</a>
        """
        parsed = parse_duckduckgo_html(html)
        self.assertEqual(len(parsed), 1)
        self.assertEqual(parsed[0].link, "https://www.mizuhogroup.com/a")
        self.assertIn("Kinar", parsed[0].title)
        self.assertEqual(
            decode_ddg_link("//duckduckgo.com/l/?uddg=https%3A%2F%2Fwww.example.com%2Fx"),
            "https://www.example.com/x",
        )
        hits, link = score_results(parsed, "Yaron Kinar", "Mizuho")
        self.assertEqual(hits, 1)
        self.assertEqual(link, "https://www.mizuhogroup.com/a")


if __name__ == "__main__":
    unittest.main()
