import { ICONS } from './theme.js';

// Scripts injected into every proxied page. Written as plain strings (no template literals inside)
// so they can be embedded in a <script> tag without escaping surprises.

// Boogle's own header: submit on Enter, the clear button, the "More" menu, and the
// back/forward cache (a page restored from it has a dead EventSource — see the overview script).
export const PAGE_SCRIPT = `
(function(){
  var form = document.querySelector('.galt-sb');
  if (form) {
    var input = form.querySelector('.galt-sb-input');
    var clear = form.querySelector('.galt-sb-clear');
    if (input) {
      input.addEventListener('keydown', function(e){
        if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
        e.preventDefault();
        if (input.value.trim()) form.requestSubmit ? form.requestSubmit() : form.submit();
      });
      input.addEventListener('input', function(){ if (clear) clear.hidden = !input.value; });
    }
    if (clear) clear.addEventListener('click', function(){ if (input) { input.value = ''; input.focus(); } clear.hidden = true; });
  }
  // Any search box Google left inside the results (a "search within" box) submits to us too.
  document.querySelectorAll('#center_col textarea[name="q"], #center_col input[name="q"]').forEach(function(el){
    el.addEventListener('keydown', function(e){
      if (e.key !== 'Enter' || e.shiftKey || e.isComposing) return;
      e.preventDefault();
      var q = el.value.trim();
      if (q) location.href = '/search?q=' + encodeURIComponent(q);
    });
  });
  // <details> menus close when you click away or press Escape.
  document.addEventListener('click', function(e){
    document.querySelectorAll('details.galt-more[open]').forEach(function(d){ if (!d.contains(e.target)) d.open = false; });
  });
  document.addEventListener('keydown', function(e){
    if (e.key === 'Escape') document.querySelectorAll('details.galt-more[open]').forEach(function(d){ d.open = false; });
  });
})();
`;

// The overview: streams Claude's answer, lists the sources it cited beside it, shows what the
// fact-check changed, and takes follow-up questions.
export const OVERVIEW_SCRIPT = `
(function(){
  var root = document.getElementById('galt-aio');
  if (!root) return;
  var card = root.querySelector('.galt');
  var body = document.getElementById('galt-body');
  var status = document.getElementById('galt-status');
  var badges = document.getElementById('galt-badges');
  var checkEl = document.getElementById('galt-check');
  var compact = document.getElementById('galt-compact');
  var actions = document.getElementById('galt-actions');
  var note = document.getElementById('galt-note');
  var followups = document.getElementById('galt-followups');
  var askForm = document.getElementById('galt-ask');
  var askInput = askForm.querySelector('.galt-ask-input');
  var side = document.getElementById('galt-side');
  var citesEl = document.getElementById('galt-cites');
  var citesCount = document.getElementById('galt-cites-count');
  var panel = side ? side.querySelector('.galt-panel') : null;
  var moreBtn = document.getElementById('galt-more-src');
  var q = root.getAttribute('data-q');
  var es = null, t0 = 0, tick = 0, finished = false, errs = 0, sources = [], ready = false;
  var history = [];

  function esc(s){ return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]; }); }
  function clock(){ status.textContent = Math.round((Date.now() - t0) / 1000) + 's'; }
  function stopClock(){ if (tick) { clearInterval(tick); tick = 0; } }
  function closeStream(){ if (es) { es.close(); es = null; } }

  /* ---- the sources panel beside the overview ---- */
  function fitPanel(){
    if (!panel || side.hidden) return;
    panel.style.setProperty('--galt-h', Math.round(card.getBoundingClientRect().height) + 'px');
    panel.classList.toggle('clipped', !panel.classList.contains('open') && panel.scrollHeight > panel.clientHeight + 1);
  }
  if (panel && window.ResizeObserver) new ResizeObserver(fitPanel).observe(card);
  window.addEventListener('resize', fitPanel);
  if (moreBtn) moreBtn.addEventListener('click', function(){
    panel.classList.toggle('open');
    moreBtn.setAttribute('aria-label', panel.classList.contains('open') ? 'Show fewer sources' : 'Show all sources');
    fitPanel();
  });

  function renderSources(){
    if (!sources.length) { if (side) side.hidden = true; compact.hidden = true; return; }
    var chips = sources.map(function(s){
      return '<a class="galt-src" href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer" title="' + esc(s.title || s.url) + '">'
        + '<span class="n">' + s.id + '</span><span class="h">' + esc(s.host || s.url) + '</span></a>';
    }).join('');
    compact.innerHTML = '<details><summary>' + sources.length + ' source' + (sources.length === 1 ? '' : 's') + '</summary>'
      + '<div class="galt-src-list">' + chips + '</div></details>';
    compact.hidden = false;
    if (!citesEl) return;
    citesEl.innerHTML = sources.map(function(s){
      return '<a class="galt-cite-card" data-n="' + s.id + '" href="' + esc(s.url) + '" target="_blank" rel="noopener noreferrer">'
        + '<span class="n">' + s.id + '</span>'
        + '<span class="galt-cc-body"><span class="galt-cc-title"></span>'
        + '<span class="galt-cc-meta"><img class="galt-cc-fav" src="https://www.google.com/s2/favicons?sz=64&domain=' + encodeURIComponent(s.host || '') + '" alt="" loading="lazy" referrerpolicy="no-referrer"><span class="galt-cc-host"></span><span class="galt-cc-uses"></span></span>'
        + '</span></a>';
    }).join('');
    // Titles and hosts come from the web: set them as text, never as markup.
    var cards = citesEl.querySelectorAll('.galt-cite-card');
    for (var i = 0; i < cards.length; i++) {
      cards[i].querySelector('.galt-cc-title').textContent = sources[i].title || sources[i].host || sources[i].url;
      cards[i].querySelector('.galt-cc-host').textContent = sources[i].host || '';
    }
    citesCount.textContent = sources.length;
    side.hidden = false;
    markUses();
    requestAnimationFrame(fitPanel);
  }

  // How often each source is cited in the answer as it stands.
  function markUses(){
    if (!citesEl) return;
    var counts = {};
    root.querySelectorAll('.galt-body .galt-cite, .galt-fu-a .galt-cite').forEach(function(el){
      var n = el.textContent.trim();
      counts[n] = (counts[n] || 0) + 1;
    });
    citesEl.querySelectorAll('.galt-cite-card').forEach(function(cardEl){
      var c = counts[cardEl.getAttribute('data-n')] || 0;
      cardEl.classList.toggle('unused', c === 0);
      cardEl.querySelector('.galt-cc-uses').textContent = c ? 'cited x' + c : '';
    });
  }
  function hot(n, on){
    if (citesEl) citesEl.querySelectorAll('.galt-cite-card[data-n="' + n + '"]').forEach(function(el){ el.classList.toggle('hot', on); });
    root.querySelectorAll('.galt-cite').forEach(function(el){ el.classList.toggle('hot', on && el.textContent.trim() === n); });
  }
  root.addEventListener('mouseover', function(e){ var c = e.target.closest('.galt-cite'); if (c) hot(c.textContent.trim(), true); });
  root.addEventListener('mouseout', function(e){ var c = e.target.closest('.galt-cite'); if (c) hot(c.textContent.trim(), false); });
  if (citesEl) {
    citesEl.addEventListener('mouseover', function(e){ var c = e.target.closest('.galt-cite-card'); if (c) hot(c.getAttribute('data-n'), true); });
    citesEl.addEventListener('mouseout', function(e){ var c = e.target.closest('.galt-cite-card'); if (c) hot(c.getAttribute('data-n'), false); });
  }

  function setBadges(list){
    badges.innerHTML = list.map(function(b){ return '<span class="galt-badge' + (b.cls ? ' ' + b.cls : '') + '">' + esc(b.text) + '</span>'; }).join('');
  }
  var CHECK = {
    corrected: { label: 'Corrected after checking the web', cls: 'fix' },
    verified: { label: 'Checked against the web', cls: 'ok' },
    unverified: { label: 'Could not be checked', cls: 'muted' },
    failed: { label: 'Check did not finish', cls: 'muted' }
  };
  function showCheck(v){
    if (!v || !v.status) { checkEl.hidden = true; return; }
    var meta = CHECK[v.status] || CHECK.unverified;
    var changes = (v.changes || []).filter(Boolean);
    checkEl.setAttribute('data-status', v.status);
    var icon = v.status === 'corrected' ? '${ICONS.pencil}' : '${ICONS.check}';
    checkEl.innerHTML = '<summary>' + icon + esc(meta.label) + (changes.length ? ' \\u00b7 ' + changes.length : '') + '</summary>'
      + (changes.length ? '<ul>' + changes.map(function(c){ return '<li>' + esc(c) + '</li>'; }).join('') + '</ul>'
        : '<ul><li>' + esc(v.error || 'Nothing needed changing.') + '</li></ul>');
    checkEl.hidden = false;
  }

  function setBody(html){
    body.innerHTML = html;
    markUses();
    fitPanel();
  }
  function fail(msg){
    finished = true;
    stopClock(); closeStream();
    card.classList.remove('galt-busy');
    card.classList.add('galt-error');
    status.textContent = '';
    body.innerHTML = '<div class="galt-err">' + esc(msg || 'unknown error') + '</div>';
    actions.hidden = false;
  }
  function finish(d){
    stopClock(); closeStream();
    finished = true; ready = true;
    card.classList.remove('galt-busy');
    setBody(d.html);
    if (d.sources && d.sources.length) { sources = d.sources; renderSources(); }
    showCheck(d.verification);
    var list = [];
    if (d.model) list.push({ text: d.model });
    if (d.cached) list.push({ text: 'Cached', cls: 'muted' });
    setBadges(list);
    status.textContent = '';
    note.textContent = d.cached ? 'From cache' : (d.ms ? 'Written in ' + (Math.round(d.ms / 100) / 10) + 's' : '');
    actions.hidden = false;
    askForm.hidden = false;
  }

  function load(refresh){
    closeStream(); stopClock();
    finished = false; errs = 0; ready = false; sources = []; history.length = 0;
    t0 = Date.now();
    card.className = 'galt galt-busy';
    status.textContent = 'Searching';
    tick = setInterval(clock, 1000);
    body.innerHTML = '<div class="galt-skeleton"><span></span><span></span><span></span></div>';
    checkEl.hidden = true; compact.hidden = true; actions.hidden = true; askForm.hidden = true;
    followups.innerHTML = ''; note.textContent = '';
    if (side) side.hidden = true;
    setBadges([]);
    var url = '/api/overview?q=' + encodeURIComponent(q) + (refresh ? '&refresh=1' : '');
    if (!window.EventSource) {
      fetch(url, { credentials: 'same-origin' })
        .then(function(r){ return r.json().then(function(d){ if (!r.ok) throw new Error(d.error || ('HTTP ' + r.status)); return d; }); })
        .then(finish).catch(function(e){ fail(e.message || e); });
      return;
    }
    es = new EventSource(url + '&stream=1');
    es.addEventListener('status', function(e){ var d = JSON.parse(e.data); status.textContent = d.text; });
    es.addEventListener('sources', function(e){ sources = JSON.parse(e.data).sources || []; renderSources(); });
    es.addEventListener('snapshot', function(e){ setBody(JSON.parse(e.data).html + '<span class="galt-cursor"></span>'); });
    es.addEventListener('quick', function(e){ setBody(JSON.parse(e.data).html); });
    es.addEventListener('check', function(e){ var d = JSON.parse(e.data); setBody(d.html); showCheck(d.verification); });
    es.addEventListener('done', function(e){ finish(JSON.parse(e.data)); });
    es.addEventListener('fail', function(e){ fail(JSON.parse(e.data).error); });
    // EventSource reconnects by itself and the server replays the run's state; give up after a few tries.
    es.onerror = function(){
      // 'this' is the stream that errored; the outer es may already be closed and nulled.
      if (finished || !es) return;
      if (this.readyState === 2 || ++errs > 3) fail('connection lost');
      else status.textContent = 'Reconnecting';
    };
  }

  actions.addEventListener('click', function(e){
    var btn = e.target.closest('button[data-action]');
    if (!btn) return;
    if (btn.getAttribute('data-action') === 'refresh') load(true);
  });

  /* ---- follow-up questions ---- */
  var asking = false;
  askForm.addEventListener('submit', function(e){
    e.preventDefault();
    var question = askInput.value.trim();
    if (!question || asking || !ready) return;
    asking = true;
    askInput.value = '';
    askForm.classList.add('busy');

    var block = document.createElement('div');
    block.className = 'galt-fu busy';
    block.innerHTML = '<div class="galt-fu-q">${ICONS.sparkle}<span></span></div>'
      + '<div class="galt-fu-a"><div class="galt-skeleton"><span></span><span></span></div></div>';
    block.querySelector('.galt-fu-q span').textContent = question;
    followups.appendChild(block);
    var answerEl = block.querySelector('.galt-fu-a');
    var answered = false;

    var ac = new AbortController();
    var abort = function(){ ac.abort(); };
    window.addEventListener('pagehide', abort, { once: true });
    fetch('/api/followup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      signal: ac.signal,
      body: JSON.stringify({ q: q, question: question, history: history.slice(-3) })
    }).then(function(r){
      if (!r.ok || !r.body) {
        return r.json().catch(function(){ return {}; }).then(function(d){ throw new Error(d.error || ('HTTP ' + r.status)); });
      }
      var reader = r.body.getReader();
      var dec = new TextDecoder();
      var buf = '';
      function pump(){
        return reader.read().then(function(res){
          if (res.done) return;
          buf += dec.decode(res.value, { stream: true });
          var parts = buf.split('\\n\\n');
          buf = parts.pop();
          parts.forEach(function(chunk){
            var ev = 'message', data = '';
            chunk.split('\\n').forEach(function(line){
              if (line.indexOf('event:') === 0) ev = line.slice(6).trim();
              else if (line.indexOf('data:') === 0) data += line.slice(5).trim();
            });
            if (!data) return;
            var d;
            try { d = JSON.parse(data); } catch (err) { return; }
            if (ev === 'snapshot') { answerEl.innerHTML = d.html + '<span class="galt-cursor"></span>'; }
            else if (ev === 'status') { block.querySelector('.galt-fu-q span').setAttribute('title', d.text); }
            else if (ev === 'done') { answerEl.innerHTML = d.html; answered = true; history.push({ question: question, answer: d.answer || '' }); markUses(); }
            else if (ev === 'fail') { throw new Error(d.error || 'follow-up failed'); }
          });
          return pump();
        });
      }
      return pump();
    }).then(function(){
      if (!answered) throw new Error('no answer was produced');
    }).catch(function(err){
      if (ac.signal.aborted) return;
      block.classList.add('error');
      answerEl.innerHTML = '<div class="galt-err">' + esc(err.message || 'Follow-up failed.') + '</div>';
    }).then(function(){
      block.classList.remove('busy');
      askForm.classList.remove('busy');
      asking = false;
      window.removeEventListener('pagehide', abort);
      fitPanel();
      askInput.focus();
    });
  });

  window.addEventListener('pagehide', function(){ closeStream(); });
  // A page restored from the back/forward cache still shows whatever was on screen when it was
  // frozen, and its EventSource is dead. Reload the overview (the server has it cached).
  window.addEventListener('pageshow', function(e){ if (e.persisted) load(false); });
  load(false);
})();
`;
