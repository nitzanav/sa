#!/usr/bin/env python3
"""Write /etc/msmtprc from SMTP_HOST and related environment variables."""

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
