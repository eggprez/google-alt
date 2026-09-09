const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const PAGE_CSS = `
.galt{--galt-bg:#f3f6fc;--galt-fg:#1f1f1f;--galt-muted:#5f6368;--galt-line:#dfe3ea;--galt-accent:#0b57d0;--galt-chip:#e8f0fe;--galt-purple:#7c3aed;
  box-sizing:border-box;margin:0 0 24px;padding:16px 18px;border-radius:20px;background:var(--galt-bg);color:var(--galt-fg);
  font-family:Google Sans,Roboto,Arial,sans-serif;font-size:15px;line-height:1.5;max-width:100%;overflow-wrap:anywhere}
/* Dark is decided by the page Google served (html.galt-dark, set in rewrite.js), never by the
   viewer's prefers-color-scheme: Google ignores that, so following it would put a light card on a
   dark page or the reverse. Colours match Google's own dark SERP. */
html.galt-dark .galt{--galt-bg:#282a2f;--galt-fg:#e8e8e8;--galt-muted:#9aa0a6;--galt-line:#3f4145;--galt-accent:#99c3ff;--galt-chip:#35373d;--galt-purple:#c4b5fd}
.galt *{box-sizing:border-box}
/* Our own display rules would otherwise beat the UA stylesheet's [hidden] {display:none}. */
.galt [hidden]{display:none!important}
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
html.galt-dark .galt-flag-corrected{background:#3b2f0b;color:#fde68a;border-color:#a16207}
.galt-v-verified .galt-phase{color:#188038}.galt-v-verified .galt-phase::before{content:"\\2713\\00a0"}
.galt-v-corrected .galt-phase{color:#b45309}.galt-v-corrected .galt-phase::before{content:"\\26A0\\00a0"}
.galt-v-unverified .galt-phase,.galt-v-failed .galt-phase{color:var(--galt-muted)}
html.galt-dark .galt-v-verified .galt-phase{color:#81c995}
html.galt-dark .galt-v-corrected .galt-phase{color:#fcd34d}
.galt-retry{margin-top:8px;font-size:13px;color:var(--galt-accent);background:none;border:0;padding:0;cursor:pointer;font-family:inherit}
.galt-body h3,.galt-body h4,.galt-body h5{font-size:12px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--galt-purple);margin:14px 0 6px}
.galt-body>.galt-answer>p:first-child{font-size:16px;line-height:1.5;font-weight:500}
.galt-answer>p:first-child{font-size:16px;line-height:1.5;font-weight:500}
.galt-body li>strong:first-child{color:var(--galt-accent)}
.galt-body li::marker{color:var(--galt-purple)}
.galt-body blockquote{margin:10px 0;padding:8px 12px;border-left:3px solid var(--galt-purple);border-radius:0 8px 8px 0;background:var(--galt-chip);color:var(--galt-muted)}
.galt-body blockquote p:last-child{margin-bottom:0}
.galt-body th{background:var(--galt-chip);font-weight:600}
/* What the fact-check rewrote, in its own colour. */
.galt-fix{background:none;color:#b45309;font-weight:500;text-decoration:underline;text-decoration-style:dotted;text-underline-offset:3px}
html.galt-dark .galt-fix{color:#fbbf24}
.galt-fix *{color:inherit}
/* Follow-up questions. */
.galt-fu{margin-top:12px;padding-top:10px;border-top:1px dashed var(--galt-line)}
.galt-fu-q{display:flex;align-items:center;gap:6px;font-weight:600;font-size:14px;margin-bottom:4px}
.galt-fu-q::before{content:"";width:14px;height:14px;flex:none;border-radius:50%;background:conic-gradient(from 90deg,#5b21b6,#8b5cf6,#c084fc,#5b21b6)}
.galt-fu-a{font-size:15px;line-height:1.5}
.galt-fu-a p{margin:0 0 8px}.galt-fu-a>:last-child{margin-bottom:0}
.galt-fu-a ul,.galt-fu-a ol{margin:6px 0 8px;padding-left:22px}
.galt-fu.galt-fu-busy .galt-fu-q::before{animation:galt-spin 1.4s linear infinite}
.galt-ask{display:flex;align-items:center;gap:8px;margin-top:12px;padding:3px 3px 3px 12px;border-radius:22px;background:var(--galt-bg);border:1px solid var(--galt-line)}
.galt-ask:focus-within{border-color:var(--galt-accent);box-shadow:0 0 0 2px var(--galt-chip)}
.galt-ask-input{flex:1;min-width:0;border:0;outline:0;background:transparent;font:inherit;font-size:14px;color:var(--galt-fg);padding:6px 0}
.galt-ask-input::placeholder{color:var(--galt-muted)}
.galt-ask-go{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:50%;border:0;cursor:pointer;
  color:#fff;background:var(--galt-purple);font:inherit;font-size:15px;line-height:1}
.galt-ask-go:hover{filter:brightness(1.1)}
.galt-ask-busy .galt-ask-go{opacity:.5;pointer-events:none}
/* Mobile. Google's mobile results column is full-bleed (375px wide, no padding) and each result
   insets its own text by 16px, so a block with no margin sits edge-to-edge and lines up with
   nothing. Match Google's inset and tighten the card. */
@media (max-width:600px){
  .galt{margin:8px 12px 20px;padding:14px 15px;border-radius:16px;font-size:14.5px}
  .galt-head{gap:6px;margin-bottom:8px;font-size:12px}
  .galt-badge{font-size:13px}
  .galt-phase{max-width:100%;order:3;flex-basis:100%}
  .galt-status{margin-left:auto}
  .galt-body>.galt-answer>p:first-child,.galt-answer>p:first-child{font-size:15.5px}
  .galt-body ul,.galt-body ol{padding-left:20px}
  .galt-body table{font-size:13px}
  .galt-body th,.galt-body td{padding:4px 6px}
  .galt-flag{padding:8px 10px;font-size:12.5px}
  .galt-sources ol{padding-left:18px}
  .galt-src-host{display:block;margin-left:0}
  .galt-ask{margin-top:10px;padding-left:10px}
  .galt-ask-input{font-size:16px}
}
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
html.galt-dark .galt-menu-portal{background:#2d2f31;color:#e3e3e3;box-shadow:0 1px 3px rgba(0,0,0,.5),0 4px 8px 3px rgba(0,0,0,.3)}
html.galt-dark .galt-menu-portal a:hover{background:rgba(255,255,255,.08)}
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

// Fills the overview block: streams Claude's answer as it is written, with search activity in the
// header, swaps in the fact-checked rewrite when it lands, and takes follow-up questions.
export const OVERVIEW_SCRIPT = `
(function(){
  var root=document.getElementById('galt-aio'); if(!root) return;
  var q=root.getAttribute('data-q'), body=root.querySelector('.galt-body'), status=root.querySelector('.galt-status'), phase=root.querySelector('.galt-phase');
  var followups=root.querySelector('.galt-followups'), askForm=root.querySelector('.galt-ask'), askInput=askForm?askForm.querySelector('.galt-ask-input'):null;
  var t0, tick, es, finished, errs, ready, history=[];
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function clock(){ status.textContent=Math.round((Date.now()-t0)/1000)+'s'; }
  function stop(){ clearInterval(tick); if(es){ es.close(); es=null; } }
  function fail(msg){
    finished=true; stop(); root.classList.remove('galt-streaming'); phase.textContent=''; status.textContent='';
    body.innerHTML='<div class="galt-error">Overview failed: '+esc(msg||'unknown error')+'</div><button class="galt-retry" type="button">Try again</button>';
    body.querySelector('.galt-retry').onclick=function(){ load(); };
  }
  var LABELS={verified:'Verified',corrected:'Corrected',unverified:'Unverified',failed:'Not verified'};
  function setVerdict(v){
    root.className=root.className.replace(/\\bgalt-v-[a-z]+\\b/g,'').trim();
    phase.textContent=v&&LABELS[v]?LABELS[v]:'';
    if(v) root.classList.add('galt-v-'+v);
  }
  function finish(d){
    stop(); finished=true; ready=true; root.classList.remove('galt-streaming');
    body.innerHTML=d.html; status.textContent=d.cached?'cached':(Math.round(d.ms/100)/10)+'s';
    setVerdict(d.verification&&d.verification.status);
    if(askForm) askForm.hidden=false;
  }
  function load(){
    finished=false; errs=0; ready=false; history.length=0; t0=Date.now();
    root.className='galt galt-streaming'; phase.textContent='Searching'; clock(); tick=setInterval(clock,1000);
    body.innerHTML='<div class="galt-spinner"></div>';
    if(followups) followups.innerHTML='';
    if(askForm) askForm.hidden=true;
    var url='/api/overview?q='+encodeURIComponent(q);
    if(!window.EventSource){
      fetch(url,{credentials:'same-origin'}).then(function(r){ return r.json().then(function(d){ if(!r.ok) throw new Error(d.error||('HTTP '+r.status)); return d; }); }).then(finish).catch(function(e){ fail(e.message||e); });
      return;
    }
    es=new EventSource(url+'&stream=1');
    es.addEventListener('status',function(e){ phase.textContent=JSON.parse(e.data).text; });
    es.addEventListener('snapshot',function(e){ body.innerHTML=JSON.parse(e.data).html+'<span class="galt-cursor"></span>'; });
    es.addEventListener('quick',function(e){ body.innerHTML=JSON.parse(e.data).html; });
    // The fact-check returns the overview rewritten, not a note about it: swap the whole body.
    es.addEventListener('check',function(e){ var d=JSON.parse(e.data); body.innerHTML=d.html; setVerdict(d.verification&&d.verification.status); });
    es.addEventListener('done',function(e){ finish(JSON.parse(e.data)); });
    es.addEventListener('fail',function(e){ fail(JSON.parse(e.data).error); });
    // EventSource reconnects by itself and the server replays the run's state; give up after a few tries.
    es.onerror=function(){ if(finished||!es) return; if(this.readyState===2||++errs>3) fail('connection lost'); else phase.textContent='Reconnecting'; };
  }

  /* follow-up questions */
  var asking=false;
  if(askForm) askForm.addEventListener('submit',function(e){
    e.preventDefault();
    var question=askInput.value.trim();
    if(!question||asking||!ready) return;
    asking=true; askInput.value=''; askForm.classList.add('galt-ask-busy');
    var block=document.createElement('div');
    block.className='galt-fu galt-fu-busy';
    block.innerHTML='<div class="galt-fu-q"><span></span></div><div class="galt-fu-a"><div class="galt-spinner"></div></div>';
    block.querySelector('.galt-fu-q span').textContent=question;
    followups.appendChild(block);
    var answerEl=block.querySelector('.galt-fu-a'), answered=false;
    var ac=new AbortController();
    var abort=function(){ ac.abort(); };
    window.addEventListener('pagehide',abort,{once:true});
    fetch('/api/followup',{
      method:'POST', headers:{'Content-Type':'application/json'}, credentials:'same-origin', signal:ac.signal,
      body:JSON.stringify({q:q,question:question,history:history.slice(-3)})
    }).then(function(r){
      if(!r.ok||!r.body) return r.json().catch(function(){ return {}; }).then(function(d){ throw new Error(d.error||('HTTP '+r.status)); });
      var reader=r.body.getReader(), dec=new TextDecoder(), buf='';
      function pump(){
        return reader.read().then(function(res){
          if(res.done) return;
          buf+=dec.decode(res.value,{stream:true});
          var parts=buf.split('\\n\\n'); buf=parts.pop();
          parts.forEach(function(chunk){
            var ev='message', data='';
            chunk.split('\\n').forEach(function(line){
              if(line.indexOf('event:')===0) ev=line.slice(6).trim();
              else if(line.indexOf('data:')===0) data+=line.slice(5).trim();
            });
            if(!data) return;
            var d; try{ d=JSON.parse(data); }catch(err){ return; }
            if(ev==='snapshot') answerEl.innerHTML=d.html+'<span class="galt-cursor"></span>';
            else if(ev==='done'){ answerEl.innerHTML=d.html; answered=true; history.push({question:question,answer:d.answer||''}); }
            else if(ev==='fail') throw new Error(d.error||'follow-up failed');
          });
          return pump();
        });
      }
      return pump();
    }).then(function(){
      if(!answered) throw new Error('no answer was produced');
    }).catch(function(err){
      if(ac.signal.aborted) return;
      answerEl.innerHTML='<div class="galt-error">'+esc(err.message||'Follow-up failed.')+'</div>';
    }).then(function(){
      block.classList.remove('galt-fu-busy');
      askForm.classList.remove('galt-ask-busy');
      asking=false;
      window.removeEventListener('pagehide',abort);
      askInput.focus();
    });
  });

  window.addEventListener('pagehide',function(){ stop(); });
  // A page restored from the back/forward cache shows whatever was on screen when it was frozen,
  // and its EventSource is dead. Reload the overview; the server has it cached.
  window.addEventListener('pageshow',function(e){ if(e.persisted) load(); });
  load();
})();
`;

export function overviewBlock(q) {
  return `<div id="galt-aio" class="galt galt-streaming" data-q="${esc(q)}">
  <div class="galt-head"><span class="galt-badge">AI Overview</span><span class="galt-by">by Claude</span><span class="galt-phase">Searching</span><span class="galt-status"></span></div>
  <div class="galt-body"><div class="galt-spinner"></div></div>
  <div class="galt-followups"></div>
  <form class="galt-ask" autocomplete="off" hidden>
    <input type="text" name="question" class="galt-ask-input" placeholder="Ask a follow-up\u2026" maxlength="500" aria-label="Ask a follow-up question">
    <button type="submit" class="galt-ask-go" aria-label="Ask">\u2192</button>
  </form>
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
