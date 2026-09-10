// Precise location. The phone's coordinates arrive in a cookie the page script sets after
// navigator.geolocation resolves; they go to Google as a uule parameter, which is what makes the
// SERP localise ("1.8 mi", the location bar naming the neighbourhood, no "Use precise location"
// chip). Verified against a live mobile SERP: the same query went from IP-city results to results
// around the given point.

export const GEO_COOKIE = 'galt_geo';

/** @returns {{lat:number, lon:number, acc:number, ts:number}|null} */
export function parseGeoCookie(cookieHeader) {
  const raw = String(cookieHeader || '').split(/;\s*/).find((c) => c.startsWith(GEO_COOKIE + '='));
  if (!raw) return null;
  let v;
  try { v = decodeURIComponent(raw.slice(GEO_COOKIE.length + 1)); } catch { return null; }
  const [lat, lon, acc, ts] = v.split(',').map(Number);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat, lon, acc: Number.isFinite(acc) ? acc : 0, ts: Number.isFinite(ts) ? ts : 0 };
}

// Google's role-2 location blob: a text proto, base64, prefixed "a ". URLSearchParams turns the
// space into "+", which Google reads back as a space; the base64 must not be percent-encoded
// by hand ("a%2B..." is a different, ignored, value). The timestamp is in microseconds.
export function uuleFor({ lat, lon }) {
  const body = `role:1\nproducer:12\nprovenance:6\ntimestamp:${Date.now() * 1000}\nlatlng{\nlatitude_e7:${Math.round(lat * 1e7)}\nlongitude_e7:${Math.round(lon * 1e7)}\n}\nradius:-1`;
  return 'a ' + Buffer.from(body).toString('base64');
}
