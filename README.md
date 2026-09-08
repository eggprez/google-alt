# google-alt

Google search results, minus Google's AI Overview, plus a Claude Code overview in its place.

A Docker container runs a real Chromium signed into your Google account. When you search through
`search.bindel.glass`, the container loads Google's results page, removes Google's AI Overview block,
and serves you the page with a placeholder that fills in with an overview written by headless Claude
Code using its own web search. Everything else on the page is Google as normal, and result links go
straight to the real sites in your own browser.

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
User-Agent (so Google sends mobile markup to phones), waits briefly for the AI Overview to render,
then rewrites the DOM in place: overview block swapped for a placeholder, scripts stripped, URLs
absolutized, tracking pings removed, web-search links pointed back at the proxy. The page is served
with a small script that calls `/api/overview` and drops Claude's answer into the placeholder when
it's ready. Queries where Google showed no overview get no Claude overview either.

`/api/overview` runs `claude -p` with `--allowedTools WebSearch,WebFetch`, a JSON schema for
`{answer, sources[]}`, and renders the markdown with numbered citation links. Results are cached
per query for an hour by default.

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

Images are published to `ghcr.io/eggprez/google-alt` by GitHub Actions on every push to `main`.

```bash
docker compose up -d
```

If the package is private, `docker login ghcr.io` on the server first with a GitHub token that has
`read:packages`. To build locally instead, uncomment `build: .` in `docker-compose.yml` and run
`docker compose up -d --build`.

The app listens on host port `2039` (container port 8080). Check `curl localhost:2039/healthz`.

### 4. Reverse proxy + TinyAuth

**Nginx Proxy Manager:** create a proxy host for `search.bindel.glass` forwarding to the Docker host on
port 2039, then paste `deploy/nginx-proxy-manager-advanced.conf` into the Advanced tab. Fix the TinyAuth
address and set the `X-Proxy-Secret` value to match `PROXY_SECRET` in `.env`.

**Plain nginx:** use `deploy/nginx-search.bindel.glass.conf` instead.

With `PROXY_SECRET` set, the app returns 403 to any request that did not come through the proxy, so the
exposed port 2039 can't be used to skip SSO from the LAN. `/healthz` is exempt for Docker's health check.

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
| `OVERVIEW_MAX_TURNS` | `12` | Cap on search/fetch steps per overview. |
| `PROXY_SECRET` | empty | Require this value in an `X-Proxy-Secret` header on every request. |
| `FORWARD_CLIENT_UA` | `true` | Ask Google for markup matching the requesting browser. |
| `AIO_WAIT_MS` | `2500` | How long to wait for Google's overview to appear before serving. |

## Endpoints

| Path | Purpose |
|---|---|
| `/` | Minimal search box, sign-in status, setup hints |
| `/search?q=` | Proxied Google web results with Claude overview |
| `/api/overview?q=` | JSON `{html, sources, ms, cached, cost}` |
| `/vnc` | noVNC into the container's Chromium |
| `/healthz` | Browser and cache status |
| `/opensearch.xml` | OpenSearch descriptor for browser engine discovery |

## Notes and caveats

- This scrapes Google with a signed-in browser for personal use. It is against Google's terms in
  the technical sense; at single-user volumes it looks like a person using Chrome, because it is.
- On phones, Google loads some component CSS lazily via JavaScript, so a few sections (notably
  "People also ask") render plainer than on google.com. Results, links, and the overview are fine.
- Google's page scripts are removed, so interactive widgets (expandable "People also ask", carousels,
  the AI Mode tab) are static. Links all work.
- AI Overview detection looks for a heading reading "AI Overview". If Google renames it, adjust
  `findOverview()` in `src/rewrite.js`.
- Claude Code's `--bare` mode is deliberately not used: it disables subscription OAuth.
- Everything runs as the unprivileged `pwuser`. Chromium runs with `--no-sandbox` because it is
  inside a container; keep the container off the public internet (it is loopback-only in compose).

## Development

```bash
npm install
CLAUDE_CODE_OAUTH_TOKEN=... DATA_DIR=./data PUBLIC_ORIGIN=http://localhost:8080 node src/server.js
```

Without Xvfb you'll want to set `headless: true` in `src/browser.js` temporarily, or just use Docker.
