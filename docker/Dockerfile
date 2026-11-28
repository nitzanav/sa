# Runtime for make alert_bot. The repo is not in this image.
# entrypoint.sh clones it with GIT_PAT.
# Python matches .python-version. Node matches .nvmrc.
# Playwright matches the playwright version in package-lock.json.
FROM python:3.12.13-bookworm

ARG NODE_VERSION=23.5.0
ARG PLAYWRIGHT_VERSION=1.63.0

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONDONTWRITEBYTECODE=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    NODE_EXTRA_CA_CERTS=/opt/rds/global-bundle.pem \
    PGSSLROOTCERT=/opt/rds/global-bundle.pem

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      git \
      make \
      msmtp \
      postgresql-client \
    && rm -rf /var/lib/apt/lists/*

RUN arch="$(dpkg --print-architecture)" \
    && case "$arch" in \
         amd64) node_arch=x64 ;; \
         arm64) node_arch=arm64 ;; \
         *) echo "unsupported architecture: $arch" >&2; exit 1 ;; \
       esac \
    && curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-${node_arch}.tar.gz" \
      | tar -xz -C /usr/local --strip-components=1 \
    && node --version \
    && npm --version

RUN mkdir -p /opt/rds \
    && curl -fsSL -o /opt/rds/global-bundle.pem \
         https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem

RUN npm install -g "playwright@${PLAYWRIGHT_VERSION}" \
    && playwright install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/* /root/.npm

COPY sendmail /usr/sbin/sendmail
COPY entrypoint.sh git-askpass.sh rewrite-database-url.py write-msmtprc.py /opt/sa/
RUN chmod 755 /usr/sbin/sendmail /opt/sa/entrypoint.sh /opt/sa/git-askpass.sh \
    && python3 --version \
    && node --version \
    && psql --version \
    && git --version

WORKDIR /app
ENTRYPOINT ["/opt/sa/entrypoint.sh"]
CMD ["./etl/alert_bot_cron.sh"]
