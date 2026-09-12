SHELL := /bin/bash

URL ?= https://www.google.com/finance/beta/quote/NVDA:NASDAQ?window=YTD&tab=analysis

SCRIPT := src/analyst-recommendation/dyi_python/scrape_analyst_recommendation.py
FIXTURE := docs/tasks/analyst-recommendation/expected.json
OUT := /tmp/analyst-recommendation.json

.PHONY: analyst-recommendation test-analyst-recommendation

analyst-recommendation:
	@./penv python $(SCRIPT) '$(URL)'

# Compares parsed JSON: json.tool normalizes whitespace and sorts keys.
test-analyst-recommendation:
	@$(MAKE) --no-print-directory analyst-recommendation URL='$(URL)' > $(OUT)
	@diff <(./penv python -m json.tool --sort-keys $(OUT)) \
	      <(./penv python -m json.tool --sort-keys $(FIXTURE)) \
	  && echo 'PASS: output matches $(FIXTURE)'
