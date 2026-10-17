# Statistics deep dive search — design

Date: 2026-10-16
Status: approved in brainstorming, awaiting spec review
Repos: `omega-server-v3` (API), `tournament-next` (front)

## Goal

On `/statistics`, section 05 "Archetype deep dive" today only offers the archetypes the page already
loaded (top 30 by deck-games). Visitors must be able to search **any archetype of the season** and
open its deep dive. Archetypes the season build did not compute are calculated **on demand**, once,
when a logged-in user asks, and saved; while it runs the page shows a loading state that tells the
user to keep the page open.

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| What is a "combination" | An **exact archetype key** as the sweep sorts decks: 1 setcode (pure) or 2 (mixed). No grouping of buckets. |
| Which keys are searchable | Keys with **at least `minSamples`** deck-games in the season (the same floor the page uses). |
| Who can trigger a calculation | **Logged-in users only**, 5 new calculations per hour per account. Opening a saved result is free and public. |
| How it is calculated | **Reuse the full season build** (`buildGlobalSeason` + `buildStatistics`) with the requested key forced into the listed archetypes, so the numbers match the page by construction. |

## Background (current code)

- `buildGlobalSeason` (`analytics.service.ts`) sums every swept day of a season (~9 s warm, up to
  ~40 s cold on a TCG season, ~80 MB peak) and runs `buildStatistics` (`analytics.statistics.ts`).
- `buildStatistics` ranks archetypes by deck-games and keeps the first `MAX_ARCHETYPES` (100):
  `ranked.slice(0, MAX_ARCHETYPES)`. Per-archetype rows (cards, engines, techs, pace, turn order,
  siding) exist only for those 100.
- `GET /statistics` cuts that result per request (`cutStatistics`: `minSamples`, `limit` ≤ 100).
- Closed ranked seasons are frozen in `statistics_snapshots` (docs/STATISTICS.md#frozen-seasons).
- Archetype keys: setcodes ascending joined by `+` on the server (`keyOf`), by `-` on the front
  (`archKey`). In URLs the key travels as `-` (a `+` would decode to a space).

## Backend (`omega-server-v3`)

### Calculation

- `buildStatistics(state, days, names, isStaple, members, include?: string)`: when `include` is a key
  that ranked past `MAX_ARCHETYPES`, it is appended to `listed`. Nothing else changes: the other 100
  rows are identical with or without `include`.
- `buildStatistics` also returns `index: [key: string, games: number][]` for **every** ranked key
  (deck-games > 0), in rank order. Names are resolved at read time from `names.archetypes`, which
  already covers every setcode of the season.
- `buildGlobalSeason(season, include?)` passes `include` through. The cached build (no `include`)
  keeps `index`; the frozen snapshot body gains `index` too.
- The deep dive of a key is its `StatArchetype` row (the shape the page already renders) plus
  `rank` (1-based position in `index`).

### Storage

```sql
CREATE TABLE IF NOT EXISTS statistics_archetypes (
  season_id   integer     NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  archetype   text        NOT NULL,  -- server key, e.g. '207+451'
  body        json        NOT NULL,  -- StatArchetype + rank
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (season_id, archetype)
);
```

- Ranked seasons only (panel periods are not on the page).
- **Invalidation:** at the end of every sweep without error, **before** `freezeStatistics`, delete the
  rows of seasons that have **no snapshot** and whose window crosses the swept range. Frozen seasons
  keep theirs forever.

### Routes (in `statisticsRoutes`, under `/statistics`)

| Route | Access | Answer |
|---|---|---|
| `GET /statistics/archetypes?ladder=` or `?season=` | public, cached 5 min | `{ season, minSamples, archetypes: { archetype: number[], name, games, ready }[] }`: the index cut at `minSamples` (the frozen one for a frozen season). `ready` = rank ≤ 100 or saved in `statistics_archetypes`. |
| `GET /statistics/archetype?season=&key=207-451` | public, `no-store` | `200 { status: 'ready', archetype }` when the key is in the build (cache or snapshot) or saved; otherwise `200 { status: 'missing' }`, `{ status: 'queued', position }`, `{ status: 'running' }` or `{ status: 'failed', error }`. `404` when the season or the key (below `minSamples`) is unknown. |
| `POST /statistics/archetype` `{ season, key }` | `requireAuth` | `200 { status: 'ready', archetype }` if saved; otherwise enqueue and `202 { status: 'queued', position }`. `429 { retryAt }` past the account limit. `404` as above. |

- `season` is a ranked season code; the GET without it on the index route uses `?ladder=` like
  `GET /statistics`. The archetype routes require `season`; the front sends `data.season.code`.

### Queue and limit

- In-memory queue, **one calculation at a time** in the process; jobs keyed by `season:key`, so equal
  requests share one job. A job runs `buildGlobalSeason(season, key)`, extracts the row and inserts it
  (`ON CONFLICT DO NOTHING`). A failed job keeps `{ status: 'failed', error }` in memory for 10 minutes
  so polling sees it; a new POST retries it.
- Limit: 5 accepted **new** jobs per account per rolling hour, in memory. A POST that finds a saved
  result or joins a job already queued does not count.
- `ponytail:` one process, like `globalCache`; with more instances the queue and limit move to the
  database.

### Known edge

A deep dive calculated after a season froze reads the days as they are then. If someone re-sweeps a
frozen season's days, that deep dive may disagree with the snapshot. The panel's Rebuild list hides
frozen seasons, so this needs a deliberate manual sweep.

### Tests (`analytics.test.ts`, hand-built `GlobalState`)

- `include`: a key outside the top `MAX_ARCHETYPES` appears in `archetypes`; every other row is equal
  to the build without `include`.
- `index`: every ranked key in rank order, games correct; the route's cut at `minSamples` keeps the
  prefix with `games ≥ max(minSamples, 1)`.
- Queue: two enqueues of the same key run one job; the limit counts only new jobs.

## Front (`tournament-next`, `app/statistics/MetaStatistics.tsx`)

### Search

- A `Lookup` ("Search any archetype") above the top-8 `Segmented` in section 05.
- The index is fetched once, on the first search (`GET /statistics/archetypes?season=`), and filtered
  by name in the browser. Mixed keys read "Snake-Eye + Fire King", so "snake" lists the pure deck and
  its mixes. Each option shows deck-games and "Ready" or "Needs calculation".

### Picking a key

1. **In the page's data** (`data.archetypes`): today's path, `setFocusKey`.
2. **`ready` but not in the page:** `GET /statistics/archetype` and render it.
3. **Not ready:** a panel "Not calculated yet":
   - logged in (`useAuth`): **Calculate** → `POST`, credentials included;
   - logged out: **Sign in to calculate** (the site's login link).

### While calculating

- A loading panel: the deck's name, queue position ("2nd in line") or "Calculating", and the copy:
  *"Calculating {name}. This adds up the whole season and can take up to a minute. Keep this page open."*
- `beforeunload` warns on close while a job of this page is queued or running.
- Polls `GET /statistics/archetype` every 3 s until `ready` or `failed`.
- `failed`: the error and **Retry** (a new POST). `429`: *"5 new calculations an hour. Try again at
  {HH:MM}"* from `retryAt`.

### Refactor

The deep dive JSX (hero panel, turn order, siding, pace, cards, engines, techs) becomes
`<DeepDive archetype rank />`, used for both the page's data and on-demand results.

### Not in scope

- The picked key in the URL (`?deck=`) for sharing; add when someone asks.
- Matchups of the searched key (the matrix was removed from the page).
- Panel periods and `/analytics/global`.

### Verification

`tsc --noEmit` and `eslint` on the front. The local front talks to the remote API
(`NEXT_PUBLIC_API_URL`), so the new routes are browser-tested after the backend deploys, or with the
front pointed at a local backend.

## Docs

`omega-server-v3/docs/STATISTICS.md` (new routes, table, queue) and
`docs/front/STATISTICS_API.md` (the two GETs and the POST, response shapes, statuses).
