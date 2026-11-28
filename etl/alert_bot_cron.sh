#!/usr/bin/env bash
set -euo pipefail

# Cron on macOS has a tiny PATH. Homebrew psql and make live in /opt/homebrew/bin.
# A missing directory on PATH is harmless in Docker.
export PATH="/opt/homebrew/bin:${PATH:-/usr/bin:/bin}"

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

log_dir="$root/data/logs"
mkdir -p "$log_dir"
log_file="$log_dir/sa-alert-bot.log"

echo "alert_bot log: $log_file"
make alert_bot 2>&1 | tee -a "$log_file"
