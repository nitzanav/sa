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
