---
last_mapped_commit: d15a732a284f108e64892d6918186b6328af8405
last_mapped_at: 2026-11-01
---
# External Integrations

**Analysis Date:** 2026-11-01

## APIs & External Services

**Omega API (omega-server-v3):**
- The only backend. This repo has no database and no server actions: every read and write goes over HTTP to it.
  - Client: native `fetch`, wrapped per domain in `utils/*.ts`
  - Base URL: `NEXT_PUBLIC_API_URL`, exported as `API_URL` from `utils/auth.ts`
  - Server route: `API_INTERNAL_URL` rewrites server-side calls in `instrumentation.ts`
  - Timeout: 8 s on every server-side API call (`API_TIMEOUT` in `instrumentation.ts`)
  - Contract docs live in the API repo and are cited at the top of each module: `TOURNAMENT_API.md`, `STATISTICS_API.md`, `WIKI_API.md`, `PANEL_API.md`, `RANKED_API.md`, `DECKS_API.md`, `PROFILE_API.md`, `MESSENGER.md`, `WELCOME_API.md`, `ANALYTICS_API.md`. `docs/profile-api.md` is the one local copy.

| Domain | Module | Path prefix |
|--------|--------|-------------|
| Auth | `utils/auth.ts` | `/auth` |
| Tournaments | `utils/tournaments.ts` | `/tournaments` |
| Statistics | `utils/statistics.ts` | `/statistics` |
| Analytics explorer | `utils/explorer.ts`, `utils/global-explorer.ts` | `/analytics` |
| Ranked | `utils/ranked.ts` | `/ranked` |
| Wiki | `utils/wiki.ts`, `utils/articles.ts` | `/wiki` |
| Decks | `utils/decks.ts` | `/decks` |
| Combos | `utils/combos.ts` | `/combos` |
| Cards | `utils/cards.ts` | `/cards` |
| Banlists | `utils/wiki.ts` | `/banlists` |
| Messenger | `utils/messenger.ts` | `/messenger` |
| Profiles | `utils/profile.ts` | `/profiles` |
| Welcome | `utils/welcome.ts` | `/welcome` |
| Admin panel | `utils/panel.ts` | `/panel` |

**Card images (ygopro.online):**
- Source of card scans and art, slow at 2-6 s per file
  - URLs: `CARD_IMAGE_URL` and `CARD_ART_URL` in `utils/const.ts`
  - Same-origin proxy for canvases: `app/card-image/[kind]/[file]/route.ts`, because the host sends no CORS headers
  - Resized by Next's optimizer (`next.config.ts` allows only the card-art and card-image paths)

**AWS S3 (uploads):**
- Stores profile covers, wiki assets and shop assets
  - Uploads: browser-direct presigned POST from `/profiles/me/cover/sign` or `/wiki/assets/sign` (body `{ contentType }`), file field last, then registered at `PATCH /profiles/me` or `/wiki/assets` (`utils/profile.ts`, `utils/articles.ts`)
  - Auth: the API signs uploads and moderates them with Rekognition; the front only needs `NEXT_PUBLIC_UPLOADS_URL`
  - Allowed asset URLs are checked in `utils/wiki-doc.ts` (`isWikiUpload`)
  - Resized by Next's optimizer: `next.config.ts` allows the bucket's `profile_covers/`, `wiki_assets/` and `shop_items/` paths

**Advertising (NitroPay):**
- Site ID `2429`, set in `utils/nitro-ads.const.ts`
  - Script host `s.nitropay.com`
  - Wrapper: `utils/nitro-ads.ts`, `utils/nitro-privacy.ts`, `components/omega/ads/`
  - Consent: Nitro's TCF CMP, read in `components/omega/tracking/tracking.tsx`
  - `/ads.txt` redirects to `https://api.nitropay.com/v1/ads-2429.txt` (`next.config.ts`)
  - VIP users (`AuthUser.isVip`) get no ads and no CMP

**Other outbound links and embeds:**
- YouTube via `youtube-nocookie.com`: `components/omega/wiki/video.tsx`, `components/omega/profile/song-player.tsx`
- Google Fonts CSS at runtime for infographics: `components/omega/infographic/infographic.tsx`
- `next/font/google` at build time: `utils/fonts.ts`
- PayPal donation link: `app/download/vip-panel.tsx`
- Share intents for X, Facebook, Reddit and WhatsApp: `components/omega/wiki/share.ts`

## Data Storage

**Databases:**
- None in this repo. Postgres sits behind the API.

**File Storage:**
- S3 for covers and wiki assets, through the API's signed upload
- `public/` for static art and `public/wiki-images/` for committed images
- Next's image cache on the container's disk, lost on each deploy

**Caching:**
- Next's fetch cache with per-call `revalidate`, chosen to mirror each endpoint's `Cache-Control`
- React `cache()` to de-duplicate reads within one render (`getTournament` in `utils/tournaments.ts`)
- Browser: `localStorage` for deck drafts (`app/deck-builder/drafts.ts`) and `sessionStorage` for the sign-in flag

## Authentication & Identity

**Auth Provider:**
- Discord OAuth, run entirely by the API
  - Sign-in is a full-page redirect to `${API_URL}/auth/discord` (`signIn` in `utils/auth.ts`)
  - Session: HttpOnly `omega_session` cookie (`SESSION_COOKIE`)
  - Browser calls use `credentials: 'include'`
  - SSR reads the cookie and forwards it through `getMeServer`
  - Show or hide UI with `AuthUser.permissions`, never with `role`. The API enforces every call.
  - `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI` and `NEXT_PUBLIC_DISCORD_URL` appear in `.env.example`, build args or scripts, but no app code reads them.

## Monitoring & Observability

**Error Tracking:**
- None. There is no Sentry or equivalent.
- `onRequestError` in `instrumentation.ts` logs every uncaught server error with its `digest`, so a user's error page can be matched to a log line.

**Logs:**
- One JSON line per event through `log` in `utils/log.ts`, matching the API's pino shape. Read them with `docker logs`.
- Events include `REQUEST_ERROR`, `API_TIMEOUT`, `BOT_BLOCKED`.
- `err` is reduced to name, message, status and stack. Never log the raw error object: it can carry the request's cookie.

**Product analytics:**
- Google Tag Manager `GTM-55HLGPXN`, with GA4 inside the container (`utils/gtm.ts`)
- Consent Mode v2 defaults are injected in `<head>` before `gtm.js` (`GTM_BOOTSTRAP`)
- Every event goes through `track`. `docs/analytics/tracking-plan.md` is the contract and `docs/analytics/gtm-container.json` is the exported container.

## CI/CD & Deployment

**Hosting:**
- Docker container on a self-managed VPS, behind Cloudflare. The hosting topology is not recorded in this repo.

**CI Pipeline:**
- GitLab CI, `.gitlab-ci.yml`. A push to `main` or `master` runs one `build` job.
- It builds with `NEXT_PUBLIC_*` as build args and pushes `$CI_REGISTRY_IMAGE:latest` and `:$CI_COMMIT_SHORT_SHA`.
- The file has no deploy job. A registry watcher on the host picks up `latest`. `stages:` still lists `deploy`.
- `interruptible: true`: a newer push can cancel a running build.
- CI runs no tests, lint or type check. Run them locally before pushing.
- The `docker:build`, `docker:deploy` and `deploy` scripts in `package.json` target the Docker Hub image `victorgodoka/omega-hub-next`, which is not the live path.

## Environment Configuration

**Required env vars:**
- `NEXT_PUBLIC_API_URL`

**Optional env vars:**
- `API_INTERNAL_URL`, `NEXT_PUBLIC_UPLOADS_URL`, `NEXT_PUBLIC_SITE_URL`, `WIKI_IMAGE_BASE`

**Secrets location:**
- Local: uncommitted `.env.*` files
- CI: GitLab CI/CD variables
- The front holds no API secret. All privileged access rides on the user's session cookie.

## Webhooks & Callbacks

**Incoming:**
- None. The only route handlers are `app/card-image/[kind]/[file]/route.ts`, `app/llms.txt/route.ts`, `app/wiki/sitemap.xml/route.ts`, `app/statistics/infographic/[section]/route.tsx` and `app/profile/[id]/statistics/infographic/[section]/route.tsx`.

**Outgoing:**
- None.

**Realtime:**
- Server-sent events from the API: `EventSource` on `/messenger/stream` in `components/omega/messenger/use-messenger.ts`.

---

*Integration audit: 2026-11-01*
