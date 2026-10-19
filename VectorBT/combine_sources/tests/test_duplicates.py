"""Status rules and the Julian Mitchell example from the README."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from mapping import assign_verified, build_analyst_map, choose_final_status  # noqa: E402


def _recs(rows: list[tuple]) -> pd.DataFrame:
    return pd.DataFrame(rows, columns=["date", "ticker", "analyst", "percent", "projected_price"])


class MapStatusTest(unittest.TestCase):
    def test_status_thresholds(self) -> None:
        self.assertEqual(assign_verified(11, 11, True), "verified_data")
        self.assertEqual(assign_verified(3, 3, True), "verified_data")
        self.assertEqual(assign_verified(2, 2, True), "likely")
        self.assertEqual(assign_verified(2, 3, True), "best_guess")
        self.assertEqual(assign_verified(8, 13, True), "best_guess")
        self.assertEqual(assign_verified(5, 13, False), "unverified")

    def test_final_status_prefers_web_hit(self) -> None:
        self.assertEqual(choose_final_status("best_guess", True), "web_verified")
        self.assertEqual(choose_final_status("best_guess", False), "best_guess")
        self.assertEqual(choose_final_status("unverified", None), "unverified")

    def test_julian_mitchell_example(self) -> None:
        google_rows = []
        yahoo_rows = []
        for i in range(11):
            google_rows.append(("2026-01-01", f"K{i}", "Yaron Kinar", 1, 100))
            yahoo_rows.append(("2026-01-01", f"K{i}", "Mizuho", 1, 100))
        for i in range(8):
            google_rows.append(("2026-02-01", f"B{i}", "Julian Mitchell", 1, 50))
            yahoo_rows.append(("2026-02-01", f"B{i}", "Barclays", 1, 50))
        for i in range(5):
            google_rows.append(("2026-03-01", f"J{i}", "Julian Mitchell", 1, 40))
            yahoo_rows.append(("2026-03-01", f"J{i}", "JP Morgan", 1, 40))
        google_rows.append(("2026-04-01", "ZZ", "Unknown Analyst", 1, 40))
        yahoo_rows.append(("2026-04-01", "ZZ", "UBS", 1, 40))

        analyst_map = build_analyst_map(_recs(google_rows), _recs(yahoo_rows))
        julian = analyst_map[analyst_map["analyst_google"] == "Julian Mitchell"]
        self.assertEqual(list(julian["analyst_yahoo"]), ["Barclays", "JP Morgan"])
        self.assertEqual(list(julian["verified"]), ["best_guess", "unverified"])
        self.assertEqual(list(julian["is_best"]), [True, False])
        yaron = analyst_map[analyst_map["analyst_google"] == "Yaron Kinar"].iloc[0]
        self.assertEqual((yaron["analyst_yahoo"], int(yaron["n"]), yaron["verified"]),
                         ("Mizuho", 11, "verified_data"))
        self.assertTrue(analyst_map["analyst_google"].ne("Unknown Analyst").all())


if __name__ == "__main__":
    unittest.main()
