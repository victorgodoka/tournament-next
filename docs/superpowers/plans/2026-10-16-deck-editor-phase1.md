# Deck Editor — Phase 1 (Core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working `/deck-editor` on desktop and mobile that searches the card pool, builds Main/Extra/Side with live validation, keeps local drafts, and saves/loads decks to the user's account with revision history on the server.

**Architecture:** omega-server-v3 gets a `decks` module (Postgres `decks` + `deck_revisions`, owner CRUD, optimistic concurrency, revisions, archetype label). tournament-next gets a pure TypeScript deck core in `utils/deck/` (model, rules, codecs) and a client-only editor in `app/deck-editor/` that talks to `GET /cards` for the pool and to the new decks API for persistence.

**Tech Stack:** Fastify 5 + `pg` (server, tests are `tsx` assert scripts against a real Postgres); Next 16 / React 19 / Tailwind 4 / next-intl / Vitest (front); `ygopro-deck-encode` (already installed); native `CompressionStream('deflate-raw')`.

**Spec:** `docs/superpowers/specs/2026-10-16-deck-editor-design.md` (read it with this plan).

**Deviations from the spec, decided while planning:**
1. `decks.id` is a random 16-hex text id, not `bigserial`: sequential ids would let anyone enumerate `unlisted` decks.
2. `legal` badges and `GET /decks` (public browse) move to the phase 4 plan, with the pages that consume them. The editor validates client-side, so phase 1 needs neither. When built, legality is decided in a pure TS function over rows read from `banlist_cards` (testable without a DB), not in SQL.
3. After a logged-out Save, sign-in returns to the editor through a `sessionStorage` return-to key read by `app/login/SignIn.tsx` (the API's OAuth flow has no return URL).

## Global Constraints

- Repos: server `C:\Users\marti\Documents\omega-server-v3`, front `C:\Users\marti\Documents\tournament-next`. Work on branch `feat/deck-editor` in both.
- The front's `main` has ~30 unrelated uncommitted files. Every commit stages only the files its task lists (`git add <paths>`), never `git add -A` / `.`.
- Edit files with the Edit/Write tools, not `sed -i`, python or node scripts (Git Bash flips CRLF/LF).
- Front verification is `pnpm exec tsc --noEmit` + `pnpm lint` + `pnpm vitest run <path>`; never `next build`. Dev server is already running on port 5173.
- React lint treats impure render and set-state-in-effect as errors: load data in promise callbacks / event handlers, no `Date.now()` during render.
- Design system only: tokens and components from `app/styles.css` and `components/ui` (`Button`, `Dialog`, `Segmented`, `SearchField`, `Select`, `TabBar`, `Switch`, `TypeCounts`, `Panel`). No new colours, radii or blurred shadows (they do not compile).
- Every UI string goes in `messages/en.json` and `messages/pt.json` under a new `DeckEditor` namespace.
- Zone limits: Main 40–60, Extra ≤ 15, Side ≤ 15, ≤ 3 copies of a card across all zones. Copies count by canonical id `alias ?? ruleId ?? id`.
- Card scans: `https://ygopro.online/assets/card-images/common/{id}.jpg`, always through `next/image` (no CORS on that host). `imageSizes` are `[64, 128, 256]`, `deviceSizes` `[640, 828, 1080, 1920]`.
- `localStorage`/`sessionStorage` reads and writes are wrapped in try/catch; the editor works without storage.
- Desktop layout from 1024 px (`lg:`), mobile below. Tap targets ≥ 44 px on mobile.
- Server error bodies are `{ error, message, details? }` via `HttpError` (`src/http/errors.ts`); malformed route ids answer 404, not 400.

## Review Focus

1. **Alternate artworks and "always treated as" cards share a copy limit**: 2 Dark Magician + 2 of its alt art is 4 copies. The add action, `rules.ts` and the server all count by canonical id. Tests in Tasks 1, 4, 5.
2. **A damaged `?d=` share link or code** must open the editor with "This deck link is damaged" and an unchanged/empty deck, never a crash. `DeckCodeError` tests in Task 6; browser check in Task 12.
3. **Storage unavailable** (private mode, blocked site data: `localStorage` access throws) must leave the editor fully usable. Test in Task 8.
4. **Two tabs saving the same deck** must never silently overwrite: stale `baseRevision` → `409` with the latest deck, and the client raises `DeckConflictError`. Tests in Tasks 2 and 7.
5. **A logged-out user pressing Save** must keep the draft through the Discord round trip and land back in the editor with it. Test in Task 8 (draft survives) and browser check in Task 12.

---

## File Structure

**Server (omega-server-v3)**

| File | Responsibility |
|---|---|
| `src/db/schema.ts` (modify, append) | `decks`, `deck_revisions` DDL |
| `src/modules/decks/decks.validation.ts` | Body parsing and structural rules (pure) |
| `src/modules/decks/decks.repository.ts` | All SQL for decks and revisions |
| `src/modules/decks/decks.service.ts` | Card existence/copy checks, label enrichment, DTO mapping, `DeckError` |
| `src/modules/decks/decks.routes.ts` | Fastify routes, auth, param parsing |
| `src/modules/decks/decks.test.ts` | Pure validation asserts + DB/inject flow |
| `src/app.ts` (modify) | Register `deckRoutes` at `/decks` |
| `package.json` (modify) | Append the decks test to `test` |
| `docs/front/DECKS_API.md`, `docs/POSTGRES_DB.md` (modify) | Contract and table docs |

**Front (tournament-next)**

| File | Responsibility |
|---|---|
| `utils/deck/types.ts` | `Zone`, `Deck`, `CardData`, `CardMap`, `DeckCodeError` |
| `utils/deck/model.ts` | Pure deck operations, canonical ids, game-order sort |
| `utils/deck/rules.ts` | `validate` → `Problem[]`, `pointsUsed` |
| `utils/deck/codecs/{ydk,ydke,omega,text,detect}.ts` | Import/export codecs |
| `utils/deck/*.test.ts`, `utils/deck/codecs/codecs.test.ts` | Vitest |
| `utils/cards.ts` (modify) | `poolParams`, `queryCards`, `cardsByIds` |
| `utils/decks.ts` (+ `decks.test.ts`) | Decks API client and error types |
| `utils/const.ts` (modify) | `CARD_IMAGE_URL` |
| `next.config.ts` (modify) | `remotePatterns` for `/assets/card-images/**` |
| `app/deck-editor/drafts.ts` (+ test) | Safe local draft and return-to storage |
| `app/deck-editor/deck-editor.reducer.ts` (+ test) | Editor state, undo/redo, dirty |
| `app/deck-editor/use-card-cache.ts` | Passcode → card map, filled from every fetch |
| `app/deck-editor/use-card-pool.ts` | Pool search, paging, abort |
| `app/deck-editor/page.tsx`, `[id]/page.tsx`, `deck-editor.loader.tsx` | Routes, metadata, client-only mount |
| `app/deck-editor/deck-editor.client.tsx` | Shell: wires state, cache, layout, shortcuts |
| `app/deck-editor/toolbar.tsx`, `deck-zone.tsx`, `card-tile.tsx` | Deck side |
| `app/deck-editor/card-pool.tsx`, `pool-filters.tsx`, `card-detail.tsx`, `hover-preview.tsx` | Pool side |
| `app/deck-editor/deck-tray.tsx` | Mobile tray |
| `app/deck-editor/use-save.ts`, `my-decks.tsx`, `conflict-dialog.tsx` | Persistence UI |
| `app/login/SignIn.tsx` (modify) | Honour the return-to key |
| `messages/en.json`, `messages/pt.json` (modify) | `DeckEditor` strings |

---

## Server

### Task 1: Decks schema and validation

**Files:**
- Modify: `src/db/schema.ts` (append after the wiki tables)
- Create: `src/modules/decks/decks.validation.ts`
- Create: `src/modules/decks/decks.test.ts`
- Modify: `package.json` (`test` script: append `&& tsx src/modules/decks/decks.test.ts`)

**Interfaces:**
- Produces:
  - `type Visibility = 'private' | 'unlisted' | 'public'`
  - `type DeckInput = { name: string; notes: string; format: number | null; main: number[]; extra: number[]; side: number[]; tags: Record<string, string[]>; visibility: Visibility; coverCardId: number | null }`
  - `type DeckPatch = Partial<DeckInput> & { baseRevision: number; force: boolean }`
  - `validateDeckInput(raw: unknown): DeckInput` and `validateDeckPatch(raw: unknown): DeckPatch`, both throwing `ValidationError` (from `../profile/profile.validation.js`)
  - `copyViolations(ids: readonly number[], canonical: ReadonlyMap<number, number>): number[]` — canonical ids with more than 3 copies, ascending
  - `ZONE_MAX = { main: 60, extra: 15, side: 15 } as const`, `MAX_COPIES = 3`

- [ ] **Step 1: Write the failing asserts** at the top of `decks.test.ts` (same style as `wiki.test.ts`: `import 'dotenv/config'`, `node:assert/strict`, section rules with `// ---`):

```ts
const ok = { name: ' Umbral ', main: [1, 2], extra: [], side: [] }
assert.deepEqual(validateDeckInput(ok), {
  name: 'Umbral', notes: '', format: null, main: [1, 2], extra: [], side: [],
  tags: {}, visibility: 'private', coverCardId: null,
})
assert.throws(() => validateDeckInput({ ...ok, name: '' }), /name must be/)
assert.throws(() => validateDeckInput({ ...ok, name: 'x'.repeat(81) }), /name must be/)
assert.throws(() => validateDeckInput({ ...ok, notes: 'x'.repeat(5001) }), /notes must be/)
assert.throws(() => validateDeckInput({ ...ok, main: Array(61).fill(1) }), /main must have at most 60/)
assert.throws(() => validateDeckInput({ ...ok, extra: Array(16).fill(1) }), /extra must have at most 15/)
assert.throws(() => validateDeckInput({ ...ok, side: [0] }), /side must be/)
assert.throws(() => validateDeckInput({ ...ok, main: [1.5] }), /main must be/)
assert.throws(() => validateDeckInput({ ...ok, visibility: 'secret' }), /visibility/)
assert.throws(() => validateDeckInput({ ...ok, tags: { abc: ['Starter'] } }), /tags/)
assert.throws(() => validateDeckInput({ ...ok, tags: { 1: Array(9).fill('t') } }), /tags/)
assert.throws(() => validateDeckInput({ ...ok, owner: 'x' }), /unknown fields/)
assert.deepEqual(validateDeckPatch({ name: 'B', baseRevision: 3 }), { name: 'B', baseRevision: 3, force: false })
assert.throws(() => validateDeckPatch({ baseRevision: 3 }), /at least one field/)
assert.throws(() => validateDeckPatch({ name: 'B' }), /baseRevision/)
// Zones travel together: the copy check needs the whole deck.
assert.throws(() => validateDeckPatch({ main: [1], baseRevision: 1 }), /main, extra and side/)
// Alt art 46986431 is Dark Magician 46986414.
const canon = new Map([[46986414, 46986414], [46986431, 46986414], [5, 5]])
assert.deepEqual(copyViolations([46986414, 46986414, 46986431, 46986431, 5], canon), [46986414])
assert.deepEqual(copyViolations([5, 5, 5], canon), [])
```

- [ ] **Step 2: Run, expect failure**

Run: `pnpm tsx src/modules/decks/decks.test.ts`
Expected: FAIL, cannot find module `./decks.validation.js`.

- [ ] **Step 3: Implement `decks.validation.ts`.** Rules: `name` trimmed, 1–80 chars; `notes` ≤ 5000 (default `''`); `format` integer or null; zones arrays of integers 1–2147483647 within `ZONE_MAX`; `tags` keys `^\d+$`, ≤ 8 strings each, each 1–24 chars after trim; `visibility` in the enum (default `private`); `coverCardId` positive integer or null; any other key → `unknown fields: …`. Patch: same per-field rules, `baseRevision` positive integer required, `force` boolean default false, zones all-or-none. Messages must match the regexes above.

- [ ] **Step 4: Append DDL to `schema.ts`** (inside `SCHEMA_SQL`, Portuguese comment like its neighbours):

```sql
CREATE TABLE IF NOT EXISTS decks (
  id            text PRIMARY KEY DEFAULT left(replace(gen_random_uuid()::text, '-', ''), 16)
                CHECK (id ~ '^[0-9a-f]{16}$'),
  owner_id      text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          text NOT NULL CHECK (length(name) BETWEEN 1 AND 80),
  notes         text NOT NULL DEFAULT '' CHECK (length(notes) <= 5000),
  format        integer,
  main          integer[] NOT NULL CHECK (cardinality(main) <= 60),
  extra         integer[] NOT NULL CHECK (cardinality(extra) <= 15),
  side          integer[] NOT NULL CHECK (cardinality(side) <= 15),
  tags          jsonb NOT NULL DEFAULT '{}' CHECK (jsonb_typeof(tags) = 'object'),
  visibility    text NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'unlisted', 'public')),
  cover_card_id integer,
  deck_hash     text NOT NULL,
  revision      integer NOT NULL DEFAULT 1,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS decks_owner_idx ON decks (owner_id, updated_at DESC, id);

CREATE TABLE IF NOT EXISTS deck_revisions (
  deck_id    text NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  revision   integer NOT NULL,
  name       text NOT NULL,
  notes      text NOT NULL,
  format     integer,
  main       integer[] NOT NULL,
  extra      integer[] NOT NULL,
  side       integer[] NOT NULL,
  tags       jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (deck_id, revision)
);
```

- [ ] **Step 5: Run, expect pass**

Run: `pnpm tsx src/modules/decks/decks.test.ts && pnpm exec tsc --noEmit`
Expected: no output from the asserts, tsc exits 0.

- [ ] **Step 6: Commit**

```bash
git add src/db/schema.ts src/modules/decks/decks.validation.ts src/modules/decks/decks.test.ts package.json
git commit -m "feat(decks): schema and input validation"
```

### Task 2: Decks API — CRUD, revisions, conflicts, labels

**Files:**
- Create: `src/modules/decks/decks.repository.ts`, `decks.service.ts`, `decks.routes.ts`
- Modify: `src/app.ts` (import and `await app.register(deckRoutes, { prefix: '/decks' })` next to the wiki registration)
- Modify: `src/modules/decks/decks.test.ts` (append the DB section)
- Create: `docs/front/DECKS_API.md`; Modify: `docs/POSTGRES_DB.md` (add a `decks` / `deck_revisions` section after `wiki_articles`)

**Interfaces:**
- Consumes: Task 1 exports; `requireAuth`, `optionalAuth` (`src/plugins/auth.ts`); `hashDeck` (`profile/deck.ts`); `resolveDeckLabels` (`profile/deck.labels.ts`, takes `{ cards, mainCount, hash }[]`, returns `Map<hash, { name, artCardId }>`); `HttpError`.
- Produces (HTTP, documented in `DECKS_API.md`):
  - `Deck` JSON: `{ id, ownerId, owner: { id, name }, name, notes, format, main, extra, side, tags, visibility, coverCardId, revision, createdAt, updatedAt, label: { name, artCardId } | null }`
  - `DeckSummary` JSON: `{ id, name, format, visibility, revision, updatedAt, counts: { main, extra, side }, coverCardId, label }`
  - `GET /decks/mine?cursor=` → `{ decks: DeckSummary[], nextCursor: string | null }`, 24 per page, `updated_at DESC, id`; cursor `<epochMs>_<id>`, malformed → 400
  - `POST /decks` → `201 Deck` (creates revision 1)
  - `GET /decks/:id` → owner: any visibility; others: `public`/`unlisted`, else 404
  - `PATCH /decks/:id` body `DeckPatch` → `200 Deck`; stale `baseRevision` without `force` → `409 { error: 'CONFLICT', message, details: { latest: Deck } }`
  - `DELETE /decks/:id` → 204
  - `GET /decks/:id/revisions` → `{ revisions: { revision, createdAt, counts }[] }` newest first (owner)
  - `GET /decks/:id/revisions/:rev` → `{ revision, createdAt, name, notes, format, main, extra, side, tags }` (owner)
  - `POST /decks/:id/revisions/:rev/restore` → `200 Deck` with a new revision (owner)
  - Id param not `^[0-9a-f]{16}$` → 404; rev not a positive int → 404; someone else's deck on owner routes → 404 (not 403)

- [ ] **Step 1: Append the failing DB flow to `decks.test.ts`**, set up like `shop.test.ts` (`buildApp`, `app.ready()`, `migrate()`, two duelists from `user ORDER BY lastlogin DESC LIMIT 2`, tokens via `authService.loginWithIdentity`, `origin: env.frontendUrl` header on writes, `try { … } finally { DELETE FROM decks WHERE name LIKE 'zz-test%'; app.close() }`, `process.exit(0)`). Use real passcodes `14558127` (Ash Blossom), `46986414` / `46986431` (Dark Magician and alt art), `84013237` (Number 39: Utopia, an Xyz). Asserts:

```ts
assert.equal((await inject('POST', '/decks', { name: 'zz-test anon', main: [], extra: [], side: [] }, null)).statusCode, 401)
const created = await inject('POST', '/decks', { name: 'zz-test A', main: [14558127, 14558127], extra: [84013237], side: [] }, a)
assert.equal(created.statusCode, 201)
const deck = created.json()
assert.match(deck.id, /^[0-9a-f]{16}$/)
assert.equal(deck.revision, 1)
assert.equal(deck.ownerId, duelistA)
// Unknown passcode and 4 copies counted across an alt art are 400s naming the cards.
assert.equal((await inject('POST', '/decks', { name: 'zz-test B', main: [999999999], extra: [], side: [] }, a)).json().error, 'BAD_REQUEST')
const four = await inject('POST', '/decks', { name: 'zz-test C', main: [46986414, 46986414, 46986431], extra: [], side: [46986431] }, a)
assert.equal(four.statusCode, 400)
assert.deepEqual(four.json().details, { overLimit: [46986414] })
// Visibility: private is 404 to others, unlisted opens by id.
assert.equal((await inject('GET', `/decks/${deck.id}`, undefined, b)).statusCode, 404)
assert.equal((await inject('PATCH', `/decks/${deck.id}`, { visibility: 'unlisted', baseRevision: 1 }, a)).json().revision, 2)
assert.equal((await inject('GET', `/decks/${deck.id}`, undefined, null)).statusCode, 200)
assert.equal((await inject('PATCH', `/decks/${deck.id}`, { name: 'x', baseRevision: 2 }, b)).statusCode, 404)
// Conflict: a second tab still on revision 1.
const stale = await inject('PATCH', `/decks/${deck.id}`, { name: 'zz-test stale', baseRevision: 1 }, a)
assert.equal(stale.statusCode, 409)
assert.equal(stale.json().details.latest.revision, 2)
assert.equal((await inject('PATCH', `/decks/${deck.id}`, { name: 'zz-test forced', baseRevision: 1, force: true }, a)).json().revision, 3)
// History and restore: restore writes revision 4 with revision 1's content.
assert.deepEqual((await inject('GET', `/decks/${deck.id}/revisions`, undefined, a)).json().revisions.map((r: { revision: number }) => r.revision), [3, 2, 1])
const restored = (await inject('POST', `/decks/${deck.id}/revisions/1/restore`, undefined, a)).json()
assert.equal(restored.revision, 4)
assert.equal(restored.name, 'zz-test A')
// Listing, malformed ids, delete cascades the history.
assert.equal((await inject('GET', '/decks/mine', undefined, a)).json().decks[0].id, deck.id)
assert.equal((await inject('GET', '/decks/mine?cursor=bad', undefined, a)).statusCode, 400)
assert.equal((await inject('GET', '/decks/NOT-AN-ID', undefined, a)).statusCode, 404)
assert.equal((await inject('DELETE', `/decks/${deck.id}`, undefined, a)).statusCode, 204)
assert.equal((await db.query('SELECT 1 FROM deck_revisions WHERE deck_id = $1', [deck.id])).rowCount, 0)
```

(`inject(method, url, payload, cookie)` is a 6-line local helper over `app.inject` that adds the cookie and origin headers.)

- [ ] **Step 2: Run, expect failure**

Run: `pnpm tsx src/modules/decks/decks.test.ts`
Expected: FAIL at the first `401` assert (route not found → 404).

- [ ] **Step 3: Implement the repository.** Signatures:
  - `insertDeck(ownerId: string, input: DeckInput, hash: string): Promise<DeckRow>`: one CTE that inserts the deck and revision 1.
  - `updateDeck(id: string, ownerId: string, patch: DeckPatch, hash: string | null): Promise<DeckRow | null>`: a CTE `UPDATE … SET …, revision = revision + 1, updated_at = now() WHERE id = $1 AND owner_id = $2 AND ($force OR revision = $base) RETURNING *`, then `INSERT INTO deck_revisions SELECT … FROM u`. `null` when 0 rows.
  - `findDeck(id: string): Promise<DeckRow | null>`. It joins `users.username` as `owner_name`.
  - `listMine(ownerId: string, after: { ms: number; id: string } | null, limit: number): Promise<DeckRow[]>`
  - `deleteDeck(id: string, ownerId: string): Promise<boolean>`
  - `listRevisions(id: string): Promise<RevisionRow[]>`
  - `findRevision(id: string, rev: number): Promise<RevisionRow | null>`
  - `canonicalIds(ids: number[]): Promise<Map<number, number>>`: `SELECT id, coalesce(alias, rule_code, id) FROM cards WHERE id = ANY($1)`.
  - `banlistExists(id: number): Promise<boolean>`

- [ ] **Step 4: Implement the service and routes.** `DeckError extends HttpError`. Rules for create and patch-with-zones:
  - Every passcode must be known, otherwise `400 BAD_REQUEST` with `details.unknown`.
  - `copyViolations` must return nothing, otherwise `400` with `details.overLimit`.
  - A `format` that isn't in `banlists` is a `400`.
  - At most 500 decks per owner, otherwise `400` "You can have at most 500 decks.".
  - `deck_hash = hashDeck([...main, ...extra])`.
  - When `updateDeck` returns `null`, re-read the deck. A missing deck or another owner → `404`. Otherwise → `409` with `details.latest`.

  Labels: map each row to `{ cards: [...main, ...extra, ...side], mainCount: main.length + extra.length, hash: deck_hash }` and resolve the whole page with one `resolveDeckLabels` call. Responses send `cache-control: private, no-cache`. Restore reads the revision and runs it through the same update path with `force: true`.

- [ ] **Step 5: Run, expect pass**

Run: `pnpm tsx src/modules/decks/decks.test.ts && pnpm exec tsc --noEmit`
Expected: the script prints `decks ok` (add that `console.log` at the end of the `try`), tsc exits 0.

- [ ] **Step 6: Write `docs/front/DECKS_API.md`** (same structure as `CARDS_API.md`: base URL, auth, errors, each route with request/response JSON, the 409 flow, the 500-deck cap) and the `POSTGRES_DB.md` section (columns, revision semantics, why ids are random).

- [ ] **Step 7: Commit**

```bash
git add src/modules/decks src/app.ts docs/front/DECKS_API.md docs/POSTGRES_DB.md
git commit -m "feat(decks): owner CRUD, revisions, conflict detection and labels"
```

---

## Front — deck core

### Task 3: Card scans, pool query and card lookups

**Files:**
- Modify: `utils/const.ts` (add `CARD_IMAGE_URL` next to `CARD_ART_URL`)
- Modify: `next.config.ts` (`remotePatterns`: `{ protocol: "https", hostname: "ygopro.online", pathname: "/assets/card-images/**" }`)
- Modify: `utils/cards.ts`
- Create: `utils/cards.test.ts`

**Interfaces:**
- Consumes: `WikiCard`, `CardKind` (`utils/wiki.ts`), `API_URL`.
- Produces:
  - `CARD_IMAGE_URL(id: number | string): string`
  - `type PoolQuery = { text: string; textMode: 'name' | 'text'; kind: CardKind[]; extraDeck?: boolean; attribute: string[]; archetype?: string; types: string[]; race: string[]; levelMin?: number; levelMax?: number; atkMin?: number; atkMax?: number; defMin?: number; defMax?: number; scaleMin?: number; scaleMax?: number; linkMarkers: string[]; banlist?: number; legalOnly: boolean; status: string[]; pointsMin?: number; pointsMax?: number; sort: 'name' | 'atk' | 'def' | 'level' | 'released_tcg' | 'released_ocg'; order: 'asc' | 'desc' }`
  - `EMPTY_POOL_QUERY: PoolQuery` (text `''`, textMode `'name'`, arrays empty, legalOnly `true`, sort `'name'`, order `'asc'`)
  - `POOL_PAGE = 60`
  - `poolParams(query: PoolQuery, page: number): URLSearchParams`
  - `queryCards(query: PoolQuery, page: number, signal?: AbortSignal): Promise<{ cards: WikiCard[]; total: number }>`
  - `cardsByIds(ids: readonly number[], signal?: AbortSignal): Promise<Map<number, WikiCard>>`. It's keyed by the passcode asked for (`idSearched`), uses chunks of 100, and skips unknown ids.

- [ ] **Step 1: Write failing tests** in `utils/cards.test.ts`:

```ts
it('maps the query onto the API parameters, omitting empty ones', () => {
  expect(poolParams({ ...EMPTY_POOL_QUERY, text: 'ash', kind: ['monster'], banlist: 2 }, 1).toString())
    .toBe('fname=ash&kind=monster&banlist=2&legal=true&sort=name&order=asc&page=1&limit=60')
  expect(poolParams({ ...EMPTY_POOL_QUERY, text: 'draw 2', textMode: 'text' }, 3).get('q')).toBe('draw 2')
  // legal and status mean nothing without a banlist: the API would 400.
  expect(poolParams({ ...EMPTY_POOL_QUERY, status: ['limited'] }, 1).has('legal')).toBe(false)
  expect(poolParams({ ...EMPTY_POOL_QUERY, status: ['limited'] }, 1).has('status')).toBe(false)
  expect(poolParams({ ...EMPTY_POOL_QUERY, types: ['synchro', 'tuner'], levelMin: 0 }, 1).get('types')).toBe('synchro,tuner')
})
it('keys looked-up cards by the passcode asked for, so alt arts resolve', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ cards: [{ idSearched: 46986431, id: 46986414, name: 'Dark Magician' }], total: 1 })))
  const map = await cardsByIds([46986431])
  expect(map.get(46986431)?.id).toBe(46986414)
  vi.unstubAllGlobals()
})
```

- [ ] **Step 2: Run, expect failure.** Run `pnpm vitest run utils/cards.test.ts`. It should fail with `poolParams is not a function`.
- [ ] **Step 3: Implement** the three functions and the constant URL. Parameter order follows `PoolQuery`'s key order. `levelMin: 0` is sent; `undefined` is not.
- [ ] **Step 4: Run, expect pass.** Run `pnpm vitest run utils/cards.test.ts`. It should pass.
- [ ] **Step 5: Commit**

```bash
git add utils/const.ts next.config.ts utils/cards.ts utils/cards.test.ts
git commit -m "feat(deck-editor): card scan URL, pool query and lookups"
```

### Task 4: Deck model

**Files:**
- Create: `utils/deck/types.ts`, `utils/deck/model.ts`, `utils/deck/model.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  - `type Zone = 'main' | 'extra' | 'side'`
  - `type Deck = { main: number[]; extra: number[]; side: number[] }`
  - `EMPTY_DECK: Deck`
  - `type CardData = WikiCard`
  - `type CardMap = ReadonlyMap<number, CardData>`
  - `class DeckCodeError extends Error {}`
  - `ZONE_MAX = { main: 60, extra: 15, side: 15 }`, `MAIN_MIN = 40`, `MAX_COPIES = 3`
- Produces (`model.ts`):
  - `isExtraDeckCard(card: CardData): boolean`: `monsterTypes` includes `fusion`, `synchro`, `xyz` or `link`.
  - `canonicalId(card: CardData): number`: `alias ?? ruleId ?? id`.
  - `copiesOf(deck: Deck, card: CardData, cards: CardMap): number`. It counts every deck passcode whose canonical id matches. A passcode missing from `cards` counts as itself.
  - `type AddResult = { deck: Deck; rejected: null | 'copies' | 'full' | 'zone' }`
  - `addCard(deck: Deck, card: CardData, cards: CardMap, zone?: Zone): AddResult`. With no zone, extra-deck cards go to Extra and the rest to Main. `'zone'` means an extra-deck card aimed at Main or a main-deck card aimed at Extra.
  - `removeCard(deck: Deck, zone: Zone, id: number): Deck`: removes the last copy of `id`.
  - `moveCard(deck: Deck, from: Zone, id: number, to: Zone, cards: CardMap): AddResult`
  - `reorder(deck: Deck, zone: Zone, from: number, to: number): Deck`
  - `sortZone(ids: readonly number[], cards: CardMap): number[]`
  - `splitExtra(ids: readonly number[], cards: CardMap): { main: number[]; extra: number[] }`

- [ ] **Step 1: Write failing tests.** Start with a `card(id, patch)` helper that casts a minimal object to `CardData`, as `utils/wiki.test.ts` does. Fixtures:
  - `ash`: effect monster, level 3.
  - `dm`: normal monster, level 7.
  - `dmAlt`: alias `dm.id`.
  - `harpie2`: `ruleId` of `harpie`.
  - `utopia`: `monsterTypes: ['xyz','effect']`.
  - `pot`: spell. `imperm`: trap. `big`: effect, level 8. `plain`: normal, level 4.

```ts
const cards = new Map([ash, dm, dmAlt, harpie, harpie2, utopia, pot, imperm, big, plain].map((c) => [c.id, c]))
it('routes extra-deck monsters to Extra unless a zone is given', () => {
  expect(addCard(EMPTY_DECK, utopia, cards).deck.extra).toEqual([utopia.id])
  expect(addCard(EMPTY_DECK, utopia, cards, 'side').deck.side).toEqual([utopia.id])
})
it('rejects a card in the wrong zone', () => {
  expect(addCard(EMPTY_DECK, utopia, cards, 'main').rejected).toBe('zone')
  expect(addCard(EMPTY_DECK, ash, cards, 'extra').rejected).toBe('zone')
})
it('counts alternate artworks and always-treated-as cards as one card', () => {
  const deck = { main: [dm.id, dm.id], extra: [], side: [dmAlt.id] }
  expect(copiesOf(deck, dmAlt, cards)).toBe(3)
  expect(addCard(deck, dm, cards).rejected).toBe('copies')
  expect(addCard(deck, dm, cards).deck).toBe(deck)
  expect(copiesOf({ main: [harpie.id, harpie2.id], extra: [], side: [] }, harpie, cards)).toBe(2)
})
it('rejects a full zone', () => {
  expect(addCard({ ...EMPTY_DECK, main: Array(60).fill(pot.id) }, ash, cards).rejected).toBe('full')
})
it('removes the last copy only', () => {
  expect(removeCard({ main: [ash.id, pot.id, ash.id], extra: [], side: [] }, 'main', ash.id).main).toEqual([ash.id, pot.id])
})
it('moves between zones and keeps order inside a zone', () => {
  expect(moveCard({ main: [ash.id], extra: [], side: [] }, 'main', ash.id, 'side', cards).deck).toEqual({ main: [], extra: [], side: [ash.id] })
  expect(reorder({ main: [1, 2, 3], extra: [], side: [] }, 'main', 0, 2).main).toEqual([2, 3, 1])
})
it('sorts in game order: monsters by frame then level desc then name, spells, traps', () => {
  expect(sortZone([imperm.id, pot.id, ash.id, big.id, plain.id], cards)).toEqual([plain.id, big.id, ash.id, pot.id, imperm.id])
})
it('splits a combined main+extra list by card type', () => {
  expect(splitExtra([ash.id, utopia.id], cards)).toEqual({ main: [ash.id], extra: [utopia.id] })
})
```

- [ ] **Step 2: Run, expect failure.** Run `pnpm vitest run utils/deck/model.test.ts`. It should fail with "module not found".
- [ ] **Step 3: Implement.** Every function returns new arrays and never mutates its inputs. Frame order for `sortZone` is `normal, effect, ritual, fusion, synchro, xyz, link`. A monster's frame is the first of `ritual, fusion, synchro, xyz, link` found in `monsterTypes`. Otherwise it's `normal` when `monsterTypes` includes `normal`, and `effect` when it doesn't. Unknown passcodes sort last.
- [ ] **Step 4: Run, expect pass.** Run `pnpm vitest run utils/deck/model.test.ts`. It should pass.
- [ ] **Step 5: Commit.** Run `git add utils/deck/types.ts utils/deck/model.ts utils/deck/model.test.ts && git commit -m "feat(deck-editor): deck model"`.

### Task 5: Validation rules

**Files:**
- Create: `utils/deck/rules.ts`, `utils/deck/rules.test.ts`

**Interfaces:**
- Consumes: Task 4; `Banlist` (`utils/wiki.ts`)
- Produces:
  - `type ProblemCode = 'main-size' | 'extra-size' | 'side-size' | 'copies' | 'forbidden' | 'limited' | 'semi-limited' | 'points' | 'banned-type' | 'unreleased' | 'unknown-card'`
  - `type Problem = { code: ProblemCode; cardId?: number; count?: number; limit?: number }`
  - `validate(deck: Deck, cards: CardMap, banlist: Banlist | null, today: string): Problem[]`. `today` is `YYYY-MM-DD`, passed in so validation stays pure.
  - `pointsUsed(deck: Deck, cards: CardMap, banlist: Banlist): number`
  - `cardStatus(card: CardData, banlist: Banlist): { copies: 0 | 1 | 2 | 3 } | { points: number }`. A card absent from `card.banlists` for that list (matched by `name`) is `{ copies: 3 }` on a normal list and `{ points: 0 }` on a Genesys one (`pointCap !== null`).

- [ ] **Step 1: Write failing tests.** Lists:
  - `tcg = { id: 2, name: 'TCG 18.05.2026', format: 'tcg', pointCap: null, bannedTypes: [], cards: 0 }`
  - `gen = { id: 100, name: 'Genesys', format: 'genesys', pointCap: 100, bannedTypes: ['pendulum', 'link'], cards: 0 }`

  Fixtures:
  - `filler`: 40 distinct passcodes of a released spell.
  - `banned`: `banlists: [{ name: 'TCG 18.05.2026', limitation: 0 }]`.
  - `lim`: limitation 1.
  - `pts60`: `[{ name: 'Genesys', limitation: 60 }]`.
  - `linkMon`: `monsterTypes: ['link','effect']`.
  - `future`: `released: { tcg: '2027-01-01', ocg: null }`.

  Tests, with each problem list compared using `toEqual`:
  - `validate(EMPTY_DECK, …, tcg, '2026-10-16')` → `[{ code: 'main-size', count: 0, limit: 40 }]`
  - 40 filler, no banlist → `[]`
  - 40 filler + 16 side → `[{ code: 'side-size', count: 16, limit: 15 }]`
  - filler + `banned` → contains `{ code: 'forbidden', cardId: banned.id }`
  - 2× `lim` → contains `{ code: 'limited', cardId: lim.id, count: 2, limit: 1 }`
  - 2× `pts60` on `gen` → contains `{ code: 'points', count: 120, limit: 100 }`, and `pointsUsed` = 120
  - `linkMon` in extra on `gen` → contains `{ code: 'banned-type', cardId: linkMon.id }`
  - `future` on `tcg` with today `2026-10-16` → contains `{ code: 'unreleased', cardId: future.id }`. The same card on an OCG list (released.ocg null) is also unreleased. On `wcs` the date isn't checked.
  - 2 dm + 2 dmAlt → contains `{ code: 'copies', cardId: dm.id, count: 4, limit: 3 }` (imports can exceed what `addCard` allows)
  - a passcode missing from `cards` → `{ code: 'unknown-card', cardId }`
  - Each card problem is reported once per canonical card, not once per copy.

- [ ] **Step 2: Run, expect failure.** Run `pnpm vitest run utils/deck/rules.test.ts`.
- [ ] **Step 3: Implement.** Problems come in this order: zone sizes (main, extra, side), then card problems in deck order. Region rules: `tcg` and `genesys` use `released.tcg`; `ocg` and `genesys_ocg` use `released.ocg`; `wcs` skips the check. A card is unreleased when the date is null or later than `today`. Banned types are checked against `card.monsterTypes`.
- [ ] **Step 4: Run, expect pass.**
- [ ] **Step 5: Commit.** Run `git add utils/deck/rules.ts utils/deck/rules.test.ts && git commit -m "feat(deck-editor): banlist and zone validation"`.

### Task 6: Codecs

**Files:**
- Create: `utils/deck/codecs/ydk.ts`, `ydke.ts`, `omega.ts`, `text.ts`, `detect.ts`, `codecs.test.ts`

**Interfaces:**
- Consumes: `Deck`, `CardMap`, `DeckCodeError`, `ZONE_MAX` (Task 4); `YGOProDeck` default export of `ygopro-deck-encode`.
- Produces:
  - `toYdk(deck: Deck): string`; `fromYdk(text: string): Deck`
  - `toYdke(deck: Deck): string`; `fromYdke(url: string): Deck`
  - `toOmega(deck: Deck): Promise<string>`; `fromOmega(code: string): Promise<{ main: number[]; side: number[] }>`. Here `main` is main and extra together, in stored order. Callers use `splitExtra`.
  - `toText(deck: Deck, cards: CardMap): string`; `fromText(text: string): { zone: Zone; qty: number; name: string }[]`
  - `type DeckFormat = 'ydke' | 'ydk' | 'omega' | 'text'`; `detectFormat(text: string): DeckFormat`
  - Every `from*` throws `DeckCodeError` on input it can't read, or when a zone is over `ZONE_MAX` (main is checked against 60 + 15 for Omega).

- [ ] **Step 1: Write failing tests**

```ts
const deck: Deck = { main: [14558127, 14558127, 46986414], extra: [84013237], side: [24224830] }
it('round-trips ydk, ydke and Omega codes', async () => {
  expect(fromYdk(toYdk(deck))).toEqual(deck)
  expect(fromYdke(toYdke(deck))).toEqual(deck)
  expect(await fromOmega(await toOmega(deck))).toEqual({ main: [14558127, 14558127, 46986414, 84013237], side: [24224830] })
})
it('writes the Omega layout: main+extra count, side count, uint32 LE passcodes', async () => {
  const raw = new Uint8Array(await new Response(new Blob([Uint8Array.from(atob(await toOmega(deck)), (c) => c.charCodeAt(0))]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer())
  expect([raw[0], raw[1], raw.length]).toEqual([4, 1, 2 + 4 * 5])
  expect(new DataView(raw.buffer).getUint32(2, true)).toBe(14558127)
})
it('reads ydk with CRLF and comments', () => {
  expect(fromYdk('#created by x\r\n#main\r\n14558127\r\n#extra\r\n84013237\r\n!side\r\n')).toEqual({ main: [14558127], extra: [84013237], side: [] })
})
it('throws DeckCodeError on damaged codes', async () => {
  expect(() => fromYdke('ydke://not-base64!!')).toThrow(DeckCodeError)
  await expect(fromOmega('AAAA')).rejects.toThrow(DeckCodeError)
  expect(() => fromYdk('#main\n' + '1\n'.repeat(61))).toThrow(DeckCodeError)
})
it('writes and reads the text list', () => {
  const names = new Map([[14558127, 'Ash Blossom & Joyous Spring'], [46986414, 'Dark Magician'], [84013237, 'Number 39: Utopia'], [24224830, 'Called by the Grave']].map(([id, name]) => [id, { id, name } as CardData]))
  expect(toText(deck, names)).toBe('Main Deck\n2 Ash Blossom & Joyous Spring\n1 Dark Magician\n\nExtra Deck\n1 Number 39: Utopia\n\nSide Deck\n1 Called by the Grave\n')
  expect(fromText('Main:\n3x Ash Blossom & Joyous Spring\nPot of Greed\nExtra Deck\n1 Number 39: Utopia')).toEqual([
    { zone: 'main', qty: 3, name: 'Ash Blossom & Joyous Spring' },
    { zone: 'main', qty: 1, name: 'Pot of Greed' },
    { zone: 'extra', qty: 1, name: 'Number 39: Utopia' },
  ])
})
it('detects the format of pasted text', () => {
  expect(detectFormat('ydke://abc!def!ghi!')).toBe('ydke')
  expect(detectFormat('#created by\n#main\n1')).toBe('ydk')
  expect(detectFormat('  #main\n1')).toBe('ydk')
  expect(detectFormat('7Vi7SgNBFL2zSUyCRbQQLWwsLCwsLBQLC8HCxk/wEyws/AMbP0LbtLCwsLCwsBAsLBQRwSJGTMhkdmZ3Z2fP7MzOJsQkkMDl3Hvuuffc2b1oACgFAIVCoaASlUqlUCgUigVSqWTkcrmSyWQikUgkEolEIpFIJBKJRCKRSCQSCcrLy8vLy8vL')).toBe('omega')
  expect(detectFormat('3 Ash Blossom & Joyous Spring')).toBe('text')
})
```

- [ ] **Step 2: Run, expect failure.** Run `pnpm vitest run utils/deck/codecs`.
- [ ] **Step 3: Implement.**
  - `ydk`/`ydke` wrap `YGOProDeck`, catching any throw as `DeckCodeError`. `toYdk` emits `#created by Duelists Unite Hub` first.
  - `omega` uses `CompressionStream('deflate-raw')` and standard base64, and inflates with `DecompressionStream`. After inflating it checks that the length is at least `2 + 4 * count`, as the server's `decodeDeck` does.
  - `text` groups copies by passcode in first-seen order. It writes no Extra/Side header when that zone is empty. On import, headers match `/^(main|extra|side)( deck)?:?$/i`, quantity lines match `/^(\d+)\s*x?\s+(.+)$/i`, a bare name means quantity 1, and lines before any header go to Main.
  - `detect` checks in order: `ydke://` prefix; a trimmed text containing a line starting with `#main`; one line of `^[A-Za-z0-9+/=]{12,}$` with no spaces; otherwise text.
- [ ] **Step 4: Run, expect pass.**
- [ ] **Step 5: Commit.** Run `git add utils/deck/codecs && git commit -m "feat(deck-editor): ydk, ydke, Omega and text codecs"`.

### Task 7: Decks API client

**Files:**
- Create: `utils/decks.ts`, `utils/decks.test.ts`

**Interfaces:**
- Consumes: the Task 2 HTTP contract; `API_URL`.
- Produces:
  - `type Visibility = 'private' | 'unlisted' | 'public'`
  - `type SavedDeck` (fields as the `Deck` JSON in Task 2); `type DeckSummary`; `type DeckInput = { name: string; notes?: string; format: number | null; main: number[]; extra: number[]; side: number[]; tags?: Record<string, string[]>; visibility?: Visibility; coverCardId?: number | null }`
  - `class DeckApiError extends Error { status: number; code?: string; details?: Record<string, unknown> }`
  - `class DeckConflictError extends DeckApiError { latest: SavedDeck }`
  - `listMyDecks(cursor?: string): Promise<{ decks: DeckSummary[]; nextCursor: string | null }>`
  - `getDeck(id: string, cookie?: string | null): Promise<SavedDeck | null>`, which returns `null` on 404
  - `createDeck(input: DeckInput): Promise<SavedDeck>`
  - `updateDeck(id: string, input: Partial<DeckInput>, baseRevision: number, force?: boolean): Promise<SavedDeck>`
  - `deleteDeck(id: string): Promise<void>`
  - `listRevisions(id: string)`, `getRevision(id: string, rev: number)`, `restoreRevision(id: string, rev: number): Promise<SavedDeck>`
  - All calls use `credentials: 'include'` and `cache: 'no-store'`, with the same `request` helper shape as `utils/explorations.ts`.

- [ ] **Step 1: Write failing tests.** Stub `fetch` with `vi.stubGlobal`. A `409` with `{ error: 'CONFLICT', details: { latest: { id: 'a', revision: 5 } } }` makes `updateDeck('a', { name: 'x' }, 4)` reject with a `DeckConflictError` whose `latest.revision` is 5. A `401` rejects with `DeckApiError` status 401. `getDeck` with 404 returns `null`. The body of `updateDeck` is `{"name":"x","baseRevision":4,"force":false}`.
- [ ] **Step 2: Run, expect failure.** Run `pnpm vitest run utils/decks.test.ts`.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run, expect pass.**
- [ ] **Step 5: Commit.** Run `git add utils/decks.ts utils/decks.test.ts && git commit -m "feat(deck-editor): decks API client"`.

---

## Front — editor

### Task 8: Editor state and drafts

**Files:**
- Create: `app/deck-editor/deck-editor.reducer.ts`, `deck-editor.reducer.test.ts`, `drafts.ts`, `drafts.test.ts`

**Interfaces:**
- Consumes: Task 4 (`addCard`, `removeCard`, `moveCard`, `reorder`, `sortZone`).
- Produces:
  - `type ViewMode = 'grid' | 'list' | 'stacked'`
  - `type EditorState = { deck: Deck; past: Deck[]; future: Deck[]; name: string; format: number | null; deckId: string | null; revision: number | null; dirty: boolean; lastAdded: number[]; rejected: { cardId: number; reason: 'copies' | 'full' | 'zone' } | null }`
  - The `EditorAction` union:
    - `{ type: 'add'; card: CardData; cards: CardMap; zone?: Zone }`
    - `{ type: 'remove'; zone: Zone; id: number }`
    - `{ type: 'move'; from: Zone; id: number; to: Zone; cards: CardMap }`
    - `{ type: 'reorder'; zone: Zone; from: number; to: number }`
    - `{ type: 'sort'; cards: CardMap }`
    - `{ type: 'undo' }`, `{ type: 'redo' }`
    - `{ type: 'rename'; name: string }`, `{ type: 'format'; format: number | null }`
    - `{ type: 'load'; deck: Deck; name: string; format: number | null; deckId: string | null; revision: number | null; dirty?: boolean }`
    - `{ type: 'saved'; deckId: string; revision: number }`
  - `initialEditorState(): EditorState` (name `'New deck'` comes from the caller's translation, so `load` sets it); `editorReducer(state: EditorState, action: EditorAction): EditorState`; `HISTORY_LIMIT = 100`; `LAST_ADDED = 5`
  - `type Draft = { deck: Deck; name: string; format: number | null; revision: number | null; at: number }`
  - `draftKey(deckId: string | null): string`, which returns `deck-draft:<id>` or `deck-draft:new`
  - `readDraft(key: string): Draft | null`, `writeDraft(key: string, draft: Draft): void`, `clearDraft(key: string): void`
  - `setReturnTo(path: string): void`, `takeReturnTo(): string | null` (sessionStorage key `return-to`; it only accepts paths starting with `/` and not `//`)

- [ ] **Step 1: Write failing reducer tests:**
  - `add` pushes the previous deck onto `past`, clears `future`, sets `dirty`, and prepends to `lastAdded` (capped at 5).
  - `undo` restores the previous deck and `redo` reapplies it.
  - A rejected add leaves `deck`, `past` and `dirty` unchanged and sets `rejected`. The next successful action clears `rejected`.
  - 101 adds leave `past.length === 100`.
  - `rename`/`format` set `dirty` and do not touch the deck history.
  - `load` resets `past`/`future`/`lastAdded` and sets `dirty` from the action (default `false`).
  - `saved` sets `deckId`/`revision` and `dirty: false`.
- [ ] **Step 2: Write failing drafts tests:**
  - Write then read round-trips.
  - A malformed JSON value reads as `null`.
  - With `vi.stubGlobal('localStorage', { getItem() { throw new Error('denied') }, setItem() { throw new Error('denied') }, removeItem() { throw new Error('denied') } })`, `readDraft` returns `null`, and `writeDraft`/`clearDraft` don't throw.
  - `setReturnTo('//evil.test')` then `takeReturnTo()` returns `null`.
  - `setReturnTo('/deck-editor')` then `takeReturnTo()` returns `'/deck-editor'` once and `null` after that.
  - Use a `Map`-backed stub for the happy path, since Vitest runs in node.
- [ ] **Step 3: Run, expect failure.** Run `pnpm vitest run app/deck-editor`.
- [ ] **Step 4: Implement.** `readDraft` validates the shape (three number arrays, a string name) before returning it.
- [ ] **Step 5: Run, expect pass.**
- [ ] **Step 6: Commit.** Run `git add app/deck-editor/deck-editor.reducer.ts app/deck-editor/deck-editor.reducer.test.ts app/deck-editor/drafts.ts app/deck-editor/drafts.test.ts && git commit -m "feat(deck-editor): editor state, undo/redo and drafts"`.

### Task 9: Editor shell, routes and deck zones (desktop)

**Files:**
- Modify: `app/deck-editor/page.tsx`
- Create: `app/deck-editor/[id]/page.tsx`, `deck-editor.loader.tsx`, `deck-editor.client.tsx`, `toolbar.tsx`, `deck-zone.tsx`, `card-tile.tsx`, `use-card-cache.ts`
- Modify: `messages/en.json`, `messages/pt.json`

**Interfaces:**
- Consumes: Tasks 3–8, `getBanlists` (`utils/wiki.ts`), `TypeCounts`, `Segmented`, `Select`, `Button`, `Icon`.
- Produces:
  - `DeckEditor({ deckId }: { deckId: string | null })` (default export of `deck-editor.client.tsx`). `deck-editor.loader.tsx` is `'use client'` and mounts it with `next/dynamic(..., { ssr: false })`, so drafts can be read in a `useState` initializer without hydration mismatches.
  - `useCardCache(): { cards: CardMap; remember(list: Iterable<CardData>): void; ensure(ids: readonly number[]): Promise<void> }`. `ensure` fetches missing ids with `cardsByIds` and stores each card under the asked passcode. The map identity changes on every `remember`/`ensure` that adds something, so memoized consumers rerender.
  - `CardTile` props: `{ id: number; card?: CardData; sizes: string; count?: number; dots?: number; status?: 'forbidden' | 'limited' | 'semi-limited' | { points: number }; problem?: boolean; onClick?(): void; onContextMenu?(e): void; draggable?: boolean; onDragStart?(e): void; className?: string }`. It renders the `CARD_IMAGE_URL` scan via `next/image` with aspect ratio 59:86. A missing `card`, or an image `onError`, renders a frame-colour placeholder (`--color-type-*`) with the card name or passcode.
  - `DeckZone` props: `{ zone: Zone; ids: number[]; cards: CardMap; view: ViewMode; problems: ReadonlySet<number>; onRemove(id: number): void; onDropCard(payload: DragPayload, index?: number): void; onOpen(id: number): void }`
  - `type DragPayload = { from: Zone | 'pool'; id: number; index?: number }`, sent through `dataTransfer` type `application/x-deck-card`.

- [ ] **Step 1: Pages.**
  - `page.tsx` is a server component with `metadata` (title "Deck Editor", description from `DeckEditor.meta`). It renders `<DeckEditorLoader deckId={null} />`.
  - `[id]/page.tsx` awaits `params` and renders `<DeckEditorLoader deckId={id} />`.
- [ ] **Step 2: Shell.**
  - `deck-editor.client.tsx` owns `useReducer(editorReducer, …)`. Its initializer reads `readDraft(draftKey(deckId))` and then `?d=`:
    - `?d=` is parsed with `fromYdke`.
    - A `DeckCodeError` sets a `notice` state to `t('damagedLink')`.
    - When the URL has `?d=`, it wins over the draft.
  - Effects (no setState inside them):
    - Debounced 500 ms `writeDraft`.
    - `ensure` all deck ids when the deck changes.
    - Load banlists into state through `getBanlists().then(setBanlists)` in a promise callback.
  - The selected `format` defaults to the TCG list (`format === 'tcg'`).
  - `problems = validate(deck, cards, banlist, today)`, where `today` is computed once in the `useState` initializer.
  - Layout:
    - `lg:grid lg:grid-cols-[minmax(0,62fr)_minmax(0,38fr)]`.
    - The deck column scrolls on its own: `lg:h-[calc(100dvh-var(--header-h,64px))] lg:overflow-y-auto`.
    - The pool slot stays empty until Task 10.
- [ ] **Step 3: Toolbar.** It has:
  - An inline-editable name (`TextInput`).
  - A format `Select` (`banlist` styling flag).
  - A validity pill: `t('legal')` or `t('problems', { count })`, which opens a popover listing problems with links that scroll to the card.
  - On a Genesys list, a points meter `pointsUsed / pointCap`: gold under the cap, crimson-lift over it.
  - Undo and redo, disabled-looking but still focusable when there's no history.
  - Sort.
  - A view `Segmented` (grid/list/stacked), remembered under the `localStorage` key `deck-view` through try/catch.
  - A Save `Button` with a dirty dot. Its handler arrives in Task 12; render it as a no-op for now.
  - Every label comes from `DeckEditor.toolbar.*`.
- [ ] **Step 4: Zones.** Each `DeckZone` shows:
  - A `SectionHead`-style header with the zone name, count, and `TypeCounts` for that zone. Card types map to `TypeCounts`' `CardType` through the frame from `sortZone`'s rule; spells and traps are `spell`/`trap`.
  - **Grid:** 10 columns for Main, 15 for Extra and Side on `lg`.
  - **List:** rows of name, type and level, with − and +.
  - **Stacked:** unique cards with a ×N badge.
  - Problem cards get `outline outline-2 outline-crimson-lift`.
  - Drop targets highlight with `bg-ground-cyan`.
- [ ] **Step 5: Strings.** Add `DeckEditor` to both message files: `meta`, `toolbar.*`, `zones.{main,extra,side}`, `views.*`, `legal`, `problems` (ICU plural), one message per `ProblemCode`, `damagedLink`, `rejected.{copies,full,zone}` (with `{name}`), `newDeck`.
- [ ] **Step 6: Verify.**
  - Run `pnpm exec tsc --noEmit && pnpm lint`; it should exit 0.
  - In the browser (dev server on 5173), open `http://localhost:5173/deck-editor?d=` followed by the `toYdke` of the Task 6 fixture deck (generate it once with `pnpm vitest` or by hand). It should show:
    - 3 Main, 1 Extra and 1 Side scans.
    - `TypeCounts` per zone.
    - The validity pill reading 1 problem (main size).
    - Working view toggles.
  - `?d=ydke://broken` should show the damaged-link notice and an empty deck. Use DOM checks (`read_page`) rather than screenshots.
- [ ] **Step 7: Commit.** Run `git add app/deck-editor messages/en.json messages/pt.json && git commit -m "feat(deck-editor): editor shell, toolbar and deck zones"`.

### Task 10: Card pool, filters, hover preview and detail sheet

**Files:**
- Create: `app/deck-editor/use-card-pool.ts`, `card-pool.tsx`, `pool-filters.tsx`, `hover-preview.tsx`, `card-detail.tsx`
- Modify: `app/deck-editor/deck-editor.client.tsx`, `messages/en.json`, `messages/pt.json`

**Interfaces:**
- Consumes: `queryCards`, `EMPTY_POOL_QUERY`, `POOL_PAGE` (Task 3); `copiesOf`, `canonicalId`, `cardStatus`; `useCardCache().remember`; `findArchetypes` (`utils/cards.ts`); `Dialog`, `SearchField`, `FilterChip`, `Switch`, `Select`.
- Produces:
  - `useCardPool(query: PoolQuery): { cards: CardData[]; total: number; loading: boolean; error: boolean; more(): void; retry(): void }`. It debounces text by 250 ms, aborts the previous request when the query changes, and appends pages.
  - `CardPool` props: `{ deck: Deck; cards: CardMap; banlist: Banlist | null; onAdd(card: CardData, zone?: Zone): void; onOpen(card: CardData): void }`
  - `CardDetail` props: `{ card: CardData | null; deck: Deck; cards: CardMap; banlists: Banlist[]; onClose(): void; onAdd(card: CardData, zone: Zone): void; onRemove(id: number, zone: Zone): void }`

- [ ] **Step 1: Pool.**
  - Top: a `SearchField` plus a name/card-text `Segmented`.
  - Quick chips: Monster, Spell, Trap, Extra (`extraDeck=true`), plus the 7 attributes as `FilterChip`s.
  - Sort `Select`, a "Only legal in format" `Switch` (sent as `banlist` + `legal` only when a format is selected), and a Filters button.
  - Results: a 4-column grid on `lg` of `CardTile`s, with `dots = copiesOf(...)` and `status` from `cardStatus` (copies 0/1/2 → `forbidden`/`limited`/`semi-limited`, 3 → none; points > 0 → `{ points }`, 0 → none).
  - Infinite scroll uses an `IntersectionObserver` sentinel that calls `more()`.
  - Errors show an inline `Notice` with Retry. A result count shows above the grid.
  - Every page of results is passed to `remember`.
- [ ] **Step 2: Filters drawer.** A right-side drawer (`animate-drawer-in`, scrim `bg-scrim`) with:
  - An archetype lookup (`findArchetypes`, debounced).
  - A `types` multi-select (all-of; labelled so).
  - Race and attribute multi-select.
  - Level/ATK/DEF/scale min–max numeric inputs.
  - A link-arrow picker: a 3×3 grid of toggles with the centre disabled.
  - Release window date inputs, enabled only with a format selected.
  - Status chips on normal lists, points min/max on Genesys lists.
  - Reset and Done buttons. The active filter count shows on the Filters button.
- [ ] **Step 3: Interactions.**
  - Click a pool tile → `onAdd(card)`.
  - Right-click or Shift+click → `onAdd(card, 'side')`, with `preventDefault` on `contextmenu`.
  - Pool tiles are `draggable` with `{ from: 'pool', id }`.
  - The shell's `onAdd` dispatches `add`. On `rejected`, it shakes the tile (`animate-[shake_200ms]`, keyframes added to `app/styles.css` `@theme` next to `blink`) and writes `t('rejected.*')` to an `aria-live="polite"` region.
  - The live region also announces counts after every change, e.g. "Main 38, Extra 15, Side 12".
- [ ] **Step 4: Hover preview.**
  - Only under `matchMedia('(hover: hover) and (pointer: fine)')`, after a 300 ms delay.
  - A floating panel (`shadow-lift`, `bg-surface-200`) with the 640 px scan, name, type line, stats (`atk === -2` → `?`; never DEF on Link) and description. It's placed to whichever side of the card has room.
- [ ] **Step 5: Detail sheet.** A `Dialog` with:
  - The scan, name, PT/JP names, type line, stats and full description.
  - Erratas, collapsed.
  - A banlist table with every list and its status (`cardStatus`).
  - An alt-art strip: thumbnails of `[canonical, ...alternateArts]`. Selecting one makes the − / + buttons act on that passcode.
  - − / count / + rows for Main-or-Extra and Side.
  - Opens on Enter or double-click from a pool or deck tile.
- [ ] **Step 6: Keyboard.** In the shell:
  - `/` focuses search.
  - Arrow keys move focus across tiles; the pool grid uses a roving `tabIndex`.
  - `+` / `-` / `s` act on the focused tile.
  - `Ctrl+Z` / `Ctrl+Y` / `Ctrl+Shift+Z` undo and redo.
  - Shortcuts are ignored while typing in an input.
- [ ] **Step 7: Verify.**
  - Run `pnpm exec tsc --noEmit && pnpm lint`.
  - Browser checks:
    - Search "ash" → results load.
    - Clicking Ash Blossom 4 times leaves 3 in Main, and the live region reads the copies message.
    - Shift+click adds to Side.
    - Filters → Xyz + Rank 4 returns only Xyz monsters.
    - Toggling legal-only with Genesys selected hides Link monsters.
    - Ctrl+Z undoes the last add.
    - The detail sheet opens on double-click and its + adds the selected alt art.
- [ ] **Step 8: Commit.** Run `git add app/deck-editor app/styles.css messages/en.json messages/pt.json && git commit -m "feat(deck-editor): card pool, filters, preview and detail sheet"`.

### Task 11: Mobile layout and deck tray

**Files:**
- Create: `app/deck-editor/deck-tray.tsx`
- Modify: `app/deck-editor/deck-editor.client.tsx`, `card-pool.tsx`, `deck-zone.tsx`, `messages/*.json`

**Interfaces:**
- Consumes: shell state; `TabBar`; `DeckZone`.
- Produces: `DeckTray` props `{ state: EditorState; cards: CardMap; problems: Problem[]; view: ViewMode; onRemove(zone: Zone, id: number): void; onOpen(id: number): void; toolbar: React.ReactNode }`

- [ ] **Step 1: Layout below `lg`.**
  - The pool fills the viewport, with the search and chips row `sticky top-0`. The grid is 3 columns at 375 px and 4 at ≥ 600 px.
  - Filters open as a full-height sheet instead of the side drawer.
  - The desktop deck column and toolbar are hidden (`max-lg:hidden`).
  - The pool gets bottom padding equal to the tray's peek height.
- [ ] **Step 2: Tray.**
  - Fixed to the bottom, `bg-surface-200`, with a top hairline and the panel chamfer.
  - The peek row (64 px) has a drag handle, `Main n · Extra n · Side n`, a validity flag, and the last 5 added as 32 px thumbnails.
  - It opens to `85dvh` on tap, or on a pointer drag up of more than 48 px. It closes on drag down, on the handle, or with Escape.
  - When open it shows a `TabBar` (Main, Extra, Side) over a `DeckZone` in list view, plus the toolbar actions in a ⋯ menu (Save, Sort, Undo, Redo, Format, View).
  - Pointer events on the handle drive the drag. No animation library: a CSS `transform` transition, removed under reduced motion.
- [ ] **Step 3: Touch interactions.**
  - Tap a pool tile → detail sheet (not add).
  - Long-press (450 ms, cancelled by more than 10 px of movement) → add 1, plus `navigator.vibrate?.(10)`.
  - In tray list rows, a swipe left of more than 64 px reveals and commits −1. Each row also keeps a visible − button for accessibility.
  - Every control is at least 44 px.
- [ ] **Step 4: Verify.**
  - Run `pnpm exec tsc --noEmit && pnpm lint`.
  - In the browser, `resize_window` to the mobile preset (375×812) and reload. Check that:
    - The pool shows 3 columns.
    - Tapping a card opens the detail sheet, and its + updates the tray counts.
    - The tray opens and its Main tab lists the card.
    - The − button removes it.
    - The page has no horizontal scroll (`document.documentElement.scrollWidth === 375`).
  - Reset to `desktop` afterwards.
- [ ] **Step 5: Commit.** Run `git add app/deck-editor messages/en.json messages/pt.json && git commit -m "feat(deck-editor): mobile pool and deck tray"`.

### Task 12: Save, load, My decks and sign-in return

**Files:**
- Create: `app/deck-editor/use-save.ts`, `my-decks.tsx`, `conflict-dialog.tsx`
- Modify: `app/deck-editor/deck-editor.client.tsx`, `toolbar.tsx`, `deck-tray.tsx`, `app/login/SignIn.tsx`, `messages/*.json`

**Interfaces:**
- Consumes: Task 7 (`createDeck`, `updateDeck`, `getDeck`, `listMyDecks`, `deleteDeck`, `DeckConflictError`, `DeckApiError`); Task 8 (`readDraft`, `writeDraft`, `clearDraft`, `draftKey`, `setReturnTo`, `takeReturnTo`); `useAuth`.
- Produces: `useSave(state: EditorState, dispatch): { save(force?: boolean): Promise<void>; saving: boolean; conflict: SavedDeck | null; resolveConflict(choice: 'load' | 'overwrite'): void; error: string | null }`

- [ ] **Step 1: Loading a saved deck.** When `deckId` is set, `getDeck(deckId).then(...)` runs in an effect-started promise. Outcomes:
  - Not the owner, or `null`: `router.replace('/deck-editor')` with a notice.
  - A local draft for this id that is newer than the deck's `updatedAt` and has a different `revision` or content: an inline `Notice` offers "Restore draft" or "Discard".
  - Otherwise: dispatch `load`.
- [ ] **Step 2: Save.** `save()` branches on the user:
  - **No user:** `writeDraft(draftKey(deckId), …)`, then `setReturnTo(location.pathname + location.search)`, then `router.push('/login')`.
  - **No `deckId`:** `createDeck`, then `dispatch('saved')`, `clearDraft('deck-draft:new')`, and `router.replace('/deck-editor/<id>')`.
  - **Otherwise:** `updateDeck(id, content, revision, force)`.

  Failure handling:
  - `DeckConflictError` → `conflict` → `ConflictDialog` ("Load latest" dispatches `load` with `latest`; "Save mine anyway" calls `save(true)`).
  - Other errors → `error` shows a toast with Retry. The draft stays local.

  Shortcuts and guards:
  - `Ctrl+S` calls `save`.
  - A `beforeunload` listener is active while `dirty && deckId !== null` (server changes unsaved).
- [ ] **Step 3: Sign-in return.** In `SignIn.tsx`, replace `router.replace('/welcome')` with `router.replace(takeReturnTo() ?? '/welcome')`.
- [ ] **Step 4: My decks.** A `Dialog` (desktop) or sheet (mobile) opened from the toolbar's ⋯. It lists `listMyDecks()` with label art, name, counts, visibility and relative `updatedAt`, with a cursor "Load more". Actions:
  - Open → `router.push('/deck-editor/<id>')`.
  - New → `load` with an empty deck, then `router.push('/deck-editor')`.
  - Delete with a confirm `Dialog`, then remove the row.

  Logged out, it shows a sign-in prompt instead.
- [ ] **Step 5: Verify.**
  - Run `pnpm exec tsc --noEmit && pnpm lint && pnpm vitest run`; all should pass.
  - Browser, logged in:
    - Build 3 cards and Save. The URL becomes `/deck-editor/<16 hex>` and the dirty dot clears.
    - Rename and save; check the revision bump with `read_network_requests`.
    - Open the same deck in a second tab, save there, then save in the first tab. The conflict dialog appears, and "Load latest" shows the other tab's name.
    - My decks lists the deck; Delete removes it.
  - Browser, logged out (new private context if available, otherwise sign out):
    - Add cards and Save. You should land on `/login`, with `sessionStorage['return-to']` set to `/deck-editor` and the draft still in `localStorage`.
    - Go back to `/deck-editor`; the draft is restored.
- [ ] **Step 6: Commit.** Run `git add app/deck-editor app/login/SignIn.tsx messages/en.json messages/pt.json && git commit -m "feat(deck-editor): save, load, conflicts and My decks"`.

---

## Done when

- `pnpm tsx src/modules/decks/decks.test.ts` prints `decks ok` (server).
- `pnpm exec tsc --noEmit`, `pnpm lint` and `pnpm vitest run` pass (front).
- The Task 9–12 browser checks pass at 1280 px and 375 px.
- Next plans: phase 2 (import/export hub, share image, KONAMI PDF), phase 3 (analysis), phase 4 (history UI, `legal` badges, `GET /decks`, `/decks` pages, OG image).
