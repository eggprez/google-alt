// The Boogle skin for a proxied Google page. It restyles Google's own markup on every tab
// (web, images, news, videos, shopping, …) using the hooks rewrite.js adds (.galt-item,
// .galt-title, .galt-url, .galt-snippet, .galt-card, .galt-imgcard) plus Google's few stable
// ids (#rcnt, #center_col, #rhs, #rso, #botstuff). Nothing here depends on a generated class.
import { TOKENS_CSS, LOGO_CSS } from './theme.js';

const BASE = `
html.galt-skin{background:var(--bg)!important;color-scheme:light dark}
html.galt-skin body{margin:0!important;padding:0!important;background:var(--bg)!important;color:var(--fg)!important;
  font-family:var(--font)!important;font-size:15px!important;line-height:1.55!important;min-width:0!important;
  -webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
/* Google sets a font on nearly every node; ours has to win, but icon fonts must not be touched. */
html.galt-skin body :where(div,span,p,a,h1,h2,h3,h4,h5,li,ul,ol,td,th,cite,em,strong,b,label,summary,section,main,nav,header,footer,form,input,textarea,button,select,g-section-with-header,[role]):not(.google-symbols):not([class*="material-icons"]):not([class*="google-material"]){
  font-family:var(--font)!important}
html.galt-skin body::before{content:"";position:fixed;top:0;left:0;right:0;height:3px;z-index:60;
  background:linear-gradient(90deg,var(--accent),var(--accent-2),var(--accent-4),var(--accent-3))}
html.galt-skin *{box-sizing:border-box}
html.galt-skin :focus-visible{outline:2px solid var(--accent-2);outline-offset:2px;border-radius:6px}
html.galt-skin ::selection{background:var(--accent-soft-2)}
/* Google's leftovers that only worked with its scripts. */
html.galt-skin #gb,html.galt-skin .gb_A,html.galt-skin #searchform,html.galt-skin #sfcnt,html.galt-skin #top_nav,
html.galt-skin #appbar,html.galt-skin #footcnt,html.galt-skin #fbar,html.galt-skin #gbqfbwa,
html.galt-skin [aria-label="Feedback"],html.galt-skin g-snackbar,html.galt-skin [jsname="mNaxIe"]{display:none!important}
/* Google loads some component CSS lazily via JS, which we strip. Unsized inline icons would
   otherwise fill the viewport. */
html.galt-skin svg:not([width]):not([height]):not(.galt-chrome svg):not(.galt-wrap svg){max-width:24px;max-height:24px}
`;

const LAYOUT = `
/* Google's #rcnt is a 22-column fluid grid whose widths come from CSS we cannot rely on.
   Replace it with two honest columns: results, and the right-hand knowledge panel. */
html.galt-skin #cnt,html.galt-skin #main,html.galt-skin .GyAeWb{width:auto!important;max-width:none!important;margin:0!important;padding:0!important;background:transparent!important;min-width:0!important}
html.galt-skin #rcnt{display:grid!important;grid-template-columns:minmax(0,var(--col-max)) minmax(0,var(--side-w))!important;
  justify-content:start!important;column-gap:var(--col-gap)!important;row-gap:0!important;
  width:auto!important;max-width:none!important;margin:0!important;padding:12px var(--gutter) 40px!important}
html.galt-skin #rcnt>*{grid-column:1/-1;min-width:0}
html.galt-skin #center_col{grid-column:1!important;width:auto!important;max-width:none!important;margin:0!important;padding:0!important;overflow:visible!important}
html.galt-skin #rhs{grid-column:2!important;width:auto!important;max-width:none!important;margin:0!important;padding:0!important}
/* With no knowledge panel there is nothing to reserve the second column for; the overview
   borrows that space instead (see .galt-wrap). */
html.galt-skin:not(.galt-has-rhs) #rcnt{grid-template-columns:minmax(0,var(--col-max))!important}
html.galt-skin #search,html.galt-skin #rso,html.galt-skin #res,html.galt-skin #topstuff,html.galt-skin #botstuff{width:auto!important;max-width:none!important;margin:0!important;padding:0!important}
@media (max-width:1100px){
  html.galt-skin #rcnt{grid-template-columns:minmax(0,1fr)!important}
  html.galt-skin #rhs{grid-column:1!important;order:-1}
}
/* Images and shopping lay their own mosaic out in pixels captured upstream: give them the
   full width and centre what they produce instead of squeezing it into the text column. */
html.galt-skin[data-galt-tab="images"] #rcnt,html.galt-skin[data-galt-tab="shopping"] #rcnt{grid-template-columns:minmax(0,1fr)!important}
html.galt-skin[data-galt-tab="images"] #center_col,html.galt-skin[data-galt-tab="shopping"] #center_col{margin-inline:auto!important}
`;

const CHROME = `
/* The header and the tab strip must be direct children of the scroll root for position:sticky
   to hold; a wrapper box would let them scroll away with it. */
.galt-chrome{display:contents}
.galt-top{position:sticky;top:0;z-index:12;display:flex;align-items:center;gap:22px;
  padding:14px var(--gutter) 10px;background:var(--topbar-bg);
  backdrop-filter:blur(14px) saturate(1.3);-webkit-backdrop-filter:blur(14px) saturate(1.3)}
.galt-logo-link{text-decoration:none}
.galt-sb{position:relative;display:flex;align-items:center;flex:1;max-width:clamp(700px,54vw,1240px);
  height:46px;padding:0 6px 0 16px;background:var(--card);border:1px solid var(--border-2);border-radius:999px;
  box-shadow:var(--shadow-sm);transition:box-shadow .2s,border-color .2s;margin:0}
.galt-sb:hover{border-color:color-mix(in srgb,var(--accent) 35%,var(--border-2));box-shadow:var(--shadow)}
.galt-sb:focus-within{border-color:color-mix(in srgb,var(--accent) 55%,var(--border-2));box-shadow:0 0 0 4px var(--accent-soft),var(--shadow-lg)}
.galt-sb-icon{color:var(--muted);display:inline-flex;margin-right:12px;transition:color .2s}
.galt-sb:focus-within .galt-sb-icon{color:var(--accent-ink)}
.galt-sb-input{flex:1;min-width:0;border:0;outline:0;background:transparent;font:inherit;font-size:16.5px;color:var(--fg)}
.galt-sb-input::placeholder{color:var(--muted)}
.galt-sb-clear,.galt-sb-go{display:inline-flex;align-items:center;justify-content:center;border:0;background:transparent;
  cursor:pointer;color:var(--muted);width:36px;height:36px;border-radius:50%;padding:0;transition:background .15s,color .15s,transform .15s}
.galt-sb-clear:hover{background:var(--bg-2);color:var(--fg)}
.galt-sb-go{color:#fff;background:linear-gradient(120deg,var(--accent),var(--accent-2));box-shadow:0 2px 8px var(--accent-glow)}
.galt-sb-go:hover{transform:scale(1.06)}
.galt-tabs{position:sticky;top:70px;z-index:11;display:flex;align-items:center;gap:6px;flex-wrap:wrap;
  padding:4px var(--gutter) 12px;border-bottom:1px solid var(--border);
  background:var(--topbar-bg);backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px)}
@media (min-width:900px){.galt-tabs{padding-left:calc(var(--gutter) + 132px)}}
.galt-tab{display:inline-flex;align-items:center;gap:7px;padding:7px 14px;color:var(--fg-2);font-size:13.5px;font-weight:500;
  border-radius:999px;border:1px solid transparent;white-space:nowrap;text-decoration:none;transition:all .15s;cursor:pointer}
.galt-tab svg{width:15px;height:15px;color:var(--c,var(--accent))}
.galt-tab-web{--c:var(--accent)}.galt-tab-images{--c:var(--accent-3)}.galt-tab-news{--c:var(--accent-4)}
.galt-tab-videos{--c:var(--accent-2)}.galt-tab-shopping{--c:#0d9488}.galt-tab-books{--c:#b45309}
.galt-tab-forums{--c:#0284c7}.galt-tab-maps{--c:#059669}.galt-tab-other{--c:var(--muted)}
.galt-tab:hover{color:var(--c);text-decoration:none;background:color-mix(in srgb,var(--c) 10%,transparent)}
.galt-tab-on{color:#fff!important;background:linear-gradient(120deg,var(--c),color-mix(in srgb,var(--c) 70%,var(--accent-2)));
  box-shadow:0 3px 10px color-mix(in srgb,var(--c) 35%,transparent)}
.galt-tab-on svg{color:#fff}
.galt-more{position:relative}
.galt-more summary{list-style:none}
.galt-more summary::-webkit-details-marker{display:none}
.galt-more-menu{position:absolute;top:calc(100% + 6px);left:0;z-index:40;min-width:170px;padding:6px 0;
  background:var(--card);border:1px solid var(--border);border-radius:12px;box-shadow:var(--shadow-lg);animation:galt-rise .16s ease}
.galt-more-menu a,.galt-more-menu span{display:block;padding:9px 16px;color:var(--fg);font-size:14px;text-decoration:none;white-space:nowrap}
.galt-more-menu a:hover{background:var(--accent-soft);color:var(--accent-ink)}
.galt-filters{display:inline-flex;align-items:center;gap:2px;margin-left:auto;padding-left:10px;color:var(--muted)}
.galt-filters>svg{width:14px;height:14px;margin-right:4px;flex:none}
.galt-filter{padding:6px 10px;border-radius:999px;color:var(--muted);font-size:12.5px;font-weight:500;white-space:nowrap;text-decoration:none;transition:all .15s}
.galt-filter:hover{color:var(--accent-ink);background:var(--accent-soft)}
.galt-filter-on{color:var(--accent-ink);background:var(--accent-soft-2)}
.galt-foot{display:flex;justify-content:space-between;gap:12px;padding:16px var(--gutter) 26px;
  color:var(--muted);font-size:13px;border-top:1px solid var(--border)}
.galt-foot a{color:var(--accent-ink);text-decoration:none}
@media (max-width:700px){
  .galt-top{gap:12px;padding:10px 14px 8px;flex-wrap:wrap}
  .galt-top .galt-logo-sm{font-size:1.5rem}
  .galt-sb{order:3;flex-basis:100%}
  .galt-tabs{top:auto;position:static;padding-left:14px;padding-right:14px}
  .galt-filters{margin-left:0;padding-left:0;flex-basis:100%;overflow-x:auto}
}
`;

const RESULTS = `
/* One result. Google nests several wrappers per item; the outermost annotated one is the card. */
html.galt-skin .galt-item{margin:0 0 26px!important;padding:0!important;background:transparent!important;
  border:0!important;box-shadow:none!important;animation:galt-rise .35s ease;max-width:none!important}
html.galt-skin .galt-item .galt-item{margin-bottom:0!important;animation:none}
html.galt-skin .galt-title{margin:0 0 2px!important;font-size:19.5px!important;font-weight:500!important;line-height:1.3!important;
  letter-spacing:-.01em!important;color:var(--link)!important;padding:0!important}
html.galt-skin a:visited .galt-title{color:var(--link-visited)!important}
html.galt-skin .galt-item a{text-decoration:none}
html.galt-skin .galt-item a:hover .galt-title{text-decoration:underline;text-underline-offset:2px}
html.galt-skin .galt-url,html.galt-skin cite{display:block;color:var(--muted)!important;font-size:12.5px!important;
  font-style:normal!important;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
html.galt-skin .galt-snippet,html.galt-skin .galt-snippet *{color:var(--fg-2)!important;font-size:14px!important;line-height:1.6!important}
html.galt-skin .galt-snippet em,html.galt-skin .galt-snippet b{color:var(--fg)!important;font-weight:600!important;font-style:normal!important}
/* The site avatar Google puts in front of a result. */
html.galt-skin .galt-item img[src*="favicon"],html.galt-skin .galt-item img[height="26"],html.galt-skin .galt-item img[width="26"]{
  border-radius:8px;background:var(--card);border:1px solid var(--border);padding:2px}
/* Google draws boxes with its own greys; neutralise the ones that survive. */
html.galt-skin #center_col [style*="background-color:#f"],html.galt-skin #center_col [style*="background:#f"],
html.galt-skin #center_col [style*="background-color: #f"]{background:var(--bg-2)!important}
html.galt-skin #center_col [style*="border"]{border-color:var(--border)!important}
html.galt-skin #rso a{color:var(--link)}
html.galt-skin #rso a:visited{color:var(--link-visited)}
/* "People also ask" / related searches / any Google card that keeps its own frame. */
html.galt-skin [jsname] > [role="heading"],html.galt-skin #center_col h2:not(.galt-title){
  font-size:17px!important;font-weight:600!important;letter-spacing:-.01em;color:var(--fg)!important;margin:0 0 10px!important}
html.galt-skin #center_col hr,html.galt-skin #center_col [role="separator"]{border-color:var(--border)!important;background:var(--border)!important}
/* News cards (the whole card is one anchor holding a heading and a thumbnail). */
html.galt-skin .galt-card{display:block;padding:12px 14px!important;border:1px solid var(--border)!important;border-radius:14px!important;
  background:var(--card)!important;box-shadow:var(--shadow-sm);color:var(--fg)!important;
  transition:transform .15s,border-color .15s,box-shadow .15s}
html.galt-skin .galt-card:hover{transform:translateY(-2px);border-color:color-mix(in srgb,var(--accent) 40%,var(--border-2))!important;box-shadow:var(--shadow)}
html.galt-skin .galt-card .galt-title{font-size:16px!important;color:var(--fg)!important;font-weight:600!important}
html.galt-skin .galt-card img{border-radius:10px}
html.galt-skin[data-galt-tab="web"] .galt-card,html.galt-skin[data-galt-tab="other"] .galt-card{
  padding:0!important;border:0!important;background:transparent!important;box-shadow:none!important}
html.galt-skin[data-galt-tab="web"] .galt-card:hover,html.galt-skin[data-galt-tab="other"] .galt-card:hover{transform:none;box-shadow:none}
html.galt-skin[data-galt-tab="web"] .galt-card .galt-title{font-size:19.5px!important;color:var(--link)!important;font-weight:500!important}
/* Images. Google's mosaic is positioned in inline pixels, so only the tiles are restyled. */
html.galt-skin .galt-imgcard{display:block;border-radius:12px;overflow:hidden;background:var(--bg-2);
  border:1px solid var(--border);box-shadow:var(--shadow-sm);transition:transform .2s,box-shadow .2s}
html.galt-skin .galt-imgcard:hover{transform:translateY(-2px);box-shadow:var(--shadow-lg)}
html.galt-skin .galt-thumb{border-radius:12px;display:block;background:var(--bg-2);
  box-shadow:var(--shadow-sm);transition:transform .18s,box-shadow .18s,filter .18s}
html.galt-skin a:hover .galt-thumb{transform:scale(1.02);box-shadow:var(--shadow-lg)}
html.galt-skin[data-galt-tab="images"] #rso{color:var(--fg)}
html.galt-skin[data-galt-tab="images"] #rso a{color:var(--fg)!important;text-decoration:none}
html.galt-skin[data-galt-tab="images"] #rso a:hover{color:var(--accent-ink)!important}
/* The right-hand knowledge panel. */
html.galt-skin #rhs{position:sticky;top:120px;align-self:start;max-height:calc(100vh - 140px);overflow-y:auto;scrollbar-width:none}
html.galt-skin #rhs::-webkit-scrollbar{display:none}
html.galt-skin #rhs > div,html.galt-skin #rhs [jscontroller]{background:transparent!important}
html.galt-skin #rhs .galt-item,html.galt-skin #rhs > div > div{border:1px solid var(--border)!important;border-radius:18px!important;
  background:var(--card)!important;box-shadow:var(--shadow-sm);padding:16px 18px!important;margin-bottom:16px!important}
/* Pagination and the bottom of the page. */
html.galt-skin .galt-bottom{margin-top:28px!important;padding-top:16px!important;border-top:1px solid var(--border)}
html.galt-skin .galt-pager a,html.galt-skin #botstuff a[href*="start="]{display:inline-flex;align-items:center;justify-content:center;
  min-width:34px;padding:7px 12px;margin:0 3px;border-radius:999px;border:1px solid var(--border-2);background:var(--card);
  color:var(--fg)!important;font-weight:500;text-decoration:none;transition:all .15s}
html.galt-skin .galt-pager a:hover,html.galt-skin #botstuff a[href*="start="]:hover{background:var(--accent-soft);border-color:color-mix(in srgb,var(--accent) 40%,var(--border-2));color:var(--accent-ink)!important}
html.galt-skin .galt-pager td,html.galt-skin .galt-pager table{border:0!important;background:transparent!important}
/* Related searches at the bottom become chips. */
html.galt-skin #bres a,html.galt-skin #brs a{display:inline-flex;align-items:center;gap:7px;padding:8px 15px;margin:0 6px 8px 0;
  border-radius:999px;background:var(--card);color:var(--fg)!important;border:1px solid var(--border-2);
  font-size:14px;box-shadow:var(--shadow-sm);text-decoration:none;transition:all .15s}
html.galt-skin #bres a:hover,html.galt-skin #brs a:hover{background:var(--accent-soft);border-color:color-mix(in srgb,var(--accent) 40%,var(--border-2));color:var(--accent-ink)!important;transform:translateY(-1px)}
`;

export const SKIN_CSS = TOKENS_CSS + LOGO_CSS + BASE + LAYOUT + CHROME + RESULTS;
