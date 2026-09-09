// Runs INSIDE the Google results page via page.evaluate. Must be self-contained.
// Returns { blocked, hadOverview, results, html, title }.

// Elements present in every state of Google's AI Overview, including the "Thinking" skeleton shown
// while Google is still generating. The visible heading only reads "AI Overview" once it finished,
// so it can't be the primary signal. Keep the literal inside rewriteInPage() in sync.
export const AIO_SELECTOR = '[jscontroller="EYwa3d"][data-q], #m-x-content, #eKIzJc, div[data-attrid="AIOverview"]';

export function rewriteInPage({ proxyOrigin, placeholderId }) {
  const AIO = '[jscontroller="EYwa3d"][data-q], #m-x-content, #eKIzJc, div[data-attrid="AIOverview"]';
  const bodyText = (document.body && document.body.innerText || '').slice(0, 4000);
  const host = location.hostname;
  const here = new URL(location.href);
  // Which tab this is. Google addresses tabs with udm= (new) or tbm= (older links still work).
  // Every tab is proxied, but only the web tab has an AI Overview or organic results to capture.
  const udm = here.searchParams.get('udm') || '';
  const tbm = here.searchParams.get('tbm') || '';
  const isWebTab = !tbm && (!udm || udm === '14' || udm === '48');

  if (location.pathname.startsWith('/sorry') || /unusual traffic from your computer network|not a robot/i.test(bodyText)) {
    return { blocked: 'captcha', title: document.title };
  }
  if (host.startsWith('consent.') || /^before you continue to google/im.test(bodyText)) {
    return { blocked: 'consent', title: document.title };
  }
  if (location.pathname.startsWith('/search') === false && !document.querySelector('#rso, #search, #main')) {
    return { blocked: 'unexpected', title: document.title };
  }

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

  // Top organic results: the quick overview is drafted from these before Claude verifies it.
  // Result links are direct URLs, /url?q= redirects, or opaque /goto?url= redirects; the <cite>
  // breadcrumb carries the readable address in every case.
  const results = [];
  const seenUrls = new Set();
  const googleHost = (h) => /(^|\.)google\.[a-z.]+$/i.test(h);
  for (const h3 of isWebTab ? document.querySelectorAll('#rso h3, #search h3') : []) {
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

  // Strip everything that only works on google.com's origin.
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

  // Search forms post back to the proxy. Google's hidden tracking fields go; the locale ones stay.
  const KEEP_HIDDEN = ['hl', 'gl', 'safe', 'lr', 'cr', 'tbs', 'num'];
  document.querySelectorAll('form').forEach((f) => {
    const action = f.getAttribute('action') || '';
    if (/\/search(\?|$)/.test(action) || f.querySelector('input[name="q"], textarea[name="q"]')) {
      f.setAttribute('action', proxyOrigin + '/search');
      f.setAttribute('method', 'get');
      f.removeAttribute('data-submitfalse');
      f.querySelectorAll('input[type="hidden"]').forEach((i) => {
        if (!KEEP_HIDDEN.includes(i.name)) i.remove();
      });
    }
  });

  // Branding: Google's wordmark becomes Boogle, linking to the proxy's home page.
  const LOGO = '<svg class="galt-logo" xmlns="http://www.w3.org/2000/svg" width="112" height="34" viewBox="0 0 112 34" role="img" aria-label="Boogle">'
    + '<defs><linearGradient id="galt-logo-grad" x1="0" y1="0" x2="1" y2="0.6"><stop offset="0" stop-color="#5b21b6"/><stop offset="0.55" stop-color="#8b5cf6"/><stop offset="1" stop-color="#c084fc"/></linearGradient></defs>'
    + '<text x="1" y="27" textLength="109" lengthAdjust="spacingAndGlyphs" font-family="\'Google Sans\',\'Product Sans\',Poppins,\'Trebuchet MS\',Arial,sans-serif" font-size="32" font-weight="700" letter-spacing="-1.5" fill="url(#galt-logo-grad)">Boogle</text></svg>';
  document.querySelectorAll('#logo, a[aria-label="Go to Google Home"], a[title="Go to Google Home"]').forEach((a) => {
    a.innerHTML = LOGO;
    a.setAttribute('href', proxyOrigin + '/');
    a.setAttribute('aria-label', 'Boogle home');
    a.setAttribute('title', 'Boogle home');
    a.classList.add('galt-logo-link');
  });
  document.querySelectorAll('img[alt="Google"]').forEach((img) => {
    const a = img.closest('a');
    if (a && a.querySelector('.galt-logo')) return;
    const span = document.createElement('span');
    span.innerHTML = LOGO;
    img.replaceWith(span.firstElementChild);
    if (a) { a.setAttribute('href', proxyOrigin + '/'); a.classList.add('galt-logo-link'); }
  });
  document.title = document.title.replace(/\s*-\s*Google Search\s*$/i, ' - Boogle');

  const TRACKING = ['ved', 'ei', 'sa', 'sca_esv', 'sxsrf', 'biw', 'bih', 'dpr', 'source', 'sclient', 'uact', 'fbs', 'sqi', 'rlz', 'iflsig', 'gs_lp', 'gs_lcrp', 'gs_ssp', 'vsint', 'aep', 'ntc', 'cs'];
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
      // Every tab, filter and results page stays on the proxy. Letting a tab link out to
      // google.com is what used to bring Google's own AI Overview back when you switched to
      // Images and came back.
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
    tab: isWebTab ? 'web' : (udm ? 'udm:' + udm : 'tbm:' + tbm),
    hadOverview,
    results,
    title: document.title,
    html: '<!DOCTYPE html>\n' + document.documentElement.outerHTML,
  };
}
