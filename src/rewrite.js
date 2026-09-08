// Runs INSIDE the Google results page via page.evaluate. Must be self-contained.
// Returns { blocked, hadOverview, html, title }.
export function rewriteInPage({ proxyOrigin, placeholderId }) {
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

  const TOP_IDS = new Set(['rso', 'rcnt', 'center_col', 'search', 'main', 'res', 'topstuff', 'cnt', 'kp-wp-tab-overview']);
  const isTop = (el) => !el || el === document.body || el === document.documentElement || TOP_IDS.has(el.id);
  const containsResults = (el) => !!el.querySelector('#rso, #search, #center_col, #rcnt');

  function climb(start) {
    let el = start;
    while (el.parentElement && !isTop(el.parentElement) && !containsResults(el.parentElement)) {
      el = el.parentElement;
    }
    if (isTop(el) || containsResults(el)) return null;
    return el;
  }

  function findOverview() {
    const heads = Array.from(document.querySelectorAll('h1, h2, h3, [role="heading"], [aria-level]'));
    const exact = heads.filter((h) => /^\s*AI Overview\s*$/i.test(h.textContent || ''));
    const loose = heads.filter((h) => /^\s*AI Overview\b/i.test(h.textContent || ''));
    for (const h of [...exact, ...loose]) {
      const block = climb(h);
      if (block) return block;
    }
    const known = document.querySelector('#m-x-content, div[data-attrid="AIOverview"], div[jscontroller][data-al]');
    if (known) return climb(known) || known;
    return null;
  }

  const overview = findOverview();
  const hadOverview = !!overview;
  if (overview) {
    // Keep Google's container (its classes carry the layout width) and swap only its contents.
    const ph = document.createElement('div');
    ph.id = placeholderId;
    overview.removeAttribute('style');
    overview.replaceChildren(ph);
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

  // Search forms should post back to the proxy.
  document.querySelectorAll('form').forEach((f) => {
    const action = f.getAttribute('action') || '';
    if (/\/search(\?|$)/.test(action) || f.querySelector('input[name="q"], textarea[name="q"]')) {
      f.setAttribute('action', proxyOrigin + '/search');
      f.setAttribute('method', 'get');
    }
  });

  const TRACKING = ['ved', 'ei', 'sa', 'sca_esv', 'sxsrf', 'biw', 'bih', 'dpr', 'source', 'sclient', 'uact', 'fbs', 'sqi', 'rlz', 'iflsig', 'gs_lp', 'gs_lcrp', 'gs_ssp'];
  const isGoogleHost = (h) => /(^|\.)google\.[a-z.]+$/i.test(h);
  const isWebSearch = (u) => {
    if (u.searchParams.has('tbm')) return false;
    const udm = u.searchParams.get('udm');
    if (udm && udm !== '14') return false;
    return true;
  };

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
      if (u.pathname === '/search' && u.searchParams.has('q') && isWebSearch(u)) {
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
    hadOverview,
    title: document.title,
    html: '<!DOCTYPE html>\n' + document.documentElement.outerHTML,
  };
}
