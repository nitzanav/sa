# Analyst Recommendation scraper (DIY JavaScript)

Scrapes the Analyst Recommendation table from a Google Finance quote Analysis tab
and prints one JSON object per row to stdout. See
[spec.md](../../../docs/tasks/analyst-recommendation/spec.md).

Run from the repo root (`nvm use`, then `npm install`):

```
make analyst-recommendation-js URL='https://www.google.com/finance/beta/quote/NVDA:NASDAQ?window=YTD&tab=analysis'
make analyst-recommendation-js-test
```

Or call the script directly:

```
node src/analyst-recommendation/dyi_javascript/scrape_analyst_recommendation.js '<url>'
```

Rows are validated before they are returned. A row that fails any check — including
a `projected` outside `-95%` to `+1000%`, which Google occasionally reports for a
stale price target — is logged at `error` level and skipped, so a bad row at the
source does not fail the whole symbol.

Fetching follows the [Oxylabs Google Finance recipe](https://github.com/oxylabs/how-to-scrape-google-finance):
set `OXYLABS_USERNAME` and `OXYLABS_PASSWORD` to route requests through the Web
Scraper API. Without them the page is fetched directly, which works because the
table is in the server-rendered HTML.
