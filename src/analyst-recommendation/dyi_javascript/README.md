# Analyst Recommendation scraper (DIY JavaScript)

Scrapes analyst recommendations from Google Finance, Yahoo Finance, and TipRanks, then writes
the same aggregated files under `data/analyst_recomendation/<source>/`:

- `data/analyst_recomendation/google/`
- `data/analyst_recomendation/yahoo/`
- `data/analyst_recomendation/tipranks/`

After every source finishes, it also writes joined CSVs at
`data/analyst_recomendation/all_symbols_per_date_and_symbol.csv` and
`data/analyst_recomendation/all_symbols_per_date_and_symbol_7d_aggregation_window.csv`.
Those keep shared `date` and `symbol` columns and prefix the rest
(`average_projected`, `std_projected`, `analyst_projections_count`, `projections`)
with the source name (`google_`, `yahoo_`, `tipranks_`).

Shared fetch/aggregation lives in `scrape_analyst_recommendation.js` and
`scrape_analyst_recommendations.js`. Source-specific parsing, URLs, ticker
extraction, and fetch live in `google_analyst_recommendation.js`,
`yahoo_analyst_recommendation.js`, and `tipranks_analyst_recommendation.js`.
Google fetch uses `httpRequestScrape`. Yahoo fetch uses `httpRequestScrapePlaywright`
so the hydrated page is cached. TipRanks POSTs a JSON-RPC `tools/call` for
`get_recent_analyst_ratings`. The raw body is cached by file name (10-day TTL).
`SKIP_EXISTING=1` reads an existing `<symbol>.json` and does not fetch. TipRanks is
expensive, so prefer skip-existing on reruns. That path does not overwrite Google or
Yahoo cache files.

A single URL still prints JSON rows to stdout. The CLI picks the source from the
URL; `scrapeAnalystRecommendation` always takes an explicit source. See
[spec.md](../../../docs/tasks/analyst-recommendation/spec.md).

Run from the repo root (`nvm use`, then `npm install`):

```
make analyst-recommendation-js URL='https://www.google.com/finance/beta/quote/NVDA:NASDAQ?window=YTD&tab=analysis'
make analyst-recommendation-js URL='https://finance.yahoo.com/quote/NVDA/analyst-insights/'
make scrape_analyst_recommendations
SOURCE=yahoo make scrape_analyst_recommendations
SOURCE=google make scrape_analyst_recommendations
SOURCE=tipranks make scrape_analyst_recommendations
NODE_CONFIG='{"analyst_recommendations": {"source": "tipranks"}}' make scrape_analyst_recommendations
SKIP_EXISTING=1 make scrape_analyst_recommendations
SKIP_EXISTING=1 SOURCE=tipranks make scrape_analyst_recommendations
make analyst-recommendation-js-test
```

TipRanks uses the same `make scrape_analyst_recommendations` target as Yahoo and Google.
`SOURCE=tipranks` (or `NODE_CONFIG` `analyst_recommendations.source`) selects it and
does not fetch the other sources. With no `SOURCE`, the target runs Google, Yahoo,
and TipRanks. The default symbol limit is `analyst_recommendations.limit` in
`config/default.json` (currently 3).

A live TipRanks fetch reads `TIP_RANKS_API_KEY` from `.env`. The Makefile loads
`.env` and exports it, so the key is not passed on the command line. A cache hit
does not need it. The key is read inside the request, after the cache lookup, and
is not part of `urlFor` (that URL only carries `ticker`). Do not put the key in
`config/default.json`.

`SOURCE=tipranks make write_joint_analyst_recommendations` joins only TipRanks and
replaces the joint CSVs with TipRanks columns only, the same way
`SOURCE=yahoo make write_joint_analyst_recommendations` keeps only Yahoo columns.

Or call the script directly:

```
node src/analyst-recommendation/dyi_javascript/scrape_analyst_recommendation.js '<url>'
node src/analyst-recommendation/dyi_javascript/scrape_analyst_recommendations.js
```

Rows are validated before they are returned. A row that fails any check is logged at
`error` level and skipped, so a bad row at the source does not fail the whole symbol.
Google sometimes prints a price target in another currency (`"SGD 1.86"`, `"CA$11.50"`,
`"A$38.00"`). The scraper replaces that with the USD amount embedded in the page and
recomputes `projected` from the USD quote. A target that is still not USD, or a
`projected` outside `-95%` to `+1000%`, is skipped. A missing `price_target` is `null`
and stays valid. `date` must fall between `2025-01-01` and tomorrow (inclusive).
A failed fetch for one symbol is logged and the scrape continues with the rest.
Tickers missing from Sharadar, or renamed, are listed in
`data/symbols_exchange_overrides.csv` (`PSKY` is fetched as `SKYD:NYSE`).

Fetching follows the [Oxylabs Google Finance recipe](https://github.com/oxylabs/how-to-scrape-google-finance):
set `OXYLABS_USERNAME` and `OXYLABS_PASSWORD` to route requests through the Web
Scraper API. Without them Google is fetched directly (`httpRequestScrape`).
Yahoo is fetched with Playwright (`httpRequestScrapePlaywright`) because the
analyst table is client-rendered after consent. Run `npx playwright install chromium`
once. TipRanks is a separate JSON-RPC POST and does not use that proxy or Playwright.
