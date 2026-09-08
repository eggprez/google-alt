import express from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { config } from './config.js';
import { fetchGoogle, browserStatus, closeBrowser, getContext, PLACEHOLDER_ID } from './browser.js';
import { getOverview, cacheStats } from './overview.js';
import { injectOverview } from './inject.js';
import { homePage, errorPage, opensearchXml } from './pages.js';

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', true);

const log = (...a) => console.log(new Date().toISOString(), ...a);

// Params we forward to Google for a web search. Everything else is dropped.
const PASS = ['q', 'start', 'num', 'hl', 'gl', 'lr', 'cr', 'safe', 'tbs', 'filter', 'nfpr', 'spell', 'udm', 'oq', 'as_q', 'as_epq', 'as_oq', 'as_eq', 'as_sitesearch', 'as_filetype', 'ie', 'oe'];

function isWebSearch(query) {
  if (query.tbm) return false;
  if (query.udm && query.udm !== '14') return false;
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
  res.json({ ok: browser.running, browser, overview: cacheStats(), model: config.claude.model });
});

app.get('/', async (req, res) => {
  const status = await browserStatus();
  res.type('html').send(homePage({ origin: config.publicOrigin, status }));
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
    let html = result.html;
    if (result.hadOverview) html = injectOverview(html, q, PLACEHOLDER_ID);
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

app.get('/api/overview', async (req, res) => {
  const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  if (!q) return res.status(400).json({ error: 'missing q' });
  const t0 = Date.now();
  try {
    const r = await getOverview(q);
    log(`overview "${q}" ${Date.now() - t0}ms cached=${r.cached} cost=${r.cost ?? '?'} turns=${r.turns ?? '?'}`);
    res.set('Cache-Control', 'private, no-store');
    res.json({ html: r.html, sources: r.sources, ms: r.ms, cached: r.cached, cost: r.cost, model: r.model });
  } catch (e) {
    log('overview error', e.message);
    res.status(502).json({ error: e.message });
  }
});

// noVNC for the one-time Google login. Only reachable through this app (and your SSO in front of it).
app.get('/vnc', (req, res) => res.redirect(302, '/vnc/vnc.html?autoconnect=true&resize=scale&path=vnc/websockify'));
const vncProxy = createProxyMiddleware({
  pathFilter: '/vnc/',
  target: config.vncTarget,
  changeOrigin: true,
  ws: true,
  pathRewrite: { '^/vnc/': '/' },
});
app.use(vncProxy);

app.use((req, res) => res.status(404).type('html').send(errorPage({ title: 'Not found', message: req.path })));

const server = app.listen(config.port, () => {
  log(`google-alt listening on :${config.port} as ${config.publicOrigin}`);
  getContext().then(() => log('browser ready')).catch((e) => log('browser failed to start', e));
});
server.on('upgrade', vncProxy.upgrade);
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
