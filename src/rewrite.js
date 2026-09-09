// Runs INSIDE the Google results page via page.evaluate. Must be self-contained.
// Returns { blocked, tab, hadOverview, results, chrome, html, title }.

// Elements present in every state of Google's AI Overview, including the "Thinking" skeleton shown
// while Google is still generating. The visible heading only reads "AI Overview" once it finished,
// so it can't be the primary signal. Keep the literal inside rewriteInPage() in sync.
export const AIO_SELECTOR = '[jscontroller="EYwa3d"][data-q], #m-x-content, #eKIzJc, div[data-attrid="AIOverview"]';

export function rewriteInPage({ proxyOrigin, placeholderId }) {
  const AIO = '[jscontroller="EYwa3d"][data-q], #m-x-content, #eKIzJc, div[data-attrid="AIOverview"]';
  const bodyText = (document.body && document.body.innerText || '').slice(0, 4000);
  const host = location.hostname;

  if (location.pathname.startsWith('/sorry') || /unusual traffic from your computer network|not a robot/i.test(bodyText)) {
    return { blocked: 'captcha', title: document.title };
  }
  if (host.startsWith('consent.') || /^before you continue to google/im.test(bodyText)) {
    return { blocked: 'consent', title: document.title };
  }
  if (location.pathname.startsWith('/search') === false && !document.querySelector('#rso, #search, #main')) {
    return { blocked: 'unexpected', title: document.title };
  }

  const here = new URL(location.href);
  const udm = here.searchParams.get('udm') || '';
  const tbm = here.searchParams.get('tbm') || '';
  // The tab we are on. Google addresses tabs with udm= (new) or tbm= (older links still work).
  const TAB_BY_UDM = { 2: 'images', 6: 'videos', 7: 'videos', 12: 'news', 14: 'web', 18: 'forums', 28: 'shopping', 36: 'books', 39: 'videos', 44: 'videos', 48: 'web', 50: 'ai' };
  const TAB_BY_TBM = { isch: 'images', vid: 'videos', nws: 'news', shop: 'shopping', bks: 'books', flm: 'videos' };
  const tab = (udm && TAB_BY_UDM[udm]) || (tbm && TAB_BY_TBM[tbm]) || (udm || tbm ? 'other' : 'web');
  const isWebTab = tab === 'web';

  // ---------------------------------------------------------------- overview
  // Page landmarks the overview block must never swallow. Google renders the overview in a
  // full-width band (#rcnt > div) that also holds the top ads slot (#tads), so we climb from an
  // overview-specific anchor until the next step up would include one of these.
  const LANDMARK_IDS = ['rso', 'search', 'res', 'center_col', 'rcnt', 'main', 'cnt', 'tads', 'tvcap', 'taw', 'topstuff', 'bottomads', 'botstuff', 'rhs', 'appbar', 'hdtb', 'searchform', 'tsf', 'kp-wp-tab-overview'];
  const landmarks = LANDMARK_IDS.map((id) => document.getElementById(id)).filter(Boolean);
  const isTop = (el) => !el || el === document.body || el === document.documentElement || LANDMARK_IDS.includes(el.id);
  const holdsLandmark = (el) => landmarks.some((l) => l !== el && el.contains(l));

  function climb(start) {
    let el = start;
    while (el.parentElement && !isTop(el.parentElement) && !holdsLandmark(el.parentElement)) {
      el = el.parentElement;
    }
    if (isTop(el) || holdsLandmark(el)) return null;
    return el;
  }

  function findOverviewAnchor() {
    const known = document.querySelector(AIO);
    if (known) return known;
    const heads = Array.from(document.querySelectorAll('h1, h2, h3, [role="heading"], [aria-level]'));
    return heads.find((h) => /^\s*(AI Overview|Thinking)\s*$/i.test(h.textContent || ''))
      || heads.find((h) => /^\s*AI Overview\b/i.test(h.textContent || ''))
      || null;
  }

  const anchor = findOverviewAnchor();
  let hadOverview = false;
  if (anchor) {
    const block = climb(anchor) || anchor;
    // Google's "no overview" notices are in the markup but hidden unless it gave up on the query.
    const visible = (el) => {
      for (let e = el; e && e !== block.parentElement; e = e.parentElement) {
        if (/display\s*:\s*none/i.test(e.getAttribute('style') || '') || getComputedStyle(e).display === 'none') return false;
      }
      return true;
    };
    const unavailable = Array.from(block.querySelectorAll('span, div'))
      .some((el) => el.children.length === 0 && /AI Overview is not available|Can't generate an AI overview/i.test(el.textContent || '') && visible(el));
    hadOverview = !unavailable && isWebTab;

    const rso = document.getElementById('rso');
    const col = document.getElementById('center_col') || (rso && (rso.closest('#res, #search') || rso));
    const ph = document.createElement('div');
    ph.id = placeholderId;
    if (col && !col.contains(block)) {
      // Google's band sits above the results column and gets its width from CSS that is loaded
      // lazily by scripts we strip. Drop the band and put ours at the top of the results column,
      // which is the same visual spot at the column's proper width.
      block.remove();
      if (hadOverview) {
        let first = col.firstElementChild;
        while (first && /^(STYLE|SCRIPT)$/.test(first.tagName)) first = first.nextElementSibling;
        col.insertBefore(ph, first);
      }
    } else if (hadOverview) {
      // Already inside the results column (Google sometimes places it after the first result).
      block.removeAttribute('style');
      block.replaceChildren(ph);
    } else {
      block.remove();
    }
  }

  // ----------------------------------------------------------------- results
  // Top organic results: the quick overview is drafted from these before Claude verifies it.
  // Result links are direct URLs, /url?q= redirects, or opaque /goto?url= redirects; the <cite>
  // breadcrumb carries the readable address in every case.
  const results = [];
  const seenUrls = new Set();
  const googleHost = (h) => /(^|\.)google\.[a-z.]+$/i.test(h);
  if (isWebTab) {
    for (const h3 of document.querySelectorAll('#rso h3, #search h3')) {
      const a = h3.closest('a[href]') || (h3.parentElement && h3.parentElement.querySelector('a[href]'));
      if (!a) continue;
      let u;
      try { u = new URL(a.getAttribute('href'), location.href); } catch { continue; }
      if (!/^https?:$/.test(u.protocol)) continue;
      if (googleHost(u.hostname)) {
        const target = u.pathname === '/url' && (u.searchParams.get('q') || u.searchParams.get('url'));
        if (target) { try { u = new URL(target); } catch { continue; } }
        else if (u.pathname !== '/goto') continue;
      }
      const item = h3.closest('.MjjYud, [data-hveid], .g') || h3.parentElement;
      const title = (h3.innerText || h3.textContent || '').trim().slice(0, 200);
      if (!title) continue;
      const cite = a.querySelector('cite') || item.querySelector('cite');
      const display = cite ? (cite.textContent || '').replace(/\s*›\s*/g, '/').replace(/\s+/g, '').trim() : '';
      let host = '';
      try { host = new URL(display.startsWith('http') ? display : 'https://' + display).hostname; } catch { /* no cite */ }
      if (googleHost(u.hostname) && !host) continue;
      const dedupe = display || u.href;
      if (seenUrls.has(dedupe)) continue;
      seenUrls.add(dedupe);
      const sn = item.querySelector('.VwiC3b, [data-sncf], [data-content-feature="1"]');
      let snippet = sn ? (sn.innerText || '') : (item.innerText || '').replace(title, '');
      snippet = snippet.replace(/\s+/g, ' ').trim().slice(0, 400);
      results.push({ title, url: u.href, display: display || u.href, host: host || u.hostname, snippet });
      if (results.length >= 8) break;
    }
  }

  // ------------------------------------------------------------------ chrome
  // Everything above the results is Google's, driven by scripts we strip. We keep only the data
  // (the query and the tab links) and rebuild the header ourselves, so every tab gets the same
  // Boogle chrome and none of it depends on Google's rotating class names.
  const queryEl = document.querySelector('textarea[name="q"], input[name="q"]');
  const query = queryEl ? (queryEl.value || queryEl.textContent || '').trim() : (here.searchParams.get('q') || '');

  // Google's per-request ids. They are dropped from every link we keep.
  const TRACKING = ['ved', 'ei', 'sa', 'sca_esv', 'sxsrf', 'biw', 'bih', 'dpr', 'source', 'sclient', 'uact', 'fbs', 'sqi', 'rlz', 'iflsig', 'gs_lp', 'gs_lcrp', 'gs_ssp', 'vsint', 'aep', 'ntc', 'cs'];
  const SKIP_TAB = /^(ai mode|more|tools|view all|all filters|safe ?search)$/i;
  // A tab link keeps the query and only changes udm/tbm. Google's other pill strips (the
  // "Diagram", "Process", … refinements on the images tab) rewrite the query instead, which is
  // how we tell them apart.
  const myQ = (here.searchParams.get('q') || '').trim();
  function sameQuery(a) {
    try {
      const u = new URL(a.getAttribute('href'), location.href);
      if (u.pathname !== '/search') return false;
      const linkQ = (u.searchParams.get('q') || '').trim();
      return !linkQ || linkQ === myQ;
    } catch { return false; }
  }
  function collectTabs() {
    const lists = Array.from(document.querySelectorAll('[role="list"], [role="navigation"] ul'));
    let best = null;
    let bestScore = 0;
    for (const list of lists) {
      const items = Array.from(list.children).filter((el) => el.getAttribute('role') === 'listitem' || el.tagName === 'LI');
      const score = items.filter((it) => {
        const a = it.querySelector('a[href]');
        return (a && sameQuery(a)) || !!it.querySelector('[aria-current="page"]');
      }).length;
      if (score > bestScore) { bestScore = score; best = list; }
    }
    if (!best || bestScore < 2) return { tabs: [], strip: null };
    const tabs = [];
    const take = (container) => {
      for (const item of Array.from(container.children)) {
        const label = (item.innerText || item.textContent || '').replace(/\s+/g, ' ').trim();
        if (!label || label.length > 24 || SKIP_TAB.test(label)) continue;
        const a = item.querySelector('a[href]');
        const active = !!item.querySelector('[aria-current="page"]') || (a && a.getAttribute('aria-disabled') === 'true');
        let href = '';
        if (a && sameQuery(a)) {
          try {
            const u = new URL(a.getAttribute('href'), location.href);
            if (u.searchParams.get('udm') === '50') continue; // Google's own AI mode
            TRACKING.forEach((k) => u.searchParams.delete(k));
            href = u.pathname + '?' + u.searchParams.toString();
          } catch { /* unusable */ }
        }
        if (!href && !active) continue;
        if (tabs.some((t) => t.label.toLowerCase() === label.toLowerCase())) continue;
        tabs.push({ label, href, active: !!active });
      }
    };
    take(best);
    // Tabs Google folded into its own "More" menu live in a separate list; ours shows them too.
    for (const list of lists) {
      if (list === best || best.contains(list) || list.contains(best)) continue;
      take(list);
    }
    return { tabs, strip: best };
  }
  const { tabs, strip } = collectTabs();
  const chrome = { q: query, tabs, tab, tbs: here.searchParams.get('tbs') || '', udm, tbm };

  // Drop Google's own chrome. Anything we could not identify simply stays and gets skinned.
  // Nothing is removed that contains the results: a wrapper whose role happens to match must
  // never take the page with it.
  const resultRoots = ['center_col', 'rso', 'search', 'rcnt'].map((id) => document.getElementById(id)).filter(Boolean);
  const holdsResults = (el) => resultRoots.some((r) => el === r || el.contains(r));
  const dropIfSafe = (el) => { if (el && el.isConnected && !holdsResults(el)) el.remove(); };
  const CHROME_SEL = ['header#gb', '#searchform', '#sfcnt', '#top_nav', '#appbar', '#footcnt'];
  for (const sel of CHROME_SEL) document.querySelectorAll(sel).forEach(dropIfSafe);
  if (strip && strip.isConnected) {
    const nav = strip.closest('[role="navigation"]');
    dropIfSafe(nav && !holdsResults(nav) ? nav : strip);
  }
  document.querySelectorAll('form').forEach((f) => {
    if (f.querySelector('input[name="q"], textarea[name="q"]') && !f.closest('#center_col')) dropIfSafe(f);
  });
  // Where inject.js splices our own header in.
  const slot = document.createElement('div');
  slot.id = 'galt-header-slot';
  if (document.body.firstChild) document.body.insertBefore(slot, document.body.firstChild);
  else document.body.appendChild(slot);

  // ---------------------------------------------------------------- annotate
  // Stable hooks for the skin, so skin.css never has to name a Google class.
  document.documentElement.classList.add('galt-skin');
  document.documentElement.setAttribute('data-galt-tab', tab);
  if (document.getElementById('rhs')) document.documentElement.classList.add('galt-has-rhs');

  const rsoRoot = document.getElementById('rso') || document.getElementById('search');
  if (rsoRoot) {
    for (const item of rsoRoot.querySelectorAll('.MjjYud, .g, [data-hveid] > .g')) {
      if (item.closest('.galt-item')) continue;
      if (!item.textContent.trim() && !item.querySelector('img')) continue;
      item.classList.add('galt-item');
    }
    for (const h of rsoRoot.querySelectorAll('h3, [role="heading"][aria-level="3"], .n0jPhd')) h.classList.add('galt-title');
    for (const c of rsoRoot.querySelectorAll('cite')) c.classList.add('galt-url');
    for (const s of rsoRoot.querySelectorAll('.VwiC3b, [data-sncf]')) s.classList.add('galt-snippet');
    // Cards: an anchor holding a heading is a news/result card; one holding only an image is a thumbnail.
    for (const a of rsoRoot.querySelectorAll('a[href]')) {
      if (a.querySelector('h3, [role="heading"]')) a.classList.add('galt-card');
      else if (a.querySelector('img') && !a.textContent.trim()) a.classList.add('galt-imgcard');
    }
    // Image tiles: Google lays the mosaic out in inline pixels, so we only restyle the tiles
    // themselves (a thumbnail, not a 16px favicon) and leave the geometry alone.
    if (tab === 'images' || tab === 'videos') {
      for (const img of rsoRoot.querySelectorAll('img')) {
        const w = Number(img.getAttribute('width')) || img.getBoundingClientRect().width;
        if (w >= 80) img.classList.add('galt-thumb');
      }
    }
  }
  const botstuff = document.getElementById('botstuff');
  if (botstuff) botstuff.classList.add('galt-bottom');
  const pager = document.querySelector('#botstuff table, [role="navigation"] table, #foot');
  if (pager) pager.classList.add('galt-pager');
  const rhs = document.getElementById('rhs');
  if (rhs) rhs.classList.add('galt-panel-col');

  // ------------------------------------------------------------------ strip
  // Everything that only works on google.com's origin.
  document.querySelectorAll('script, iframe, noscript, link[rel~="preload"], link[rel~="prefetch"], link[rel~="dns-prefetch"], link[rel~="preconnect"], link[rel~="modulepreload"], meta[http-equiv], base')
    .forEach((e) => e.remove());

  // Lazy images.
  document.querySelectorAll('img[data-src]').forEach((img) => img.setAttribute('src', img.getAttribute('data-src')));
  document.querySelectorAll('img[data-deferred][data-src], img[data-iurl]').forEach((img) => {
    const u = img.getAttribute('data-iurl');
    if (u) img.setAttribute('src', u);
  });

  const abs = (v) => {
    try { return new URL(v, location.href).href; } catch { return v; }
  };

  document.querySelectorAll('[src]').forEach((el) => el.setAttribute('src', abs(el.getAttribute('src'))));
  document.querySelectorAll('[srcset]').forEach((el) => {
    const v = el.getAttribute('srcset').split(',').map((part) => {
      const [u, d] = part.trim().split(/\s+/, 2);
      return d ? `${abs(u)} ${d}` : abs(u);
    }).join(', ');
    el.setAttribute('srcset', v);
  });
  document.querySelectorAll('link[href]').forEach((el) => el.setAttribute('href', abs(el.getAttribute('href'))));
  document.querySelectorAll('form[action]').forEach((el) => el.setAttribute('action', abs(el.getAttribute('action'))));

  // Branding: the page title, and any Google wordmark left in the body.
  document.querySelectorAll('#logo, a[aria-label="Go to Google Home"], a[title="Go to Google Home"], img[alt="Google"]').forEach((el) => {
    const a = el.tagName === 'A' ? el : el.closest('a');
    (a || el).remove();
  });
  document.title = document.title.replace(/\s*-\s*Google\s*(Search|Zoeken|Suche)?\s*$/i, '') + ' - Boogle';

  const isGoogleHost = (h) => /(^|\.)google\.[a-z.]+$/i.test(h);

  document.querySelectorAll('a[href]').forEach((a) => {
    a.removeAttribute('ping');
    a.removeAttribute('onmousedown');
    a.removeAttribute('onclick');
    let u;
    try { u = new URL(a.getAttribute('href'), location.href); } catch { return; }
    if (u.protocol === 'javascript:') { a.removeAttribute('href'); return; }
    if (isGoogleHost(u.hostname)) {
      if (u.pathname === '/url') {
        const target = u.searchParams.get('q') || u.searchParams.get('url');
        if (target && /^https?:/i.test(target)) { a.setAttribute('href', target); return; }
      }
      // Every search link — every tab, every filter, every results page — stays on the proxy.
      // Following one back to google.com is what used to bring Google's own AI Overview back.
      if (u.pathname === '/search' && (u.searchParams.has('q') || u.searchParams.has('udm'))) {
        TRACKING.forEach((k) => u.searchParams.delete(k));
        a.setAttribute('href', proxyOrigin + '/search?' + u.searchParams.toString());
        return;
      }
    }
    a.setAttribute('href', u.href);
  });

  // Inline event handlers can't do anything useful without Google's scripts.
  document.querySelectorAll('*').forEach((el) => {
    for (const attr of Array.from(el.attributes)) {
      if (/^on/i.test(attr.name)) el.removeAttribute(attr.name);
    }
  });

  return {
    blocked: null,
    tab,
    hadOverview,
    results,
    chrome,
    title: document.title,
    html: '<!DOCTYPE html>\n' + document.documentElement.outerHTML,
  };
}
