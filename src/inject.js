const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const OVERVIEW_CSS = `
.galt{--galt-bg:#f3f6fc;--galt-fg:#1f1f1f;--galt-muted:#5f6368;--galt-line:#dfe3ea;--galt-accent:#0b57d0;--galt-chip:#e8f0fe;
  box-sizing:border-box;margin:0 0 20px;padding:16px 18px;border-radius:20px;background:var(--galt-bg);color:var(--galt-fg);
  font-family:Google Sans,Roboto,Arial,sans-serif;font-size:15px;line-height:1.5;max-width:100%;overflow-wrap:anywhere}
@media (prefers-color-scheme:dark){.galt{--galt-bg:#1f2125;--galt-fg:#e3e3e3;--galt-muted:#9aa0a6;--galt-line:#3c4043;--galt-accent:#a8c7fa;--galt-chip:#2c3a4d}}
.galt *{box-sizing:border-box}
.galt-head{display:flex;align-items:center;gap:8px;margin-bottom:10px;font-size:13px;color:var(--galt-muted)}
.galt-badge{display:inline-flex;align-items:center;gap:6px;font-weight:600;color:var(--galt-fg);font-size:14px}
.galt-badge::before{content:"";width:16px;height:16px;border-radius:50%;background:conic-gradient(from 90deg,#4285f4,#9b72cb,#d96570,#4285f4)}
.galt-status{margin-left:auto;font-variant-numeric:tabular-nums}
.galt-body p{margin:0 0 10px}.galt-body p:last-child{margin-bottom:0}
.galt-body ul,.galt-body ol{margin:6px 0 10px;padding-left:22px}.galt-body li{margin:3px 0}
.galt-body h3,.galt-body h4,.galt-body h5{font-size:15px;margin:12px 0 6px;font-weight:600}
.galt-body code{font-family:ui-monospace,Menlo,Consolas,monospace;font-size:13px;background:var(--galt-chip);padding:1px 5px;border-radius:5px}
.galt-body pre{background:var(--galt-chip);padding:10px 12px;border-radius:10px;overflow-x:auto}
.galt-body pre code{background:none;padding:0}
.galt-body a{color:var(--galt-accent);text-decoration:none}.galt-body a:hover{text-decoration:underline}
.galt-body table{border-collapse:collapse;margin:8px 0;max-width:100%;display:block;overflow-x:auto}
.galt-body th,.galt-body td{border:1px solid var(--galt-line);padding:4px 8px;text-align:left}
.galt-cite{font-size:11px;line-height:0;margin-left:1px}
.galt-cite a{display:inline-block;min-width:16px;padding:0 4px;border-radius:8px;background:var(--galt-chip);color:var(--galt-accent);text-align:center;vertical-align:baseline;line-height:16px}
.galt-sources{margin-top:12px;padding-top:10px;border-top:1px solid var(--galt-line)}
.galt-sources-label{font-size:12px;font-weight:600;color:var(--galt-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em}
.galt-sources ol{margin:0;padding-left:20px;font-size:13px}.galt-sources li{margin:3px 0}
.galt-sources a{color:var(--galt-fg);text-decoration:none}
.galt-src-host{color:var(--galt-muted);margin-left:6px;font-size:12px}
.galt-spinner{width:22px;height:22px;border:3px solid var(--galt-line);border-top-color:var(--galt-accent);border-radius:50%;animation:galt-spin .9s linear infinite;margin:6px 0}
@keyframes galt-spin{to{transform:rotate(360deg)}}
.galt-error{color:#b3261e}
.galt-retry{margin-top:8px;font-size:13px;color:var(--galt-accent);background:none;border:0;padding:0;cursor:pointer;font-family:inherit}
`;

export const OVERVIEW_SCRIPT = `
(function(){
  var root=document.getElementById('galt-aio'); if(!root) return;
  var q=root.getAttribute('data-q'), body=root.querySelector('.galt-body'), status=root.querySelector('.galt-status');
  var t0=Date.now(), tick=setInterval(function(){ status.textContent='Searching\\u2026 '+Math.round((Date.now()-t0)/1000)+'s'; },1000);
  function done(){ clearInterval(tick); }
  function load(){
    body.innerHTML='<div class="galt-spinner"></div>';
    fetch('/api/overview?q='+encodeURIComponent(q),{credentials:'same-origin'})
      .then(function(r){ return r.json().then(function(d){ if(!r.ok) throw new Error(d.error||('HTTP '+r.status)); return d; }); })
      .then(function(d){ done(); body.innerHTML=d.html; status.textContent=d.cached?'cached':(Math.round(d.ms/100)/10)+'s'; })
      .catch(function(e){ done(); status.textContent=''; body.innerHTML='<div class="galt-error">Overview failed: '+String(e.message||e).replace(/[<>&]/g,'')+'</div><button class="galt-retry" type="button">Try again</button>'; body.querySelector('.galt-retry').onclick=function(){ t0=Date.now(); tick=setInterval(function(){ status.textContent='Searching\\u2026 '+Math.round((Date.now()-t0)/1000)+'s'; },1000); load(); }; });
  }
  load();
})();
`;

export function overviewBlock(q) {
  return `<div id="galt-aio" class="galt" data-q="${esc(q)}">
  <div class="galt-head"><span class="galt-badge">AI Overview</span><span class="galt-by">by Claude</span><span class="galt-status">Searching…</span></div>
  <div class="galt-body"><div class="galt-spinner"></div></div>
</div>`;
}

/**
 * Splice our block, CSS, and script into the rewritten Google page.
 */
export function injectOverview(html, q, placeholderId) {
  const head = `<style id="galt-css">${OVERVIEW_CSS}</style><link rel="search" type="application/opensearchdescription+xml" title="Google (Claude overview)" href="/opensearch.xml">`;
  let out = html.includes('</head>') ? html.replace('</head>', head + '</head>') : head + html;
  const ph = new RegExp(`<div id="${placeholderId}"></div>`);
  out = out.replace(ph, overviewBlock(q));
  const script = `<script id="galt-js">${OVERVIEW_SCRIPT}</script>`;
  out = out.includes('</body>') ? out.replace('</body>', script + '</body>') : out + script;
  return out;
}
