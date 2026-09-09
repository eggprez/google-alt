// The AI Overview block: its stylesheet and its markup. The block spans the results column and
// the empty space to its right, where the sources it cited are listed as cards.
import { ICONS } from './theme.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const OVERVIEW_CSS = `
.galt-wrap{display:grid;grid-template-columns:minmax(0,1fr) var(--side-w);gap:var(--col-gap);align-items:start;
  margin:4px 0 26px;font-family:var(--font);font-size:15px;line-height:1.55;color:var(--fg)}
/* On a wide screen with no knowledge panel the block borrows the empty right-hand column. */
@media (min-width:1060px){html.galt-skin:not(.galt-has-rhs) .galt-wrap{margin-right:calc(-1 * (var(--side-w) + var(--col-gap)))}}
@media (max-width:1059px){.galt-wrap{grid-template-columns:minmax(0,1fr)}.galt-side{display:none}}
html.galt-skin.galt-has-rhs .galt-wrap{grid-template-columns:minmax(0,1fr)}
html.galt-skin.galt-has-rhs .galt-side{display:none}
.galt-wrap *{box-sizing:border-box}

.galt{position:relative;overflow:hidden;padding:18px 20px 16px;border-radius:20px;border:1px solid transparent;
  background-image:
    linear-gradient(135deg,color-mix(in srgb,var(--accent) 7%,var(--card)),var(--card) 45%,color-mix(in srgb,var(--accent-3) 6%,var(--card))),
    linear-gradient(120deg,var(--accent),var(--accent-2) 40%,var(--accent-4) 75%,var(--accent-3));
  background-origin:border-box;background-clip:padding-box,border-box;
  box-shadow:0 10px 34px color-mix(in srgb,var(--accent) 12%,transparent);animation:galt-rise .4s ease}
.galt::before{content:"";position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(ellipse 55% 45% at 0% 0%,var(--accent-soft-2),transparent 70%),
             radial-gradient(ellipse 40% 40% at 100% 100%,color-mix(in srgb,var(--accent-3) 12%,transparent),transparent 70%)}
.galt.galt-error{background-image:linear-gradient(var(--card),var(--card)),linear-gradient(120deg,var(--danger),var(--border));box-shadow:none}
.galt-head{position:relative;display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-bottom:10px}
.galt-spark{display:inline-flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:10px;
  color:#fff;background:linear-gradient(135deg,var(--accent),var(--accent-2));box-shadow:0 3px 10px var(--accent-glow);flex:none}
.galt-spark svg{width:17px;height:17px}
.galt-busy .galt-spark{animation:galt-sparkle 1.3s ease-in-out infinite}
.galt-name{font-weight:650;font-size:15.5px;letter-spacing:-.01em}
.galt-badges{display:inline-flex;gap:6px;flex-wrap:wrap}
.galt-badge{font-size:10.5px;padding:3px 9px;border-radius:999px;background:var(--accent-soft);color:var(--accent-ink);
  font-weight:650;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap}
.galt-badge.muted{background:var(--bg-2);color:var(--muted)}
.galt-badge.ok{background:color-mix(in srgb,var(--ok) 14%,transparent);color:var(--ok)}
.galt-badge.fix{background:color-mix(in srgb,var(--fix) 16%,transparent);color:var(--fix)}
.galt-status{margin-left:auto;font-size:12.5px;color:var(--muted);display:inline-flex;align-items:center;gap:6px;font-variant-numeric:tabular-nums}
.galt-busy .galt-status::before{content:"";width:7px;height:7px;border-radius:50%;background:var(--accent-2);animation:galt-blink 1s ease-in-out infinite}
.galt-progress{position:relative;height:2px;margin:0 0 12px;border-radius:2px;overflow:hidden;background:var(--bg-2);display:none}
.galt-busy .galt-progress{display:block}
.galt-progress::after{content:"";position:absolute;inset:0;background:linear-gradient(90deg,transparent,var(--accent-2),var(--accent-3),transparent);
  background-size:200% 100%;animation:galt-shimmer 1.4s linear infinite}

/* ---- the answer, written to be read in shapes rather than paragraphs ---- */
.galt-body{position:relative;font-size:15.5px;line-height:1.65;color:var(--fg)}
.galt-body>:first-child{margin-top:0}
.galt-body>:last-child{margin-bottom:0}
.galt-body p{margin:0 0 10px}
.galt-body>p:first-child{font-size:17.5px;line-height:1.5;font-weight:500;letter-spacing:-.01em;margin-bottom:12px}
.galt-body h3,.galt-body h4,.galt-body h5{display:flex;align-items:center;gap:8px;margin:16px 0 7px;font-size:12px;font-weight:700;
  letter-spacing:.07em;text-transform:uppercase;color:var(--accent-ink)}
.galt-body h3::before,.galt-body h4::before,.galt-body h5::before{content:"";width:14px;height:2px;border-radius:2px;
  background:linear-gradient(90deg,var(--accent),var(--accent-2));flex:none}
.galt-body ul,.galt-body ol{margin:0 0 12px;padding-left:20px}
.galt-body li{margin:5px 0}
.galt-body li::marker{color:var(--accent-2)}
/* "**Label:** value" bullets read as a key/value line. */
.galt-body li>strong:first-child{color:var(--accent-ink);font-weight:650}
.galt-body strong{font-weight:650}
.galt-body blockquote{margin:10px 0 12px;padding:10px 14px;border-left:3px solid var(--accent-2);border-radius:0 12px 12px 0;
  background:var(--accent-soft);color:var(--fg-2);font-size:14.5px}
.galt-body blockquote p:last-child{margin-bottom:0}
.galt-body table{border-collapse:separate;border-spacing:0;margin:8px 0 14px;font-size:14px;width:100%;
  border:1px solid var(--border);border-radius:12px;overflow:hidden;display:table}
.galt-body thead th{background:var(--bg-2);font-weight:650;color:var(--fg)}
.galt-body th,.galt-body td{padding:7px 11px;text-align:left;border-bottom:1px solid var(--border)}
.galt-body tr:last-child td{border-bottom:0}
.galt-body code{font-family:var(--mono);font-size:.87em;background:var(--bg-2);border:1px solid var(--border);border-radius:6px;padding:.1em .4em}
.galt-body pre{background:var(--bg-2);border:1px solid var(--border);border-radius:10px;padding:12px 14px;overflow-x:auto}
.galt-body pre code{border:0;padding:0;background:none}
.galt-body hr{border:0;border-top:1px dashed var(--border-2);margin:14px 0}
.galt-body a{color:var(--link)}
.galt-cursor::after{content:"▍";color:var(--accent-2);animation:galt-blink 1s steps(2) infinite}
/* What the fact-check pass rewrote. */
.galt-fix{background:none;color:var(--fix)!important;font-weight:550;text-decoration:underline;text-decoration-style:dotted;
  text-decoration-color:color-mix(in srgb,var(--fix) 45%,transparent);text-underline-offset:3px}
.galt-fix *{color:inherit!important}

/* citations */
.galt-cite{display:inline-block;vertical-align:super;font-size:10.5px;line-height:1;font-weight:700;padding:2px 5.5px;margin:0 1px;
  border-radius:999px;background:var(--accent-soft-2);color:var(--accent-ink);text-decoration:none!important;
  transition:background .15s,color .15s,transform .15s}
.galt-cite:hover,.galt-cite.hot{background:var(--accent);color:#fff;transform:translateY(-1px)}
.galt-skeleton{display:grid;gap:10px;padding:4px 0}
.galt-skeleton span{height:13px;border-radius:7px;background:linear-gradient(90deg,var(--bg-2),var(--accent-soft-2),var(--bg-2));
  background-size:200% 100%;animation:galt-shimmer 1.4s linear infinite}
.galt-skeleton span:nth-child(2){width:92%}.galt-skeleton span:nth-child(3){width:70%}

/* fact-check strip */
.galt-check{position:relative;margin-top:12px}
.galt-check summary{cursor:pointer;list-style:none;display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;
  color:var(--fix);padding:4px 11px;border-radius:999px;background:color-mix(in srgb,var(--fix) 10%,transparent);
  border:1px solid color-mix(in srgb,var(--fix) 30%,transparent)}
.galt-check summary::-webkit-details-marker{display:none}
.galt-check summary svg{width:13px;height:13px}
.galt-check[data-status="verified"] summary{color:var(--ok);background:color-mix(in srgb,var(--ok) 10%,transparent);border-color:color-mix(in srgb,var(--ok) 30%,transparent)}
.galt-check[data-status="failed"] summary,.galt-check[data-status="unverified"] summary{color:var(--muted);background:var(--bg-2);border-color:var(--border)}
.galt-check ul{margin:10px 0 0;padding-left:20px;font-size:13.5px;color:var(--fg-2)}
.galt-check li{margin:4px 0}
.galt-check li::marker{color:var(--fix)}

/* compact source chips, shown where the side panel does not fit */
.galt-compact{display:none;position:relative;margin-top:12px}
@media (max-width:1059px){.galt-compact{display:block}}
html.galt-skin.galt-has-rhs .galt-compact{display:block}
.galt-compact summary{cursor:pointer;font-size:13px;color:var(--muted);font-weight:500;list-style:none;display:inline-flex;align-items:center;gap:6px}
.galt-compact summary::-webkit-details-marker{display:none}
.galt-compact summary::before{content:"";width:6px;height:6px;border-right:1.5px solid currentColor;border-bottom:1.5px solid currentColor;transform:rotate(-45deg);transition:transform .15s}
.galt-compact details[open] summary::before{transform:rotate(45deg)}
.galt-src-list{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.galt-src{display:inline-flex;align-items:center;gap:7px;max-width:100%;padding:4px 11px 4px 5px;border-radius:999px;
  background:var(--bg-2);border:1px solid var(--border);font-size:12.5px;color:var(--fg-2);text-decoration:none;transition:all .15s}
.galt-src:hover{border-color:var(--accent-2);color:var(--accent-ink);background:var(--accent-soft);transform:translateY(-1px)}
.galt-src .n{display:inline-flex;align-items:center;justify-content:center;width:19px;height:19px;border-radius:50%;
  background:var(--accent-soft-2);color:var(--accent-ink);font-weight:700;font-size:10.5px;flex:none}
.galt-src .h{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}

/* actions, follow-ups, ask box */
.galt-actions{position:relative;display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:14px;padding-top:12px;border-top:1px dashed var(--border-2)}
.galt-btn{display:inline-flex;align-items:center;gap:7px;font:inherit;font-size:13px;font-weight:500;padding:6px 13px;border-radius:999px;
  border:1px solid var(--border-2);background:var(--card);color:var(--fg-2);cursor:pointer;transition:all .15s}
.galt-btn:hover{border-color:var(--accent-2);color:var(--accent-ink);background:var(--accent-soft);transform:translateY(-1px)}
.galt-note{margin-left:auto;font-size:12px;color:var(--muted)}
.galt-followups{position:relative}
.galt-fu{margin-top:14px;padding-top:12px;border-top:1px dashed var(--border-2);animation:galt-rise .3s ease}
.galt-fu-q{display:flex;align-items:center;gap:8px;font-weight:600;font-size:14.5px;margin-bottom:6px;color:var(--fg)}
.galt-fu-q svg{width:16px;height:16px;color:var(--accent-2);flex:none}
.galt-fu.busy .galt-fu-q svg{animation:galt-sparkle 1.3s ease-in-out infinite}
.galt-fu-a{font-size:15px;line-height:1.65}
.galt-fu-a p{margin:0 0 8px}.galt-fu-a>:last-child{margin-bottom:0}
.galt-fu-a ul,.galt-fu-a ol{margin:0 0 8px;padding-left:20px}
.galt-fu-a li::marker{color:var(--accent-2)}
.galt-ask{position:relative;display:flex;align-items:center;gap:8px;margin-top:14px;padding:4px 4px 4px 12px;border-radius:999px;
  background:var(--bg-2);border:1px solid var(--border-2);transition:border-color .15s,box-shadow .15s}
.galt-ask:focus-within{border-color:color-mix(in srgb,var(--accent) 55%,var(--border-2));box-shadow:0 0 0 3px var(--accent-soft);background:var(--card)}
.galt-ask-icon{display:inline-flex;color:var(--accent-2)}
.galt-ask-icon svg{width:15px;height:15px}
.galt-ask-input{flex:1;min-width:0;border:0;outline:0;background:transparent;font:inherit;font-size:14px;color:var(--fg);padding:6px 0}
.galt-ask-input::placeholder{color:var(--muted)}
.galt-ask-go{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:50%;border:0;cursor:pointer;
  color:#fff;background:linear-gradient(120deg,var(--accent),var(--accent-2));transition:transform .15s,opacity .15s}
.galt-ask-go svg{width:15px;height:15px}
.galt-ask-go:hover{transform:scale(1.06)}
.galt-ask.busy .galt-ask-go{opacity:.5;pointer-events:none}
.galt-err{color:var(--danger)}

/* ---- the sources panel, in the space to the right ---- */
.galt-side{min-width:0}
.galt-panel{position:relative;overflow:hidden;max-height:var(--galt-h,none);border:1px solid var(--border);border-radius:18px;
  padding:14px 14px 12px;background:var(--card);box-shadow:var(--shadow-sm);animation:galt-rise .4s ease;transition:max-height .25s ease}
.galt-panel.open{max-height:none}
.galt-panel::before{content:"";position:absolute;top:0;left:0;right:0;height:4px;z-index:1;
  background:linear-gradient(90deg,var(--accent),var(--accent-2),var(--accent-3))}
.galt-panel-head{display:flex;align-items:center;gap:7px;font-weight:650;font-size:14.5px;letter-spacing:-.01em;margin:0 2px 10px}
.galt-panel-head svg{width:16px;height:16px;color:var(--accent-ink)}
.galt-panel-count{margin-left:auto;font-size:11.5px;font-weight:650;color:var(--accent-ink);background:var(--accent-soft);padding:2px 9px;border-radius:999px}
.galt-panel-hint{margin:10px 2px 0;font-size:12px;color:var(--muted);line-height:1.4}
.galt-cites{display:grid;gap:6px}
.galt-cite-card{display:grid;grid-template-columns:24px minmax(0,1fr);gap:10px;align-items:start;padding:9px 10px 9px 8px;
  border-radius:12px;border:1px solid transparent;color:var(--fg);text-decoration:none;transition:background .15s,border-color .15s,transform .15s}
.galt-cite-card:hover,.galt-cite-card.hot{background:var(--accent-soft);border-color:color-mix(in srgb,var(--accent) 35%,var(--border))}
.galt-cite-card.hot{transform:translateX(2px)}
.galt-cite-card.unused{opacity:.55}
.galt-cite-card.unused:hover,.galt-cite-card.unused.hot{opacity:1}
.galt-cite-card .n{display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;margin-top:1px;border-radius:50%;
  background:var(--accent-soft-2);color:var(--accent-ink);font-weight:700;font-size:11.5px}
.galt-cc-body{display:grid;gap:3px;min-width:0}
.galt-cc-title{font-size:14px;font-weight:550;line-height:1.3;color:var(--link);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.galt-cc-meta{display:flex;align-items:center;gap:6px;font-size:12px;color:var(--muted);min-width:0;flex-wrap:wrap}
.galt-cc-fav{width:14px;height:14px;border-radius:4px;object-fit:contain;flex:none}
.galt-cc-host{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.galt-cc-uses{margin-left:auto;font-size:11.5px;color:var(--muted);white-space:nowrap}
.galt-more-src{position:absolute;left:0;right:0;bottom:0;display:none;align-items:flex-end;justify-content:center;height:64px;
  padding-bottom:8px;border:0;cursor:pointer;font:inherit;background:linear-gradient(to bottom,transparent,var(--card) 60%)}
.galt-panel.clipped .galt-more-src,.galt-panel.open .galt-more-src{display:flex}
.galt-panel.open .galt-more-src{position:static;height:auto;padding:6px 0 0;background:none}
.galt-more-src span{display:inline-flex;align-items:center;justify-content:center;width:28px;height:28px;border-radius:50%;
  border:1px solid var(--border-2);background:var(--card);color:var(--fg-2);box-shadow:var(--shadow-sm);transition:all .2s}
.galt-more-src svg{width:15px;height:15px}
.galt-more-src:hover span{background:var(--accent-soft);color:var(--accent-ink)}
.galt-panel.open .galt-more-src span{transform:rotate(180deg)}
`;

export function overviewBlock(q) {
  return `<div class="galt-wrap" id="galt-aio" data-q="${esc(q)}">
<section class="galt galt-busy">
  <div class="galt-head">
    <span class="galt-spark">${ICONS.sparkle}</span>
    <span class="galt-name">AI Overview</span>
    <span class="galt-badges" id="galt-badges"></span>
    <span class="galt-status" id="galt-status" aria-live="polite">Starting…</span>
  </div>
  <div class="galt-progress"></div>
  <div class="galt-body" id="galt-body"><div class="galt-skeleton"><span></span><span></span><span></span></div></div>
  <details class="galt-check" id="galt-check" hidden></details>
  <div class="galt-compact" id="galt-compact" hidden></div>
  <div class="galt-actions" id="galt-actions" hidden>
    <button type="button" class="galt-btn" data-action="refresh">${ICONS.refresh} Regenerate</button>
    <span class="galt-note" id="galt-note"></span>
  </div>
  <div class="galt-followups" id="galt-followups"></div>
  <form class="galt-ask" id="galt-ask" hidden autocomplete="off">
    <span class="galt-ask-icon">${ICONS.sparkle}</span>
    <input type="text" name="question" class="galt-ask-input" placeholder="Ask a follow-up…" maxlength="500" aria-label="Ask a follow-up question">
    <button type="submit" class="galt-ask-go" aria-label="Ask">${ICONS.arrowRight}</button>
  </form>
</section>
<aside class="galt-side" id="galt-side" hidden>
  <div class="galt-panel">
    <div class="galt-panel-head">${ICONS.book}<span>Sources</span><span class="galt-panel-count" id="galt-cites-count"></span></div>
    <div class="galt-cites" id="galt-cites"></div>
    <p class="galt-panel-hint">The numbers in the overview point here. Hover one to see where it was used.</p>
    <button type="button" class="galt-more-src" id="galt-more-src" aria-label="Show all sources"><span>${ICONS.chevronDown}</span></button>
  </div>
</aside>
</div>`;
}
