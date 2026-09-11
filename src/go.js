// Google's redirect links, resolved on the server.
//
// A sponsored result links to google.com/aclk (googleadservices.com/pagead/aclk on desktop) and
// some organic results to google.com/goto?url=<opaque blob>; Google answers both with a 302 to
// the real site. Served as-is, that hop is the only time the phone ever talks to Google directly,
// and on a phone with an ad-blocking DNS or filter it is exactly the request that gets dropped,
// which shows up as "can't connect" on sponsored and top results while everything else works.
// Routing those links through /go makes this server follow the hop instead and send the browser
// straight to the destination. The click still registers with Google as it always did.

const GOOGLE_HOST = /(^|\.)google\.[a-z.]+$/i;
const AD_HOST = /(^|\.)googleadservices\.com$/i;
// Hosts a click may bounce through before reaching the site. The first Location outside this
// set is the destination; the browser follows any redirects the site itself does.
const CHAIN_HOST = /(^|\.)(google\.[a-z.]+|googleadservices\.com|doubleclick\.net|googlesyndication\.com)$/i;

const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const MOBILE_UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36';

/** True for the Google links that only redirect somewhere else. Keep in sync with rewrite.js. */
export function isGoogleRedirect(href) {
  let u;
  try { u = new URL(href); } catch { return false; }
  if (!/^https?:$/.test(u.protocol)) return false;
  if (GOOGLE_HOST.test(u.hostname)) return u.pathname === '/aclk' || u.pathname === '/goto';
  if (AD_HOST.test(u.hostname)) return u.pathname === '/pagead/aclk';
  return false;
}

/** The href to serve for a link: Google redirects go through /go, anything else is unchanged. */
export function goHref(href, origin = '') {
  return isGoogleRedirect(href) ? `${origin}/go?u=${encodeURIComponent(href)}` : href;
}

/** Google's click endpoints answer a phone and a desktop differently; mirror the caller. */
export function userAgentFor(clientUa) {
  return /Mobile|Android|iPhone|iPad|iPod/i.test(clientUa || '') ? MOBILE_UA : DESKTOP_UA;
}

/**
 * Follow the redirect chain until it leaves Google. Resolves to the destination URL, or null
 * when Google did not redirect (an expired link, a challenge page), so the caller can fall back.
 */
export async function resolveRedirect(href, { userAgent = DESKTOP_UA, timeoutMs = 8000, maxHops = 5 } = {}) {
  let url = href;
  for (let hop = 0; hop < maxHops; hop++) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);
    let res;
    try {
      res = await fetch(url, {
        redirect: 'manual',
        signal: ctrl.signal,
        headers: { 'user-agent': userAgent, accept: 'text/html,application/xhtml+xml,*/*;q=0.8' },
      });
    } finally {
      clearTimeout(timer);
    }
    if (res.body) res.body.cancel().catch(() => {});
    const loc = res.headers.get('location');
    if (res.status < 300 || res.status > 399 || !loc) return null;
    let next;
    try { next = new URL(loc, url); } catch { return null; }
    if (!/^https?:$/.test(next.protocol)) return null;
    if (!CHAIN_HOST.test(next.hostname)) return next.href;
    url = next.href;
  }
  return null;
}
