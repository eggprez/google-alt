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

  // Shared by the handlers below. q0 is the query this page is for.
  const q0 = here.searchParams.get('q') || '';
  const text1 = (el) => (el && (el.innerText || el.textContent) || '').replace(/\s+/g, ' ').trim();
  const searchHref = (q, extra) => proxyOrigin + '/search?q=' + encodeURIComponent(q) + (extra || '');
  // A destination for a control that had none: the page script sends a tap there (inject.js).
  const setHref = (el, href) => {
    if (el.hasAttribute('data-galt-href')) return;
    el.setAttribute('data-galt-href', href);
    if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '0');
  };
  const hasLink = (el) => !!(el.querySelector('a[href]') || el.closest('a[href]'));
  // The line set in the largest type inside a tile is its title (a movie's name over its genre
  // line, an event's name over its date).
  const titleOf = (tile) => {
    let best = '';
    let size = 0;
    for (const el of tile.querySelectorAll('span, div')) {
      if (el.children.length && !Array.from(el.childNodes).some((n) => n.nodeType === 3 && n.nodeValue.trim())) continue;
      const t = text1(el);
      if (t.length < 3 || t.length > 120) continue;
      const fs = parseFloat(getComputedStyle(el).fontSize) || 0;
      if (fs > size) { size = fs; best = t; }
    }
    return best;
  };

  // Page landmarks the overview block must never swallow. Google renders the overview in a
  // full-width band (#rcnt > div) that also holds the top ads slot (#tads), so we climb from an
  // overview-specific anchor until the next step up would include one of these.
  const LANDMARK_IDS = ['rso', 'search', 'res', 'center_col', 'rcnt', 'main', 'cnt', 'tads', 'tvcap', 'taw', 'topstuff', 'bottomads', 'botstuff', 'rhs', 'appbar', 'hdtb', 'searchform', 'tsf', 'kp-wp-tab-overview'];
  const landmarks = LANDMARK_IDS.map((id) => document.getElementById(id)).filter(Boolean);
  const isTop = (el) => !el || el === document.body || el === document.documentElement || LANDMARK_IDS.includes(el.id);
  const holdsLandmark = (el) => landmarks.some((l) => l !== el && el.contains(l));

  // A parent that reads much longer than the overview, or holds a business's phone number,
  // has something else in it. A business page puts the overview in the same container as the
  // panel's Overview tab (address, hours, Call, Directions), and climbing into that container
  // took the whole panel body with the overview. The overview's own wrappers only add its
  // heading, footer and disclaimer.
  const textLen = (el) => text1(el).length;
  const holdsBusiness = (el) => !!el.querySelector('[data-phone-number], a[href^="tel:"], [data-attrid="title"]');
  function climb(start) {
    let el = start;
    while (el.parentElement && !isTop(el.parentElement) && !holdsLandmark(el.parentElement)) {
      const p = el.parentElement;
      if (textLen(p) > textLen(el) + 160 || (holdsBusiness(p) && !holdsBusiness(el))) break;
      el = p;
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
    // Google ships a component's CSS at its first use on the page, and the overview block is the
    // first thing on the page, so it carries <style> elements that also style results further
    // down (18KB of them on a mobile SERP, including the rule that lays result thumbnails out in
    // a row). Dropping the block took those with it, which is what left everything below the
    // overview unstyled: stacked thumbnails, chips falling back to bulleted lists, oversized text.
    // Put them back exactly where they were so the cascade is unchanged.
    const keptStyles = Array.from(block.querySelectorAll('style'));
    if (col && !col.contains(block)) {
      // Google's band sits above the results column and gets its width from CSS that is loaded
      // lazily by scripts we strip. Drop the band and put ours at the top of the results column,
      // which is the same visual spot at the column's proper width.
      block.replaceWith(...keptStyles);
      if (hadOverview) {
        let first = col.firstElementChild;
        while (first && /^(STYLE|SCRIPT)$/.test(first.tagName)) first = first.nextElementSibling;
        col.insertBefore(ph, first);
      }
    } else if (hadOverview) {
      // Already inside the results column (Google sometimes places it after the first result).
      block.removeAttribute('style');
      block.replaceChildren(...keptStyles, ph);
    } else {
      block.replaceWith(...keptStyles);
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

  // Precise location. Google's scripts opened a "See results closer to you?" modal (with a
  // full-page scrim) on local queries before we took the snapshot, and without those scripts
  // nothing can close it, so the phone got a page stuck behind a dialog whose buttons did
  // nothing. Drop the modal, its scrim, and the hidden "learn more" sheet; keep the inline
  // "Use precise location" chip in the location bar and mark it so the page script can drive
  // it (it asks the device for coordinates and reloads, see inject.js).
  document.querySelectorAll('[role="dialog"]').forEach((d) => {
    if (/precise location/i.test(d.textContent || '')) d.remove();
  });
  document.querySelectorAll('.os-s').forEach((e) => e.remove());
  document.querySelectorAll('[role="button"]').forEach((b) => {
    if (/^\s*Use precise location\s*$/i.test(b.textContent || '')) b.setAttribute('data-galt-geo', 'use');
  });
  // The footer's "Update location" button does the same job from the bottom of the page. Its
  // label is a bare text node followed by hidden spans (the "Can't update your location"
  // snackbar), so it is matched by element, not by text. Google's mobile page keeps the whole
  // footer hidden until its infinite scroll runs out of results, which never happens here (a
  // "More search results" button stands in for the scroll), so show it where Google would.
  document.querySelectorAll('update-location [role="button"]').forEach((b) => b.setAttribute('data-galt-geo', 'use'));
  const sfooter = document.getElementById('sfooter');
  if (sfooter) sfooter.style.removeProperty('display');

  // "People also ask" answers are not in the page: each one is fetched when Google's script
  // expands the question, so the pairs arrive holding a "Generating" skeleton (or "An error has
  // occurred"). Mark them so the page script can turn a tap into a search for the question.
  document.querySelectorAll('.related-question-pair[data-q]').forEach((p) => {
    const b = p.querySelector('[role="button"][aria-controls]');
    if (b) b.setAttribute('data-galt-paa', p.getAttribute('data-q'));
  });

  // Stock chart periods. The 1D/5D/1M... buttons and the 1Y/5Y/Max options in the "More" menu
  // redraw the chart from data Google's script fetches, so without it they did nothing. Google
  // Finance draws the same chart for the same periods from its URL (?window=5D), and the widget
  // already links there ("More about Apple Inc"), so a tap opens that page at the chosen period.
  const WINDOWS = { '1d': '1D', '5d': '5D', '1m': '1M', '6m': '6M', ytd: 'YTD', '1y': '1Y', '5y': '5Y', '40y': 'MAX', max: 'MAX' };
  const quoteLinkFor = (el) => {
    for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) {
      const a = e.querySelector('a[href*="google.com/finance/quote/"]');
      if (a) return a;
    }
    return null;
  };
  document.querySelectorAll('[data-period]').forEach((el) => {
    if (!/^(button|option|tab)$/.test(el.getAttribute('role') || '')) return;
    const a = quoteLinkFor(el);
    if (!a) return;
    let quote;
    try { quote = new URL(a.getAttribute('href'), location.href); } catch { return; }
    const period = el.getAttribute('data-period') || '';
    const win = WINDOWS[period.toLowerCase()] || period.toUpperCase();
    el.setAttribute('data-galt-fin', quote.origin + quote.pathname + '?window=' + encodeURIComponent(win));
    el.setAttribute('tabindex', '0');
  });

  // Collapsed sections whose content is already in the page: "Also in the news" under a stock,
  // the earnings rows, the "Quarterly financials" and "Earnings" chips. Google's script showed
  // the panel on tap; nothing does now. Mark the ones whose panel holds real content (a PAA
  // "Generating" skeleton is not content: those became searches above) so the page script can
  // open and close them. The menus the page script already drives are left alone, and so is the
  // mobile "Search tools" row (#hdtbMenus): its filters are laid out by CSS that never arrives.
  let panelSeq = 0;
  const markToggle = (btn, panel) => {
    if (!panel || panel.id === 'hdtbMenus' || btn.hasAttribute('data-galt-paa')) return;
    if (btn.matches('[jscontroller="eBYPP"] [jsname="oYxtQd"], #hdtb-tls')) return;
    if (panel.querySelector('[role="progressbar"]') || !(panel.textContent || '').trim()) {
      // A knowledge panel row whose content Google fetches on tap ("Tickets", "Popular times",
      // "Reviews" under a landmark): nothing to unfold, so tap searches for it, like a PAA.
      const t = text1(btn.querySelector('[jsname="r4nke"]'));
      if (t && t.length <= 40 && q0 && !hasLink(btn)) btn.setAttribute('data-galt-paa', q0 + ' ' + t.toLowerCase());
      return;
    }
    if (getComputedStyle(panel).display !== 'none') {
      // A section that starts open ("About", "Images", "Nearby places") folds on tap, as it
      // does on google.com. Anything else visible is left alone: the desktop financials chips
      // park their table as an invisible popover (position:absolute, sized by Google's script
      // to overlay the neighbours) that does not fit in the flow of its 204px card.
      if (btn.getAttribute('aria-expanded') !== 'true') return;
      if (!panel.id) panel.id = 'galt-panel-' + (++panelSeq);
      btn.setAttribute('data-galt-toggle', panel.id);
      btn.setAttribute('data-galt-init', 'open');
      return;
    }
    if (!panel.id) panel.id = 'galt-panel-' + (++panelSeq);
    btn.setAttribute('data-galt-toggle', panel.id);
    btn.setAttribute('aria-expanded', 'false');
  };
  document.querySelectorAll('[role="button"][aria-controls]').forEach((b) => markToggle(b, document.getElementById(b.getAttribute('aria-controls'))));
  // An expander that names no panel ("6 key moments in this video", a place's hours): the
  // hidden content is the next thing in its container.
  document.querySelectorAll('[role="button"][aria-expanded="false"]:not([aria-controls])').forEach((b) => {
    if (b.hasAttribute('data-galt-toggle') || b.hasAttribute('data-galt-paa') || b.closest('.galt')) return;
    const holder = b.parentElement;
    if (!holder) return;
    // The hidden element is the sibling itself, or the sibling's only child (the key moments
    // list sits in a zero-height wrapper).
    const hiddenOf = (c) => (getComputedStyle(c).display === 'none' ? c : (c.children.length === 1 && getComputedStyle(c.firstElementChild).display === 'none' ? c.firstElementChild : null));
    let hidden = null;
    for (const c of holder.children) {
      if (c === b || c.contains(b)) continue;
      const h = hiddenOf(c);
      if (h && (h.textContent || '').trim().length > 20) { hidden = h; break; }
    }
    if (hidden) markToggle(b, hidden);
  });
  document.querySelectorAll('[jscontroller="qWD4e"][role="button"]').forEach((b) => markToggle(b, b.parentElement && b.parentElement.querySelector(':scope > .ZfqtA')));

  // Product tiles ("Popular products" and the like) are divs with no link at all: Google's script
  // opens a product panel on click, fetched from a product id the tile carries. Without the
  // script they were dead. The merchant URL is nowhere in the page, so a tap searches the
  // Shopping tab for the exact product title instead (from the Shopping tab, the web tab), where
  // the results are ordinary links. Tiles are found by the id element Google leaves in each one,
  // with the class as a fallback.
  const isPrice = (t) => /^\s*(?:[$€£]|USD)\s?\d/.test(t) || /^\s*\d[\d.,]*\s?(?:[$€£]|USD)/.test(t);
  // Labels that name the control rather than the product ("Go to product viewer for this item.",
  // "Product Image 1 of 1"), and the long accessibility description that runs "Title. Nearby,
  // 5 mi. Current Price: ..." from which only the first sentence is the title.
  const GENERIC_LABEL = /product viewer|product image|^image\b|interactive|autorotating|showing the item|^\s*(?:\d+%\s*off|sale|deal|new)\b/i;
  const BADGE = /[.,]?\s*(?:\d+%\s*off|sale|deal)\.?\s*$/i;
  const clean = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const tileTitle = (tile) => {
    const cands = [];
    for (const el of tile.querySelectorAll('[title], [aria-label], img[alt]')) {
      cands.push(clean(el.getAttribute('title')), clean(el.getAttribute('aria-label')), clean(el.getAttribute('alt')).replace(/\.$/, ''));
    }
    for (const el of tile.querySelectorAll('div, span')) {
      if (!el.children.length) cands.push(clean(el.textContent));
    }
    for (let t of cands) {
      if (!t || t.length < 4 || isPrice(t)) continue;
      // A long accessibility label is sentences ("An interactive ... angles.Sony WH-1000XM6
      // Headphones. 180. Also nearby. Current Price: ..."): the first that is not boilerplate.
      if (t.length > 60 && /\.\s*(?=[A-Z0-9$])/.test(t)) {
        t = t.split(/\.\s*(?=[A-Z0-9$])/).map((x) => x.trim()).find((x) => x.length >= 4 && !GENERIC_LABEL.test(x) && !isPrice(x)) || '';
      }
      if (!t || GENERIC_LABEL.test(t)) continue;
      t = t.replace(BADGE, '').trim();
      if (t.length >= 4 && t.length <= 150) return t;
    }
    return '';
  };
  document.querySelectorAll('[data-pid][data-cid], .UC8ZCe').forEach((el) => {
    const tile = el.closest('[jsaction]') || el;
    // (The "About this result" / "Report" help links every Shopping-tab tile carries do not count.)
    if (tile.hasAttribute('data-galt-shop') || tile.querySelector('a[href]:not([href*="support.google.com"]):not([href*="policies.google.com"])') || tile.closest('a[href]')) return;
    const title = tileTitle(tile);
    if (!title) return;
    tile.setAttribute('data-galt-shop', title);
    tile.setAttribute('role', 'link');
    tile.setAttribute('tabindex', '0');
    tile.setAttribute('aria-label', title + ' - search Shopping');
  });

  // Strip everything that only works on google.com's origin.
  document.querySelectorAll('script, iframe, noscript, link[rel~="preload"], link[rel~="prefetch"], link[rel~="dns-prefetch"], link[rel~="preconnect"], link[rel~="modulepreload"], link[rel~="expect"], meta[http-equiv], base')
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

  // Google's own wordmark stays. Its link would otherwise lead to google.com, so point it at the
  // proxy's home page. Exact labels only: "Google apps" (the app grid) also contains the word.
  document.querySelectorAll('#logo, a[aria-label="Google" i], a[aria-label="Go to Google Home" i], a[title="Go to Google Home" i]')
    .forEach((el) => {
      const a = el.tagName === 'A' ? el : el.closest('a');
      if (a) a.setAttribute('href', proxyOrigin + '/');
    });
  document.title = document.title.replace(/\s*-\s*Google (?:Search|Shopping)\s*$/i, ' - Boogle');

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
  const isAdHost = (h) => /(^|\.)googleadservices\.com$/i.test(h);

  // ---- Controls Google's scripts drove, given something to do without them. ----
  // Phone numbers. "Call" is a link back to the results page carrying the number in an
  // attribute; Google's script dialled it. Dial it with the link instead.
  document.querySelectorAll('[data-phone-number]').forEach((el) => {
    const n = (el.getAttribute('data-phone-number') || '').replace(/[^\d+]/g, '');
    if (!n) return;
    if (el.tagName === 'A') el.setAttribute('href', 'tel:' + n);
    else if (!hasLink(el)) setHref(el, 'tel:' + n);
  });
  // Directions are Android intent: links (they open the Maps app). Firefox on iOS and any
  // desktop browser cannot follow one; the plain Maps URL inside opens the app on Android too.
  const intentToHttps = (h) => {
    const m = /S\.browser_fallback_url=([^;]+)/.exec(h);
    let target = '';
    try { target = m ? decodeURIComponent(m[1]) : 'https://' + h.slice('intent://'.length).split('#Intent')[0]; } catch { /* malformed */ }
    return /^https?:/.test(target) ? target : '';
  };
  document.querySelectorAll('a[href^="intent:"]').forEach((a) => {
    const target = intentToHttps(a.getAttribute('href'));
    if (target) a.setAttribute('href', target);
  });
  // A place in the local pack. Its row is covered by a link to Google's place viewer, a page
  // only Google's scripts can draw. The business's own results page, pinned to it by Google's
  // id (ludocid), carries the same panel: hours, Call, Directions, reviews, photos.
  // The desktop rows (and a panel's "Nearby places") carry no ludocid, but their id holds the
  // entity's kgmid ("pv-/g/11ywms_jpy"), which pins the panel the same way.
  document.querySelectorAll('[data-ludocid], [id^="pv-/"]').forEach((tile) => {
    if (tile.closest('[data-galt-href]')) return;
    const cid = tile.getAttribute('data-ludocid') || '';
    const mid = tile.id.startsWith('pv-/') ? tile.id.slice(3) : '';
    if (!/^\d+$/.test(cid) && !/^\/[gm]\/[\w-]+$/.test(mid)) return;
    const name = (text1(tile.querySelector('[role="heading"]')) || titleOf(tile)).replace(/^[A-Z]\.?\s+/, '');
    if (!name) return;
    const href = searchHref(name, /^\d+$/.test(cid) ? '&ludocid=' + cid : '&kgmid=' + encodeURIComponent(mid));
    // The overlay link only catches taps on the row's empty space (the text sits above it in
    // its own elements), so the row itself gets the destination too.
    tile.querySelectorAll('a[data-open-viewer], a[href*="/searchviewer"]').forEach((a) => a.setAttribute('href', href));
    if (!tile.closest('a[href]')) setHref(tile, href);
    // "Menu" on a Places-tab row opened a panel Google fetched; search for the menu instead.
    tile.querySelectorAll('[role="button"]').forEach((b) => {
      if (/^menu$/i.test(text1(b)) && !hasLink(b)) setHref(b, searchHref(name + ' menu'));
    });
  });
  // The map. Google's script opened the Maps view of the query; the Maps tab links there.
  const mapsTab = document.querySelector('a[href*="maps.google.com/maps"]');
  document.querySelectorAll('[jscontroller="pGR4wc"], [jscontroller="vHlTde"], [jscontroller="H2R8Vd"], [role="region"][aria-label="Map"]').forEach((m) => {
    // (The map's own "Terms" link stays a link: a tap on it wins over the map's destination.)
    if (m.closest('[data-galt-href], a[href]')) return;
    const du = m.getAttribute('data-url') || '';
    let href = '';
    if (du.startsWith('/')) href = 'https://' + location.hostname + du;
    else if (mapsTab) href = mapsTab.getAttribute('href');
    else if (q0) href = 'https://www.google.com/maps/search/' + encodeURIComponent(q0);
    if (href) setHref(m, href);
  });
  // Tiles whose destination is in a data-url (the "Ask anything in AI Mode" suggestions, the
  // hotel map): a Google path, proxied when it is a search.
  // A knowledge panel's address is an <a> with no href and the place's Maps URL as an intent.
  document.querySelectorAll('[data-url]').forEach((el) => {
    if (el.closest('[data-galt-href]') || hasLink(el)) return;
    if (!/^(button|link)$/.test(el.getAttribute('role') || '') && !el.hasAttribute('jsaction')) return;
    let raw = el.getAttribute('data-url') || '';
    if (/^intent:\/\//i.test(raw)) raw = intentToHttps(raw);
    if (!raw || !/^(\/|https?:)/.test(raw)) return;
    let u;
    try { u = new URL(raw, location.href); } catch { return; }
    let href = u.href;
    if (isGoogleHost(u.hostname) && u.pathname === '/search') {
      if (u.searchParams.get('udm') === '50') u.searchParams.delete('udm');
      TRACKING.forEach((k) => u.searchParams.delete(k));
      href = proxyOrigin + '/search?' + u.searchParams.toString();
    }
    if (el.tagName === 'A') el.setAttribute('href', href); else setHref(el, href);
  });
  // The panel's "Directions" button has no destination in the page at all; Maps can route to
  // the address printed under it.
  const kpAddress = text1(document.querySelector('[jscontroller="x0z7kc"] a[data-url], [data-attrid*="address" i]'));
  if (kpAddress) {
    document.querySelectorAll('[jscontroller="pU86Hd"][role="link"]').forEach((b) => {
      if (hasLink(b) || !/^directions$/i.test(text1(b))) return;
      setHref(b, 'https://www.google.com/maps/dir//' + encodeURIComponent(kpAddress));
    });
  }
  // Video tiles carry the video's URL; Google's script played it inline.
  // A video result in the Videos section wraps its title link and key moments too: there,
  // just the thumbnail gets the destination.
  document.querySelectorAll('[data-surl], [data-curl]').forEach((el) => {
    if (el.closest('[data-galt-href], a[href]')) return;
    const u = el.getAttribute('data-surl') || el.getAttribute('data-curl') || '';
    if (!/^https?:/.test(u)) return;
    if (!el.querySelector('a[href]')) { setHref(el, u); return; }
    el.querySelectorAll('[role="button"]').forEach((b) => {
      if (hasLink(b) || b.closest('[data-galt-href]')) return;
      if (b.hasAttribute('data-galt-toggle') || b.hasAttribute('data-galt-paa') || b.hasAttribute('data-galt-clamp')) return;
      // A "key moment" row names its offset ("From 1 minute, 17 seconds."): play from there.
      const m = /From (?:(\d+) minutes?)?,?\s*(?:(\d+) seconds?)?/.exec(b.getAttribute('aria-label') || '');
      if (m && (m[1] || m[2])) { setHref(b, u + (u.includes('?') ? '&' : '?') + 't=' + ((+m[1] || 0) * 60 + (+m[2] || 0))); return; }
      // The thumbnail and the untimed "key moment" rows play the video; the expander beside
      // them ("6 key moments") was excluded above.
      setHref(b, u);
    });
  });
  // An image result (the Images tab, the "Images" strip on the web tab) names its source page
  // in data-lpage; Google's viewer would have offered "Visit". Go straight there.
  document.querySelectorAll('[data-lpage^="http"]').forEach((card) => {
    const tile = card.querySelector('[jscontroller="aw2uhd"], [role="button"]') || card;
    if (tile.closest('[data-galt-href], a[href]') || tile.querySelector('a[href]')) return;
    setHref(tile, card.getAttribute('data-lpage'));
  });
  // Image tiles (the "Images" strip, a merchant's cover photo, a knowledge panel's thumbnail)
  // opened Google's image viewer, which is a script. The Images tab for the query is the
  // nearest thing in the page.
  if (q0) {
    document.querySelectorAll('[jscontroller="aw2uhd"][role="button"], [data-attrid="ShoppingMerchantSingleCoverImage"], [data-attrid="VisualDigestImageResult"][role="button"], [data-attrid="VisualDigestImageResult"] [role="button"], [jscontroller="n5EtZd"][role="button"], [jscontroller="n5EtZd"] [role="button"]').forEach((el) => {
      if (el.closest('[data-galt-href]') || hasLink(el)) return;
      setHref(el, searchHref(q0, '&udm=2'));
    });
  }
  // Showtimes. A movie's name opened its panel; tapping it, or "More theaters and showtimes"
  // under it, searches for the movie's showtimes. The showtime buttons themselves led into
  // Google's ticket dialog, which needs its script; they are left as they are.
  document.querySelectorAll('[jscontroller="mNvPwf"] [role="heading"][data-mid]').forEach((h) => {
    if (hasLink(h)) return;
    const t = titleOf(h);
    if (!t) return;
    h.setAttribute('data-galt-title', t);
    setHref(h, searchHref(t + ' showtimes'));
  });
  document.querySelectorAll('[jscontroller="mNvPwf"] [role="button"]').forEach((b) => {
    if (b.closest('[data-galt-href]') || hasLink(b) || !/showtimes/i.test(text1(b))) return;
    let card = b.parentElement;
    let h = null;
    while (card && card !== document.body && !(h = card.querySelector('[data-galt-title]'))) card = card.parentElement;
    if (h) setHref(b, searchHref(h.getAttribute('data-galt-title') + ' showtimes'));
  });
  // A widget's tab strip (Theaters | Movies): the other tab is another search.
  document.querySelectorAll('[role="tablist"] [role="tab"]').forEach((t) => {
    if (hasLink(t) || t.getAttribute('aria-selected') === 'true' || t.closest('[data-galt-href]')) return;
    const label = text1(t);
    if (label && label.length <= 30 && q0) setHref(t, searchHref(q0 + ' ' + label.toLowerCase()));
  });
  // Event, activity and place tiles ("things to do this weekend") opened a viewer Google
  // fetches; search for the thing.
  document.querySelectorAll('[data-ssid$="_viewer_entrypoint"][role="button"], [data-ssid="lcl_place_tile_button"]').forEach((t) => {
    if (t.closest('[data-galt-href]') || hasLink(t)) return;
    const title = titleOf(t);
    if (title) setHref(t, searchHref(title));
  });
  // A place's "Museums" / "Events" / "Restaurants" rows (a city's panel) opened a list Google
  // fetches; search for that kind of thing there.
  document.querySelectorAll('[data-attrid="LocalNavDynamicInfolistItem"] [role="button"], [data-attrid="LocalNavDynamicInfolistItem"][role="button"]').forEach((b) => {
    if (b.closest('[data-galt-href]') || hasLink(b)) return;
    const t = titleOf(b);
    if (t && q0) setHref(b, searchHref(q0 + ' ' + t.toLowerCase()));
  });
  // An entity panel's cards (a show's "Where to watch", "Cast", "Ratings", "Release date"): a
  // chip naming the topic over a tile Google's script opened into a sheet. Both search for the
  // entity and the topic; links inside a tile (the streaming services, IMDb) stay links.
  let chipSeq = 0;
  // (Some chips are plain labels without role=button, e.g. "Ratings" on a film; same deal.)
  document.querySelectorAll('[jscontroller="qWD4e"]').forEach((chip) => {
    if (chip.closest('[data-galt-href], [data-galt-proxy]') || chip.querySelector('[jscontroller="lT1z8b"]')) return;
    if (chip.hasAttribute('data-galt-toggle')) {
      // The chip folds a list out ("Songs" over "Cruel Summer, Shake It Off, ..."); the summary
      // tile beside it does the same.
      if (!chip.id) chip.id = 'galt-chip-' + (++chipSeq);
      const card = chip.parentElement || chip;
      card.querySelectorAll('[jscontroller="lT1z8b"]').forEach((c) => {
        if (!c.closest('a[href], [data-galt-proxy], [data-galt-href]')) c.setAttribute('data-galt-proxy', chip.id);
      });
      return;
    }
    if (hasLink(chip) || chip.closest('[data-galt-href]')) return;
    const label = text1(chip);
    if (!label || label.length > 30 || !q0) return;
    const href = searchHref(q0 + ' ' + label.toLowerCase());
    setHref(chip, href);
    const card = chip.parentElement && chip.parentElement.querySelector('[jscontroller="lT1z8b"]') ? chip.parentElement : chip.closest('[data-attrid]');
    if (card) card.querySelectorAll('[jscontroller="lT1z8b"]').forEach((t) => { if (!t.closest('[data-galt-href], a[href]')) setHref(t, href); });
  });
  // The trailer tile names its clip in data-attrid; the Videos tab has it.
  document.querySelectorAll('[data-attrid*="/media_item/trailer/"]').forEach((t) => {
    if (t.closest('[data-galt-href]') || hasLink(t)) return;
    const title = t.getAttribute('data-attrid').split('/trailer/')[1];
    if (title) setHref(t, searchHref(title, '&udm=7'));
  });
  // A merchant offer (the offers grid under a product) carries its store URL.
  document.querySelectorAll('[data-target-url^="http"]').forEach((el) => {
    if (el.closest('[data-galt-href], a[href]') || el.querySelector('a[href]')) return;
    setHref(el, el.getAttribute('data-target-url'));
  });
  // A match row in a scores list opened the game's panel; search for the game, pinned to it.
  document.querySelectorAll('[jscontroller="ThULI"][role="link"]').forEach((row) => {
    if (row.closest('[data-galt-href]')) return;
    let teams = Array.from(row.querySelectorAll('td[class*="tt-w"]')).map((td) => (td.innerText || '').split('\n')[0].trim()).filter(Boolean);
    if (teams.length !== 2) {
      // Each team's name is printed twice in a row (crest label and name).
      const lines = (row.innerText || '').split('\n').map((x) => x.trim());
      teams = lines.filter((x, i) => x && x === lines[i + 1] && !/^\d+$/.test(x));
    }
    if (teams.length !== 2) return;
    const midEl = row.querySelector('[data-mid]');
    const mid = midEl ? midEl.getAttribute('data-mid') : '';
    setHref(row, searchHref(teams[0] + ' vs ' + teams[1], /^\/[gm]\//.test(mid) ? '&kgmid=' + encodeURIComponent(mid) : ''));
  });
  document.querySelectorAll('[jscontroller="sspKBe"][role="button"], [jscontroller="sspKBe"] [role="button"]').forEach((b) => {
    if (q0 && /more games/i.test(text1(b)) && !hasLink(b)) setHref(b, searchHref(q0.replace(/\bscores?\b/i, '').trim() + ' schedule'));
  });
  // The weather widget's day strip switched the hourly view; each day is its own forecast.
  const DAYS = { sun: 'sunday', mon: 'monday', tue: 'tuesday', wed: 'wednesday', thu: 'thursday', fri: 'friday', sat: 'saturday' };
  document.querySelectorAll('[jscontroller="hGVs6"][role="button"]').forEach((d) => {
    const m = /^(sun|mon|tue|wed|thu|fri|sat)/i.exec((d.getAttribute('aria-label') || text1(d)).trim());
    if (!m || !q0 || hasLink(d)) return;
    setHref(d, searchHref((/weather|forecast/i.test(q0) ? q0 : 'weather ' + q0) + ' ' + DAYS[m[1].toLowerCase()]));
  });
  // Translate. The language pickers become dropdowns of Google's own language lists (the list
  // sits hidden beside a "Search languages" box, one per side); the page script turns a pick,
  // Enter in the text box, and the swap arrow into a new "translate ... to ..." search. The
  // microphone, camera and fullscreen buttons need Google's app.
  document.querySelectorAll('#tw-sl, #tw-tl').forEach((btn) => {
    const side = btn.id === 'tw-sl' ? 'sl' : 'tl';
    const box = document.getElementById(side + '_list-search-box');
    const wrap = box && box.closest('.language-list');
    const list = wrap && Array.from(wrap.querySelectorAll('.language_list_languages')).sort((a, b) => b.children.length - a.children.length)[0];
    if (!list || !list.children.length) return;
    if (!list.id) list.id = 'galt-langs-' + side;
    list.querySelectorAll('[role="button"]').forEach((it) => it.setAttribute('data-galt-lang', side));
    btn.setAttribute('data-galt-menu', list.id);
    btn.setAttribute('aria-haspopup', 'menu');
  });
  document.querySelectorAll('#tw-mic, #tw-cst, [id^="tw-fs"], [jscontroller="JlIvbd"], [aria-label^="Translate with your camera"], [aria-label="Translate by voice"]').forEach((e) => e.remove());
  {
    const tgt = text1(document.getElementById('tw-target-text'));
    if (tgt) document.querySelectorAll('#tw-tmenu [jsaction="dWdiIc"]').forEach((b) => setHref(b, searchHref(tgt)));
    const srcLang = text1(document.getElementById('tw-sl')).replace(/\s*-\s*detected$/i, '');
    document.querySelectorAll('[data-attrid="tw-bilingualDictionary"][role="button"], [data-attrid="tw-bilingualDictionary"] [role="button"]').forEach((row) => {
      const word = text1(row.querySelector('div, span'));
      if (word && srcLang && !hasLink(row)) setHref(row, searchHref('translate ' + word + ' to ' + srcLang));
    });
  }
  // The weather line in a place's panel opened the forecast.
  document.querySelectorAll('[data-attrid="WeatherAndClimateVise"], [data-attrid="WeatherAndClimateVise"] [jsaction]').forEach((w) => {
    if (q0 && !w.closest('[data-galt-href]') && !hasLink(w)) setHref(w, searchHref(q0 + ' weather'));
  });
  // A product's image carousel opened Google's image viewer; the Images tab has the pictures.
  document.querySelectorAll('[data-attrid="kc:/shopping/gpc:image-set"] [role="listitem"], [data-attrid="kc:/shopping/gpc:image-set"] [role="button"]').forEach((t) => {
    if (q0 && !t.closest('[data-galt-href], a[href]') && !t.querySelector('a[href]') && t.querySelector('img')) setHref(t, searchHref(q0, '&udm=2'));
  });
  // The photo strip and "View all photos" in a place's panel opened Google's photo viewer.
  document.querySelectorAll('[role="button"][aria-label="View all photos"], g-scrolling-carousel button[data-phdesc]').forEach((b) => {
    if (q0 && !hasLink(b)) setHref(b, searchHref(q0, '&udm=2'));
  });
  // The panel's hours line opened the week's hours, which are not in the page.
  document.querySelectorAll('[jscontroller="EQHD1"] [role="button"]').forEach((b) => {
    if (q0 && !hasLink(b) && !b.hasAttribute('data-galt-toggle')) b.setAttribute('data-galt-paa', q0 + ' hours');
  });
  // Local Services ads: the "Call" button's number is not in the page; the provider's profile
  // page (which the card already links to) has it.
  document.querySelectorAll('[jscontroller="VChu3e"][role="button"]').forEach((b) => {
    let card = b.parentElement;
    let a = null;
    for (let i = 0; card && i < 8 && !(a = card.querySelector('a[href*="/localservices/profile"]')); i++) card = card.parentElement;
    if (a) setHref(b, a.getAttribute('href'));
  });
  // Filter chips that open a sheet ("Vibe", "Price", "Reservations" over a local pack). One
  // whose sheet is a list of links becomes a dropdown of them (the page script's menus); one
  // whose sheet is a form Google's script would have submitted goes.
  let menuSeq = 0;
  document.querySelectorAll('[jscontroller="scFHte"]').forEach((chip) => {
    const trigger = chip.querySelector(':scope > [role="button"]');
    const list = chip.querySelector('[role="dialog"] [role="list"]');
    if (!trigger) return;
    if (!list || !list.querySelector('a[href]')) { chip.remove(); return; }
    list.querySelectorAll('a:not([href])').forEach((a) => (a.closest('[role="listitem"]') || a).remove());
    if (!list.id) list.id = 'galt-menu-' + (++menuSeq);
    trigger.setAttribute('data-galt-menu', list.id);
    trigger.setAttribute('aria-haspopup', 'menu');
  });
  // Share buttons: the phone's own share sheet, or the link copied.
  document.querySelectorAll('[role="button"][aria-label="Share"], [role="button"][aria-label^="Share "]').forEach((b) => {
    if (b.closest('.galt') || hasLink(b)) return;
    b.setAttribute('data-galt-share', (b.getAttribute('aria-label') || '').replace(/^Share\s*/i, ''));
  });
  // "Read more" on a clamped description (a merchant's blurb, a product overview): unclamp it.
  document.querySelectorAll('[role="button"][aria-expanded="false"], [data-expandable="1"][data-collapsed="1"]').forEach((b) => {
    if (b.hasAttribute('data-galt-paa') || b.hasAttribute('data-galt-toggle') || b.hasAttribute('aria-controls') || b.closest('a[href]')) return;
    if (!b.querySelector('[style*="line-clamp"]')) return;
    b.setAttribute('data-galt-clamp', '1');
  });
  // Controls that only work signed in to google.com or inside its scripts, with nothing to
  // stand in: the "About this result" dots on every result, Follow, the knowledge panel's
  // overflow menu, "Order" buttons that never had a link. The main menu keeps its space so
  // the header does not reflow.
  document.querySelectorAll('[jscontroller="i8S0p"], [jscontroller="edDbvc"], [jscontroller="W5nr0b"], [jscontroller="DPreE"] [jsname="oYxtQd"], a[jscontroller="pcweGb"]:not([href]), [jscontroller="rRNiyd"], [jscontroller="QhmaJc"], [aria-label="Froggy\'s World game"]').forEach((e) => e.remove());
  // "Add to home screen" (Google's own shortcut promo) and its "Try it".
  document.querySelectorAll('[jscontroller="Jlf2lc"]').forEach((b) => {
    let card = null;
    for (let e = b.parentElement, i = 0; e && e !== document.body && i < 8; e = e.parentElement, i++) {
      const t = (e.textContent || '').trim();
      if (t.length > 300) break;
      if (/add to home screen/i.test(t)) card = e;
    }
    if (card) card.remove();
  });
  document.querySelectorAll('[jsname="hyP9Qc"][aria-label="Main menu"]').forEach((e) => { e.style.visibility = 'hidden'; e.setAttribute('aria-hidden', 'true'); });

  document.querySelectorAll('a[href]').forEach((a) => {
    a.removeAttribute('ping');
    a.removeAttribute('onmousedown');
    a.removeAttribute('onclick');
    let u;
    try { u = new URL(a.getAttribute('href'), location.href); } catch { return; }
    if (u.protocol === 'javascript:') { a.removeAttribute('href'); return; }
    if (isGoogleHost(u.hostname) || isAdHost(u.hostname)) {
      if (u.pathname === '/url') {
        const target = u.searchParams.get('q') || u.searchParams.get('url');
        if (target && /^https?:/i.test(target)) { a.setAttribute('href', target); return; }
        // A Google path (a search, the place viewer): handled like a direct link to it.
        if (target && target.startsWith('/')) { try { u = new URL(target, u.origin); } catch { /* keep the wrapper */ } }
      }
      // Sponsored results (/aclk) and opaque result redirects (/goto) carry no destination we
      // can unwrap here; the proxy follows Google's redirect for the browser (see src/go.js).
      if (u.pathname === '/aclk' || u.pathname === '/goto' || u.pathname === '/pagead/aclk') {
        a.setAttribute('href', proxyOrigin + '/go?u=' + encodeURIComponent(u.href));
        return;
      }
      // Every tab, filter and results page stays on the proxy. Letting a tab link out to
      // google.com is what used to bring Google's own AI Overview back when you switched to
      // Images and came back.
      if (u.pathname === '/search' && (u.searchParams.has('q') || u.searchParams.has('udm'))) {
        // AI Mode (udm=50) is Google's own chat answer, which this proxy replaces. Its tab goes;
        // the "Ask anything in AI Mode" suggestions elsewhere become ordinary searches.
        // A tab is a list item holding nothing but the link (the mobile page carries a second,
        // hidden copy of the strip whose list has no role, so the item is recognised by content).
        if (u.searchParams.get('udm') === '50') {
          const li = a.closest('[role="listitem"]');
          if (li && (li.textContent || '').trim() === (a.textContent || '').trim()) { li.remove(); return; }
          u.searchParams.delete('udm');
        }
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
