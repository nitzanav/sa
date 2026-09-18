# Lessons

## Analyst recommendation sources

- Generic scrape takes an explicit `source` plus URL. Do not infer Google vs Yahoo from the hostname inside `scrapeAnalystRecommendation`.
- URL-to-source selection belongs in a CLI-level helper (`sourceForUrl` / `scrapeAnalystRecommendationFromUrl`).
- Source-specific behavior (`parse`, `fetch`, `urlFor`, `quoteFromUrl`, `requestUrl`, `matchesUrl`) lives on the source object in `google_analyst_recommendation.js` or `yahoo_analyst_recommendation.js`.
- Google `fetch` uses `httpRequestScrape`. Yahoo `fetch` uses `httpRequestScrapePlaywright`. Do not fetch inside the generic scrape helper.
- Output dir is generic: `data/analyst_recomendation/<source.name>`. Do not hardcode per-source directory constants.
