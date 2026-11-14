#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

if [ -z "${DATABASE_URL:-}" ] && [ -f "$root/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$root/.env"
  set +a
fi

make download_fortune_500

SOURCE=yahoo make scrape_analyst_recommendations & p1=$!
SOURCE=tipranks make scrape_analyst_recommendations & p2=$!
SOURCE=google make scrape_analyst_recommendations & p3=$!
wait "$p1" && wait "$p2" && wait "$p3"

make alert:buy DAYS_AGO="${DAYS_AGO:-0}"