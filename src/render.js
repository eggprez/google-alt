import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

marked.setOptions({ gfm: true, breaks: false });

const SANITIZE = {
  allowedTags: ['p', 'br', 'strong', 'em', 'b', 'i', 'u', 's', 'mark', 'code', 'pre', 'ul', 'ol', 'li', 'a', 'sup', 'h3', 'h4', 'h5', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'span', 'dl', 'dt', 'dd'],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel', 'class'],
    sup: ['class'],
    span: ['class'],
    mark: ['class'],
    td: ['align'],
    th: ['align'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: (tagName, attribs) => ({
      tagName,
      attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer' },
    }),
  },
};

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

// A "Sources:" line (optionally a heading or bold) that starts the trailing source list.
const SOURCES_HEAD = /(?:^|\n)[ \t]*(?:#{1,6}[ \t]*)?[*_]{0,2}sources?[*_]{0,2}[ \t]*:?[ \t]*(?=\n|$)/gi;
const URL_RE = /https?:\/\/[^\s<>()\]"']+/;

/**
 * Split Claude's text into the answer and the trailing source list.
 * Accepts "[1] Title — URL", "1. Title: URL", "- [1] [Title](URL)" and similar.
 */
export function splitSources(text) {
  const t = text || '';
  let last = null;
  for (const m of t.matchAll(SOURCES_HEAD)) last = m;
  if (!last) return { answer: t, sources: [] };
  const answer = t.slice(0, last.index).trimEnd();
  const sources = [];
  for (const raw of t.slice(last.index + last[0].length).split('\n')) {
    const url = (raw.match(URL_RE) || [])[0];
    if (!url) continue;
    const num = (raw.match(/^\s*(?:[-*•]\s*)?\[?(\d{1,3})[\].:)]/) || [])[1];
    const id = num ? Number(num) : sources.length + 1;
    const title = raw.replace(url, '')
      .replace(/^\s*(?:[-*•]\s*)?\[?\d{1,3}[\].:)]?\s*/, '')
      .replace(/^[\s\-–—:|()[\]<>"*]+|[\s\-–—:|()[\]<>"*]+$/g, '')
      .trim();
    const clean = url.replace(/[.,;:]+$/, '');
    sources.push({ id, title: title || hostOf(clean), url: clean, host: hostOf(clean) });
  }
  return { answer, sources };
}

/**
 * Parse the fact-check pass, which always returns the overview rewritten rather than a note
 * about it:
 *   STATUS: verified | corrected
 *   CHANGES: (bullets; empty when nothing changed)
 *   ANSWER: (the full overview, with every edited span wrapped in {{ }})
 *   Sources: (list)
 */
export function parseVerification(text) {
  const t = (text || '').replace(/\r/g, '');
  const status = (t.match(/^\s*\**STATUS\**\s*:\s*\**\s*(verified|corrected|unverified)/im) || [])[1]?.toLowerCase() || null;
  const changesBlock = (t.match(/^\s*\**CHANGES\**\s*:\s*\**\s*\n([\s\S]*?)(?=^\s*\**(?:ANSWER|Sources?)\**\s*:|(?![\s\S]))/im) || [])[1] || '';
  const changes = changesBlock.split('\n').map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()).filter((l) => l && !/^none\b/i.test(l));
  const answerBlock = (t.match(/^\s*\**ANSWER\**\s*:\s*\**\s*\n([\s\S]*)$/im) || [])[1] || '';
  const { answer, sources } = splitSources(answerBlock);
  // What the reply did outranks what it says it did: a listed change, or a marked-up span in the
  // answer, means the overview was edited even when the status line claims otherwise.
  const corrected = status === 'corrected' || changes.length > 0 || /\{\{[\s\S]*?\}\}/.test(answer);
  return {
    status: corrected ? 'corrected' : (status === 'unverified' ? 'unverified' : 'verified'),
    changes,
    answer: answer.trim(),
    sources,
  };
}

// The fact-check wraps each span it rewrote in {{ }}. Turn those into <mark> before the markdown
// is parsed, so inline formatting inside a correction still works, and drop any unpaired brace.
function markCorrections(md) {
  let out = '';
  let rest = md;
  for (;;) {
    const open = rest.indexOf('{{');
    if (open < 0) break;
    const close = rest.indexOf('}}', open + 2);
    if (close < 0) break;
    out += rest.slice(0, open) + '<mark class="galt-fix">' + rest.slice(open + 2, close) + '</mark>';
    rest = rest.slice(close + 2);
  }
  return (out + rest).replace(/\{\{|\}\}/g, '');
}

/**
 * Turn a markdown answer into the HTML body of the overview.
 * Citations like [1] or [2][3] become pill links to the matching source.
 * - streaming: partial text; citations render as inert pills (sources may not be known yet).
 */
export function renderAnswer(answerMd, sources, { streaming = false } = {}) {
  const byId = new Map();
  for (const s of sources || []) {
    if (s && s.url && /^https?:/i.test(s.url)) byId.set(Number(s.id), s);
  }
  // Demote headings so the page keeps one document outline.
  const md = markCorrections((answerMd || '').replace(/^(#{1,2})\s/gm, '### '));
  let html = sanitizeHtml(marked.parse(md), SANITIZE);

  // Replace bracketed citations after sanitizing so we control the markup. "[1, 2]" and "[1][2]"
  // both occur; each number becomes its own pill.
  html = html.replace(/\[(\d{1,3}(?:\s*,\s*\d{1,3})*)\]/g, (m, group) => group.split(',').map((part) => {
    const n = part.trim();
    const s = byId.get(Number(n));
    if (streaming) return `<sup class="galt-cite"><span>${n}</span></sup>`;
    if (!s) return '';
    return `<sup class="galt-cite"><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" title="${esc(s.title || s.url)}">${n}</a></sup>`;
  }).join(''));

  return `<div class="galt-answer">${html}</div>`;
}

/** The numbered source list under the answer. */
export function renderSourceList(sources) {
  const list = (sources || [])
    .filter((s) => s && s.url && /^https?:/i.test(s.url))
    .sort((a, b) => Number(a.id) - Number(b.id))
    .map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer"><span class="galt-src-title">${esc(s.title || s.url)}</span><span class="galt-src-host">${esc(s.host || hostOf(s.url))}</span></a></li>`)
    .join('');
  return list ? `<div class="galt-sources"><div class="galt-sources-label">Sources</div><ol>${list}</ol></div>` : '';
}

/**
 * The note above a fact-checked answer. The fixes themselves are already in the text (in the
 * correction colour); this says how many there were and what they were.
 */
export function renderVerification(v) {
  if (!v) return '';
  if (v.status === 'corrected') {
    const items = v.changes.length ? `<ul>${v.changes.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : '';
    return `<div class="galt-flag galt-flag-corrected"><strong>Corrected after checking the web.</strong> The changes are marked in the text.${items}</div>`;
  }
  if (v.status === 'failed') {
    return `<div class="galt-flag galt-flag-muted">Could not check this answer: ${esc(v.error || 'the check failed')}</div>`;
  }
  return '';
}

/** The whole overview body: the change note, the answer, and the sources it cited. */
export function renderBlock(answerMd, sources, verification) {
  const cited = citedSources(answerMd, sources);
  return renderVerification(verification)
    + renderAnswer(answerMd, sources)
    + renderSourceList(cited.length ? cited : sources);
}

/** Which sources the finished answer actually cites, in citation order. */
export function citedSources(answerMd, sources) {
  const cited = new Set(Array.from((answerMd || '').matchAll(/\[(\d{1,3}(?:\s*,\s*\d{1,3})*)\]/g))
    .flatMap((m) => m[1].split(',').map((n) => Number(n.trim()))));
  return (sources || [])
    .filter((s) => cited.has(Number(s.id)))
    .map((s) => ({ id: Number(s.id), title: s.title || hostOf(s.url), url: s.url, host: s.host || hostOf(s.url) }))
    .sort((a, b) => a.id - b.id);
}
