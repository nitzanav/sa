"""Bucket assignment for compare_tipranks."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from compare_tipranks import assign_buckets  # noqa: E402
from names import normalize_person  # noqa: E402


def _frame(rows: list[tuple]) -> pd.DataFrame:
    df = pd.DataFrame(rows, columns=["date", "ticker", "analyst", "percent", "projected_price"])
    df["date"] = pd.to_datetime(df["date"])
    df["person"] = df["analyst"].map(normalize_person)
    return df


class AssignBucketsTest(unittest.TestCase):
    def test_bucket_priority(self) -> None:
        google = _frame(
            [
                ("2026-03-01", "AAA", "Jane Smith CFA", 10.0, 100.0),  # exact + lag source
                ("2026-03-02", "BBB", "John Doe", 5.0, 50.0),  # within 7d
                ("2026-03-10", "CCC", "Pat Lee", 0.0, 70.0),  # same day diff price
                ("2026-02-15", "DDD", "Mia Fox", 0.0, 123.0),  # person+ticker, different day
                ("2026-03-20", "EEE", "Sam Ray", 0.0, 999.0),  # noise so EEE has a Google row
            ]
        )
        yahoo = _frame(
            [
                ("2026-03-21", "FFF", "Barclays", None, 80.0),  # yahoo price match
            ]
        )
        tipranks = _frame(
            [
                ("2026-03-01", "AAA", "Jane Smith", None, 100.0),       # exact_google
                ("2026-03-05", "BBB", "John Doe", None, 50.0),           # google_within_7d
                ("2026-03-10", "CCC", "Pat Lee", None, 71.0),            # same_person_day_diff_price
                ("2026-03-15", "DDD", "Mia Fox", None, 999.0),           # person_ticker_no_price
                ("2026-03-18", "EEE", "Nina Vee", None, 11.0),           # person_absent_from_google
                ("2026-03-20", "FFF", "Someone New", None, 80.0),        # yahoo_price_only
                ("2026-03-25", "ZZZ", "Nobody There", None, 42.0),       # person_absent_from_google
                ("2026-03-26", "AAA", "Unknown Analyst", None, 42.0),    # person=None -> unmatched
            ]
        )

        out = assign_buckets(tipranks, google, yahoo)
        order = out.sort_values(["ticker", "date"]).reset_index(drop=True)
        got = dict(zip(order["ticker"] + "/" + order["date"].dt.strftime("%m-%d"), order["bucket"]))
        self.assertEqual(
            got,
            {
                "AAA/03-01": "exact_google",
                "AAA/03-26": "unmatched",
                "BBB/03-05": "google_within_7d",
                "CCC/03-10": "same_person_day_diff_price",
                "DDD/03-15": "person_ticker_no_price",
                "EEE/03-18": "person_absent_from_google",
                "FFF/03-20": "yahoo_price_only",
                "ZZZ/03-25": "person_absent_from_google",
            },
        )

    def test_lag_window_edge(self) -> None:
        google = _frame([("2026-01-01", "X", "A B", 0.0, 10.0)])
        yahoo = _frame([])
        # 7 days later matches, 8 days later does not
        tip = _frame(
            [
                ("2026-01-08", "X", "A B", None, 10.0),
                ("2026-01-09", "X", "A B", None, 10.0),
            ]
        )
        out = assign_buckets(tip, google, yahoo).sort_values("date").reset_index(drop=True)
        self.assertEqual(list(out["bucket"]), ["google_within_7d", "person_ticker_no_price"])

    def test_price_tolerance(self) -> None:
        google = _frame([("2026-01-01", "X", "A B", 0.0, 100.00)])
        yahoo = _frame([])
        tip = _frame(
            [
                ("2026-01-01", "X", "A B", None, 100.005),  # within $0.01
                ("2026-01-01", "X", "A B", None, 100.02),   # outside tol, same day diff price
            ]
        )
        out = assign_buckets(tip, google, yahoo).sort_values("projected_price").reset_index(drop=True)
        self.assertEqual(list(out["bucket"]), ["exact_google", "same_person_day_diff_price"])


if __name__ == "__main__":
    unittest.main()
