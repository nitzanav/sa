# Analyst Recommendation scraper (DIY JavaScript)

Scrapes analyst recommendations from Google Finance and Yahoo Finance, then writes
the same aggregated files under `data/analyst_recomendation/<source>/`:

- `data/analyst_recomendation/google/`
- `data/analyst_recomendation/yahoo/`

After every source finishes, it also writes joined CSVs at
`data/analyst_recomendation/all_symbols_per_date_and_symbol.csv` and
`data/analyst_recomendation/all_symbols_per_date_and_symbol_7d_aggregation_window.csv`.
Those keep shared `date` and `symbol` columns and prefix the rest
(`average_projected`, `std_projected`, `analyst_projections_count`, `projections`)
with the source name (`google_`, `yahoo_`).

Shared fetch/aggregation lives in `scrape_analyst_recommendation.js` and
`scrape_analyst_recommendations.js`. Source-specific parsing, URLs, ticker
extraction, and fetch live in `google_analyst_recommendation.js` and
`yahoo_analyst_recommendation.js`. Google fetch uses `httpRequestScrape`.
Yahoo fetch uses `httpRequestScrapePlaywright` so the hydrated page is cached.

A single URL still prints JSON rows to stdout. The CLI picks the source from the
URL; `scrapeAnalystRecommendation` always takes an explicit source. See
[spec.md](../../../docs/tasks/analyst-recommendation/spec.md).

Run from the repo root (`nvm use`, then `npm install`):

```
make analyst-recommendation-js URL='https://www.google.com/finance/beta/quote/NVDA:NASDAQ?window=YTD&tab=analysis'
make analyst-recommendation-js URL='https://finance.yahoo.com/quote/NVDA/analyst-insights/'
make scrape_analyst_recommendations
SOURCE=yahoo make scrape_analyst_recommendations
SKIP_EXISTING=1 make scrape_analyst_recommendations
make analyst-recommendation-js-test
```

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
once.
