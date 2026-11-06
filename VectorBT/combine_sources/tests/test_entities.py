"""Slug stability, alias merge, candidate thresholds, overlap window."""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from candidates import build_candidates, merge_auto_relations, overlap_window, unique_price_join  # noqa: E402
from entities import (  # noqa: E402
    apply_firm_alias_map,
    apply_relation_overrides,
    keep_one_firm,
    load_firms,
    load_people,
    load_relations,
    rekey_firm_ids,
    resolve_firm_id,
    slug,
    upsert_relation,
)


class SlugTest(unittest.TestCase):
    def test_variants_collapse(self) -> None:
        self.assertEqual(slug("J.P. Morgan"), "j-p-morgan")
        self.assertEqual(slug("JP Morgan"), "jp-morgan")
        self.assertEqual(slug("Keefe, Bruyette & Woods"), "keefe-bruyette-and-woods")
        self.assertEqual(slug("Yaron Kinar"), "yaron-kinar")


class AliasMergeTest(unittest.TestCase):
    def test_source_priority_and_dedupe(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "firms.csv"
            table = load_firms(path)
            created = table.upsert("jp-morgan", "J.P. Morgan", "tipranks", "J.P. Morgan")
            self.assertTrue(created)
            created_again = table.upsert("jp-morgan", "JP Morgan", "yahoo", "JP Morgan")
            self.assertFalse(created_again)
            table.upsert("jp-morgan", "JP Morgan", "yahoo", "JP Morgan")  # dedupe
            table.save()

            reloaded = load_firms(path)
            row = reloaded.frame[reloaded.frame["firm_id"] == "jp-morgan"].iloc[0]
            self.assertEqual(row["canonical"], "JP Morgan")  # yahoo wins
            self.assertEqual(row["source"], "yahoo")
            self.assertEqual(row["yahoo_aliases"], "JP Morgan")
            self.assertEqual(row["tipranks_aliases"], "J.P. Morgan")


class CandidateThresholdTest(unittest.TestCase):
    def _frames(self):
        google_rows = []
        yahoo_rows = []
        # Strong: Yaron Kinar + Mizuho, 4 matches, share 1.0
        for i in range(4):
            google_rows.append({"ticker": f"K{i}", "date": "2026-01-01", "person": "Yaron Kinar", "projected_price": 100.0})
            yahoo_rows.append({"ticker": f"K{i}", "date": "2026-01-01", "firm": "Mizuho", "projected_price": 100.0})
        # Unique: Julian Mitchell + Barclays, 8 matches
        for i in range(8):
            google_rows.append({"ticker": f"B{i}", "date": "2026-02-01", "person": "Julian Mitchell", "projected_price": 50.0})
            yahoo_rows.append({"ticker": f"B{i}", "date": "2026-02-01", "firm": "Barclays", "projected_price": 50.0})
        # Shared price on same ticker/date: do not count as JP Morgan
        for i in range(5):
            google_rows.append({"ticker": f"J{i}", "date": "2026-03-01", "person": "Julian Mitchell", "projected_price": 40.0})
            yahoo_rows.append({"ticker": f"J{i}", "date": "2026-03-01", "firm": "JP Morgan", "projected_price": 40.0})
            yahoo_rows.append({"ticker": f"J{i}", "date": "2026-03-01", "firm": "Goldman Sachs", "projected_price": 40.0})
        # Dropped: Matthew O'Neill, 1 match (n < 2)
        google_rows.append({"ticker": "V", "date": "2026-10-13", "person": "Matthew O'Neill", "projected_price": 430.0})
        yahoo_rows.append({"ticker": "V", "date": "2026-10-13", "firm": "Baird", "projected_price": 430.0})
        google = pd.DataFrame(google_rows)
        yahoo = pd.DataFrame(yahoo_rows)
        return google, yahoo

    def test_strong_weak_and_dropped(self) -> None:
        google, yahoo = self._frames()
        auto, pending = build_candidates(
            google,
            yahoo,
            tipranks_pairs=[],
            firm_slug_by_canonical={},
            person_slug_by_canonical={},
        )
        rules = set(auto["rule"]) if not auto.empty else set()
        self.assertIn("exact_price_strong", rules)
        yaron = auto[auto["person_id"] == slug("Yaron Kinar")].iloc[0]
        self.assertEqual(yaron["firm_id"], "mizuho-securities")
        self.assertEqual(int(yaron["support_n"]), 4)
        self.assertEqual(yaron["rule"], "exact_price_strong")

        auto_keys = {(row["person_id"], row["firm_id"]) for _, row in auto.iterrows()}
        self.assertIn((slug("Julian Mitchell"), slug("Barclays")), auto_keys)
        julian = auto[auto["person_id"] == slug("Julian Mitchell")].iloc[0]
        self.assertEqual(julian["rule"], "exact_price_strong")
        self.assertEqual(int(julian["support_n"]), 8)
        self.assertEqual(float(julian["support_share"]), 1.0)
        self.assertNotIn((slug("Julian Mitchell"), "j-p-morgan"), auto_keys)
        self.assertTrue(pending.empty)
        self.assertNotIn((slug("Matthew O'Neill"), "robert-w-baird"), auto_keys)

    def test_shared_price_on_same_ticker_date_is_dropped(self) -> None:
        google = pd.DataFrame(
            [
                {"ticker": "AAPL", "date": "2026-01-01", "person": "Alice", "projected_price": 100.0},
                {"ticker": "AAPL", "date": "2026-01-01", "person": "Bob", "projected_price": 100.0},
            ]
        )
        yahoo = pd.DataFrame(
            [{"ticker": "AAPL", "date": "2026-01-01", "firm": "Citi", "projected_price": 100.0}]
        )
        self.assertTrue(unique_price_join(google, yahoo).empty)

    def test_tipranks_skipped_when_unique_price_exists(self) -> None:
        google, yahoo = self._frames()
        auto, _ = build_candidates(
            google,
            yahoo,
            tipranks_pairs=[{"person": "Julian Mitchell", "firm": "J.P. Morgan"}],
            firm_slug_by_canonical={},
            person_slug_by_canonical={},
        )
        julian = auto[auto["person_id"] == slug("Julian Mitchell")]
        self.assertEqual(len(julian), 1)
        self.assertEqual(julian.iloc[0]["firm_id"], slug("Barclays"))
        self.assertEqual(julian.iloc[0]["rule"], "exact_price_strong")

    def test_tipranks_json_pair_always_wins(self) -> None:
        google, yahoo = self._frames()
        tipranks_pairs = [{"person": "Christine Cho", "firm": "Goldman Sachs"}]
        auto, _ = build_candidates(
            google,
            yahoo,
            tipranks_pairs=tipranks_pairs,
            firm_slug_by_canonical={},
            person_slug_by_canonical={},
        )
        rules = auto[(auto["person_id"] == slug("Christine Cho")) & (auto["firm_id"] == slug("Goldman Sachs"))]
        self.assertEqual(len(rules), 1)
        self.assertEqual(rules.iloc[0]["rule"], "tipranks_json")
        self.assertEqual(rules.iloc[0]["confirmed_by_agent"], "yes")


class OverlapWindowTest(unittest.TestCase):
    def test_latest_start_earliest_end(self) -> None:
        yahoo = pd.DataFrame({"date": ["2025-01-01", "2026-01-01"]})
        google = pd.DataFrame({"date": ["2025-06-01", "2026-06-01"]})
        tipranks = pd.DataFrame({"date": ["2024-01-01", "2025-12-01"]})
        start, end = overlap_window({"y": yahoo, "g": google, "t": tipranks})
        self.assertEqual(start, "2025-06-01")
        self.assertEqual(end, "2025-12-01")


class RelationUpsertTest(unittest.TestCase):
    def test_upsert_replaces_in_place(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "relations.csv"
            relations = load_relations(path)
            relations = upsert_relation(
                relations,
                person_id="yaron-kinar",
                firm_id="mizuho",
                rule="exact_price_weak",
                support_n=2,
                support_share=0.5,
                confirmed_by_agent="",
                agent_notes="",
                evidence_sample="",
                source_search="etl",
            )
            relations = upsert_relation(
                relations,
                person_id="yaron-kinar",
                firm_id="mizuho",
                rule="exact_price_strong",
                support_n=11,
                support_share=1.0,
                confirmed_by_agent="yes",
                agent_notes="",
                evidence_sample="K0@2026-01-01",
                source_search="etl",
            )
            self.assertEqual(len(relations), 1)
            row = relations.iloc[0]
            self.assertEqual(row["rule"], "exact_price_strong")
            self.assertEqual(row["support_n"], "11")


class OneFirmTest(unittest.TestCase):
    def test_keep_one_firm_drops_the_other(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            relations = load_relations(Path(tmp) / "relations.csv")
        relations = upsert_relation(
            relations, person_id="julian-mitchell", firm_id="barclays", rule="websearch_candidate",
            support_n=8, support_share=1.0, confirmed_by_agent="yes", agent_notes="",
            evidence_sample="", source_search="websearch",
        )
        relations = upsert_relation(
            relations, person_id="julian-mitchell", firm_id="j-p-morgan", rule="tipranks_json",
            support_n=1, support_share=1.0, confirmed_by_agent="yes", agent_notes="",
            evidence_sample="", source_search="tipranks_json",
        )
        relations = keep_one_firm(relations, "julian-mitchell", "barclays")
        self.assertEqual(list(relations["firm_id"]), ["barclays"])

    def test_merge_replaces_stale_tipranks(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            existing = load_relations(Path(tmp) / "relations.csv")
        existing = upsert_relation(
            existing, person_id="julian-mitchell", firm_id="j-p-morgan", rule="tipranks_json",
            support_n=1, support_share=1.0, confirmed_by_agent="yes",
            agent_notes="", evidence_sample="", source_search="tipranks_json",
        )
        existing = upsert_relation(
            existing, person_id="julian-mitchell", firm_id="barclays", rule="websearch_candidate",
            support_n=8, support_share=0.6154, confirmed_by_agent="yes",
            agent_notes="Barclays", evidence_sample="", source_search="websearch",
        )
        auto = pd.DataFrame(
            [{
                "person_id": "julian-mitchell", "firm_id": "barclays", "rule": "exact_price_strong",
                "support_n": 8, "support_share": 1.0, "confirmed_by_agent": "yes",
                "agent_notes": "", "evidence_sample": "", "source_search": "etl",
            }]
        )
        merged = merge_auto_relations(existing, auto)
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged.iloc[0]["firm_id"], "barclays")
        self.assertEqual(merged.iloc[0]["rule"], "websearch_candidate")
        self.assertEqual(merged.iloc[0]["support_n"], "8")
        self.assertEqual(merged.iloc[0]["support_share"], "1.0000")

    def test_merge_preserves_manual_override(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            existing = load_relations(Path(tmp) / "relations.csv")
        existing = upsert_relation(
            existing, person_id="julian-mitchell", firm_id="j-p-morgan", rule="manual_override",
            support_n=1, support_share=1.0, confirmed_by_agent="yes",
            agent_notes="override", evidence_sample="", source_search="manual",
        )
        auto = pd.DataFrame(
            [{
                "person_id": "julian-mitchell", "firm_id": "barclays", "rule": "exact_price_strong",
                "support_n": 8, "support_share": 1.0, "confirmed_by_agent": "yes",
                "agent_notes": "", "evidence_sample": "", "source_search": "etl",
            }]
        )
        merged = merge_auto_relations(existing, auto)
        self.assertEqual(len(merged), 1)
        self.assertEqual(merged.iloc[0]["firm_id"], "j-p-morgan")
        self.assertEqual(merged.iloc[0]["rule"], "manual_override")


class ResolveFirmIdTest(unittest.TestCase):
    def test_aliases_resolve_and_kbw_stays_off_stifel(self) -> None:
        self.assertEqual(resolve_firm_id(slug("JP Morgan")), "j-p-morgan")
        self.assertEqual(resolve_firm_id(slug("J.P. Morgan")), "j-p-morgan")
        self.assertEqual(resolve_firm_id(slug("Citi")), "citigroup")
        self.assertEqual(resolve_firm_id(slug("Citigroup")), "citigroup")
        self.assertEqual(resolve_firm_id(slug("Keefe, Bruyette & Woods")), "kbw")
        self.assertEqual(resolve_firm_id(slug("Stifel")), "stifel-nicolaus")
        self.assertNotEqual(resolve_firm_id("kbw"), resolve_firm_id(slug("Stifel")))
        self.assertEqual(resolve_firm_id(slug("Freedom Broker")), "freedom-broker")


class FirmAliasMapTest(unittest.TestCase):
    def test_merge_jp_morgan_rows(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "firms.csv"
            table = load_firms(path)
            table.upsert("jp-morgan", "JP Morgan", "yahoo", "JP Morgan")
            table.upsert("j-p-morgan", "J.P. Morgan", "tipranks", "J.P. Morgan")
            apply_firm_alias_map(table)
            self.assertEqual(len(table.frame), 1)
            row = table.frame.iloc[0]
            self.assertEqual(row["firm_id"], "j-p-morgan")
            self.assertEqual(row["canonical"], "J.P. Morgan")
            self.assertEqual(row["yahoo_aliases"], "JP Morgan")
            self.assertEqual(row["tipranks_aliases"], "J.P. Morgan")


class RekeyFirmIdsTest(unittest.TestCase):
    def test_two_people_stay_two(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            relations = load_relations(Path(tmp) / "relations.csv")
        relations = upsert_relation(
            relations, person_id="alice", firm_id="jp-morgan", rule="tipranks_json",
            support_n=1, support_share=1.0, confirmed_by_agent="yes",
            agent_notes="", evidence_sample="", source_search="tipranks_json",
        )
        relations = upsert_relation(
            relations, person_id="bob", firm_id="j-p-morgan", rule="tipranks_json",
            support_n=1, support_share=1.0, confirmed_by_agent="yes",
            agent_notes="", evidence_sample="", source_search="tipranks_json",
        )
        out = rekey_firm_ids(relations)
        self.assertEqual(len(out), 2)
        self.assertEqual(set(out["person_id"]), {"alice", "bob"})
        self.assertEqual(set(out["firm_id"]), {"j-p-morgan"})

    def test_same_person_both_slugs_collapses(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            relations = load_relations(Path(tmp) / "relations.csv")
        relations = upsert_relation(
            relations, person_id="alice", firm_id="jp-morgan", rule="tipranks_json",
            support_n=1, support_share=1.0, confirmed_by_agent="yes",
            agent_notes="", evidence_sample="", source_search="tipranks_json",
        )
        relations = upsert_relation(
            relations, person_id="alice", firm_id="j-p-morgan", rule="websearch_candidate",
            support_n=2, support_share=1.0, confirmed_by_agent="yes",
            agent_notes="", evidence_sample="", source_search="websearch",
        )
        out = rekey_firm_ids(relations)
        self.assertEqual(len(out), 1)
        self.assertEqual(out.iloc[0]["person_id"], "alice")
        self.assertEqual(out.iloc[0]["firm_id"], "j-p-morgan")
        self.assertEqual(out.iloc[0]["rule"], "websearch_candidate")


class RelationOverrideTest(unittest.TestCase):
    def test_julian_set_jack_dropped_idempotent(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            existing = load_relations(Path(tmp) / "relations.csv")
        existing = upsert_relation(
            existing, person_id="julian-mitchell", firm_id="barclays", rule="websearch_candidate",
            support_n=8, support_share=1.0, confirmed_by_agent="yes",
            agent_notes="Barclays", evidence_sample="", source_search="websearch",
        )
        existing = upsert_relation(
            existing, person_id="jack-meehan", firm_id="nephron", rule="tipranks_json",
            support_n=1, support_share=1.0, confirmed_by_agent="yes",
            agent_notes="", evidence_sample="", source_search="tipranks_json",
        )
        auto = pd.DataFrame(
            [
                {
                    "person_id": "julian-mitchell", "firm_id": "barclays", "rule": "exact_price_strong",
                    "support_n": 8, "support_share": 1.0, "confirmed_by_agent": "yes",
                    "agent_notes": "", "evidence_sample": "", "source_search": "etl",
                },
                {
                    "person_id": "jack-meehan", "firm_id": "nephron", "rule": "tipranks_json",
                    "support_n": 1, "support_share": 1.0, "confirmed_by_agent": "yes",
                    "agent_notes": "tipranks per-ticker JSON firm column", "evidence_sample": "",
                    "source_search": "tipranks_json",
                },
            ]
        )
        merged = apply_relation_overrides(merge_auto_relations(existing, auto))
        again = apply_relation_overrides(merge_auto_relations(merged, auto))
        for frame in (merged, again):
            self.assertEqual(len(frame), 1)
            row = frame.iloc[0]
            self.assertEqual(row["person_id"], "julian-mitchell")
            self.assertEqual(row["firm_id"], "j-p-morgan")
            self.assertEqual(row["rule"], "manual_override")
            self.assertNotIn("jack-meehan", set(frame["person_id"]))


if __name__ == "__main__":
    unittest.main()
