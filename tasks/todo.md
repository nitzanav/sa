# Vendor-specific analyst fetch (Google HTTP, Yahoo Playwright)

## Goal

Move HTML fetch out of `scrapeAnalystRecommendation` onto each source. Google keeps `httpRequestScrape`. Yahoo uses a new Playwright scrape helper so the hydrated page (including `Overall`) is cached and parsed.

## Plan

- [x] Add Playwright settings to `config/default.json` (loaded via `src/common/config.js`)
- [x] Add `httpRequestScrapePlaywright` next to the existing HTTP scrape helper (same rate-limit / retry / cache stack)
- [x] Google source owns `fetch` via `httpRequestScrape` + `requestUrl`
- [x] Yahoo source owns `fetch` via `httpRequestScrapePlaywright`
- [x] `scrapeAnalystRecommendation` only adds log context, then `source.fetch` + `source.parse`
- [x] Unit tests: mock Playwright launch; Yahoo scrape tests stub `source.fetch`
- [x] Update lessons

## Review

Generic scrape no longer fetches. Each source has `fetch`. Google still uses `httpRequestScrape` (`hl=en`). Yahoo uses `httpRequestScrapePlaywright` (consent, scroll, wait for `Overall`), with the same retry/cache/rate-limit wrappers.

`httpRequestScrapePlaywright` lives in `src/common/http_request_scrape_playwright.js`, not `config.js`. `config.js` only loads JSON; Playwright options are in `config/default.json`.

Verified: 53 unit tests pass. Live MMM Playwright fetch returned `Overall Score` and parsed 5 in-range rows.
