import { marked } from 'marked';
import sanitizeHtml from 'sanitize-html';

marked.setOptions({ gfm: true, breaks: false });

const SANITIZE = {
  allowedTags: ['p', 'br', 'strong', 'em', 'b', 'i', 'u', 's', 'code', 'pre', 'ul', 'ol', 'li', 'a', 'sup', 'h3', 'h4', 'h5', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'hr', 'span'],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel', 'class'],
    sup: ['class'],
    span: ['class'],
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
    sources.push({ id, title: title || hostOf(url), url: url.replace(/[.,;:]+$/, '') });
  }
  return { answer, sources };
}

/**
 * Parse the verification pass:
 *   STATUS: verified | corrected
 *   CHANGES: (bullets)
 *   ANSWER: (markdown)
 *   Sources: (list)
 */
export function parseVerification(text) {
  const t = (text || '').replace(/\r/g, '');
  const status = (t.match(/^\s*\**STATUS\**\s*:\s*\**\s*(verified|corrected|unverified)/im) || [])[1]?.toLowerCase() || null;
  const changesBlock = (t.match(/^\s*\**CHANGES\**\s*:\s*\**\s*\n([\s\S]*?)(?=^\s*\**(?:ANSWER|Sources?)\**\s*:|(?![\s\S]))/im) || [])[1] || '';
  const changes = changesBlock.split('\n').map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim()).filter((l) => l && !/^none\b/i.test(l));
  const answerBlock = (t.match(/^\s*\**ANSWER\**\s*:\s*\**\s*\n([\s\S]*)$/im) || [])[1] || '';
  const { answer, sources } = splitSources(answerBlock);
  const corrected = status === 'corrected' || (!status && answer.trim().length > 0);
  return { status: corrected ? 'corrected' : (status === 'unverified' ? 'unverified' : 'verified'), changes, answer: answer.trim(), sources };
}

/**
 * Turn a markdown answer + sources into the HTML body of the overview block.
 * Citations like [1] or [2][3] become superscript links to the matching source.
 * - streaming: partial text; citations render as plain superscripts and no source list is shown.
 * - citedOnly: list only the sources the text actually cites (for snippet-based answers, which
 *   receive every top result as a candidate).
 */
export function renderOverview(answerMd, sources, { streaming = false, citedOnly = false } = {}) {
  const byId = new Map();
  for (const s of sources || []) {
    if (s && s.url && /^https?:/i.test(s.url)) byId.set(Number(s.id), s);
  }
  // Demote headings so Google's page structure stays sane.
  const md = (answerMd || '').replace(/^(#{1,2})\s/gm, '### ');
  let html = marked.parse(md);
  html = sanitizeHtml(html, SANITIZE);

  const cited = new Set();
  // Replace bracketed citations after sanitizing so we control the markup.
  html = html.replace(/\[(\d{1,3})\]/g, (m, n) => {
    if (streaming) return `<sup class="galt-cite"><span>${n}</span></sup>`;
    const s = byId.get(Number(n));
    if (!s) return '';
    cited.add(Number(n));
    return `<sup class="galt-cite"><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" title="${esc(s.title || s.url)}">${n}</a></sup>`;
  });
  if (streaming) return `<div class="galt-answer">${html}</div>`;

  const list = Array.from(byId.values())
    .filter((s) => !citedOnly || cited.has(Number(s.id)))
    .sort((a, b) => Number(a.id) - Number(b.id))
    .map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer"><span class="galt-src-title">${esc(s.title || s.url)}</span><span class="galt-src-host">${esc(s.host || hostOf(s.url))}</span></a></li>`)
    .join('');
  const sourcesHtml = list ? `<div class="galt-sources"><div class="galt-sources-label">Sources</div><ol>${list}</ol></div>` : '';
  return `<div class="galt-answer">${html}</div>${sourcesHtml}`;
}

/** The banner shown above a corrected answer, or an unobtrusive note when verification failed. */
export function renderVerification(v) {
  if (!v) return '';
  if (v.status === 'corrected') {
    const items = v.changes.length ? `<ul>${v.changes.map((c) => `<li>${esc(c)}</li>`).join('')}</ul>` : '';
    return `<div class="galt-flag galt-flag-corrected"><strong>Corrected after checking the web.</strong>${items}</div>`;
  }
  if (v.status === 'failed') {
    return `<div class="galt-flag galt-flag-muted">Could not verify this answer: ${esc(v.error || 'verification failed')}</div>`;
  }
  return '';
}
