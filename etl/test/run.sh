#!/usr/bin/env bash
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$root"

if [ -z "${DATABASE_URL:-}" ] && [ -f "$root/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$root/.env"
  set +a
fi
if [ -z "${DATABASE_URL:-}" ]; then
  echo "Error: DATABASE_URL is not set" >&2
  exit 1
fi

header=$'DROP SCHEMA IF EXISTS etl_test CASCADE;\nCREATE SCHEMA etl_test;\nSET search_path TO etl_test;\n'
{
  printf '%s' "$header"
  sed \
    -e "s|data/analyst_recomendation/yahoo/all_symbols.csv|etl/test/fixtures/yahoo.csv|" \
    -e "s|data/analyst_recomendation/google/all_symbols.csv|etl/test/fixtures/google.csv|" \
    -e "s|data/analyst_recomendation/tipranks/all_symbols.csv|etl/test/fixtures/tipranks.csv|" \
    -e "s|data/signals.csv|etl/test/signals.csv|" \
    etl/etl.sql
} > etl/test/etl_test.sql

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f etl/test/etl_test.sql
diff -u etl/test/expected/signals.csv etl/test/signals.csv

# Second run keeps raw_signals. A rating the files no longer contain must stay,
# and its created_at must not move.
created=$(psql "$DATABASE_URL" -q -v ON_ERROR_STOP=1 -tA -c \
  "INSERT INTO etl_test.raw_signals (source, date, ticker, analyst, percent, projected_price) VALUES ('yahoo', DATE '2026-01-16', 'KEPT_FROM_PRIOR_SCRAPE', 'Old', 10, 100) RETURNING created_at;" | head -n 1)
tail -n +3 etl/test/etl_test.sql | psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f -
kept=$(psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -tA -c \
  "SELECT COUNT(*) FROM etl_test.raw_signals WHERE source = 'yahoo' AND ticker = 'KEPT_FROM_PRIOR_SCRAPE' AND created_at = '$created';")
if [ "$kept" != "1" ]; then
  echo "Error: prior raw_signals row was not kept (count=$kept)" >&2
  exit 1
fi
