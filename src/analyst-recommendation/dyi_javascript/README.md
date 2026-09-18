# Analyst Recommendation scraper (DIY JavaScript)

Scrapes analyst recommendations from Google Finance and Yahoo Finance, then writes
the same aggregated files under `data/analyst_recomendation/<source>/`:

- `data/analyst_recomendation/google/`
- `data/analyst_recomendation/yahoo/`

Shared fetch/aggregation lives in `scrape_analyst_recommendation.js` and
`scrape_analyst_recommendations.js`. Source-specific parsing, URLs, and ticker
extraction live in `google_analyst_recommendation.js` and
`yahoo_analyst_recommendation.js`.

A single URL still prints JSON rows to stdout. The CLI picks the source from the
URL; `scrapeAnalystRecommendation` always takes an explicit source. See
[spec.md](../../../docs/tasks/analyst-recommendation/spec.md).

Run from the repo root (`nvm use`, then `npm install`):

```
make analyst-recommendation-js URL='https://www.google.com/finance/beta/quote/NVDA:NASDAQ?window=YTD&tab=analysis'
make analyst-recommendation-js URL='https://finance.yahoo.com/quote/NVDA/analyst-insights/'
make scrape_analyst_recommendations
SOURCE=yahoo make scrape_analyst_recommendations
make analyst-recommendation-js-test
```

Or call the script directly:

```
node src/analyst-recommendation/dyi_javascript/scrape_analyst_recommendation.js '<url>'
node src/analyst-recommendation/dyi_javascript/scrape_analyst_recommendations.js
```

Rows are validated before they are returned. A row that fails any check is logged at
`error` level and skipped, so a bad row at the source does not fail the whole symbol.
Two checks reject data that Google really does serve: a `projected` outside `-95%` to
`+1000%` (seen against a stale price target), and a `price_target` quoted in a
currency other than USD (`"SGD 1.86"`). A missing `price_target` is `null` and stays
valid. `date` must fall between `2025-12-01` and today (inclusive).

Fetching follows the [Oxylabs Google Finance recipe](https://github.com/oxylabs/how-to-scrape-google-finance):
set `OXYLABS_USERNAME` and `OXYLABS_PASSWORD` to route requests through the Web
Scraper API. Without them the page is fetched directly, which works because the
table is in the server-rendered HTML.
