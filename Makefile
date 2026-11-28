SHELL := /bin/bash

# Load .env file if it exists
-include .env
export

# ---------------------------------------------------------------------------
# Shared configuration
# ---------------------------------------------------------------------------
# URL is overridable from the command line, e.g.:
#   make analyst-recommendation-py URL='https://...'
URL ?= https://www.google.com/finance/beta/quote/NVDA:NASDAQ?window=YTD&tab=analysis

# Reference output that every implementation must reproduce. Not named FIXTURE:
# export would overwrite FIXTURE=1 for make positions-explorer.
EXPECTED_JSON := docs/tasks/analyst-recommendation/expected.json

# $(call diff-against-fixture,<stdout capture file>)
# Compares parsed JSON: json.tool normalizes whitespace and sorts keys.
# Reuse this macro from every `<task>-<tech>-test` target so all
# implementations are validated the same way.
define diff-against-fixture
@diff <(./penv python -m json.tool --sort-keys $(1)) \
      <(./penv python -m json.tool --sort-keys $(EXPECTED_JSON)) \
  && echo 'PASS: $(1) matches $(EXPECTED_JSON)'
endef

# ---------------------------------------------------------------------------
# Adding a new implementation (e.g. JavaScript, Go, Rust, ...)
# ---------------------------------------------------------------------------
# Naming convention: <task>-<tech> for the runner, <task>-<tech>-test for the
# test. The runner MUST print pure JSON to stdout (no logs), so the test can
# capture stdout to a file and diff it against $(EXPECTED_JSON).
#
# Steps to add a new tech `<tech>` for task `analyst-recommendation`:
#   1. Put the script under `src/analyst-recommendation/dyi_<tech>/`.
#   2. Add two PHONY targets below:
#        analyst-recommendation-<tech>:
#        	@<runner> src/analyst-recommendation/dyi_<tech>/<script> '$(URL)'
#        analyst-recommendation-<tech>-test:
#        	@$(MAKE) --no-print-directory analyst-recommendation-<tech> URL='$(URL)' \
#        	    > /tmp/analyst-recommendation-<tech>.json
#        	$(call diff-against-fixture,/tmp/analyst-recommendation-<tech>.json)
#   3. Add both target names to the .PHONY line.
#
# The runner must be silent on stdout except for the final JSON; put any
# progress/debug output on stderr so the captured file stays valid JSON.
# ---------------------------------------------------------------------------

.PHONY: analyst-recommendation-py analyst-recommendation-py-test \
        analyst-recommendation-js analyst-recommendation-js-test \
        scrape_analyst_recommendations scrape_analyst_recommendations-test symbols_exchange \
        download_fortune_500 download_yahoo_quotes write_joint_analyst_recommendations etl winrate backtest \
        alert\:buy alert\:buy-truncate alert_bot notify_alerts \
        alert\:sell sell_alerts positions-explorer

analyst-recommendation-py:
	@./penv python src/analyst-recommendation/dyi_python/scrape_analyst_recommendation.py '$(URL)'

analyst-recommendation-py-test:
	@$(MAKE) --no-print-directory analyst-recommendation-py URL='$(URL)' > /tmp/analyst-recommendation-py.json
	$(call diff-against-fixture,/tmp/analyst-recommendation-py.json)

analyst-recommendation-js:
	@. "$${NVM_DIR:-$$HOME/.nvm}/nvm.sh" && nvm use >/dev/null && node src/analyst-recommendation/dyi_javascript/scrape_analyst_recommendation.js '$(URL)'

analyst-recommendation-js-test:
	@$(MAKE) --no-print-directory analyst-recommendation-js URL='$(URL)' > /tmp/analyst-recommendation-js.json
	$(call diff-against-fixture,/tmp/analyst-recommendation-js.json)

# ---------------------------------------------------------------------------
# Data downloads
# ---------------------------------------------------------------------------

symbols_exchange:
	@. "$${NVM_DIR:-$$HOME/.nvm}/nvm.sh" && nvm use >/dev/null && node src/symbols-exchange/fetch_symbols_exchange.js

# Scrapes Google, Yahoo, and TipRanks into data/analyst_recomendation/<source>/, then joins
# per-date/symbol CSVs into data/analyst_recomendation/all_symbols_per_date_and_symbol*.csv.
# Override limit:
#   NODE_CONFIG='{"analyst_recommendations": {"limit": 10}}' make scrape_analyst_recommendations
# Skip symbols whose JSON already exists (TipRanks is expensive; prefer this on reruns):
#   SKIP_EXISTING=1 make scrape_analyst_recommendations
#   NODE_CONFIG='{"analyst_recommendations": {"skip_existing": true}}' make scrape_analyst_recommendations
# Run one source only (google, yahoo, or tipranks):
#   SOURCE=yahoo make scrape_analyst_recommendations
#   SOURCE=tipranks make scrape_analyst_recommendations
#   SKIP_EXISTING=1 SOURCE=tipranks make scrape_analyst_recommendations
#   NODE_CONFIG='{"analyst_recommendations": {"source": "yahoo"}}' make scrape_analyst_recommendations
# TipRanks live fetches read TIP_RANKS_API_KEY from .env (make exports it). Cache hits do not. Do not put the key in config.
# After a successful scrape, commits data/ (message "data") and pushes. A no-op or git failure does not fail the target.
SOURCE ?=
SKIP_EXISTING ?=

scrape_analyst_recommendations: symbols_exchange
	@time . "$${NVM_DIR:-$$HOME/.nvm}/nvm.sh" && nvm use >/dev/null && node src/analyst-recommendation/dyi_javascript/scrape_analyst_recommendations.js $(if $(SOURCE),--source=$(SOURCE)) $(if $(SKIP_EXISTING),--skip-existing)
	@(git reset && git add -- data && git commit -m "data" && git push) || :

scrape_analyst_recommendations-test:
	@. "$${NVM_DIR:-$$HOME/.nvm}/nvm.sh" && nvm use >/dev/null && npm run --silent test:e2e

download_fortune_500:
	@mkdir -p data/fortune_500
	@curl -fsSL https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv -o data/fortune_500/symbols.csv

# Daily Yahoo chart responses for every symbol in data/fortune_500/symbols.csv.
# Writes data/yahoo_quotes/quotes.csv (ticker, raw JSON response) and
# data/yahoo_quotes/all_symbols_per_date_and_symbol.csv
# (date, symbol, open, high, low, close; date is America/New_York), then
# replaces the yahoo_quotes table with those bars. Requires DATABASE_URL.
download_yahoo_quotes: download_fortune_500
	@if [ -z "$$DATABASE_URL" ]; then echo "Error: DATABASE_URL is not set"; exit 1; fi
	@./penv python etl/download_yahoo_quotes.py
	@psql "$$DATABASE_URL" -v ON_ERROR_STOP=1 -f etl/load_yahoo_quotes.sql

# ---------------------------------------------------------------------------
# Database operations
# ---------------------------------------------------------------------------

# Rebuild per-source and joint CSVs from data/analyst_recomendation/<source>/<symbol>.json.
# Join one source only (google, yahoo, or tipranks). That replaces the joint CSVs with
# that source's columns only (SOURCE=tipranks keeps only tipranks_* columns, same as
# SOURCE=yahoo keeps only yahoo_* columns):
#   SOURCE=yahoo make write_joint_analyst_recommendations
#   SOURCE=tipranks make write_joint_analyst_recommendations
write_joint_analyst_recommendations:
	@. "$${NVM_DIR:-$$HOME/.nvm}/nvm.sh" && nvm use >/dev/null && node src/analyst-recommendation/dyi_javascript/scrape_analyst_recommendations.js --join-only $(if $(SOURCE),--source=$(SOURCE))

# Rebuild CSVs from per-symbol JSON, copy Yahoo, Google, and TipRanks into
# database tables, pool all_sources (Yahoo + TipRanks) and yahoo_and_google,
# then export ranked signals.
# Requires DATABASE_URL environment variable to be set.
# Example:
#   export DATABASE_URL="postgresql://myuser:secret@mydb.xxxx.us-east-1.rds.amazonaws.com:5432/mydb?sslmode=require"
#   make etl
etl: write_joint_analyst_recommendations
	@if [ -z "$$DATABASE_URL" ]; then echo "Error: DATABASE_URL is not set"; exit 1; fi
	@day=$$(date +%Y_%m_%d); \
	sed -E "s/(^|[^A-Za-z0-9_])_raw_signals([^A-Za-z0-9_]|$$)/\\1_raw_signals_$$day\\2/g" etl/etl.sql \
	| psql "$$DATABASE_URL" -v ON_ERROR_STOP=1 -f -

# Point-in-time analyst win rates from Yahoo prices. Run after `make etl`
# so _raw_signals exists. Replaces the recency view with the win-rate weights.
winrate: download_yahoo_quotes
	@if [ -z "$$DATABASE_URL" ]; then echo "Error: DATABASE_URL is not set"; exit 1; fi
	@psql "$$DATABASE_URL" -v ON_ERROR_STOP=1 -f etl/winrate.sql

# Today's buy alerts from the signals view. Run after `make etl`, on a weekday
# at or after 16:00 America/New_York, once the daily bars include that date.
# The order is the next session's open. Refreshes Yahoo quotes and the
# yahoo_quotes table, then replaces NOW() with ALERT_AT (default: now, UTC).
# alert_bot exports one value so sell, buy, and notify share it.
#   make alert:buy
#   ALERT_AT='2026-11-06 22:00:00+0000' make alert:buy
alert\:buy: download_yahoo_quotes
	@if [ -z "$$DATABASE_URL" ]; then echo "Error: DATABASE_URL is not set"; exit 1; fi
	@export ALERT_AT="$${ALERT_AT:-$$(date -u '+%Y-%m-%d %H:%M:%S%z')}"; \
	sed "s/NOW()/TIMESTAMPTZ '$$ALERT_AT'/g" etl/buy_alerts.sql | psql "$$DATABASE_URL" -v ON_ERROR_STOP=1 -f -

# Wipe alerts and alerts_raw. Use before a clean backfill.
#   make alert:buy-truncate
alert\:buy-truncate:
	@if [ -z "$$DATABASE_URL" ]; then echo "Error: DATABASE_URL is not set"; exit 1; fi
	@psql "$$DATABASE_URL" -v ON_ERROR_STOP=1 -f etl/alert_buy_truncate.sql

# One ALERT_AT for sell, buy, and notify. DRY_MODE=1 skips the analyst scrapes.
#   make alert_bot
#   ALERT_AT='2026-11-06 22:00:00+0000' make alert_bot
#   DRY_MODE=1 make alert_bot
alert_bot: download_fortune_500
	@set -euo pipefail; \
	export ALERT_AT="$${ALERT_AT:-$$(date -u '+%Y-%m-%d %H:%M:%S%z')}"; \
	if [ "$${DRY_MODE:-}" != "1" ]; then \
		$(MAKE) --no-print-directory SOURCE=yahoo scrape_analyst_recommendations & p1=$$!; \
		$(MAKE) --no-print-directory SOURCE=tipranks scrape_analyst_recommendations & p2=$$!; \
		$(MAKE) --no-print-directory SOURCE=google scrape_analyst_recommendations & p3=$$!; \
		wait $$p1 && wait $$p2 && wait $$p3; \
	fi; \
	$(MAKE) --no-print-directory alert:sell; \
	$(MAKE) --no-print-directory alert:buy; \
	$(MAKE) --no-print-directory notify_alerts

# Sell open positions on 2.5% loss from entry (dd) or 15% giveback of the
# peak gain (pp), using the close of the run's New York date. The run must be
# a weekday at or after 16:00 America/New_York with that date in the daily
# bars. The order is the next session's open. ls is manual. Refreshes Yahoo
# quotes and the yahoo_quotes table, then replaces NOW() with ALERT_AT.
#   make alert:sell
#   ALERT_AT='2026-11-06 22:00:00+0000' make alert:sell
alert\:sell: download_yahoo_quotes
	@if [ -z "$$DATABASE_URL" ]; then echo "Error: DATABASE_URL is not set"; exit 1; fi
	@export ALERT_AT="$${ALERT_AT:-$$(date -u '+%Y-%m-%d %H:%M:%S%z')}"; \
	sed "s/NOW()/TIMESTAMPTZ '$$ALERT_AT'/g" etl/sell_alerts.sql | psql "$$DATABASE_URL" -v ON_ERROR_STOP=1 -f -

# Read alerts and positions for ALERT_AT, write data/alerts/<timestamp>.json, email HTML.
#   ALERT_AT='2026-11-06 00:03:00+02' make notify_alerts
notify_alerts:
	@if [ -z "$$DATABASE_URL" ]; then echo "Error: DATABASE_URL is not set"; exit 1; fi
	@export ALERT_AT="$${ALERT_AT:-$$(date -u '+%Y-%m-%d %H:%M:%S%z')}"; \
	. "$${NVM_DIR:-$$HOME/.nvm}/nvm.sh" && nvm use >/dev/null && node etl/notify_alerts.js

# Quotes only, then alert:sell. No analyst scrape.
#   make sell_alerts
#   ALERT_AT='2026-11-06 22:00:00+0000' make sell_alerts
sell_alerts:
	@./etl/sell_alerts.sh

# ---------------------------------------------------------------------------
# Backtests
# ---------------------------------------------------------------------------

backtest:
	@./penv python VectorBT/backtest.py

# ---------------------------------------------------------------------------
# Positions explorer
# ---------------------------------------------------------------------------

# Chart closes, positions, and analyst targets per symbol. FIXTURE=1 serves
# positions_explorer/lib/fixture.json instead of the database. PORT defaults to 3000.
#   make positions-explorer
#   FIXTURE=1 make positions-explorer
positions-explorer:
	@./nvm-run node positions_explorer/server.js
