# Analyst Recommendation scraper (DIY Python)

Scrapes the Analyst Recommendation table from a Google Finance quote Analysis tab
and prints one JSON object per row to stdout. See
[spec.md](../../../docs/tasks/analyst-recommendation/spec.md).

Run from the repo root:

```
make analyst-recommendation-py URL='https://www.google.com/finance/beta/quote/NVDA:NASDAQ?window=YTD&tab=analysis'
make analyst-recommendation-py-test
```

Or call the script directly:

```
./penv python src/analyst-recommendation/dyi_python/scrape_analyst_recommendation.py '<url>'
```

Fetching follows the [Oxylabs Google Finance recipe](https://github.com/oxylabs/how-to-scrape-google-finance):
set `OXYLABS_USERNAME` and `OXYLABS_PASSWORD` to route requests through the Web
Scraper API. Without them the page is fetched directly, which works because the
table is in the server-rendered HTML.
