# Statistics Deep Dive Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let `/statistics` search any archetype key of a season and open its deep dive, calculating keys outside the season build on demand for logged-in users.

**Architecture:** `buildStatistics` gains `include` (force one key into the listed rows) and `index` (every ranked key with its deck-games). A one-at-a-time in-memory queue runs `buildGlobalSeason(season, key)` and saves the row in `statistics_archetypes`. Three routes under `/statistics` serve the index, the deep dive status and the POST that queues a calculation; the front adds a search, a Calculate flow and a shared `<DeepDive />`.

**Tech Stack:** omega-server-v3: Fastify, Postgres (`pg`), `tsx` + `node:assert` tests. tournament-next: Next.js App Router, React client components, Tailwind, `@ui/*`.

**Spec:** `docs/superpowers/specs/2026-10-16-statistics-deep-dive-search-design.md`

**Prerequisite:** the closed-season freeze (`statistics_snapshots`, `freezeStatistics`, `/panel/analytics/statistics/seasons`) is uncommitted in both repos. Commit it before Task 1; Tasks 3 and 4 build on it.

## Global Constraints

- Keys: server `'207+451'` (`keyOf`, ascending); front and URLs `207-451` (`archKey`). Max 2 setcodes.
- Searchable = deck-games ≥ `max(minSamples, 1)`; a frozen season uses the snapshot's `min_samples`.
- `MAX_ARCHETYPES` (100) rows are the build; `ready` = rank ≤ 100 or saved.
- Calculate: `requireAuth`; 5 new jobs per account per rolling hour; joining a queued/running job or hitting a saved result never counts.
- One job at a time per process; failed job state kept 10 minutes.
- Poll every 3 s. Copy: *"Calculating {name}. This adds up the whole season and can take up to a minute. Keep this page open."* and *"5 new calculations an hour. Try again at {HH:MM}"*.
- Ranked seasons only for saving (`statistics_archetypes.season_id` → `seasons`).
- No `Co-Authored-By` trailer in commits. Front verification: `npx tsc --noEmit` + `npx eslint <files>`, no `next build`. Edit files with the Edit tool, not sed/python (omega-server mixes CRLF/LF).

## Review Focus

- A key typed out of order or with `+` (`451-207`, `207+451`) → the route normalises to ascending; never a second saved row. Test in Task 4.
- The server restarts while a job is queued → GET answers `missing`; the front must stop the spinner and offer Calculate again, not poll forever. Handled in Task 6.
- The user switches ladder or season mid-poll → polling for the old season stops (abort on unmount/season change). Task 6.
- A logged-in user at the limit clicks Calculate on a key someone else already queued → joins it, no 429. Test in Task 2.
- A key ranked 31–100 (computed but not on the page) → opens instantly as `ready`, no Calculate. Task 4 sets `ready` by position < `MAX_ARCHETYPES`; Task 6 Step 5 picks such a key in the browser once the backend is reachable.

---

### Task 1: `include` and `index` in `buildStatistics`

**Files:**
- Modify: `omega-server-v3/src/modules/analytics/analytics.statistics.ts` (`buildStatistics` signature; `listed` near the `ranked.slice(0, MAX_ARCHETYPES)` line; return object)
- Modify: `omega-server-v3/src/modules/analytics/analytics.service.ts` (`buildGlobalSeason`)
- Test: `omega-server-v3/src/modules/analytics/analytics.test.ts`, block `// statistics`

**Interfaces:**
- Produces: `buildStatistics(state, days, names, isStaple, members = {}, include?: string, max = MAX_ARCHETYPES)`; result gains `index: [key: string, games: number][]` (every ranked key, rank order). `FullStatistics` carries it, so the cache and the frozen snapshot carry it. `max` exists so the hand-built test state (a handful of archetypes) can put a key past the cut; production never passes it.
- Produces: `buildGlobalSeason(season: SeasonRow, include?: string)` passing `include` through. Still module-private.
- `cutStatistics` must **not** return `index` (strip it with `archetypeGames`/`matchupRank`), so `GET /statistics` stays the same size.

- [ ] **Step 1: Write the failing tests** (after the existing `const full = buildStatistics(...)` line, ~686)

```ts
{
  const keyOf = (a: { archetype: number[] }) => a.archetype.join('+')
  const isStaple = (id: number) => id !== 500
  // index: every ranked key in rank order, the listed ones first, games = archetypeGames
  assert.deepEqual(full.index.slice(0, full.archetypes.length).map(([k]) => k), full.archetypes.map(keyOf))
  assert.deepEqual(full.index.map(([, g]) => g), full.archetypeGames)
  assert.equal('index' in cutStatistics(full, 5, 30), false)
  // include: with a cap of 1, the second key joins only when asked, with the same row as the uncapped build
  const [first, second] = [full.index[0]![0], full.index[1]![0]]
  const capped = buildStatistics(statState, statDays, statNames, isStaple, {}, undefined, 1)
  const forced = buildStatistics(statState, statDays, statNames, isStaple, {}, second, 1)
  assert.deepEqual(capped.archetypes.map(keyOf), [first])
  assert.deepEqual(forced.archetypes.map(keyOf), [first, second])
  assert.deepEqual(forced.archetypes[0], capped.archetypes[0])
  assert.deepEqual(forced.archetypes[1], full.archetypes[1])
}
```

- [ ] **Step 2: Run, expect FAIL** — `cd omega-server-v3 && npx tsx src/modules/analytics/analytics.test.ts` → `Property 'index' does not exist`.
- [ ] **Step 3: Implement.** `listed = ranked.slice(0, max)`, then if `include` is in `ranked` but not in `listed`, push its entry. `index: ranked.map(([k, a]) => [k, a.all[0]])`. `cutStatistics` destructures `index` out with the other internals. `buildGlobalSeason(season, include?)` forwards it.
- [ ] **Step 4: Run, expect `analytics.test ok`**, then `npx tsc --noEmit -p .` → no output.
- [ ] **Step 5: Commit** — `git commit -m "feat(statistics): index of every key and include in buildStatistics"`

---

### Task 2: Deep dive queue and account limit

**Files:**
- Create: `omega-server-v3/src/modules/analytics/analytics.deepdive.ts`
- Create: `omega-server-v3/src/modules/analytics/analytics.deepdive.test.ts`
- Modify: `omega-server-v3/package.json` (`test` script: append `&& tsx src/modules/analytics/analytics.deepdive.test.ts`)

**Interfaces:**
- Produces:
  ```ts
  export type JobState = { status: 'queued'; position: number } | { status: 'running' } | { status: 'failed'; error: string }
  export const createQueue: (run: (id: string) => Promise<void>, now?: () => number) => {
    /** `created` false = joined a queued/running job (does not count toward the limit). */
    enqueue(id: string): { state: JobState; created: boolean }
    state(id: string): JobState | null   // null = unknown or done
  }
  export const createLimiter: (max: number, windowMs: number) => {
    take(account: string, now: number): { ok: true } | { ok: false; retryAt: number }
  }
  export const FAILED_TTL_MS = 10 * 60 * 1000
  ```
- `id` is `${seasonId}:${serverKey}`. Done jobs disappear from `state` (the saved row answers). Failed ones stay `FAILED_TTL_MS`, then `null`; `enqueue` of a failed id starts a new job (`created: true`).

- [ ] **Step 1: Write the failing tests**

```ts
// one job at a time, shared ids, positions
const order: string[] = []
let release!: () => void
const queue = createQueue((id) => (order.push(id), new Promise<void>((r) => (release = r))))
assert.deepEqual(queue.enqueue('1:5'), { state: { status: 'running' }, created: true })
assert.deepEqual(queue.enqueue('1:6'), { state: { status: 'queued', position: 1 }, created: true })
assert.deepEqual(queue.enqueue('1:6'), { state: { status: 'queued', position: 1 }, created: false })
release(); await tick()
assert.equal(queue.state('1:5'), null)
assert.deepEqual(queue.state('1:6'), { status: 'running' })
assert.deepEqual(order, ['1:5', '1:6'])
// failure kept 10 min, then gone; retry creates
let t = 0
const failing = createQueue(() => Promise.reject(new Error('boom')), () => t)
failing.enqueue('1:7'); await tick()
assert.deepEqual(failing.state('1:7'), { status: 'failed', error: 'boom' })
t = FAILED_TTL_MS + 1
assert.equal(failing.state('1:7'), null)
// limit: 5 an hour per account, rolling
const limit = createLimiter(5, 3_600_000)
for (let i = 0; i < 5; i++) assert.deepEqual(limit.take('u', i), { ok: true })
assert.deepEqual(limit.take('u', 10), { ok: false, retryAt: 3_600_000 })
assert.deepEqual(limit.take('v', 10), { ok: true })
assert.deepEqual(limit.take('u', 3_600_000), { ok: true })
console.log('analytics.deepdive.test ok')
```

`tick = () => new Promise((r) => setImmediate(r))`.

- [ ] **Step 2: Run, expect FAIL** — `npx tsx src/modules/analytics/analytics.deepdive.test.ts` → cannot find module.
- [ ] **Step 3: Implement** both factories. Queue: an array of waiting ids, one `current`, a `failed` map `id → { error, at }`; after each job, start the next. Limiter: `Map<account, number[]>` of accepted times, drop those older than `now - windowMs`; `retryAt` = oldest kept + `windowMs`. Add `// ponytail: one process, like globalCache; with more instances move queue and limit to the database.`
- [ ] **Step 4: Run, expect `analytics.deepdive.test ok`**; `npx tsc --noEmit -p .` clean.
- [ ] **Step 5: Commit** — `git commit -m "feat(statistics): deep dive job queue and per-account limit"`

---

### Task 3: `statistics_archetypes` storage and sweep invalidation

**Files:**
- Modify: `omega-server-v3/src/db/schema.ts` (after `statistics_snapshots`)
- Modify: `omega-server-v3/src/modules/analytics/analytics.repository.ts` (section `/statistics congelado`)
- Modify: `omega-server-v3/src/modules/analytics/analytics.service.ts`, `analytics.sync.ts` (`runSync` finally)

**Interfaces:**
- Produces (repository):
  - `findSavedArchetype<T>(seasonId: number, key: string): Promise<T | null>`
  - `listSavedArchetypes(seasonId: number): Promise<Set<string>>`
  - `insertSavedArchetype(seasonId: number, key: string, body: unknown): Promise<void>` (`ON CONFLICT DO NOTHING`, `JSON.stringify`)
  - `deleteLiveSavedArchetypes(from: Date, until: Date): Promise<number>` — rows of seasons with **no** snapshot whose window crosses `[from, until)`: `s.starts_at < until AND (s.ends_at IS NULL OR s.ends_at > from)`.
- Produces (service): `forgetDeepDives(from: string, to: string): Promise<number>` using `dayStart(from, tz)` and `dayStart(addDays(to, 1), tz)`.
- `runSync` finally (no error): `forgetDeepDives(from, to)` **then** `freezeStatistics(from, to)`, then warm — in that order, in one chain.

- [ ] **Step 1: Add the table** exactly as in the spec ("Storage"), with a comment pointing at docs/STATISTICS.md.
- [ ] **Step 2: Add the four repository functions and `forgetDeepDives`.** No unit test: these are single SQL statements; the crossing rule is the spec's.
- [ ] **Step 3: Chain it in `runSync`**; log `{ event: 'STATISTICS_DEEPDIVE_FORGOT', rows }` when rows > 0.
- [ ] **Step 4: Verify** — `npx tsc --noEmit -p .` clean; `npx tsx src/modules/analytics/analytics.test.ts` → `analytics.test ok`.
- [ ] **Step 5: Commit** — `git commit -m "feat(statistics): save on-demand deep dives, forget them on sweep"`

---

### Task 4: Service and routes

**Files:**
- Modify: `omega-server-v3/src/modules/analytics/analytics.service.ts`
- Modify: `omega-server-v3/src/modules/analytics/analytics.routes.ts` (`statisticsRoutes`)
- Modify: `omega-server-v3/docs/STATISTICS.md`, `omega-server-v3/docs/front/STATISTICS_API.md`
- Test: `omega-server-v3/src/modules/analytics/analytics.test.ts`

**Interfaces:**
- Consumes: Task 1 `index`/`include`, Task 2 `createQueue`/`createLimiter`, Task 3 repository.
- Produces (service):
  ```ts
  export const archetypeKey: (raw: unknown) => string | null   // '451-207' | '207+451' → '207+451'; null if not 1–2 positive ints
  export const cutIndex: (index: [string, number][], minSamples: number) => [string, number][]   // prefix with games ≥ max(minSamples, 1)
  export const loadArchetypeIndex(seasonCode: string | null, format): Promise<{ season; minSamples: number; archetypes: { archetype: number[]; name: string | null; games: number; ready: boolean }[] }>
  export type DeepDiveAnswer = { status: 'ready'; archetype: StatArchetypeRow & { rank: number } } | { status: 'missing' } | JobState
  export const loadArchetypeDeepDive(seasonCode: string, key: string): Promise<DeepDiveAnswer>
  export const requestArchetypeDeepDive(seasonCode: string, key: string, userId: string): Promise<{ code: 200 | 202; body: DeepDiveAnswer } | { code: 429; body: { retryAt: string } }>
  ```
  `StatArchetypeRow` = `FullStatistics['archetypes'][number]`.
- Internal helper `seasonBuild(season)`: `{ statistics: FullStatistics, minSamples, season, syncedDays }` from the snapshot when frozen, else `cachedGlobalSeason` + `minSamplesSetting()`. `loadStatistics` is refactored onto it (no behavior change).
- Errors: unknown season, period season for the archetype routes, or a key not in the index cut → `AnalyticsError(404, 'NOT_FOUND', ...)`; bad key → `AnalyticsError(400, 'BAD_REQUEST', 'key must be 1–2 setcodes')`.
- Routes: `GET /statistics/archetypes` (`?ladder|format|season`, `cache-control: public, max-age=300`), `GET /statistics/archetype?season=&key=` (`no-store`), `POST /statistics/archetype` `{ season, key }` with `{ preHandler: requireAuth }`, reply code from the service. All inherit the 60/min IP limit.

- [ ] **Step 1: Write the failing tests**

```ts
assert.equal(archetypeKey('451-207'), '207+451')
assert.equal(archetypeKey('207+451'), '207+451')
assert.equal(archetypeKey('451'), '451')
for (const bad of ['', '1-2-3', 'a', '0', '-5', undefined, 12]) assert.equal(archetypeKey(bad), null)
const idx: [string, number][] = [['1', 40], ['2', 30], ['1+2', 5], ['3', 1]]
assert.deepEqual(cutIndex(idx, 30), idx.slice(0, 2))
assert.deepEqual(cutIndex(idx, 0), idx) // floor of 1
assert.deepEqual(cutIndex(idx, 50), [])
```

- [ ] **Step 2: Run, expect FAIL** (not exported).
- [ ] **Step 3: Implement `archetypeKey`, `seasonBuild`, the three service functions and routes.** Order inside `requestArchetypeDeepDive`: key in index cut (else 404) → in build `archetypes` or saved → 200 ready → `queue.state(id)` queued/running → 202 that state, no limit → `limiter.take(userId, Date.now())` → 429 `{ retryAt: ISO }` → `queue.enqueue(id)` → 202. The queue's `run(id)` builds `buildGlobalSeason(season, key)`, takes the row for `key`, adds `rank` (position in `index` + 1) and calls `insertSavedArchetype`. `ready` in the index = position < `MAX_ARCHETYPES` or in `listSavedArchetypes`.
- [ ] **Step 4: Run tests and typecheck** — `analytics.test ok`, `analytics.deepdive.test ok`, `npx tsc --noEmit -p .` clean.
- [ ] **Step 5: Docs** — STATISTICS.md: section "Deep dive on demand" (routes, table, queue, limit, invalidation, frozen-season edge from the spec). STATISTICS_API.md: the three routes with request, response shapes and every `status`.
- [ ] **Step 6: Commit** — `git commit -m "feat(statistics): archetype index and on-demand deep dive routes"`

---

### Task 5: Front fetchers and `<DeepDive />` extraction

**Files:**
- Modify: `tournament-next/utils/statistics.ts`
- Create: `tournament-next/app/statistics/DeepDive.tsx`
- Modify: `tournament-next/app/statistics/MetaStatistics.tsx` (section 05 body)

**Interfaces:**
- Produces (`utils/statistics.ts`):
  ```ts
  export type IndexEntry = { archetype: ArchetypeKey; name: string | null; games: number; ready: boolean }
  export type DeepDiveRow = StatArchetype & { rank: number }
  export type DeepDiveState = { status: 'ready'; archetype: DeepDiveRow } | { status: 'missing' } | { status: 'queued'; position: number } | { status: 'running' } | { status: 'failed'; error: string } | { status: 'limited'; retryAt: string }
  export const getArchetypeIndex: (season: string, signal?: AbortSignal) => Promise<IndexEntry[]>
  export const getDeepDive: (season: string, key: ArchetypeKey, signal?: AbortSignal) => Promise<DeepDiveState>
  export const requestDeepDive: (season: string, key: ArchetypeKey) => Promise<DeepDiveState>   // credentials: 'include'; 429 → { status: 'limited', retryAt }
  ```
  Keys go in the URL as `archKey(key)`. Non-OK other than 429 throws.
- Produces (`DeepDive.tsx`): `export const DeepDive = ({ archetype, rank }: { archetype: StatArchetype; rank: number }) => JSX` — the hero `Panel`, the three-column turn order / siding / pace, the cards table and engines/techs, moved verbatim with the helpers they use (`Art`, `Named`, `Bar`, `Groups`, `SortHeads`, card sorting). Shared helpers move to the new file and `MetaStatistics.tsx` imports them; nothing is duplicated.

- [ ] **Step 1: Add the types and three fetchers.**
- [ ] **Step 2: Move the deep dive JSX into `DeepDive.tsx`**; section 05 renders `<Segmented …/>` then `<DeepDive archetype={focus} rank={rank} />`.
- [ ] **Step 3: Verify no behavior change** — `npx tsc --noEmit` and `npx eslint app/statistics utils/statistics.ts` clean; open `http://localhost:5173/statistics` in the browser pane (dev server already runs on 5173: `preview_start {url}`), and with `javascript_tool` check section 05 still lists the hero, "Turn order", "Siding", "Cards", "Engines", "Techs" and that clicking another chip changes the hero title.
- [ ] **Step 4: Commit** — `git commit -m "refactor(statistics): DeepDive component and deep dive fetchers"`

---

### Task 6: Search and Calculate flow

**Files:**
- Create: `tournament-next/app/statistics/DeepDiveSearch.tsx`
- Modify: `tournament-next/app/statistics/MetaStatistics.tsx` (section 05)

**Interfaces:**
- Consumes: Task 5 fetchers and `DeepDive`; `Lookup` from `@ui/lookup` (its `search` must be stable); `useAuth()` (`user: AuthUser | null | undefined`).
- Produces: `export const DeepDiveSearch = ({ season, onLocal }: { season: Statistics['season']; onLocal: (key: string) => boolean }) => JSX` — `onLocal(archKey)` returns `true` when the key is in the page's data and was focused (today's path); otherwise the component shows the result itself below the search.

- [ ] **Step 1: Search.** `Lookup` labelled "Search any archetype". The index promise is created on the first search and kept in a ref per `season.code`; options are name matches (case-insensitive) with `meta` = `"{games} deck-games · Ready"` or `"· Needs calculation"`. Name fallback `Setcode {a} / {b}` like `nameOf`.
- [ ] **Step 2: Pick.** `onLocal` first; else `getDeepDive` → `ready` renders `<DeepDive>`; `missing` → Panel "Not calculated yet" with **Calculate** (`user` truthy) or a `Link` "Sign in to calculate" to `/login` (`user === null`); `undefined` (auth loading) shows nothing yet.
- [ ] **Step 3: Calculate.** `requestDeepDive`, then poll `getDeepDive` every 3000 ms while `queued`/`running`. Loading panel: name, "{n}{st|nd|rd|th} in line" or "Calculating", and the spec copy verbatim. `beforeunload` listener only while queued/running. `failed` → error text + **Retry** (calls `requestDeepDive` again). `limited` → `5 new calculations an hour. Try again at {HH:MM}` (`retryAt` in the viewer's time). A `missing` answer while polling (server restarted) ends polling and shows the "Not calculated yet" panel again. Polling and fetches use one `AbortController` aborted on unmount and when `season.code` or the picked key changes.
- [ ] **Step 4: Wire into section 05** above the `Segmented`, passing `onLocal = (key) => byKey.has(key) && (setFocusKey(key), true)`.
- [ ] **Step 5: Verify** — `npx tsc --noEmit`, `npx eslint app/statistics` clean (mind `react-hooks/purity` and `set-state-in-effect`: start fetches from event handlers or promise callbacks, `Date.now()` only inside handlers). In the browser pane: the search field renders in section 05; picking a key of the page's data focuses the hero. The calculate path needs the backend deployed (the local front calls `NEXT_PUBLIC_API_URL`): say so in the handoff if it was not exercised.
- [ ] **Step 6: Commit** — `git commit -m "feat(statistics): search any archetype in the deep dive, calculate on demand"`
