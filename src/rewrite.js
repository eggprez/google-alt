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
  // Desktop titles are <h3> and the readable address is a <cite>. The mobile SERP has neither: the
  // title is a div[role="heading"][aria-level="3"] inside the result's link, and the address is a
  // plain <span> holding "https://host". Missing them left mobile with no results at all, which
  // sent every phone search down the slower research path instead of draft-then-fact-check.
  // Result links are direct URLs, /url?q= redirects, or opaque /goto?url= redirects.
  const results = [];
  const seenUrls = new Set();
  const googleHost = (h) => /(^|\.)google\.[a-z.]+$/i.test(h);
  const TITLE_SEL = '#rso h3, #search h3, #rso [role="heading"][aria-level="3"], #search [role="heading"][aria-level="3"]';
  const URLISH = /^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)+([/›\s]|$)/i;
  // The address as Google prints it, from a <cite> or, failing that, the first leaf that reads
  // like a host. Kept short so a snippet sentence starting with a domain can't be mistaken for it.
  // The <cite> has to be checked too: video and forum cards put "247.6K+ views · 10 years ago"
  // there, which used to reach Claude as a source host of "247.xn--6k+views10yearsago-d4a".
  const addressIn = (scope) => {
    const cite = scope.querySelector('cite');
    const cited = cite && (cite.textContent || '').trim();
    if (cited && URLISH.test(cited)) return cited;
    for (const el of scope.querySelectorAll('span, div')) {
      if (el.children.length) continue;
      const t = (el.textContent || '').trim();
      if (t.length < 4 || t.length > 100 || /\s/.test(t.replace(/\s*›\s*/g, ''))) continue;
      if (URLISH.test(t)) return t;
    }
    return '';
  };
  for (const h of isWebTab ? document.querySelectorAll(TITLE_SEL) : []) {
    const a = h.closest('a[href]') || (h.parentElement && h.parentElement.querySelector('a[href]'));
    if (!a) continue;
    let u;
    try { u = new URL(a.getAttribute('href'), location.href); } catch { continue; }
    if (!/^https?:$/.test(u.protocol)) continue;
    if (googleHost(u.hostname)) {
      const target = u.pathname === '/url' && (u.searchParams.get('q') || u.searchParams.get('url'));
      if (target) { try { u = new URL(target); } catch { continue; } }
      else if (u.pathname !== '/goto') continue;
    }
    const item = h.closest('.MjjYud, [data-hveid], .g') || h.parentElement;
    const title = (h.innerText || h.textContent || '').trim().slice(0, 200);
    if (!title) continue;
    const display = (addressIn(a) || addressIn(item)).replace(/\s*›\s*/g, '/').replace(/\s+/g, '').trim();
    let host = '';
    try { host = new URL(display.startsWith('http') ? display : 'https://' + display).hostname; } catch { /* no address */ }
    // A hostname the URL parser accepted but no site could have (it punycodes anything).
    if (host && !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(host)) host = '';
    // Nothing readable and an opaque /goto link: we would be handing Claude a source it cannot see.
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

  // Lazy images. Most thumbnails on a results page — social posts, video stills, site logos,
  // sports crests — ship as a 1x1 transparent gif, and the real URL lives somewhere only Google's
  // scripts look at. We strip those scripts, so we have to apply the sources ourselves or the page
  // arrives with no pictures at all. Two mechanisms cover nearly all of them:
  //   img[data-src]        the URL sits on the element
  //   google.ldi           an id -> URL map (values are protocol-relative), applied by _setImagesSrc
  // Removing a <script> element does not undo what it already ran, so google.ldi is still here.
  document.querySelectorAll('img[data-src]').forEach((img) => img.setAttribute('src', img.getAttribute('data-src')));
  document.querySelectorAll('img[data-deferred][data-src], img[data-iurl]').forEach((img) => {
    const u = img.getAttribute('data-iurl');
    if (u) img.setAttribute('src', u);
  });
  const ldi = (window.google && window.google.ldi) || {};
  for (const id of Object.keys(ldi)) {
    const url = ldi[id];
    if (typeof url !== 'string' || !url) continue;
    // Google reuses an id across the copies of a card, so fill every element carrying it.
    for (const img of document.querySelectorAll('[id="' + id.replace(/["\\]/g, '\\$&') + '"]')) {
      if (img.tagName !== 'IMG') continue;
      // Only fill in placeholders; never overwrite a picture Google already loaded.
      const cur = img.getAttribute('src') || '';
      if (cur && !/^data:image\/gif/i.test(cur)) continue;
      img.setAttribute('src', url);
      img.removeAttribute('data-deferred');
    }
  }
  // Placeholders neither mechanism resolved. The mobile SERP has ~20 of them per page (result and
  // video thumbnails whose URL arrives in a later XHR we never make), and removing them collapsed
  // the cards around them — that is what made mobile results look mangled. Keep the box, which the
  // transparent gif fills silently, and drop only the ones too small to be holding a space open.
  document.querySelectorAll('img[src^="data:image/gif"]').forEach((img) => {
    const r = img.getBoundingClientRect();
    if (r.width <= 4 || r.height <= 4) { img.remove(); return; }
    img.classList.add('galt-noimg');
    img.setAttribute('alt', '');
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
  // The mark to replace differs per page: desktop has #logo holding a 92x30 inline SVG, the mobile
  // SERP an <a aria-label="Google"> around a 92x36 one (matched by neither of the old selectors,
  // which is why the phone still showed Google's own logo), and both keep a small square "G" for
  // the collapsed header. A wordmark squeezed into a 32x32 box is unreadable, so square marks get
  // a monogram, and every mark is drawn at the size of the one it replaces so nothing reflows.
  const FONT = "'Google Sans','Product Sans',Poppins,'Trebuchet MS',Arial,sans-serif";
  let logoSeq = 0;
  function boogleSvg(w, h) {
    const id = 'galt-logo-grad-' + (++logoSeq);
    const grad = '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="0.6">'
      + '<stop offset="0" stop-color="#5b21b6"/><stop offset="0.55" stop-color="#8b5cf6"/><stop offset="1" stop-color="#c084fc"/></linearGradient></defs>';
    const square = w / h < 1.6;
    const mark = square
      ? '<circle cx="17" cy="17" r="16.5" fill="url(#' + id + ')"/>'
        + '<text x="17" y="25.5" text-anchor="middle" font-family="' + FONT + '" font-size="23" font-weight="700" fill="#fff">B</text>'
      : '<text x="1" y="27" textLength="109" lengthAdjust="spacingAndGlyphs" font-family="' + FONT + '"'
        + ' font-size="32" font-weight="700" letter-spacing="-1.5" fill="url(#' + id + ')">Boogle</text>';
    return '<svg class="galt-logo" xmlns="http://www.w3.org/2000/svg" width="' + w + '" height="' + h + '"'
      + ' viewBox="' + (square ? '0 0 34 34' : '0 0 112 34') + '" preserveAspectRatio="xMidYMid meet"'
      + ' role="img" aria-label="Boogle">' + grad + mark + '</svg>';
  }
  // The size Google drew its mark at. A logo in a header that is hidden until you scroll measures
  // 0x0, so fall back to the width/height attributes before the wordmark's own default.
  function markSize(el) {
    const kid = el.querySelector('svg, img') || el;
    const r = kid.getBoundingClientRect();
    let w = Math.round(r.width);
    let h = Math.round(r.height);
    if (!w || !h) {
      w = parseFloat(kid.getAttribute('width')) || 0;
      h = parseFloat(kid.getAttribute('height')) || 0;
    }
    if (!w || !h) { w = 112; h = 34; }
    return { w, h };
  }
  function brand(el) {
    if (el.querySelector('.galt-logo')) return;
    const size = markSize(el);
    el.innerHTML = boogleSvg(size.w, size.h);
    el.setAttribute('aria-label', 'Boogle home');
    el.classList.add('galt-logo-link');
    if (el.tagName === 'A') {
      el.setAttribute('href', proxyOrigin + '/');
      el.setAttribute('title', 'Boogle home');
    }
  }
  // Exact labels only: "Google apps" (the app grid) also contains the word.
  document.querySelectorAll('#logo, a[aria-label="Google" i], a[aria-label="Go to Google Home" i], a[title="Go to Google Home" i]')
    .forEach(brand);
  document.querySelectorAll('img[alt="Google"]').forEach((img) => {
    const a = img.closest('a');
    if (a && a.querySelector('.galt-logo')) return;
    const size = markSize(img);
    const span = document.createElement('span');
    span.innerHTML = boogleSvg(size.w, size.h);
    img.replaceWith(span.firstElementChild);
    if (a) { a.setAttribute('href', proxyOrigin + '/'); a.classList.add('galt-logo-link'); }
  });
  document.title = document.title.replace(/\s*-\s*Google Search\s*$/i, ' - Boogle');

  // Google picks light or dark on the server, from the account setting — it ignores the viewer's
  // prefers-color-scheme (verified: a SERP fetched with dark emulated still came back light, and
  // the mobile SERP came back dark with light emulated). So the overview cannot follow the
  // viewer's OS; it has to follow the page it is sitting in. Measure what Google actually sent.
  function pageIsDark() {
    const luminance = (el) => {
      if (!el) return null;
      const m = /rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s/]+([\d.]+))?/.exec(getComputedStyle(el).backgroundColor || '');
      if (!m) return null;
      if (m[4] !== undefined && Number(m[4]) === 0) return null; // fully transparent: keep looking
      return (0.2126 * Number(m[1]) + 0.7152 * Number(m[2]) + 0.0722 * Number(m[3])) / 255;
    };
    const l = luminance(document.body);
    const v = l === null ? luminance(document.documentElement) : l;
    return v !== null && v < 0.5;
  }
  if (pageIsDark()) document.documentElement.classList.add('galt-dark');

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
