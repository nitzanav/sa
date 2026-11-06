---
name: analyst-entities
description: >-
  Orchestrate firm/person classification and person-firm relations from Yahoo,
  Google, and Tipranks. Runs classify.py then candidates.py, then confirms
  pending exact-price-weak rows with a generalPurpose subagent. Use when the
  user asks to map analysts to firms, refresh entities, confirm candidates,
  or run the analyst-entities skill.
---

# Analyst entities

The skill only orchestrates. Scripts write every CSV. Do not invent firms, people, or relations.

Run every command from the repo root with `./penv python`.

## Files

| File | Role |
| --- | --- |
| `data/analyst_recomendation/entities/firms.csv` | one firm per slug |
| `data/analyst_recomendation/entities/people.csv` | one person per slug |
| `data/analyst_recomendation/entities/relations.csv` | confirmed person-firm |
| `data/analyst_recomendation/entities/candidates_pending.csv` | weak price matches awaiting confirm |
| `data/analyst_recomendation/entities/candidates_rejected.csv` | agent said no or unknown |
| `data/analyst_recomendation/entities/aliases_unknown.csv` | names that look like firms but came from a person source |

## Workflow

Copy this checklist and tick it as you go.

```
- [ ] 1 classify
- [ ] 2 candidates
- [ ] 3 emit pending batch if any
- [ ] 4 confirm with a subagent
- [ ] 5 ingest answers
- [ ] 6 print counts
```

### 1. Classify

```bash
./penv python VectorBT/combine_sources/classify.py
```

Yahoo names and Tipranks JSON `firm` keys become firms. Classify resolves firm aliases via `FIRM_ALIASES`. Google and Tipranks people that are not in that firm set become people. Reruns only add new aliases.

### 2. Candidates

```bash
./penv python VectorBT/combine_sources/candidates.py
```

Uses the Yahoo ∩ Tipranks ∩ Google date window. One firm per person. A price
match counts only when that `(ticker, date, price)` is unique on both sides
(one Google person, one Yahoo firm). Shared price targets are dropped.

Writes:

- `exact_price_strong` (`n >= 3` and `share >= 0.8`) to `relations.csv`
- `exact_price_weak` (`n == 2` or `share` in `[0.5, 0.8)`) to `candidates_pending.csv`
- `tipranks_json` only when that person has no unique-price firm
- weaker coincidences are dropped

`n` is distinct unique `(ticker, date, price)` matches. `share` is `n / total n` for that person.
Reruns keep `websearch_candidate` rows and replace every other auto rule.

Or run both stages:

```bash
./penv python VectorBT/combine_sources/build_map.py
```

### 3. Emit a batch

If `candidates_pending.csv` has data rows:

```bash
./penv python VectorBT/combine_sources/confirm_candidates.py --emit data/analyst_recomendation/entities/batch.json --limit 20
```

If the file is empty or missing, skip to step 6.

### 4. Confirm with a subagent

Launch one `generalPurpose` Task. Prompt it with the path to `batch.json` and these rules:

- For each row, search the web with the `query_suggestions` (person and firm as an analyst pair).
- Confirm `yes` only when a title or snippet says the person is an analyst at that firm.
- Otherwise `no` or `unknown`. Do not guess from the price match.
- Write `data/analyst_recomendation/entities/batch.answered.json` as a JSON list. Each item must have `person_id`, `firm_id`, `person`, `firm`, `confirmed` (`yes`/`no`/`unknown`), `url`, `note`.
- Do not edit any other file.

Wait for that subagent. Do not confirm rows yourself.

### 5. Ingest

```bash
./penv python VectorBT/combine_sources/confirm_candidates.py --ingest data/analyst_recomendation/entities/batch.answered.json
```

Yes moves the row to `relations.csv` with `rule=websearch_candidate` and `confirmed_by_agent=yes`. Anything else goes to `candidates_rejected.csv` and leaves pending.

If pending still has rows, repeat steps 3–5.

### 6. Summary

Print firms, people, relations, confirmed (`confirmed_by_agent=yes`), pending remaining, and rejected. Do not rewrite the CSVs by hand.
