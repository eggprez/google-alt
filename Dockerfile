# Playwright image ships a Chromium build matching the pinned playwright npm version.
FROM mcr.microsoft.com/playwright:v1.63.0-noble

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update \
 && apt-get install -y --no-install-recommends xvfb x11vnc novnc websockify fonts-noto-color-emoji util-linux \
 && rm -rf /var/lib/apt/lists/* \
 && mkdir -p /tmp/.X11-unix && chmod 1777 /tmp/.X11-unix

# Claude Code CLI. Log in interactively with `docker exec -it google-alt claude`, or set CLAUDE_CODE_OAUTH_TOKEN.
ARG CLAUDE_CODE_VERSION=2.1.265
RUN npm install -g @anthropic-ai/claude-code@${CLAUDE_CODE_VERSION} && claude --version

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
COPY scripts/entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh \
 && mkdir -p /data/profile /data/claude /data/work \
 && chown -R pwuser:pwuser /app /data

ENV NODE_ENV=production \
    PORT=8080 \
    DATA_DIR=/data \
    HOME=/home/pwuser \
    CLAUDE_CONFIG_DIR=/data/claude \
    DISABLE_AUTOUPDATER=1 \
    DISABLE_TELEMETRY=1 \
    CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# Everything, including `docker exec` shells, runs as the unprivileged app user so a login saved from
# the shell is readable by the server.
USER pwuser
# `docker exec -it google-alt claude` starts in the scratch work dir.
WORKDIR /data/work

EXPOSE 8080
VOLUME ["/data"]
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s CMD curl -fsS http://127.0.0.1:8080/healthz || exit 1
ENTRYPOINT ["/entrypoint.sh"]
