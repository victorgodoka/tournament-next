---
last_mapped_commit: d15a732a284f108e64892d6918186b6328af8405
last_mapped_at: 2026-11-01
---
<!-- refreshed: 2026-11-01 -->
# Architecture

**Analysis Date:** 2026-11-01

## System Overview

```text
                    Browser
                       │
                       ▼
          Cloudflare + reverse proxy
                       │
┌──────────────────────▼──────────────────────────────────────┐
│  Next.js standalone server (this repo)                      │
│                                                             │
│  proxy.ts            bot guard on /profile and /wiki/card   │
│  instrumentation.ts  API timeout, internal URL, error logs  │
│                                                             │
│  app/**/page.tsx     server components: fetch, metadata     │
│  app/**/route.ts     infographics, card images, sitemaps    │
└──────────────────────┬──────────────────────────────────────┘
                       │  server-side fetch, 8 s timeout
                       ▼
┌─────────────────────────────────────────────────────────────┐
│  omega-server-v3 API (separate repo)                        │
│  Postgres, Discord OAuth, Cloudinary signing, SSE           │
└─────────────────────────────────────────────────────────────┘
                       ▲
                       │  browser fetch, credentials: include
┌──────────────────────┴──────────────────────────────────────┐
│  Hydrated client code                                       │
│  app/deck-builder  app/simulator  app/calculator  app/admin │
│  components/omega  components/ui                            │
│  utils/deck  utils/simulator  utils/combo (pure logic)      │
└─────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| Root layout | Providers, GTM bootstrap, ads, messenger dock | `app/layout.tsx` |
| Bot guard | Blocks scrapers, rate-limits `/profile` per IP | `proxy.ts` |
| Server fetch wrapper | Timeout and internal rerouting of API calls | `instrumentation.ts` |
| Auth context | Current user on the client | `contexts/auth/auth.context.tsx` |
| API clients | One typed module per API domain | `utils/*.ts` |
| Domain logic | Deck rules, simulator state, combo odds | `utils/deck/`, `utils/simulator/`, `utils/combo/` |
| Domain UI | Ads, messenger, wiki, tournament, analytics widgets | `components/omega/` |
| Design system | Reusable primitives | `components/ui/` |
| Translations | Locale selection and per-route message pick | `i18n/request.ts`, `i18n/client-messages.tsx` |

## Pattern Overview

**Overall:** Thin server-rendered front over a remote REST API, with heavy client-only tools.

**Key Characteristics:**
- No database, no server actions, no API routes that proxy business logic. `app/**/route.ts` only serves images, sitemaps and `llms.txt`.
- Public content pages fetch on the server, for SEO and caching. Personal data and tools fetch in the browser.
- The session cookie is forwarded by hand when SSR must answer for a visitor (`app/profile/[id]/page.tsx`).
- Tools load with `ssr: false` behind a `*.loader.tsx`, because they read drafts and URL state in initializers.
- Domain logic stays in pure functions under `utils/`, covered by unit tests. Reducers and hooks in `app/` call into it.

## Layers

**Edge guard:**
- Purpose: Stop bots before an expensive render
- Location: `proxy.ts`
- Contains: User-agent block list, in-memory fixed-window limiter
- Depends on: `cf-connecting-ip`
- Used by: `/profile/*`, `/wiki/card/*`

**Routes:**
- Purpose: Load data, set metadata, choose the page
- Location: `app/**/page.tsx`, `app/**/layout.tsx`
- Contains: Async server components, `generateMetadata`, `notFound()`
- Depends on: `utils/*`, feature components
- Used by: Next's router

**Feature components:**
- Purpose: Page UI and client state
- Location: `app/<route>/`
- Contains: `*.client.tsx`, `*.page.tsx`, `*.reducer.ts`, `use-*.ts`, section components
- Depends on: `components/omega`, `components/ui`, `utils/*`, `@hooks/index`
- Used by: Their own route. `app/calculator`, `app/simulator` and `app/deck-builder` also import from each other.

**Shared components:**
- Purpose: Reuse across routes
- Location: `components/omega/`, `components/ui/`
- Contains: Domain widgets and primitives
- Depends on: `utils/*`. Never imports from `app/`.
- Used by: Every route

**Client-independent logic:**
- Purpose: API access and pure domain code
- Location: `utils/`
- Contains: Fetch wrappers, types, parsers, simulators
- Depends on: The API, `next` types, React's `cache` in a few modules. No `'use client'` here.
- Used by: Everything

## Data Flow

### Server-rendered page

1. Request reaches `proxy` if the path matches (`proxy.ts:42`).
2. `TournamentRoute` awaits `params` and `searchParams` (`app/tournament/[id]/page.tsx:67`).
3. `getTournament` reads the API through a `cache()`-wrapped function, shared with `generateMetadata` (`utils/tournaments.ts:59`).
4. The `fetch` is the wrapper from `register`, adding the timeout and internal URL (`instrumentation.ts:20`).
5. `notFound()` handles a `null` result; other errors reach `onRequestError` and the error boundary.
6. The page renders `TournamentPage` with plain props.

### Client-only tool

1. `app/deck-builder/page.tsx` renders the shell and `DeckEditorLoader`.
2. `deck-editor.loader.tsx` loads the editor with `ssr: false`.
3. `deck-editor.client.tsx` holds a `useReducer` over `editorReducer` (`app/deck-builder/deck-editor.reducer.ts`).
4. Mutations go through pure functions in `utils/deck/model.ts`.
5. `use-save.ts` writes to the API through `utils/decks.ts`, and `drafts.ts` keeps a `localStorage` copy.

### Sign-in

1. `signIn` does a full-page redirect to `${API_URL}/auth/discord` (`utils/auth.ts:47`).
2. The API completes OAuth and sets the HttpOnly `omega_session` cookie.
3. `app/layout.tsx` passes `hasSession` from the cookie jar to `AuthProvider`.
4. `AuthProvider` calls `fetchMe` only when the cookie exists (`contexts/auth/auth.context.tsx:21`).

### Live tournament

1. `app/tournament/live-strip.tsx` runs a timer and calls `router.refresh()`.
2. The server re-renders the route; `fetch` revalidates after 15 s.

### Messenger

1. `MessengerProvider` wraps every page from `app/layout.tsx`.
2. `use-messenger.ts` opens an `EventSource` on `/messenger/stream` and applies server events.

**State Management:**
- No global store. `AuthProvider` and `MessengerProvider` are the only app-wide contexts.
- Tools use `useReducer`; data fetching uses `useResource` from `hooks/index.ts`.
- URL search params hold shareable state, such as `?tab=`, `?ladder=`, `?section=`, `?d=`.

## Key Abstractions

**API client module:**
- Purpose: One file per API domain, with its own error class and typed functions
- Examples: `utils/tournaments.ts`, `utils/ranked.ts`, `utils/panel.ts`, `utils/decks.ts`
- Pattern: A private `get` or `request`, an error class with `status` and `code`. Branch on `code`, never `message`.

**Loader / client pair:**
- Purpose: Keep a heavy tool out of the server bundle
- Examples: `app/deck-builder/deck-editor.loader.tsx`, `app/simulator/simulator.loader.tsx`, `app/calculator/calculator.loader.tsx`
- Pattern: `next/dynamic` with `ssr: false` in a `'use client'` wrapper

**Deck model:**
- Purpose: Immutable deck operations, legality and format rules
- Examples: `utils/deck/model.ts`, `utils/deck/rules.ts`, `utils/deck/codecs/`
- Pattern: Pure functions over `Deck` and `CardMap`

**Simulator draft:**
- Purpose: Board state for the combo simulator
- Examples: `utils/simulator/board.ts`, `utils/simulator/draft.ts`, `utils/simulator/session.ts`
- Pattern: Pure transitions, replayable for sharing and video

**Wiki document:**
- Purpose: Structured article format and its validation
- Examples: `utils/wiki-doc.ts`, `components/omega/wiki/blocks.tsx`, `app/wiki/editor/DocEditor.tsx`
- Pattern: Typed blocks, with sanitised Markdown in `utils/remark.ts`. `docs/WIKI_BLOCKS.md` documents the format.

## Entry Points

**Root layout:**
- Location: `app/layout.tsx`
- Triggers: Every page
- Responsibilities: Locale, fonts, JSON-LD, GTM, providers, ads, tracking

**Proxy:**
- Location: `proxy.ts`
- Triggers: Paths in `config.matcher`
- Responsibilities: Bot blocking and rate limiting

**Instrumentation:**
- Location: `instrumentation.ts`
- Triggers: Server start, uncaught server errors
- Responsibilities: Disable sharp's cache, wrap `fetch`, log errors

**Tier list script:**
- Location: `scripts/wiki-tier-list.ts`
- Triggers: Run by hand
- Responsibilities: Generates the weekly wiki tier list pages and meta report

## Architectural Constraints

- **Threading:** Node's single event loop on the server. `sharp` work and infographic renders run on the same process as page renders. The browser code uses no Web Workers.
- **Global state:** `hits` in `proxy.ts` is per-process, so the limiter assumes one replica. `globalThis.fetch` is replaced in `instrumentation.ts`.
- **Circular imports:** None confirmed at runtime. `StatisticsFilters.tsx` has a type-only import of `PlayerStatistics.tsx`. `tokensave_circular` reports several more, but they are name-matching false positives.
- **Client bundle:** `app/layout.tsx` wraps all pages in client providers. `ClientMessages` must name each route's namespaces in its `layout.tsx`, or that route's client components get no strings.
- **Cookie visibility:** `getMeServer` only sees the session when the API sets `COOKIE_DOMAIN` to the shared parent domain.
- **Middleware location:** Next 16 reads `proxy.ts`, not `middleware.ts`. `config.matcher` must stay a literal.
- **Time and randomness in render:** `react-hooks/purity` is an error. Compute `Date.now()` in a helper outside the component, as `clock()` does in `app/tournament/[id]/page.tsx`.

## Anti-Patterns

### Gating data on the server by role

**What happens:** A page hides content in the UI and treats that as protection.
**Why it's wrong:** The front holds no authority. The API checks every call.
**Do this instead:** Use `user.permissions` for display only, as `components/ui/require-auth.tsx` and `app/admin/AdminShell.tsx` do.

### Adding remote image hosts or wildcards

**What happens:** A broad `remotePatterns` entry in `next.config.ts`.
**Why it's wrong:** Each `url` + `w` + `q` is a sharp job on the page server, so a wildcard lets a stranger mint unlimited work.
**Do this instead:** Keep hosts and paths narrow. Send card art through `cardLoader` or `app/card-image/[kind]/[file]/route.ts`.

### Reading the API in an unbounded server loop

**What happens:** Rendering pages that fan out across many API reads, or links crawlers can walk forever.
**Why it's wrong:** A crawler walking profiles drained the API's connection pool on 2026-10-26.
**Do this instead:** Cache with `revalidate`, keep `noIndex` on personal pages, and extend `proxy.ts` for new heavy routes.

### Passing `messages` wholesale

**What happens:** `NextIntlClientProvider` with no `messages` prop.
**Why it's wrong:** It serialises the entire catalogue, about 120 KB, into every page.
**Do this instead:** Add the namespaces to `ClientMessages` in the route's `layout.tsx`.

## Error Handling

**Strategy:** Log server failures as JSON, render a usable page when a non-critical read fails, and let critical failures reach a boundary.

**Patterns:**
- Critical reads throw and reach `app/global-error.tsx` or `app/wiki/error.tsx`. Only those two boundaries exist.
- Optional joins catch and log, then degrade: `framesOf` in `app/tournament/[id]/page.tsx` returns `{}`.
- `null` means not found. `notFound()` renders the route's `not-found.tsx`.
- Discriminated results where the page must show a failure state, such as `result.ok` from `getStatistics`.
- Client fetches pass an `AbortSignal` and ignore aborted errors.

## Cross-Cutting Concerns

**Logging:** `log` from `utils/log.ts` on the server. Never pass raw request objects.
**Validation:** The API validates. The front parses API text defensively (`parseBubble` in `utils/bubble.ts`) and sanitises Markdown (`rehype-sanitize` in `utils/remark.ts`). `return-to` targets are checked in `utils/return-to.ts`.
**Authentication:** Session cookie set by the API. `useAuth` on the client, `getMeServer` on the server.
**Internationalisation:** `next-intl` with `en` and `pt`. Locale comes from the `NEXT_LOCALE` cookie.
**SEO:** `pageMetadata` and `noIndexMetadata` from `utils/metadata.ts`. JSON-LD goes through `jsonLd`, which escapes `<`.
**Ads:** `adsMode` in `components/omega/ads/ads-mode.ts` decides per path and per user.

---

*Architecture analysis: 2026-11-01*
