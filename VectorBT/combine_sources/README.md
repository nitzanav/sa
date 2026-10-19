# Combine Google and Yahoo analyst recommendations

Google rows name a person. Yahoo rows name a firm. These two scripts map each person to a firm and (optionally) confirm the best guess with a web search.

Run from the repo root, in this order:

```bash
./penv python VectorBT/combine_sources/build_map.py
./penv python VectorBT/combine_sources/web_verify.py
```

Both scripts are safe to rerun. Finished web searches stay cached.

## Inputs

- `data/analyst_recomendation/google/all_symbols.csv`
- `data/analyst_recomendation/yahoo/all_symbols.csv`

Columns: `date`, `ticker`, `analyst`, `percent`, `projected_price`.

## 1. build_map.py

Normalizes person names (strip, drop `Unknown Analyst`, remove trailing `CFA`, `Jr`, `III`, and similar), parses dates, and inner-joins the two files on ticker and date. A pair is evidence only when the projected prices differ by less than $0.01.

Rows are grouped by `(person, firm)` with:

- `n`: number of exact-price matches
- `share`: `n / total n` for that person
- `is_best`: the top firm for that person (highest `n`, then firm name A-Z when tied)
- `verified`:
  - `verified_data` when `is_best`, `n >= 3`, and `share >= 0.8`
  - `likely` when `is_best`, `n >= 2`, and `share >= 0.8`
  - `best_guess` when `is_best` and the share is weaker
  - `unverified` for every other firm

Output: `data/analyst_recomendation/analyst_map.csv`.

## 2. web_verify.py

Searches only `is_best` rows, highest `n` first. The query is `"<person>" "<firm>" analyst`.

There is no AI and no article is opened. A hit is one of the top 5 results whose title and snippet both contain the person's last name and the firm's first word as whole words (case-insensitive). One hit sets `web_verified` to true. This can be fooled: a snippet may list both names without the person working at that firm, and a real employer can be missed when the snippet uses other wording. `final_status` is `web_verified` on a hit, otherwise the data-only `verified` value. A miss never demotes `best_guess` or above.

Provider order for `--provider auto`:

| Provider | Environment variables |
| --- | --- |
| Google Custom Search | `GOOGLE_API_KEY`, `GOOGLE_CSE_ID` |
| SerpAPI | `SERPAPI_KEY` |
| Brave | `BRAVE_API_KEY` |
| DuckDuckGo | none |

`--provider google|serpapi|brave|duckduckgo` forces one backend. Keys stay in the environment.

Finished pairs are stored in `VectorBT/.cache/analyst_web_verify.sqlite`. A rerun skips them. Each result is committed before the next query, so a crash resumes. `--max-queries` (default 100) caps new calls per run. Calls wait 0.2s (`--sleep`) and retry 429/5xx with backoff.

Output: `data/analyst_recomendation/analyst_map_web_verified.csv` (step 1 columns plus `web_hits`, `web_link`, `web_verified`, `final_status`).

## Tests

```bash
./penv python -m unittest discover -s VectorBT/combine_sources/tests -v
```
