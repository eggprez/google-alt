// The Boogle design system: colour tokens, type, motion and the wordmark.
// Shared by our own pages (pages.js) and by the skin injected into Google's
// markup (skin.js), so both look like one product. Ported from the sibling
// "Search Engine" project's public/style.css, which is the reference design.

export const TOKENS_CSS = `
:root{
  --accent:#6d28d9;--accent-2:#a855f7;--accent-3:#38bdf8;--accent-4:#ec4899;
  --accent-ink:var(--accent);
  --accent-soft:color-mix(in srgb,var(--accent) 9%,transparent);
  --accent-soft-2:color-mix(in srgb,var(--accent) 16%,transparent);
  --accent-glow:color-mix(in srgb,var(--accent) 28%,transparent);
  --bg:#fbfaff;--bg-2:#f3f1fa;--bg-3:#ebe8f5;
  --fg:#17161d;--fg-2:#46454f;--muted:#6f6e7a;
  --border:#e7e4f0;--border-2:#d9d5e6;--card:#fff;
  --link:#4c1d95;--link-visited:#7e22ce;
  --shadow-sm:0 1px 2px rgba(20,16,40,.06),0 1px 8px rgba(20,16,40,.06);
  --shadow:0 2px 6px rgba(20,16,40,.06),0 8px 24px rgba(20,16,40,.08);
  --shadow-lg:0 6px 16px rgba(20,16,40,.08),0 18px 48px rgba(109,40,217,.16);
  --danger:#b91c1c;--ok:#15803d;--warn:#b45309;
  --fix:#c2410c;
  --topbar-bg:rgba(251,250,255,.82);
  --font:"Inter","SF Pro Text",-apple-system,BlinkMacSystemFont,system-ui,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  --mono:ui-monospace,"SF Mono",SFMono-Regular,Menlo,Consolas,monospace;
  --radius:16px;
  --gutter:clamp(18px,2.4vw,56px);
  --col-max:clamp(620px,52vw,760px);
  --side-w:clamp(280px,22vw,380px);
  --col-gap:clamp(24px,2.4vw,52px);
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --accent-2:#c084fc;--accent-3:#7dd3fc;--accent-ink:var(--accent-2);
  --accent-soft:color-mix(in srgb,var(--accent-2) 12%,transparent);
  --accent-soft-2:color-mix(in srgb,var(--accent-2) 20%,transparent);
  --accent-glow:color-mix(in srgb,var(--accent-2) 32%,transparent);
  --bg:#0f0e14;--bg-2:#17161e;--bg-3:#1f1d28;
  --fg:#ededf3;--fg-2:#c3c1cf;--muted:#9391a3;
  --border:#262433;--border-2:#33303f;--card:#15141b;
  --link:#c4b5fd;--link-visited:#d8b4fe;
  --shadow-sm:0 1px 2px rgba(0,0,0,.5),0 1px 8px rgba(0,0,0,.35);
  --shadow:0 2px 6px rgba(0,0,0,.5),0 8px 24px rgba(0,0,0,.45);
  --shadow-lg:0 6px 16px rgba(0,0,0,.5),0 18px 48px rgba(168,85,247,.18);
  --danger:#f87171;--ok:#4ade80;--warn:#fcd34d;--fix:#fb923c;
  --topbar-bg:rgba(15,14,20,.78);
}}
:root[data-theme="dark"]{
  --accent-2:#c084fc;--accent-3:#7dd3fc;--accent-ink:var(--accent-2);
  --accent-soft:color-mix(in srgb,var(--accent-2) 12%,transparent);
  --accent-soft-2:color-mix(in srgb,var(--accent-2) 20%,transparent);
  --accent-glow:color-mix(in srgb,var(--accent-2) 32%,transparent);
  --bg:#0f0e14;--bg-2:#17161e;--bg-3:#1f1d28;
  --fg:#ededf3;--fg-2:#c3c1cf;--muted:#9391a3;
  --border:#262433;--border-2:#33303f;--card:#15141b;
  --link:#c4b5fd;--link-visited:#d8b4fe;
  --shadow-sm:0 1px 2px rgba(0,0,0,.5),0 1px 8px rgba(0,0,0,.35);
  --shadow:0 2px 6px rgba(0,0,0,.5),0 8px 24px rgba(0,0,0,.45);
  --shadow-lg:0 6px 16px rgba(0,0,0,.5),0 18px 48px rgba(168,85,247,.18);
  --danger:#f87171;--ok:#4ade80;--warn:#fcd34d;--fix:#fb923c;
  --topbar-bg:rgba(15,14,20,.78);
}
@keyframes galt-rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
@keyframes galt-fade{from{opacity:0}to{opacity:1}}
@keyframes galt-shimmer{to{background-position:-200% 0}}
@keyframes galt-sparkle{0%,100%{transform:scale(1) rotate(0)}50%{transform:scale(1.15) rotate(10deg)}}
@keyframes galt-blink{50%{opacity:0}}
@keyframes galt-spin{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion:reduce){*,*::before,*::after{animation:none!important;transition:none!important}}
`;

/** The wordmark: gradient "Boogle" plus the sparkle mark, as in the reference design. */
export const LOGO_CSS = `
.galt-logo{display:inline-flex;align-items:center;gap:.18em;font-family:var(--font);font-weight:800;letter-spacing:-.04em;line-height:1;text-decoration:none!important;user-select:none;white-space:nowrap}
.galt-logo-text{background:linear-gradient(100deg,var(--accent) 0%,var(--accent-2) 60%,var(--accent-3) 120%);-webkit-background-clip:text;background-clip:text;color:transparent;padding:.1em .06em .24em 0;margin:-.1em -.06em -.24em 0}
.galt-logo-mark{display:inline-flex;color:var(--accent-2);filter:drop-shadow(0 2px 6px var(--accent-glow))}
.galt-logo-lg{font-size:clamp(60px,11vw,96px)}
.galt-logo-lg .galt-logo-mark svg{width:.42em;height:.42em;margin-top:-.55em}
.galt-logo-sm{font-size:1.6875rem;flex:none}
.galt-logo-sm .galt-logo-mark svg{width:.5em;height:.5em;margin-top:-.5em}
`;

export const ICONS = {
  sparkle: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true"><path d="M12 2c.4 3.9 2.1 6.6 6 7-3.9.4-5.6 3.1-6 7-.4-3.9-2.1-6.6-6-7 3.9-.4 5.6-3.1 6-7zM19 14c.2 1.9 1 3.3 3 3.5-2 .2-2.8 1.6-3 3.5-.2-1.9-1-3.3-3-3.5 2-.2 2.8-1.6 3-3.5zM5 15c.15 1.5.8 2.6 2.5 2.75C5.8 17.9 5.15 19 5 20.5c-.15-1.5-.8-2.6-2.5-2.75C4.2 17.6 4.85 16.5 5 15z"/></svg>',
  search: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  arrowRight: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  close: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  book: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H20v17H6.5a2.5 2.5 0 0 0 0 5H20"/><path d="M4 4.5v17"/></svg>',
  chevronDown: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>',
  refresh: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.6-6.4"/><path d="M21 3v6h-6"/></svg>',
  check: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4 12 5 5L20 6"/></svg>',
  pencil: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4l10-10a2.8 2.8 0 1 0-4-4L4 16z"/><path d="m13.5 6.5 4 4"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 9-12h-7z"/></svg>',
  image: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="3"/><circle cx="9" cy="10" r="2"/><path d="m21 16-5-5-9 9"/></svg>',
  news: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 5h13v14H6a2 2 0 0 1-2-2z"/><path d="M17 9h3v8a2 2 0 0 1-2 2"/><path d="M7 9h6M7 13h6M7 17h6"/></svg>',
  video: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="3"/><path d="m16 10 5-3v10l-5-3z"/></svg>',
  shopping: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h16l-1.2 11a2 2 0 0 1-2 1.8H7.2a2 2 0 0 1-2-1.8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
  forum: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 12a7 7 0 0 1-7 7H8l-4 3v-5.4A7 7 0 0 1 8 5h5a7 7 0 0 1 7 7z"/></svg>',
  map: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
  clock: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  dots: '<svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="1.8"/><circle cx="12" cy="12" r="1.8"/><circle cx="19" cy="12" r="1.8"/></svg>',
  alert: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2 20h20z"/><path d="M12 9v5M12 17.2v.1"/></svg>',
  globe: '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
};

/** The wordmark markup. `size` is 'lg' (home hero) or 'sm' (results header). */
export function wordmark(size = 'sm', href = '/') {
  return `<a class="galt-logo galt-logo-${size} galt-logo-link" href="${href}" aria-label="Boogle home"><span class="galt-logo-text">Boogle</span><span class="galt-logo-mark">${ICONS.sparkle}</span></a>`;
}

/** <link>s for the Inter webfont used across every page. */
export const FONT_LINKS =
  '<link rel="preconnect" href="https://fonts.googleapis.com">'
  + '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>'
  + '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap">';
