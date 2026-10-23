"""Search cache resumes after a crash and skips pairs already stored."""

from __future__ import annotations

import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from web_cache import SearchCache  # noqa: E402


class SearchCacheTest(unittest.TestCase):
    def test_put_get_and_reopen(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "cache.sqlite"
            cache = SearchCache(path)
            self.assertIsNone(cache.get("Yaron Kinar", "Mizuho"))
            cache.put("Yaron Kinar", "Mizuho", '"Yaron Kinar" "Mizuho" analyst', "google", 2, "https://mizuho.example", True)
            cache.close()

            again = SearchCache(path)
            row = again.get("Yaron Kinar", "Mizuho")
            self.assertIsNotNone(row)
            assert row is not None
            self.assertEqual(row.web_hits, 2)
            self.assertEqual(row.web_link, "https://mizuho.example")
            self.assertTrue(row.web_verified)
            again.put("Yaron Kinar", "Mizuho", "q", "google", 0, "", False)
            replaced = again.get("Yaron Kinar", "Mizuho")
            assert replaced is not None
            self.assertFalse(replaced.web_verified)
            self.assertEqual(replaced.web_hits, 0)
            again.close()


if __name__ == "__main__":
    unittest.main()
