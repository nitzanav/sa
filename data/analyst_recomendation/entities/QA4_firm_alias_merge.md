# QA 4 of 4 — firm-alias merge

**Verdict: ship with notes** (2026-10-31)

Deterministic asserts: 29/29 PASS. Rebuild `build_map.py` left firms=135, people=1852, relations=1661, pending=0, rules unchanged. 0 multi-firm people. No leftover `FIRM_ALIASES` slugs. Rejected row is `daniel-arias` / `evercore-isi`.

Web: 33 searches. Required people and alias-group brands are current. KBW kept separate from Stifel (correct: KBW is Stifel-owned but still branded KBW). Freedom Broker and Freedom Capital Markets correctly remain distinct.

Notes (not blockers):
- `ryan-krueger` mapping to `kbw` is currently correct (rejoined KBW Mar 2026 after ~1 month at RGA), but the stored evidence cites the Dec 2025 RGA hire release and reads as if he left sell-side.
- `freedom-broker` has 0 relations (all 14 Freedom people sit on `freedom-capital-markets`).
- `build_map.py` log intermediate `tipranks_json=1440` / `strong=129` differ from stored 1427 / 128 because preserved `websearch_candidate` + `manual_override` win; final CSV is stable.
