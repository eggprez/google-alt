# google-alt ("Boogle")

Google search results, minus Google's AI Overview, plus a Claude Code overview in its place.

A Docker container runs a real Chromium signed into your Google account. When you search through
`search.bindel.glass`, the container loads Google's results page, removes Google's AI Overview block,
and serves you the page with Google's wordmark swapped for a purple **Boogle**. The overview slot
streams in an answer from headless Claude Code as it is written: first a quick draft from the top
results on the page, then a verification pass with Claude's own web search that corrects and flags
anything wrong. Everything else on the page is Google as normal, and result links go straight to the
real sites in your own browser.

Only the main web results page is proxied. Images, News, Maps, Shopping and friends link out to
google.com, where you are signed in anyway.

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
User-Agent (so Google sends mobile markup to phones), then rewrites the DOM in place: Google's
overview band (found by its container, so the "Thinking" skeleton counts too) is removed and our
block is inserted at the top of the results column, scripts are stripped, URLs absolutized,
tracking pings removed, web-search links pointed back at the proxy, the logo replaced, and the top
organic results (title, address, snippet) captured for the overview. A small page script restores
what Google's scripts used to do: Enter submits the search box, and the More / Tools / time-range
menus open. Queries where Google showed no overview get no Claude overview either.

`/api/overview?q=…&stream=1` is a server-sent-events stream the page subscribes to:

1. **Quick draft.** `claude -p` with no tools gets the query plus the captured top results and
   writes an answer citing them by number. Text streams into the block as it is generated.
2. **Verification.** A second run with `WebSearch`/`WebFetch` checks every claim. The header shows
   what it is searching; when it finishes the block is marked **Verified**, or replaced with the
   corrected answer under a **Corrected after checking the web** banner listing what changed.

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
| `OVERVIEW_MAX_TURNS` | `12` | Cap on search/fetch steps for the verification pass. |
| `PROXY_SECRET` | empty | Require this value in an `X-Proxy-Secret` header on every request. |
| `FORWARD_CLIENT_UA` | `true` | Ask Google for markup matching the requesting browser. |
| `AIO_WAIT_MS` | `2500` | How long to wait for Google's overview to appear before serving. |

## Endpoints

| Path | Purpose |
|---|---|
| `/` | Minimal search box, sign-in status, setup hints |
| `/search?q=` | Proxied Google web results with Claude overview |
| `/api/overview?q=` | JSON `{html, sources, verification, mode, ms, cached, cost}` |
| `/api/overview?q=&stream=1` | Server-sent events: `status`, `snapshot`, `quick`, `done`, `fail` |
| `/vnc` | noVNC into the container's Chromium |
| `/healthz` | Browser and cache status |
| `/opensearch.xml` | OpenSearch descriptor for browser engine discovery |

## Notes and caveats

- This scrapes Google with a signed-in browser for personal use. It is against Google's terms in
  the technical sense; at single-user volumes it looks like a person using Chrome, because it is.
- On phones, Google loads some component CSS lazily via JavaScript, so a few sections (notably
  "People also ask") render plainer than on google.com. Results, links, and the overview are fine.
- Google's page scripts are removed, so interactive widgets (expandable "People also ask", carousels,
  the AI Mode tab) are static. Links, the search box, and the More / Tools menus work.
- AI Overview detection keys on Google's overview container (`AIO_SELECTOR` in `src/rewrite.js`),
  with the "AI Overview" / "Thinking" heading as a fallback. If Google changes its markup, adjust
  those. The menus rely on Google's `eBYPP` / `oYxtQd` / `H9P06b` / `xl07Ob` attribute names.
- The verification pass roughly doubles the Claude usage per search. Set `OVERVIEW_VERIFY=false`
  to keep only the quick draft (which never searches the web itself).
- Server-sent events need an unbuffered reverse proxy; the shipped nginx configs set
  `proxy_buffering off`, and the app also sends `X-Accel-Buffering: no`.
- Claude Code's `--bare` mode is deliberately not used: it disables subscription OAuth.
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
