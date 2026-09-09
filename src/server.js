import express from 'express';
import { timingSafeEqual } from 'node:crypto';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { config } from './config.js';
import { fetchGoogle, browserStatus, closeBrowser, getContext, PLACEHOLDER_ID } from './browser.js';
import { cacheStats, claudeAuthStatus, rememberResults } from './overview.js';
import { overviewHandler } from './api.js';
import { injectPage } from './inject.js';
import { homePage, errorPage, opensearchXml } from './pages.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);

const log = (...a) => console.log(new Date().toISOString(), ...a);

// Optional shared secret so only traffic that came through the reverse proxy is served.
function hasProxySecret(headers) {
  if (!config.proxySecret) return true;
  const given = headers['x-proxy-secret'];
  if (typeof given !== 'string') return false;
  const a = Buffer.from(given);
  const b = Buffer.from(config.proxySecret);
  return a.length === b.length && timingSafeEqual(a, b);
}
// Paths that don't need the secret: the health check, browser discovery files, and noVNC's static
// assets. Reverse proxies with asset caching (e.g. NPM "Cache Assets") serve *.js/*.css through a
// separate location that lacks custom headers. The websocket itself is still gated (see 'upgrade').
const SECRET_EXEMPT = /^\/(healthz|opensearch\.xml|favicon\.ico|vnc\/(?!websockify).*)$/;
app.use((req, res, next) => {
  if (SECRET_EXEMPT.test(req.path) || hasProxySecret(req.headers)) return next();
  res.status(403).type('text').send('Forbidden: missing or invalid X-Proxy-Secret');
});

// Params we forward to Google for a web search. Everything else is dropped.
const PASS = ['q', 'start', 'num', 'hl', 'gl', 'lr', 'cr', 'safe', 'tbs', 'filter', 'nfpr', 'spell', 'udm', 'oq', 'as_q', 'as_epq', 'as_oq', 'as_eq', 'as_sitesearch', 'as_filetype', 'ie', 'oe'];

function isWebSearch(query) {
  if (query.tbm) return false;
  if (query.udm && query.udm !== '14' && query.udm !== 'web') return false;
  return true;
}

function buildGoogleUrl(query, all = false) {
  const u = new URL(`https://${config.googleDomain}/search`);
  for (const [k, v] of Object.entries(query)) {
    if (typeof v !== 'string') continue;
    if (all || PASS.includes(k)) u.searchParams.set(k, v);
  }
  if (!u.searchParams.has('hl') && config.hl) u.searchParams.set('hl', config.hl);
  if (!u.searchParams.has('gl') && config.gl) u.searchParams.set('gl', config.gl);
  return u;
}

app.get('/healthz', async (req, res) => {
  const browser = await browserStatus();
  res.json({ ok: browser.running, browser, claude: { ...claudeAuthStatus(), model: config.claude.model }, overview: cacheStats() });
});

app.get('/', async (req, res) => {
  const status = await browserStatus();
  res.type('html').send(homePage({ origin: config.publicOrigin, status, claude: claudeAuthStatus() }));
});

app.get('/opensearch.xml', (req, res) => {
  res.type('application/opensearchdescription+xml').send(opensearchXml(config.publicOrigin));
});

app.get('/favicon.ico', (req, res) => res.redirect(302, `https://${config.googleDomain}/favicon.ico`));

app.get('/search', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) return res.redirect(302, '/');
  if (!isWebSearch(req.query)) {
    // Images, News, Maps, etc. are Google as normal.
    return res.redirect(302, buildGoogleUrl(req.query, true).href);
  }
  const googleUrl = buildGoogleUrl(req.query);
  const t0 = Date.now();
  try {
    const result = await fetchGoogle(googleUrl, {
      clientUa: req.get('user-agent'),
      acceptLanguage: req.get('accept-language'),
    });
    log(`search "${q}" ${Date.now() - t0}ms overview=${result.hadOverview} blocked=${result.blocked || 'no'}`);
    if (result.blocked) {
      const messages = {
        captcha: 'Google is asking the remote browser to prove it is not a robot.',
        consent: 'Google is showing a consent screen in the remote browser.',
        unexpected: `Google returned an unexpected page (${result.title || result.finalUrl}).`,
      };
      return res.status(503).type('html').send(errorPage({
        title: 'Google needs attention',
        message: messages[result.blocked] || 'Unexpected response from Google.',
        q,
        showVnc: true,
      }));
    }
    if (result.hadOverview) rememberResults(q, result.results);
    const html = injectPage(result.html, { q, placeholderId: PLACEHOLDER_ID, hadOverview: result.hadOverview });
    res.set({
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex, nofollow',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Galt-Overview': result.hadOverview ? '1' : '0',
    });
    res.type('html').send(html);
  } catch (e) {
    log('search error', e);
    res.status(502).type('html').send(errorPage({
      title: 'Search failed',
      message: `The remote browser could not load Google: ${e.message}`,
      q,
      showVnc: true,
    }));
  }
});

app.get('/api/overview', overviewHandler);

// noVNC for the one-time Google login. Only reachable through this app (and your SSO in front of it).
app.get('/vnc', (req, res) => res.redirect(302, '/vnc/vnc.html?autoconnect=true&resize=scale&path=vnc/websockify'));
// ws is deliberately false: with ws:true the library grabs the server's upgrade event itself after
// the first request and ignores our handler below, which does the X-Proxy-Secret check.
const vncProxy = createProxyMiddleware({
  pathFilter: '/vnc/',
  target: config.vncTarget,
  changeOrigin: true,
  ws: false,
  pathRewrite: { '^/vnc/': '/' },
  on: {
    error: (err, req) => log('vnc proxy error', req?.url, err.message),
  },
});
app.use(vncProxy);

app.use((req, res) => res.status(404).type('html').send(errorPage({ title: 'Not found', message: req.path })));

const server = app.listen(config.port, () => {
  log(`google-alt listening on :${config.port} as ${config.publicOrigin}`);
  getContext().then(() => log('browser ready')).catch((e) => log('browser failed to start', e));
});
server.on('upgrade', (req, socket, head) => {
  if (!req.url.startsWith('/vnc/')) { socket.destroy(); return; }
  if (!hasProxySecret(req.headers)) {
    log(`vnc websocket rejected: missing/invalid X-Proxy-Secret (from ${req.headers['x-forwarded-for'] || socket.remoteAddress})`);
    socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }
  log(`vnc websocket ${req.url}`);
  vncProxy.upgrade(req, socket, head);
});
server.requestTimeout = 0;
server.headersTimeout = 65000;

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, async () => {
    log(`${sig} received, shutting down`);
    server.close();
    await closeBrowser();
    process.exit(0);
  });
}
