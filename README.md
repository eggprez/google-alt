# google-alt ("Boogle")

Google search results, minus Google's AI Overview, plus a Claude Code overview in its place.

A Docker container runs a real Chromium signed into your Google account. When you search through
`search.bindel.glass`, the container loads Google's results page, removes Google's AI Overview block,
and serves you the page with Google's wordmark swapped for a purple **Boogle**. The overview slot
streams in an answer from headless Claude Code as it is written: first a quick draft from the top
results on the page, then a verification pass with Claude's own web search that corrects and flags
anything wrong. Everything else on the page is Google as normal, and result links go straight to the
real sites in your own browser.

Every tab is proxied — web, images, videos, news, shopping — and every Google search link on the
page is rewritten to come back through the proxy, so switching to Images and back never drops you
onto google.com (which is what used to make Google's own AI Overview reappear). Only the web tab
gets a Claude overview; the others are Google's page as normal.

The page keeps Google's own look. The only thing that changes visually is the wordmark (a purple
**Boogle**), the page title, and the overview block itself.

## How it works

```
phone / laptop browser
   │  https://search.bindel.glass/search?q=...
   ▼
nginx + TinyAuth (SSO)
   │
   ▼
google-alt container
   ├─ Express server            /search, /api/overview, /vnc/
   ├─ Chromium (Playwright)     persistent signed-in Google profile, headed on Xvfb
   ├─ noVNC                     one-time Google login through your browser
   └─ claude -p                 WebSearch + WebFetch, JSON output, subscription OAuth token
```

`/search` opens a fresh tab in the persistent Chromium, loads Google with the requesting browser's
User-Agent (so Google sends mobile markup to phones) and, when the phone has shared its position,
a `uule` parameter carrying the coordinates, then rewrites the DOM in place: Google's
overview band (found by its container, so the "Thinking" skeleton counts too) is removed and our
block is inserted at the top of the results column, scripts are stripped, URLs absolutized,
tracking pings removed, every Google search link pointed back at the proxy, the logo replaced, and
the top organic results (title, address, snippet) captured for the overview. A small page script restores
what Google's scripts used to do: Enter submits the search box, and the More / Tools / time-range
menus open. Queries where Google showed no overview get no Claude overview either.

`/api/overview?q=…&stream=1` is a server-sent-events stream the page subscribes to:

1. **Quick draft.** `claude -p` with **no tools at all** (`WebSearch`/`WebFetch` are explicitly
   disallowed) gets the query plus the top results captured from the page you are looking at, and
   writes an answer citing them by number. Text streams into the block as it is generated. The
   prompt asks for shape rather than prose: a one-line lead answer, then `###` headings,
   `**Label:** value` bullets, comparison tables and `>` callouts.
2. **Fact-check.** A second run with `WebSearch`/`WebFetch` checks every claim and returns the
   overview **rewritten**, not a note about it. The header shows what it is searching. Each span
   the check changed comes back wrapped in `{{ }}` and is rendered in a different colour, under a
   **Corrected after checking the web** banner listing what changed. A clean check just marks the
   block **Verified**.

Under the answer, a box takes **follow-up questions** (`POST /api/followup`). A follow-up reuses
the overview's sources, may search the web for anything they do not cover, and lists only the
sources it newly introduced. Answers stay available for follow-ups for `FOLLOWUP_TTL_S` (30 min)
regardless of the overview cache.

Without captured results (direct API call, or the page was served before a restart) Claude
researches from scratch with its own search instead. Finished overviews are cached per query for
an hour by default; the plain JSON form of the endpoint waits for the final result.

## Setup

### 1. Configure

```bash
cp .env.example .env
# set PROXY_SECRET, and PUBLIC_ORIGIN if not search.bindel.glass
```

### 2. Claude Code login

Claude Code is installed in the image. After the container is up, log in once from its shell:

```bash
docker exec -it google-alt claude
```

Type `/login`, open the printed URL on any device, sign in with your Claude subscription, and paste
the code back. Credentials land in the `/data` volume, so they survive restarts and image upgrades.
Exit with `/exit`. The home page and `/healthz` report whether Claude is logged in.

Alternatively run `claude setup-token` on a logged-in machine and set `CLAUDE_CODE_OAUTH_TOKEN` in
`.env`; a token takes precedence over the saved login.

### 3. Run

Images are published to `ghcr.io/eggprez/googlealt` by GitHub Actions on every push to `main`.

```bash
docker compose up -d
```

The package is public, so no registry login is needed. To build locally instead, uncomment `build: .`
in `docker-compose.yml` and run `docker compose up -d --build`.

The app listens on host port `2039` (container port 8080). Check `curl localhost:2039/healthz`.

### 4. Reverse proxy + TinyAuth

**Nginx Proxy Manager:** create a proxy host for `search.bindel.glass` forwarding to the Docker host on
port 2039, then paste `deploy/nginx-proxy-manager-advanced.conf` into the Advanced tab. Fix the TinyAuth
address and set the `X-Proxy-Secret` value to match `PROXY_SECRET` in `.env`.

**Plain nginx:** use `deploy/nginx-search.bindel.glass.conf` instead.

With `PROXY_SECRET` set, the app returns 403 to any request that did not come through the proxy, so the
exposed port 2039 can't be used to skip SSO from the LAN. Exempt: `/healthz` (Docker health check),
`/opensearch.xml`, `/favicon.ico`, and noVNC's static files under `/vnc/` (the VNC websocket is still
gated). The exemptions matter with NPM's "Cache Assets" option, which serves `*.js`/`*.css` through a
location block without your custom headers.

### 5. Sign into Google once

Open `https://search.bindel.glass/vnc` in a browser. You get a noVNC view of the container's Chromium
with Google open. Sign in to your Google account there. The profile lives in the `google-alt-data`
volume, so it survives restarts and rebuilds.

If Google ever throws a CAPTCHA or consent screen at the container, `/search` shows an error page
with a link back to `/vnc` so you can clear it by hand.

### 6. Add it as a search engine

The search URL is:

```
https://search.bindel.glass/search?q=%s
```

- **Firefox (Android/iOS):** Settings → Search → Add search engine → paste the URL above.
- **Brave (Android):** Settings → Search engines → Add, or visit the site once and pick it from the list.
- **Firefox desktop:** visit the site, then right-click the address bar → add "Google (Claude)".
- **Chrome desktop:** Settings → Search engine → Manage → Add, with the URL above.
- **Safari (iOS):** no custom engines. Add `https://search.bindel.glass/` to the home screen and use
  its search box, or make a Shortcut that opens the URL with the clipboard as `q`.

You'll log into TinyAuth once per browser; after that searches from the address bar go straight through.

## Configuration

All settings are environment variables, documented in `.env.example`. The ones you're most likely to touch:

| Variable | Default | Meaning |
|---|---|---|
| `CLAUDE_MODEL` | `sonnet` | Model for the overview. `opus` is slower and better. |
| `OVERVIEW_CACHE_TTL_S` | `3600` | Reuse an overview for the same query. `0` disables. |
| `OVERVIEW_VERIFY` | `true` | Run the second, web-searching verification pass. `false` keeps only the quick draft. |
| `OVERVIEW_MAX_TURNS` | `12` | Cap on search/fetch steps for the fact-check and follow-ups. |
| `FOLLOWUP_TTL_S` | `1800` | How long a finished answer stays available for follow-up questions. |
| `PROXY_SECRET` | empty | Require this value in an `X-Proxy-Secret` header on every request. |
| `FORWARD_CLIENT_UA` | `true` | Ask Google for phone or desktop markup based on the requesting browser. |
| `AIO_WAIT_MS` | `2500` | How long to wait for Google's overview to appear before serving. |

## Endpoints

| Path | Purpose |
|---|---|
| `/` | Minimal search box, sign-in status, setup hints |
| `/search?q=` | Proxied Google web results with Claude overview |
| `/api/overview?q=` | JSON `{html, sources, verification, mode, ms, cached, cost}`. `&stream=1` for SSE, `&refresh=1` to bypass the cache |
| `POST /api/followup` | `{q, question, history}` → SSE `status` / `snapshot` / `done` / `fail` |
| `/api/overview?q=&stream=1` | Server-sent events: `status`, `snapshot`, `quick`, `done`, `fail` |
| `/go?u=` | Follows a Google ad-click (`/aclk`) or opaque result (`/goto`) redirect on the server and sends the browser to the destination |
| `/vnc` | noVNC into the container's Chromium |
| `/healthz` | Browser and cache status |
| `/opensearch.xml` | OpenSearch descriptor for browser engine discovery |

## Notes and caveats

- This scrapes Google with a signed-in browser for personal use. It is against Google's terms in
  the technical sense; at single-user volumes it looks like a person using Chrome, because it is.
- On phones, Google loads some component CSS lazily via JavaScript, so a few sections (notably
  "People also ask") render plainer than on google.com. Results, links, and the overview are fine.
- Google's page scripts are removed, so interactive widgets (carousels, the AI Mode tab) are
  static. Links, the search box, and the More / Tools menus work. "People also ask" answers are not
  in the page at all (Google fetches each one when you expand it), so tapping a question runs a
  search for it instead of unfolding nothing.
- **Precise location.** Google places you by the container's IP until told otherwise. The
  "Use precise location" chip in the location bar under the tabs asks your phone for its position
  (the browser's own permission prompt), stores it in a `galt_geo` cookie on the proxy, and reloads.
  From then on every search carries the coordinates to Google as its `uule` parameter, which is
  what makes local results say "1.8 mi" and the location bar name your neighbourhood. Each page
  load refreshes the stored position in the background, so the next search uses where you are now.
  Clearing the site's cookies turns it off. Google's own "See results closer to you?" modal is
  removed from the page: with its scripts gone nothing could close it, and its buttons did nothing.
- **Images.** Most thumbnails on a results page (social posts, video stills, site logos, sports
  crests) ship as a 1x1 transparent gif; the real URL lives either on `img[data-src]` or in the
  `google.ldi` map (element id -> protocol-relative URL) that Google's own script would apply.
  Since we strip those scripts, `rewrite.js` applies both itself — without that the page arrives
  with no pictures at all. Removing a `<script>` element does not undo what it already ran, so
  `google.ldi` is still readable at that point. On a sample results page this took 135 unresolved
  placeholders down to zero, with 6 unresolvable ones dropped. Scrolling first does not help:
  Google's deferred loader will not re-fire for a synthetic scroll. The mobile page keeps about
  twenty placeholders whose URL only arrives in a later XHR; those keep their box (the gif is
  transparent, so the card holds its shape) and get `.galt-noimg`. Deleting them, as an earlier
  version did, collapsed the cards around them and was what made mobile results look mangled.
- **The overview block carries other blocks' CSS.** Google ships a component's stylesheet at its
  first use on the page, and the AI Overview is the first thing on the page, so its container holds
  `<style>` elements (18KB on a mobile SERP) whose rules also style results much further down —
  including the one that lays result thumbnails out in a row. Removing the block took them with it
  and everything below the overview lost its layout. `rewrite.js` moves those `<style>` elements
  back into the same spot in document order before the block goes.
- **We send the form factor, not the client's UA.** `FORWARD_CLIENT_UA` reads the client's
  User-Agent only to decide phone or desktop; the request itself always carries a Chrome UA,
  because the engine here is Chromium. Passing a client UA through verbatim breaks on Firefox: the
  UA contradicts the Chrome client hints Chromium sends, and Google answers with a bare template —
  132KB with 19KB of CSS, no `#rso`, no results and no AI Overview, against 383KB with 187KB of CSS
  and 7 results for the same query with a Chrome UA.
- **Mobile markup is a different page.** With `FORWARD_CLIENT_UA=true` a phone gets Google's mobile
  SERP, which shares almost no structure with the desktop one: result titles are
  `div[role="heading"][aria-level="3"]` instead of `<h3>`, there is no `<cite>` at all (the address
  is a plain `<span>` holding `https://host`), and the wordmark is an `<a aria-label="Google">`
  around an inline SVG rather than `#logo`. `rewrite.js` handles both shapes. Getting the results
  wrong is quiet but expensive: with no results captured, the overview falls back to researching
  the query from scratch instead of the fast draft-then-fact-check pass.
- **Light or dark.** Google decides the SERP theme on the server, from the account setting, and
  ignores the viewer's `prefers-color-scheme` (a page fetched with dark emulated still comes back
  light; the mobile page came back dark with light emulated). So the overview block cannot follow
  the viewer's OS or it ends up as a light card on a dark page. `rewrite.js` measures the
  background luminance of the page Google actually sent and sets `html.galt-dark`, which is what
  the block's dark palette keys off.
- AI Overview detection keys on Google's overview container (`AIO_SELECTOR` in `src/rewrite.js`),
  with the "AI Overview" / "Thinking" heading as a fallback. If Google changes its markup, adjust
  those. The menus rely on Google's `eBYPP` / `oYxtQd` / `H9P06b` / `xl07Ob` attribute names.
- Proxying every tab means an image or news click costs a Chromium page load and one more request
  to Google from your IP, where it used to be a redirect to google.com.
- Sponsored results link to `google.com/aclk` (or `googleadservices.com/pagead/aclk`) and some
  organic results to `google.com/goto?url=<opaque blob>`; Google 302s both to the real site. Those
  are rewritten to `/go?u=…`, and the server follows the redirect itself (`src/go.js`). On a phone
  with an ad-blocking DNS or filter that hop is the one request that gets dropped, which showed up
  as "can't connect" on sponsored and top results only. The click still registers with Google; if
  Google does not redirect (an expired link), `/go` falls back to sending the browser to the Google
  link itself.
- Product tiles ("Popular products" and similar grids) are divs with no link: Google's script opens
  a product panel on click, and the merchant URL is not in the page at all. `rewrite.js` marks them
  (`data-galt-shop`) and the page script turns a tap into a Shopping-tab search for the exact
  product title through the proxy (a web search when already on the Shopping tab).
- The fact-check pass roughly doubles the Claude usage per search. Set `OVERVIEW_VERIFY=false`
  to keep only the quick draft (which never searches the web itself).
- Server-sent events need an unbuffered reverse proxy; the shipped nginx configs set
  `proxy_buffering off`, and the app also sends `X-Accel-Buffering: no`.
- Claude Code's `--bare` mode is deliberately not used: it disables subscription OAuth.
- If Chromium ever refuses to start with "The profile appears to be in use by another Chromium
  process ... on another computer", a killed container left its lock files in the volume. The app
  now clears `SingletonLock`, `SingletonCookie` and `SingletonSocket` before every launch; on an
  older image, remove them by hand:
  `docker exec google-alt rm -f /data/profile/Singleton{Lock,Cookie,Socket}`
- Everything runs as the unprivileged `pwuser`. Chromium runs with `--no-sandbox` because it is
  inside a container; keep the container off the public internet (it is loopback-only in compose).

## Development

```bash
npm install
CLAUDE_CODE_OAUTH_TOKEN=... DATA_DIR=./data PUBLIC_ORIGIN=http://localhost:8080 node src/server.js
```

Without Xvfb you'll want to set `headless: true` in `src/browser.js` temporarily, or just use Docker.

To work on the page script or the overview UI without Chromium or Claude, `.scratch/` (git-ignored)
can hold a dev server that serves a saved rewritten page through `injectPage()` and a fake `claude`
that emits stream-json; see `src/api.js` for the event shapes.
