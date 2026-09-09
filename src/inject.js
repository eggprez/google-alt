const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const PAGE_CSS = `
.galt{--galt-bg:#f3f6fc;--galt-fg:#1f1f1f;--galt-muted:#5f6368;--galt-line:#dfe3ea;--galt-accent:#0b57d0;--galt-chip:#e8f0fe;--galt-purple:#7c3aed;
  box-sizing:border-box;margin:0 0 24px;padding:16px 18px;border-radius:20px;background:var(--galt-bg);color:var(--galt-fg);
  font-family:Google Sans,Roboto,Arial,sans-serif;font-size:15px;line-height:1.5;max-width:100%;overflow-wrap:anywhere}
@media (prefers-color-scheme:dark){.galt{--galt-bg:#1f2125;--galt-fg:#e3e3e3;--galt-muted:#9aa0a6;--galt-line:#3c4043;--galt-accent:#a8c7fa;--galt-chip:#2c3a4d;--galt-purple:#c4b5fd}}
.galt *{box-sizing:border-box}
.galt-head{display:flex;align-items:center;gap:8px;margin-bottom:10px;font-size:13px;color:var(--galt-muted);flex-wrap:wrap}
.galt-badge{display:inline-flex;align-items:center;gap:6px;font-weight:600;color:var(--galt-fg);font-size:14px}
.galt-badge::before{content:"";width:16px;height:16px;border-radius:50%;background:conic-gradient(from 90deg,#5b21b6,#8b5cf6,#c084fc,#5b21b6)}
.galt-phase{color:var(--galt-purple);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:60%}
.galt-streaming .galt-phase::after{content:"\\2026"}
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
.galt-cite a,.galt-cite span{display:inline-block;min-width:16px;padding:0 4px;border-radius:8px;background:var(--galt-chip);color:var(--galt-accent);text-align:center;vertical-align:baseline;line-height:16px}
.galt-cursor{display:inline-block;width:8px;height:15px;margin-left:2px;vertical-align:-2px;background:var(--galt-purple);border-radius:2px;animation:galt-blink 1s steps(2) infinite}
@keyframes galt-blink{to{opacity:0}}
.galt-sources{margin-top:12px;padding-top:10px;border-top:1px solid var(--galt-line)}
.galt-sources-label{font-size:12px;font-weight:600;color:var(--galt-muted);margin-bottom:6px;text-transform:uppercase;letter-spacing:.04em}
.galt-sources ol{margin:0;padding-left:20px;font-size:13px}.galt-sources li{margin:3px 0}
.galt-sources a{color:var(--galt-fg);text-decoration:none}
.galt-src-host{color:var(--galt-muted);margin-left:6px;font-size:12px}
.galt-spinner{width:22px;height:22px;border:3px solid var(--galt-line);border-top-color:var(--galt-purple);border-radius:50%;animation:galt-spin .9s linear infinite;margin:6px 0}
@keyframes galt-spin{to{transform:rotate(360deg)}}
.galt-error{color:#b3261e}
.galt-flag{margin:0 0 12px;padding:10px 12px;border-radius:12px;font-size:13px;line-height:1.45}
.galt-flag ul{margin:6px 0 0;padding-left:18px}.galt-flag li{margin:2px 0}
.galt-flag-corrected{background:#fef3c7;color:#713f12;border:1px solid #fcd34d}
.galt-flag-muted{color:var(--galt-muted);background:transparent;border:1px dashed var(--galt-line)}
@media (prefers-color-scheme:dark){.galt-flag-corrected{background:#3b2f0b;color:#fde68a;border-color:#a16207}}
.galt-v-verified .galt-phase{color:#188038}.galt-v-verified .galt-phase::before{content:"\\2713\\00a0"}
.galt-v-corrected .galt-phase{color:#b45309}.galt-v-corrected .galt-phase::before{content:"\\26A0\\00a0"}
.galt-v-unverified .galt-phase,.galt-v-failed .galt-phase{color:var(--galt-muted)}
@media (prefers-color-scheme:dark){.galt-v-verified .galt-phase{color:#81c995}.galt-v-corrected .galt-phase{color:#fcd34d}}
.galt-retry{margin-top:8px;font-size:13px;color:var(--galt-accent);background:none;border:0;padding:0;cursor:pointer;font-family:inherit}
/* Google loads some component CSS lazily via JS, which we strip. Unsized inline icons otherwise fill the viewport. */
svg:not([width]):not([height]):not(.galt *){max-width:24px;max-height:24px}
/* Boogle wordmark */
.galt-logo-link{display:inline-flex;align-items:center;text-decoration:none}
.galt-logo{display:block;width:112px;height:34px;max-width:none;max-height:none}
/* Google's dropdowns (More, Tools, time and verbatim filters) are hidden until its scripts open them.
   An open menu is moved to <body>, because the nav strip has a transform and overflow that would clip it. */
.galt-menu-portal{opacity:1!important;position:fixed!important;z-index:2147483000;width:max-content!important;max-width:min(320px,92vw)!important;min-width:140px;
  background:#fff;color:#1f1f1f;border-radius:8px;box-shadow:0 1px 3px rgba(60,64,67,.3),0 4px 8px 3px rgba(60,64,67,.15);overflow:hidden!important;padding:6px 0;font-family:Google Sans,Roboto,Arial,sans-serif;font-size:14px}
.galt-menu-portal a{display:block;padding:10px 16px;color:inherit;text-decoration:none;white-space:nowrap}
.galt-menu-portal a:hover{background:rgba(60,64,67,.08)}
.galt-menu-portal [role="button"]{cursor:pointer;padding:10px 16px;white-space:nowrap}
@media (prefers-color-scheme:dark){.galt-menu-portal{background:#2d2f31;color:#e3e3e3;box-shadow:0 1px 3px rgba(0,0,0,.5),0 4px 8px 3px rgba(0,0,0,.3)}
  .galt-menu-portal a:hover{background:rgba(255,255,255,.08)}}
`;

// Runs on every proxied results page. Restores the bits of Google's UI that its scripts drove.
export const PAGE_SCRIPT = `
(function(){
  // Enter in the search box submits it (Google's box is a textarea, so Enter would add a newline).
  document.querySelectorAll('textarea[name="q"], input[name="q"]').forEach(function(el){
    el.addEventListener('keydown', function(e){
      if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
      e.preventDefault();
      var q = el.value.trim(); if (!q) return;
      var f = el.form;
      if (f) { if (f.requestSubmit) f.requestSubmit(); else f.submit(); }
      else location.href = '/search?q=' + encodeURIComponent(q);
    });
  });
  document.querySelectorAll('[aria-label="Clear"][role="button"]').forEach(function(b){
    b.addEventListener('click', function(){
      var q = document.querySelector('textarea[name="q"], input[name="q"]');
      if (q) { q.value = ''; q.focus(); }
    });
  });

  // Dropdown menus: a [jscontroller=eBYPP] holds a trigger ([jsname=oYxtQd]) and a hidden panel
  // ([jsname=H9P06b]) whose child ([jsname=xl07Ob]) is the menu. The Tools button (#hdtb-tls)
  // opens the panel that lives in #hdtb. Open menus are moved to <body> and positioned by hand.
  function panelFor(t){
    if (t.id === 'hdtb-tls') return document.querySelector('#hdtb [jsname="H9P06b"]');
    var c = t.closest('[jscontroller="eBYPP"]');
    return c && c.querySelector(':scope > [jsname="H9P06b"]');
  }
  function ownerPanel(el){ var m = el && el.closest('.galt-menu-portal'); return m ? m.__galtPanel : null; }
  function closeMenu(panel){
    var menu = panel.__galtMenu; if (!menu) return;
    menu.classList.remove('galt-menu-portal'); menu.style.left = menu.style.top = '';
    panel.appendChild(menu); panel.__galtMenu = null;
    var t = panel.__galtTrigger; if (t) t.setAttribute('aria-expanded', 'false');
  }
  function closeMenus(keep){
    var chain = []; for (var p = keep; p; p = ownerPanel(p.__galtTrigger)) chain.push(p);
    document.querySelectorAll('.galt-menu-portal').forEach(function(m){ if (chain.indexOf(m.__galtPanel) < 0) closeMenu(m.__galtPanel); });
  }
  document.addEventListener('click', function(e){
    var t = e.target.closest('[jscontroller="eBYPP"] [jsname="oYxtQd"], #hdtb-tls');
    if (!t) { if (!e.target.closest('.galt-menu-portal')) closeMenus(); return; }
    var panel = panelFor(t); if (!panel) return;
    e.preventDefault();
    if (panel.__galtMenu) { closeMenu(panel); return; }
    var menu = panel.querySelector(':scope > [jsname="xl07Ob"]') || panel.firstElementChild; if (!menu) return;
    panel.__galtMenu = menu; panel.__galtTrigger = t; menu.__galtPanel = panel;
    closeMenus(panel);
    document.body.appendChild(menu); menu.classList.add('galt-menu-portal');
    t.setAttribute('aria-expanded', 'true');
    var tr = t.getBoundingClientRect(), nested = !!ownerPanel(t);
    var left = nested ? tr.right + 2 : tr.left, top = nested ? tr.top - 6 : tr.bottom + 4;
    menu.style.left = left + 'px'; menu.style.top = top + 'px';
    var mr = menu.getBoundingClientRect();
    if (mr.right > window.innerWidth - 8) menu.style.left = Math.max(4, left - (mr.right - window.innerWidth + 8)) + 'px';
    if (mr.bottom > window.innerHeight - 8) menu.style.top = Math.max(4, top - (mr.bottom - window.innerHeight + 8)) + 'px';
  });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape') closeMenus(); });
  window.addEventListener('scroll', function(){ closeMenus(); }, { passive: true });
})();
`;

// Fills the overview block: streams Claude's answer as it is written, with search activity in the header.
export const OVERVIEW_SCRIPT = `
(function(){
  var root=document.getElementById('galt-aio'); if(!root) return;
  var q=root.getAttribute('data-q'), body=root.querySelector('.galt-body'), status=root.querySelector('.galt-status'), phase=root.querySelector('.galt-phase');
  var t0, tick, es, finished, errs;
  function clock(){ status.textContent=Math.round((Date.now()-t0)/1000)+'s'; }
  function stop(){ clearInterval(tick); if(es){ es.close(); es=null; } }
  function fail(msg){
    stop(); root.classList.remove('galt-streaming'); phase.textContent=''; status.textContent='';
    body.innerHTML='<div class="galt-error">Overview failed: '+String(msg||'unknown error').replace(/[<>&]/g,'')+'</div><button class="galt-retry" type="button">Try again</button>';
    body.querySelector('.galt-retry').onclick=load;
  }
  var LABELS={verified:'Verified',corrected:'Corrected',unverified:'Unverified',failed:'Not verified'};
  function finish(d){
    stop(); finished=true; root.classList.remove('galt-streaming');
    body.innerHTML=d.html; status.textContent=d.cached?'cached':(Math.round(d.ms/100)/10)+'s';
    var v=d.verification&&d.verification.status;
    phase.textContent=v?LABELS[v]||'':'';
    if(v) root.classList.add('galt-v-'+v);
  }
  function load(){
    finished=false; errs=0; t0=Date.now(); root.className='galt galt-streaming'; phase.textContent='Searching'; clock(); tick=setInterval(clock,1000);
    body.innerHTML='<div class="galt-spinner"></div>';
    var url='/api/overview?q='+encodeURIComponent(q);
    if(!window.EventSource){
      fetch(url,{credentials:'same-origin'}).then(function(r){ return r.json().then(function(d){ if(!r.ok) throw new Error(d.error||('HTTP '+r.status)); return d; }); }).then(finish).catch(function(e){ fail(e.message||e); });
      return;
    }
    es=new EventSource(url+'&stream=1');
    es.addEventListener('status',function(e){ phase.textContent=JSON.parse(e.data).text; });
    es.addEventListener('snapshot',function(e){ body.innerHTML=JSON.parse(e.data).html+'<span class="galt-cursor"></span>'; });
    es.addEventListener('quick',function(e){ body.innerHTML=JSON.parse(e.data).html; });
    es.addEventListener('done',function(e){ finish(JSON.parse(e.data)); });
    es.addEventListener('fail',function(e){ fail(JSON.parse(e.data).error); });
    // EventSource reconnects by itself and the server replays the run's state; give up after a few tries.
    es.onerror=function(){ if(finished) return; if(es.readyState===2||++errs>3) fail('connection lost'); else phase.textContent='Reconnecting'; };
  }
  load();
})();
`;

export function overviewBlock(q) {
  return `<div id="galt-aio" class="galt galt-streaming" data-q="${esc(q)}">
  <div class="galt-head"><span class="galt-badge">AI Overview</span><span class="galt-by">by Claude</span><span class="galt-phase">Searching</span><span class="galt-status"></span></div>
  <div class="galt-body"><div class="galt-spinner"></div></div>
</div>`;
}

/**
 * Splice our CSS, page script, and (when Google had an overview) the overview block into the
 * rewritten Google page.
 */
export function injectPage(html, { q, placeholderId, hadOverview }) {
  const head = `<style id="galt-css">${PAGE_CSS}</style><link rel="search" type="application/opensearchdescription+xml" title="Boogle" href="/opensearch.xml">`;
  let out = html.includes('</head>') ? html.replace('</head>', head + '</head>') : head + html;
  let scripts = `<script id="galt-page-js">${PAGE_SCRIPT}</script>`;
  if (hadOverview) {
    const ph = `<div id="${placeholderId}"></div>`;
    if (out.includes(ph)) {
      out = out.replace(ph, overviewBlock(q));
      scripts += `<script id="galt-js">${OVERVIEW_SCRIPT}</script>`;
    }
  }
  out = out.includes('</body>') ? out.replace('</body>', scripts + '</body>') : out + scripts;
  return out;
}
