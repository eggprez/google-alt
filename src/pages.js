// Boogle's own pages: the home screen and the error screen. Same design system as the skin
// applied to proxied Google results, so the whole product looks like one thing.
import { TOKENS_CSS, LOGO_CSS, FONT_LINKS, ICONS, wordmark } from './theme.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const PAGE_CSS = `
*{box-sizing:border-box}
html{color-scheme:light dark;font-size:clamp(16px,.3vw + 11.5px,18px)}
body{margin:0;font-family:var(--font);font-size:.9375rem;line-height:1.55;color:var(--fg);background:var(--bg);
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;min-height:100vh;display:flex;flex-direction:column;
  position:relative;overflow-x:hidden}
a{color:var(--link);text-decoration:none}
a:hover{text-decoration:underline;text-underline-offset:2px}
code,kbd{font-family:var(--mono);font-size:.85em;background:var(--bg-2);border:1px solid var(--border);border-radius:6px;padding:.1em .45em}
:focus-visible{outline:2px solid var(--accent-2);outline-offset:2px;border-radius:6px}
.glow{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}
.blob{position:absolute;border-radius:50%;filter:blur(60px);opacity:.5;animation:galt-float 16s ease-in-out infinite;will-change:transform}
.b1{width:48vw;height:48vw;left:-10vw;top:-16vw;background:radial-gradient(circle,var(--accent) 0%,transparent 62%)}
.b2{width:44vw;height:44vw;right:-12vw;top:8vh;background:radial-gradient(circle,var(--accent-3) 0%,transparent 62%);animation-delay:-6s;animation-direction:reverse}
.b3{width:40vw;height:40vw;left:22vw;bottom:-22vw;background:radial-gradient(circle,var(--accent-4) 0%,transparent 62%);animation-delay:-11s}
@keyframes galt-float{0%,100%{transform:translate(0,0)}50%{transform:translate(2%,3%)}}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) .blob{opacity:.32}}
.glow-grid{position:absolute;inset:0;background-image:radial-gradient(color-mix(in srgb,var(--fg) 9%,transparent) 1px,transparent 1px);
  background-size:26px 26px;mask-image:radial-gradient(ellipse 60% 55% at 50% 40%,#000 20%,transparent 75%);
  -webkit-mask-image:radial-gradient(ellipse 60% 55% at 50% 40%,#000 20%,transparent 75%);opacity:.6}
main{position:relative;z-index:1;flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;
  padding:0 20px 8vh;animation:galt-rise .5s ease}
main.narrow{justify-content:flex-start;padding-top:12vh;max-width:720px;margin:0 auto;align-items:stretch}
.pill{display:inline-flex;align-items:center;gap:6px;margin-bottom:22px;padding:6px 14px 6px 10px;border-radius:999px;
  font-size:.7812rem;font-weight:600;color:var(--accent-ink);background:color-mix(in srgb,var(--card) 75%,transparent);
  border:1px solid color-mix(in srgb,var(--accent) 30%,var(--border));backdrop-filter:blur(8px);box-shadow:var(--shadow-sm)}
.pill svg{width:14px;height:14px;color:var(--accent-4)}
.pill.bad{color:var(--danger);border-color:color-mix(in srgb,var(--danger) 35%,var(--border))}
.pill.bad svg{color:var(--danger)}
.galt-logo-lg{margin-bottom:10px}
.tagline{margin:0 0 30px;color:var(--muted);font-size:.9375rem}
.tagline b{color:var(--fg-2);font-weight:600}
.sb{position:relative;display:flex;align-items:center;width:100%;max-width:clamp(660px,46vw,960px);height:56px;padding:0 10px 0 20px;
  background:var(--card);border:1px solid var(--border-2);border-radius:999px;box-shadow:var(--shadow-sm);
  transition:box-shadow .2s,border-color .2s}
.sb:hover{border-color:color-mix(in srgb,var(--accent) 35%,var(--border-2));box-shadow:var(--shadow)}
.sb:focus-within{border-color:color-mix(in srgb,var(--accent) 55%,var(--border-2));box-shadow:0 0 0 4px var(--accent-soft),var(--shadow-lg)}
.sb-icon{color:var(--muted);display:inline-flex;margin-right:12px}
.sb:focus-within .sb-icon{color:var(--accent-ink)}
.sb-input{flex:1;min-width:0;border:0;outline:0;background:transparent;font:inherit;font-size:1.125rem;color:var(--fg)}
.sb-input::placeholder{color:var(--muted)}
.sb-go{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;border:0;cursor:pointer;
  color:#fff;background:linear-gradient(120deg,var(--accent),var(--accent-2));box-shadow:0 2px 8px var(--accent-glow);transition:transform .15s}
.sb-go:hover{transform:scale(1.06)}
.hint{margin-top:22px;color:var(--muted);font-size:.8125rem;text-align:center}
.cards{display:grid;gap:12px;margin-top:26px;width:100%;max-width:clamp(660px,46vw,960px)}
.card{position:relative;z-index:1;display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:14px 18px;border-radius:16px;
  border:1px solid var(--border);background:color-mix(in srgb,var(--card) 88%,transparent);backdrop-filter:blur(8px);
  box-shadow:var(--shadow-sm);font-size:.875rem;color:var(--fg-2)}
.card strong{color:var(--fg);font-weight:600}
.card .spacer{flex:1}
.card a{color:var(--accent-ink);font-weight:500}
.dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--ok);box-shadow:0 0 0 3px color-mix(in srgb,var(--ok) 20%,transparent);flex:none}
.dot.bad{background:var(--danger);box-shadow:0 0 0 3px color-mix(in srgb,var(--danger) 20%,transparent)}
h1{font-size:1.75rem;font-weight:650;letter-spacing:-.02em;margin:0 0 8px}
p.lead{color:var(--fg-2);margin:0 0 20px;font-size:1rem}
.foot{position:relative;z-index:1;display:flex;justify-content:space-between;gap:12px;padding:16px 26px;color:var(--muted);font-size:.8125rem}
.err{color:var(--danger)}
@media (max-width:700px){.galt-logo-lg{font-size:clamp(56px,16vw,80px)}main.narrow{padding-top:8vh}}
`;

const shell = (title, body, bodyClass = '') => `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="referrer" content="no-referrer">
<link rel="search" type="application/opensearchdescription+xml" title="Boogle" href="/opensearch.xml">
${FONT_LINKS}
<style>${TOKENS_CSS}${LOGO_CSS}${PAGE_CSS}</style></head>
<body class="${esc(bodyClass)}">
<div class="glow" aria-hidden="true"><span class="blob b1"></span><span class="blob b2"></span><span class="blob b3"></span><div class="glow-grid"></div></div>
${body}
</body></html>`;

const searchBox = (q = '', autofocus = false) => `<form class="sb" action="/search" method="get" role="search" autocomplete="off">
  <span class="sb-icon">${ICONS.search}</span>
  <input class="sb-input" type="text" name="q" value="${esc(q)}" placeholder="Search the web" aria-label="Search"${autofocus ? ' autofocus' : ''} spellcheck="false" autocapitalize="off" autocorrect="off" maxlength="512" required>
  <button type="submit" class="sb-go" aria-label="Search">${ICONS.arrowRight}</button>
</form>`;

export function homePage({ origin, status, claude }) {
  const claudeOk = !!claude.loggedIn;
  const googleOk = !!status.signedIn;
  return shell('Boogle', `
<main>
  <span class="pill${claudeOk ? '' : ' bad'}">${ICONS.bolt} ${claudeOk ? `AI Overview · ${esc(claude.via)}` : 'Claude is not logged in'}</span>
  ${wordmark('lg', '/')}
  <p class="tagline">Google's results. A <b>Claude</b> overview instead of Google's.</p>
  ${searchBox('', true)}
  <div class="cards">
    <div class="card"><span class="dot${googleOk ? '' : ' bad'}"></span>
      ${googleOk ? 'Google session <strong>signed in</strong>.' : '<strong class="err">Not signed in to Google.</strong> <a href="/vnc">Open the remote browser</a> and sign in once.'}
      <span class="spacer"></span><a href="/vnc">Remote browser</a> · <a href="/healthz">Status</a></div>
    <div class="card"><span class="dot${claudeOk ? '' : ' bad'}"></span>
      ${claudeOk ? `Claude <strong>logged in</strong> (${esc(claude.via)}).` : 'Claude <strong class="err">not logged in</strong>. Run <code>docker exec -it google-alt claude</code> and use <code>/login</code>.'}</div>
    <div class="card">Add as a search engine: <code>${esc(origin)}/search?q=%s</code></div>
  </div>
  <p class="hint">Every tab — images, news, videos — comes back through Boogle.</p>
</main>
<footer class="foot"><span>Results from Google · Overview by Claude</span><a href="/healthz">Status</a></footer>`);
}

export function errorPage({ title, message, q, showVnc }) {
  return shell(title, `
<main class="narrow">
  ${wordmark('sm', '/')}
  <h1 style="margin-top:26px">${esc(title)}</h1>
  <p class="lead">${esc(message)}</p>
  ${searchBox(q || '')}
  <div class="cards" style="max-width:none">
    ${showVnc ? '<div class="card"><a href="/vnc">Open the remote browser</a> to sign in or solve the challenge, then reload this page.</div>' : ''}
    ${q ? `<div class="card"><a href="https://www.google.com/search?q=${encodeURIComponent(q)}">Open this search on google.com instead</a></div>` : ''}
  </div>
</main>
<footer class="foot"><span>Boogle</span><a href="/">Home</a></footer>`);
}

export function opensearchXml(origin) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>Boogle</ShortName>
  <Description>Google results with a Claude AI overview</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <Url type="text/html" method="get" template="${esc(origin)}/search?q={searchTerms}"/>
  <Url type="application/x-suggestions+json" template="https://suggestqueries.google.com/complete/search?client=firefox&amp;q={searchTerms}"/>
  <Image width="16" height="16">${esc(origin)}/favicon.ico</Image>
</OpenSearchDescription>`;
}
