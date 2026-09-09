const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const shell = (title, body) => `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<link rel="search" type="application/opensearchdescription+xml" title="Google (Claude overview)" href="/opensearch.xml">
<style>
:root{color-scheme:light dark;--fg:#1f1f1f;--muted:#5f6368;--bg:#fff;--line:#dadce0;--accent:#0b57d0}
@media (prefers-color-scheme:dark){:root{--fg:#e3e3e3;--muted:#9aa0a6;--bg:#1f2125;--line:#3c4043;--accent:#a8c7fa}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.5 Google Sans,Roboto,Arial,sans-serif}
main{max-width:640px;margin:0 auto;padding:12vh 20px 40px}
h1{font-size:28px;font-weight:500;margin:0 0 20px;text-align:center}
form{display:flex;gap:8px}
input[type=search]{flex:1;font:inherit;padding:12px 16px;border:1px solid var(--line);border-radius:24px;background:transparent;color:inherit;outline:none}
input[type=search]:focus{border-color:var(--accent)}
button{font:inherit;padding:12px 18px;border:0;border-radius:24px;background:var(--accent);color:#fff;cursor:pointer}
.meta{margin-top:40px;color:var(--muted);font-size:14px}.meta a{color:var(--accent)}
.card{border:1px solid var(--line);border-radius:12px;padding:16px;margin-top:16px}
code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px}
.err{color:#b3261e}
</style></head><body><main>${body}</main></body></html>`;

export function homePage({ origin, status, claude }) {
  const claudeLine = claude.loggedIn
    ? `Claude: <strong>logged in</strong> (${esc(claude.via)}).`
    : 'Claude: <strong class="err">not logged in</strong>. Run <code>docker exec -it google-alt claude</code> and use <code>/login</code>.';
  const signIn = status.signedIn
    ? 'Google session: <strong>signed in</strong>.'
    : 'Google session: <strong class="err">not signed in</strong>. <a href="/vnc">Open the browser</a> and sign in once.';
  return shell('Search', `
<h1>Search</h1>
<form action="/search" method="get"><input type="search" name="q" placeholder="Search Google" autofocus autocomplete="off"><button type="submit">Go</button></form>
<div class="meta">
  <div class="card">${signIn} · <a href="/vnc">Remote browser</a> · <a href="/healthz">Status</a></div>
  <div class="card">${claudeLine}</div>
  <div class="card">Add as a search engine: <code>${esc(origin)}/search?q=%s</code><br>Firefox desktop will also offer it from the address bar.</div>
</div>`);
}

export function errorPage({ title, message, q, showVnc }) {
  return shell(title, `
<h1>${esc(title)}</h1>
<div class="card"><p>${esc(message)}</p>
${showVnc ? '<p><a href="/vnc">Open the remote browser</a> to sign in or solve the challenge, then reload this page.</p>' : ''}
${q ? `<p><a href="https://www.google.com/search?q=${encodeURIComponent(q)}">Open this search on google.com instead</a></p>` : ''}
</div>`);
}

export function opensearchXml(origin) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<OpenSearchDescription xmlns="http://a9.com/-/spec/opensearch/1.1/">
  <ShortName>Google (Claude)</ShortName>
  <Description>Google results with a Claude AI overview</Description>
  <InputEncoding>UTF-8</InputEncoding>
  <Url type="text/html" method="get" template="${esc(origin)}/search?q={searchTerms}"/>
  <Url type="application/x-suggestions+json" template="https://suggestqueries.google.com/complete/search?client=firefox&amp;q={searchTerms}"/>
  <Image width="16" height="16">${esc(origin)}/favicon.ico</Image>
</OpenSearchDescription>`;
}
