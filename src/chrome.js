// Builds Boogle's own header for a proxied Google page: wordmark, search box, tab strip and
// time filters. Google's header markup is discarded in rewrite.js; only the data survives
// (the query and the tab links), so the chrome looks the same on every tab and does not depend
// on Google's class names.
import { ICONS, wordmark } from './theme.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Tab label -> the kind we colour and pick an icon for. Google's labels vary by locale; unknown
// ones simply get the neutral treatment.
const KINDS = [
  [/^(all|web|todo)$/i, 'web', ICONS.globe],
  [/^(images|imágenes|bilder)$/i, 'images', ICONS.image],
  [/(video|short videos)/i, 'videos', ICONS.video],
  [/^(news|noticias|nachrichten)$/i, 'news', ICONS.news],
  [/^(shopping|compras)$/i, 'shopping', ICONS.shopping],
  [/^(books|libros|bücher)$/i, 'books', ICONS.book],
  [/^(forums|foros)$/i, 'forums', ICONS.forum],
  [/^(maps|mapas)$/i, 'maps', ICONS.map],
];
function kindOf(label) {
  for (const [re, kind, icon] of KINDS) if (re.test(label)) return { kind, icon };
  return { kind: 'other', icon: ICONS.dots };
}

const RANGES = [
  { id: '', label: 'Any time' },
  { id: 'qdr:d', label: '24 hours' },
  { id: 'qdr:w', label: 'Week' },
  { id: 'qdr:m', label: 'Month' },
  { id: 'qdr:y', label: 'Year' },
];

/** How many tabs stay on the strip before the rest fold into "More". */
const VISIBLE_TABS = 6;

function filterHref({ q, udm, tbm, tbs }) {
  const p = new URLSearchParams();
  if (q) p.set('q', q);
  if (udm) p.set('udm', udm);
  if (tbm) p.set('tbm', tbm);
  if (tbs) p.set('tbs', tbs);
  return '/search?' + p.toString();
}

/**
 * @param {{q:string, tabs:{label:string,href:string,active:boolean}[], tab:string, tbs:string, udm:string, tbm:string}} chrome
 */
export function renderHeader(chrome) {
  const q = chrome?.q || '';
  const tabs = Array.isArray(chrome?.tabs) ? chrome.tabs : [];
  const tbs = chrome?.tbs || '';

  const tabHtml = (t) => {
    const { kind, icon } = kindOf(t.label);
    const cls = `galt-tab galt-tab-${kind}${t.active ? ' galt-tab-on' : ''}`;
    const inner = `${icon}<span>${esc(t.label)}</span>`;
    return t.href && !t.active
      ? `<a class="${cls}" href="${esc(t.href)}">${inner}</a>`
      : `<span class="${cls}" aria-current="page">${inner}</span>`;
  };
  const shown = tabs.slice(0, VISIBLE_TABS);
  const rest = tabs.slice(VISIBLE_TABS);
  const more = rest.length
    ? `<details class="galt-more"><summary class="galt-tab galt-tab-other">${ICONS.dots}<span>More</span></summary>`
      + `<div class="galt-more-menu">${rest.map((t) => (t.href ? `<a href="${esc(t.href)}">${esc(t.label)}</a>` : `<span>${esc(t.label)}</span>`)).join('')}</div></details>`
    : '';

  const filters = q
    ? `<div class="galt-filters" aria-label="Time range">${ICONS.clock}`
      + RANGES.map((r) => {
        const on = (tbs || '') === r.id || (!tbs && !r.id);
        const href = filterHref({ q, udm: chrome.udm, tbm: chrome.tbm, tbs: r.id });
        return `<a class="galt-filter${on ? ' galt-filter-on' : ''}" href="${esc(href)}">${esc(r.label)}</a>`;
      }).join('')
      + '</div>'
    : '';

  const hidden = [
    chrome?.udm ? `<input type="hidden" name="udm" value="${esc(chrome.udm)}">` : '',
    chrome?.tbm ? `<input type="hidden" name="tbm" value="${esc(chrome.tbm)}">` : '',
    tbs ? `<input type="hidden" name="tbs" value="${esc(tbs)}">` : '',
  ].join('');

  return `<div class="galt-chrome">
<header class="galt-top">
  ${wordmark('sm', '/')}
  <form class="galt-sb" action="/search" method="get" role="search" autocomplete="off">
    <span class="galt-sb-icon">${ICONS.search}</span>
    <input class="galt-sb-input" type="text" name="q" value="${esc(q)}" placeholder="Search" aria-label="Search" spellcheck="false" autocapitalize="off" autocorrect="off" maxlength="512" required>
    <button type="button" class="galt-sb-clear" aria-label="Clear"${q ? '' : ' hidden'}>${ICONS.close}</button>
    <button type="submit" class="galt-sb-go" aria-label="Search">${ICONS.arrowRight}</button>
    ${hidden}
  </form>
</header>
<nav class="galt-tabs" aria-label="Search tabs">${shown.map(tabHtml).join('')}${more}${filters}</nav>
</div>`;
}

/** The footer under the results. */
export function renderFooter() {
  return `<footer class="galt-foot"><span>Results from Google · Overview by Claude</span><a href="/">Boogle home</a></footer>`;
}
