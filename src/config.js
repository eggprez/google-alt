const env = process.env;
const bool = (v, d) => (v == null || v === '' ? d : /^(1|true|yes|on)$/i.test(v));
const int = (v, d) => (v == null || v === '' ? d : parseInt(v, 10));

export const config = {
  port: int(env.PORT, 8080),
  dataDir: env.DATA_DIR || '/data',
  publicOrigin: (env.PUBLIC_ORIGIN || 'http://localhost:8080').replace(/\/$/, ''),
  googleDomain: env.GOOGLE_DOMAIN || 'www.google.com',
  hl: env.GOOGLE_HL || 'en',
  gl: env.GOOGLE_GL || 'us',
  forwardClientUa: bool(env.FORWARD_CLIENT_UA, true),
  aioWaitMs: int(env.AIO_WAIT_MS, 2500),
  browserConcurrency: int(env.BROWSER_CONCURRENCY, 3),
  claude: {
    bin: env.CLAUDE_BIN || 'claude',
    model: env.CLAUDE_MODEL || 'sonnet',
    maxTurns: int(env.OVERVIEW_MAX_TURNS, 12),
    timeoutMs: int(env.OVERVIEW_TIMEOUT_MS, 150000),
    cacheTtlS: int(env.OVERVIEW_CACHE_TTL_S, 3600),
    concurrency: int(env.OVERVIEW_CONCURRENCY, 2),
  },
  vncTarget: env.VNC_TARGET || 'http://127.0.0.1:6080',
};
