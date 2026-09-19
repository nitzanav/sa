SHELL := /bin/bash

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
        download_fortune_500 backtest

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

# Scrapes Google and Yahoo into data/analyst_recomendation/<source>/, then joins
# per-date/symbol CSVs into data/analyst_recomendation/all_symbols_per_date_and_symbol*.csv.
# Override limit:
#   NODE_CONFIG='{"analyst_recommendations": {"limit": 10}}' make scrape_analyst_recommendations
# Run one source only (google or yahoo):
#   SOURCE=yahoo make scrape_analyst_recommendations
#   NODE_CONFIG='{"analyst_recommendations": {"source": "yahoo"}}' make scrape_analyst_recommendations
SOURCE ?=

scrape_analyst_recommendations: symbols_exchange
	@. "$${NVM_DIR:-$$HOME/.nvm}/nvm.sh" && nvm use >/dev/null && node src/analyst-recommendation/dyi_javascript/scrape_analyst_recommendations.js $(if $(SOURCE),--source=$(SOURCE))

scrape_analyst_recommendations-test:
	@. "$${NVM_DIR:-$$HOME/.nvm}/nvm.sh" && nvm use >/dev/null && npm run --silent test:e2e

download_fortune_500:
	@mkdir -p data/fortune_500
	@curl -fsSL https://raw.githubusercontent.com/datasets/s-and-p-500-companies/main/data/constituents.csv -o data/fortune_500/symbols.csv

# ---------------------------------------------------------------------------
# Backtests
# ---------------------------------------------------------------------------

backtest:
	@./penv python VectorBT/backtest.py
