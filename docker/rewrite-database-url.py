#!/usr/bin/env python3
"""Print DATABASE_URL adjusted for this container. Messages go to stderr."""

import os
import re
import sys

url = os.environ["DATABASE_URL"]


def host_repl(match):
    print("DATABASE_URL host is localhost; using host.docker.internal", file=sys.stderr)
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
