SHELL := /bin/bash

URL ?= https://www.google.com/finance/beta/quote/NVDA:NASDAQ?window=YTD&tab=analysis

FIXTURE := docs/tasks/analyst-recommendation/expected.json

PY_OUT := /tmp/analyst-recommendation-py.json

# $(call diff-against-fixture,<stdout capture file>)
# Compares parsed JSON: json.tool normalizes whitespace and sorts keys.
define diff-against-fixture
@diff <(./penv python -m json.tool --sort-keys $(1)) \
      <(./penv python -m json.tool --sort-keys $(FIXTURE)) \
  && echo 'PASS: $(1) matches $(FIXTURE)'
endef

.PHONY: analyst-recommendation-py analyst-recommendation-py-test

analyst-recommendation-py:
	@./penv python src/analyst-recommendation/dyi_python/scrape_analyst_recommendation.py '$(URL)'

analyst-recommendation-py-test:
	@$(MAKE) --no-print-directory analyst-recommendation-py URL='$(URL)' > $(PY_OUT)
	$(call diff-against-fixture,$(PY_OUT))
