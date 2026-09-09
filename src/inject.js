// Splices Boogle into a rewritten Google page: the design tokens and skin, our own header and
// footer, the AI Overview block, and the two client scripts.
import { FONT_LINKS } from './theme.js';
import { SKIN_CSS } from './skin.js';
import { OVERVIEW_CSS, overviewBlock } from './overview-ui.js';
import { renderHeader, renderFooter } from './chrome.js';
import { PAGE_SCRIPT, OVERVIEW_SCRIPT } from './client.js';

export const PAGE_CSS = SKIN_CSS + OVERVIEW_CSS;

export { overviewBlock };

const HEADER_SLOT = '<div id="galt-header-slot"></div>';

/**
 * @param {string} html   the rewritten Google page
 * @param {{q:string, placeholderId:string, hadOverview:boolean, chrome?:object}} opts
 */
export function injectPage(html, { q, placeholderId, hadOverview, chrome }) {
  const head = FONT_LINKS
    + `<style id="galt-css">${PAGE_CSS}</style>`
    + '<meta name="referrer" content="no-referrer">'
    + '<link rel="search" type="application/opensearchdescription+xml" title="Boogle" href="/opensearch.xml">';
  let out = html.includes('</head>') ? html.replace('</head>', head + '</head>') : head + html;

  const header = renderHeader(chrome || { q, tabs: [], tab: 'web', tbs: '', udm: '', tbm: '' });
  out = out.includes(HEADER_SLOT) ? out.replace(HEADER_SLOT, header) : out.replace(/<body([^>]*)>/i, `<body$1>${header}`);

  let scripts = `<script id="galt-page-js">${PAGE_SCRIPT}</script>`;
  if (hadOverview) {
    const ph = `<div id="${placeholderId}"></div>`;
    if (out.includes(ph)) {
      out = out.replace(ph, overviewBlock(q));
      scripts += `<script id="galt-js">${OVERVIEW_SCRIPT}</script>`;
    }
  }
  const tail = renderFooter() + scripts;
  out = out.includes('</body>') ? out.replace('</body>', tail + '</body>') : out + tail;
  return out;
}
