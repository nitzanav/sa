#!/usr/bin/env bash
# Clone the repo with GIT_PAT, install its dependencies, then run the command.
# make alert_bot commits and pushes. This script does not.
set -euo pipefail

if [[ -n "${DATABASE_URL:-}" ]]; then
  DATABASE_URL="$(python3 /opt/sa/rewrite-database-url.py)"
  export DATABASE_URL
fi

if [[ -n "${SMTP_HOST:-}" ]]; then
  python3 /opt/sa/write-msmtprc.py
fi

if [[ -z "${GIT_PAT:-}" ]]; then
  echo "GIT_PAT is not set. Use a GitHub personal access token with repo scope, not an SSH key." >&2
  exit 1
fi

export GIT_ASKPASS=/opt/sa/git-askpass.sh
export GIT_TERMINAL_PROMPT=0

repo="${GIT_REPO:-https://github.com/nitzanav/sa.git}"
echo "cloning ${repo}"
git clone --depth 1 "$repo" /app
cd /app
git config user.name "${GIT_AUTHOR_NAME:-Nitzan Aviram}"
git config user.email "${GIT_AUTHOR_EMAIL:-nitzanav@gmail.com}"

mkdir -p data/logs data/alerts data/yahoo_quotes data/fortune_500 data/analyst_recomendation
./penv setup
npm ci --omit=dev

if [[ $# -eq 0 ]]; then
  exec ./etl/alert_bot_cron.sh
fi
exec "$@"
