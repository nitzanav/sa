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

# Reference output that every implementation must reproduce.
FIXTURE := docs/tasks/analyst-recommendation/expected.json

# $(call diff-against-fixture,<stdout capture file>)
# Compares parsed JSON: json.tool normalizes whitespace and sorts keys.
# Reuse this macro from every `<task>-<tech>-test` target so all
# implementations are validated the same way.
define diff-against-fixture
@diff <(./penv python -m json.tool --sort-keys $(1)) \
      <(./penv python -m json.tool --sort-keys $(FIXTURE)) \
  && echo 'PASS: $(1) matches $(FIXTURE)'
endef

# ---------------------------------------------------------------------------
# Adding a new implementation (e.g. JavaScript, Go, Rust, ...)
# ---------------------------------------------------------------------------
# Naming convention: <task>-<tech> for the runner, <task>-<tech>-test for the
# test. The runner MUST print pure JSON to stdout (no logs), so the test can
# capture stdout to a file and diff it against $(FIXTURE).
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
        alert\:buy alert\:buy-truncate alert_bot \
        alert\:sell sell_alerts

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
SOURCE ?=
SKIP_EXISTING ?=

scrape_analyst_recommendations: symbols_exchange
	@time . "$${NVM_DIR:-$$HOME/.nvm}/nvm.sh" && nvm use >/dev/null && node src/analyst-recommendation/dyi_javascript/scrape_analyst_recommendations.js $(if $(SOURCE),--source=$(SOURCE)) $(if $(SKIP_EXISTING),--skip-existing)

scrape_analyst_recommendations-test:
	@. "$${NVM_DIR:-$$HOME/.nvm}/nvm.sh" && nvm use >/dev/null && npm run --silent test:e2e

download_fortune_500:
	@mkdir -p data/fortune_500
	@curl -fsSL https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv -o data/fortune_500/symbols.csv

# Daily Yahoo chart responses for every symbol in data/fortune_500/symbols.csv.
# Writes data/yahoo_quotes/quotes.csv (ticker, raw JSON response) and
# data/yahoo_quotes/all_symbols_per_date_and_symbol.csv
# (date, symbol, open, high, low, close; date is America/New_York).
download_yahoo_quotes: download_fortune_500
	@./penv python etl/download_yahoo_quotes.py

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
# The order is the next session's open. Refreshes Yahoo quotes, then replaces
# NOW() with one UTC timestamptz, opens positions for new alerts, and prints
# alerts and positions for that run.
# DAYS_AGO shifts that timestamp back 24 hours. macOS date has no -d, so the offset is -v.
#   make alert:buy
#   make alert:buy DAYS_AGO=3
DAYS_AGO ?= 0

alert\:buy: download_yahoo_quotes
	@if [ -z "$$DATABASE_URL" ]; then echo "Error: DATABASE_URL is not set"; exit 1; fi
	@now=$$(date -u -v-$(DAYS_AGO)d '+%Y-%m-%d %H:%M:%S%z'); \
	sed "s/NOW()/TIMESTAMPTZ '$$now'/g" etl/buy_alerts.sql | psql "$$DATABASE_URL" -v ON_ERROR_STOP=1 -f - && \
	psql "$$DATABASE_URL" -v ON_ERROR_STOP=1 -c "SELECT * FROM alerts WHERE alerted_at = TIMESTAMPTZ '$$now'" && \
	psql "$$DATABASE_URL" -v ON_ERROR_STOP=1 -c "SELECT * FROM positions WHERE buy_date = TIMESTAMPTZ '$$now'"

# Wipe alerts and alerts_raw. Use before a clean backfill.
#   make alert:buy-truncate
alert\:buy-truncate:
	@if [ -z "$$DATABASE_URL" ]; then echo "Error: DATABASE_URL is not set"; exit 1; fi
	@psql "$$DATABASE_URL" -v ON_ERROR_STOP=1 -f etl/alert_buy_truncate.sql

# Refresh Fortune 500 list, scrape Yahoo/TipRanks/Google in parallel, then alert:sell and alert:buy.
# Run `make etl` first (or after scrapes) so signals reflect new JSON when needed.
#   make alert_bot
#   make alert_bot DAYS_AGO=3
alert_bot:
	@./etl/alert_bot.sh

# Sell open positions on 2.5% loss from entry (dd) or 15% giveback of the
# peak gain (pp), using the close of the run's New York date. The run must be
# a weekday at or after 16:00 America/New_York with that date in the daily
# bars. The order is the next session's open. ls is manual. Refreshes Yahoo
# quotes, freezes one UTC timestamptz, writes sell alerts, closes those
# positions, and prints the run.
#   make alert:sell
#   make alert:sell DAYS_AGO=3
alert\:sell: download_yahoo_quotes
	@if [ -z "$$DATABASE_URL" ]; then echo "Error: DATABASE_URL is not set"; exit 1; fi
	@now=$$(date -u -v-$(DAYS_AGO)d '+%Y-%m-%d %H:%M:%S%z'); \
	sed "s/NOW()/TIMESTAMPTZ '$$now'/g" etl/sell_alerts.sql | psql "$$DATABASE_URL" -v ON_ERROR_STOP=1 -f - && \
	psql "$$DATABASE_URL" -v ON_ERROR_STOP=1 -c "SELECT * FROM alerts WHERE alerted_at = TIMESTAMPTZ '$$now' AND type = 'sell'" && \
	psql "$$DATABASE_URL" -v ON_ERROR_STOP=1 -c "SELECT id, symbol, lots, price AS entry, sell_price, peak_price, sell_reason, buy_date, sell_date FROM positions WHERE sell_date = TIMESTAMPTZ '$$now'"

# Quotes only, then alert:sell. No analyst scrape.
#   make sell_alerts
#   make sell_alerts DAYS_AGO=3
sell_alerts:
	@./etl/sell_alerts.sh

# ---------------------------------------------------------------------------
# Backtests
# ---------------------------------------------------------------------------

backtest:
	@./penv python VectorBT/backtest.py
