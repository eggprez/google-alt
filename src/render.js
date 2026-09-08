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

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ''); } catch { return url; }
}

/**
 * Turn Claude's markdown answer + sources into the HTML body of the overview block.
 * Citations like [1] or [2][3] become superscript links to the matching source.
 */
export function renderOverview(answerMd, sources) {
  const byId = new Map();
  for (const s of sources || []) {
    if (s && s.url && /^https?:/i.test(s.url)) byId.set(Number(s.id), s);
  }
  // Demote headings so Google's page structure stays sane.
  const md = (answerMd || '').replace(/^(#{1,2})\s/gm, '### ');
  let html = marked.parse(md);
  html = sanitizeHtml(html, SANITIZE);

  // Replace bracketed citations after sanitizing so we control the markup.
  html = html.replace(/\[(\d{1,2})\]/g, (m, n) => {
    const s = byId.get(Number(n));
    if (!s) return '';
    return `<sup class="galt-cite"><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer" title="${esc(s.title || s.url)}">${n}</a></sup>`;
  });

  const list = Array.from(byId.values())
    .sort((a, b) => Number(a.id) - Number(b.id))
    .map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer"><span class="galt-src-title">${esc(s.title || s.url)}</span><span class="galt-src-host">${esc(hostOf(s.url))}</span></a></li>`)
    .join('');
  const sourcesHtml = list ? `<div class="galt-sources"><div class="galt-sources-label">Sources</div><ol>${list}</ol></div>` : '';

  return `<div class="galt-answer">${html}</div>${sourcesHtml}`;
}
