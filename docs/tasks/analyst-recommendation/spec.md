# Task: Google Finance Analyst Recommendation scraper

## Goal

Scrape the **Analyst Recommendation** table from a Google Finance quote **Analysis** tab. Input is a quote URL. Output is JSON for every row of that table only (not financials, news, or other widgets).

Example URL: [NVDA Analysis (YTD)](https://www.google.com/finance/beta/quote/NVDA:NASDAQ?window=YTD&tab=analysis)

The Analysis tab is client-rendered. The Analyst cell is two lines: **name**, then **firm**.

## Deliverable

A `Makefile` target that runs a Python script (`./penv python …`, see `AGENTS.md`) **or** a JavaScript script (`nvm use`, then `node …`).

The command takes a URL and prints JSON to **stdout** (no extra stdout logs):

```
make analyst-recommendation URL='https://www.google.com/finance/beta/quote/NVDA:NASDAQ?window=YTD&tab=analysis'
```

The target may wrap either:

```
./penv python scrape_analyst_recommendation.py '<url>'
node scrape_analyst_recommendation.js '<url>'
```

## Output schema

Stdout is a JSON **array of objects**, one per table row, **in page order**. Keys:

| Key | Type | Meaning |
| --- | --- | --- |
| `analyst` | string | Name as shown (`"James Schneider"`, `"Unknown Analyst"`) |
| `firm` | string | Broker (`"Goldman Sachs"`) |
| `recommendation` | string | `Buy` / `Hold` / `Sell` |
| `action` | string | `Maintained`, `Initiated`, `Reiterated`, `Upgraded`, etc. |
| `price_target` | string \| null | As shown (`"$300.00"`). Display `-` → `null` |
| `projected` | string \| null | As shown (`"+37.4%"`, `"+26%"`). Display `-` → `null` |
| `date` | string | `MM/DD/YYYY` as shown (`"09/10/2026"`) |

Example row:

```json
{
  "analyst": "James Schneider",
  "firm": "Goldman Sachs",
  "recommendation": "Buy",
  "action": "Maintained",
  "price_target": "$300.00",
  "projected": "+37.4%",
  "date": "09/10/2026"
}
```

Pretty-print is optional. Compare **parsed** JSON (whitespace and key order do not matter).

## Test data

Snapshot of the example NVDA table (captured 2026-09-12, 51 rows). CSV columns match the JSON keys.

- [expected.csv](expected.csv)
- [expected.json](expected.json)

## Test

**The test is: run the make command on the example URL and compare stdout to [expected.json](expected.json).**

```
make analyst-recommendation URL='https://www.google.com/finance/beta/quote/NVDA:NASDAQ?window=YTD&tab=analysis' > /tmp/out.json
```

Pass when:

1. Output is valid JSON: an array of objects with the seven keys above.
2. Row count matches the fixture (51 for this snapshot).
3. Each row equals the fixture on `analyst`, `firm`, `recommendation`, `action`, `price_target`, `projected`, and `date` (exact strings; `null` for missing price/projected).

A `make test-analyst-recommendation` target that runs the example URL and diffs against `expected.json` is recommended.

Live Google Finance data changes. This fixture is the contract for the task. If live rows diverge, record the mismatch; do not change the schema.

## Constraints

- Scrape only Analyst Recommendation.
- Stdout is JSON only (stderr may log).
- Preserve names with apostrophes (`David O'Connor`, `Thomas O'Malley`).
- Preserve original row order.
