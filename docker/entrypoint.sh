#!/usr/bin/env bash
# Prepare the alert-bot container, then run the given command.
# Default command is etl/alert_bot_cron.sh (see the Dockerfile CMD).
set -euo pipefail

cd /app
mkdir -p data/logs data/alerts data/yahoo_quotes data/fortune_500 data/analyst_recomendation

# localhost inside the container is not the host. RDS hostnames stay as given.
# An RDS URL with no sslmode gets sslmode=require so psql and node pg both encrypt.
if [[ -n "${DATABASE_URL:-}" ]]; then
  DATABASE_URL="$(python3 - <<'PY'
import os
import re
import sys

url = os.environ["DATABASE_URL"]

def host_repl(match):
    print(
        "DATABASE_URL host is localhost; using host.docker.internal",
        file=sys.stderr,
    )
    return match.group(1) + "host.docker.internal" + (match.group(3) or "")

url = re.sub(
    r"(@)(localhost|127\.0\.0\.1|\[::1\])(:[0-9]+)?",
    host_repl,
    url,
    count=1,
)
host = re.search(r"@([^/?#:]+)", url)
name = host.group(1) if host else ""
if name.endswith(".rds.amazonaws.com") and "sslmode=" not in url:
    print("RDS host has no sslmode; using sslmode=require", file=sys.stderr)
    url += ("&" if "?" in url else "?") + "sslmode=require"
print(url)
PY
)"
  export DATABASE_URL
fi

if [[ -n "${SMTP_HOST:-}" ]]; then
  python3 - <<'PY'
import os
from pathlib import Path

port = os.environ.get("SMTP_PORT", "587")
user = os.environ.get("SMTP_USER", "")
sender = os.environ.get("SMTP_FROM") or os.environ.get("ALERT_EMAIL") or "alerts@localhost"
starttls = "off" if port == "465" else "on"
auth = "on" if user else "off"
text = "\n".join([
    "defaults",
    f"auth {auth}",
    "tls on",
    f"tls_starttls {starttls}",
    "tls_trust_file /etc/ssl/certs/ca-certificates.crt",
    "account default",
    f"host {os.environ['SMTP_HOST']}",
    f"port {port}",
    f"from {sender}",
    f"user {user}",
    f"password {os.environ.get('SMTP_PASSWORD', '')}",
    "",
])
path = Path("/etc/msmtprc")
path.write_text(text)
os.chmod(path, 0o600)
PY
fi

# data/ is not in the image. Fetch the tip of main and check out that tree.
key_src="${GIT_SSH_KEY:-/run/secrets/github_key}"
if [[ ! -f "$key_src" ]]; then
  echo "git: mount the GitHub SSH key at ${key_src}" >&2
  exit 1
fi
install -m 600 "$key_src" /tmp/github_key
export GIT_SSH_COMMAND="${GIT_SSH_COMMAND:-ssh -i /tmp/github_key -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new -o UserKnownHostsFile=/tmp/known_hosts}"

git init -b main
git remote add origin "${GIT_REMOTE:-git@github.com:nitzanav/sa.git}"
git config user.name "${GIT_AUTHOR_NAME:-Nitzan Aviram}"
git config user.email "${GIT_AUTHOR_EMAIL:-nitzanav@gmail.com}"
git fetch --depth 1 origin main
git update-ref refs/heads/main origin/main
git symbolic-ref HEAD refs/heads/main
git reset -q --mixed HEAD
git checkout -q -- data
echo "checked out data/ from origin/main"

# make alert_bot commits and pushes after the parallel source scrapes.
if [[ $# -eq 0 ]]; then
  exec ./etl/alert_bot_cron.sh
fi
exec "$@"
