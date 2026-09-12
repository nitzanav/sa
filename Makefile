SHELL := /bin/bash

URL ?= https://www.google.com/finance/beta/quote/NVDA:NASDAQ?window=YTD&tab=analysis

FIXTURE := docs/tasks/analyst-recommendation/expected.json

# $(call diff-against-fixture,<scraper target>,<stdout capture file>)
# Compares parsed JSON: json.tool normalizes whitespace and sorts keys.
define diff-against-fixture
@$(MAKE) --no-print-directory $(1) URL='$(URL)' > $(2)
@diff <(./penv python -m json.tool --sort-keys $(2)) \
      <(./penv python -m json.tool --sort-keys $(FIXTURE)) \
  && echo 'PASS: $(1) output matches $(FIXTURE)'
endef

.PHONY: analyst-recommendation-py analyst-recommendation-py-test

analyst-recommendation-py:
	@./penv python src/analyst-recommendation/dyi_python/scrape_analyst_recommendation.py '$(URL)'

analyst-recommendation-py-test:
	$(call diff-against-fixture,analyst-recommendation-py,/tmp/analyst-recommendation-py.json)
