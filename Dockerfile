# One-shot image for `make alert_bot` / etl/alert_bot_cron.sh.
# Python matches .python-version. Node matches .nvmrc and is on PATH
# (the image does not install nvm; ./nvm-run falls through to this node).
FROM python:3.12.13-bookworm

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    NODE_EXTRA_CA_CERTS=/opt/rds/global-bundle.pem \
    PGSSLROOTCERT=/opt/rds/global-bundle.pem \
    SA_DOCKER=1

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      git \
      make \
      msmtp \
      postgresql-client \
    && rm -rf /var/lib/apt/lists/*

# Node binary distribution. .nvmrc is the version source of truth.
COPY .nvmrc /tmp/.nvmrc
RUN node_version="$(tr -d '[:space:]' < /tmp/.nvmrc)" \
    && arch="$(dpkg --print-architecture)" \
    && case "$arch" in \
         amd64) node_arch=x64 ;; \
         arm64) node_arch=arm64 ;; \
         *) echo "unsupported architecture: $arch" >&2; exit 1 ;; \
       esac \
    && curl -fsSL "https://nodejs.org/dist/v${node_version}/node-v${node_version}-linux-${node_arch}.tar.gz" \
      | tar -xz -C /usr/local --strip-components=1 \
    && node --version \
    && npm --version \
    && rm /tmp/.nvmrc

# Amazon RDS CA bundle. Node's pg driver treats sslmode=require as verify-full,
# so the private RDS CA must be trusted. psql uses PGSSLROOTCERT for verify-ca
# and verify-full; sslmode=require still encrypts without it.
RUN mkdir -p /opt/rds \
    && curl -fsSL -o /opt/rds/global-bundle.pem \
         https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem

# notify_alerts pipes mail to /usr/sbin/sendmail. msmtp delivers when
# SMTP_HOST is set; otherwise this wrapper explains what is missing.
RUN printf '%s\n' \
      '#!/bin/sh' \
      'if [ ! -s /etc/msmtprc ]; then' \
      '  echo "sendmail: set SMTP_HOST (and SMTP_USER / SMTP_PASSWORD) so alert mail can be delivered" >&2' \
      '  exit 1' \
      'fi' \
      'exec /usr/bin/msmtp "$@"' \
      > /usr/sbin/sendmail \
    && chmod 755 /usr/sbin/sendmail

WORKDIR /app

COPY requirements.txt penv .python-version ./
RUN chmod +x penv && ./penv setup

COPY package.json package-lock.json ./
RUN npm ci \
    && npx playwright install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/*

COPY . .
RUN apt-get update && apt-get install -y --no-install-recommends openssh-client \
    && rm -rf /var/lib/apt/lists/*
RUN chmod +x nvm-run etl/alert_bot_cron.sh docker/entrypoint.sh \
    && python3 --version \
    && node --version \
    && psql --version

ENTRYPOINT ["/app/docker/entrypoint.sh"]
CMD ["./etl/alert_bot_cron.sh"]
