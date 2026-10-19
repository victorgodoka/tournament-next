# Combo Simulator — Sub-project 2 (Saved Combos and Share Links) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Signed-in players save the simulator's line as a titled combo, keep updating it under one link, list and delete their combos, and share a link that anyone can watch in a read-only player and take into their own simulator.

**Architecture:**
- **Server:** a `combos` table, a pure validator that rebuilds the payload field by field, and five routes in the deck module's pattern.
- **Front:** a `utils/combos.ts` API client, plus `Session` growing `deckId` and `combo` (draft v2). The simulator gets Save / Save as new / Share / My combos. The player lives at `/simulator/c/[id]`, sharing the replay logic extracted from the simulator.
- **Validation:** the server checks shape and limits; the front replays the log (`parseSession`) on open (approach A).

**Tech Stack:** Server: Fastify 5, `pg`, `node:assert` test scripts run by `tsx`. Front: Next 16 / React 19 / Tailwind 4 / next-intl / Vitest + happy-dom.

**Spec:** `docs/superpowers/specs/2026-10-19-combo-sharing-design.md` (tournament-next). Read it with this plan.

**Decisions made while planning** (the spec leaves these open):

1. **`Session` gains `deckId: string | null`.** It is set from the picked saved deck (`build.deckId`) and from a valid `?deck=` on boot, and sent as the combo's `deckId`. The spec's `deck_id` needs the session to know its deck; sub-project 1 had left it out.
2. **`SavedRef` carries the title:** `{ id, title, revision, saved }`, so Save can `PATCH` without asking for the title again.
3. **The server keeps `deckId` only when that deck belongs to the saver;** any other value is stored as `null`. In practice only the saver's own decks reach the simulator with an id.
4. **`PATCH` replaces the whole combo** (`title`, `deckId`, `payload`) plus `baseRevision`. It is never a partial update.
5. **409 `CONFLICT` details are `{ revision: current }`.** The client's conflict dialog offers "Reload the saved one" (a `GET`, then load) or "Save as new".
6. **`PATCH` on a combo deleted elsewhere returns 404.** The client then drops the tie (`combo: null`) and opens the Save dialog as a first save.
7. **`combos.db.test.ts` is not in the `test` script,** like `decks.db.test.ts`: it writes to the Postgres in `.env`. Its run is a manual step guarded by a host check.
8. **The replay logic is extracted to `app/simulator/use-replay.ts`.** The simulator and the player share it instead of duplicating it.

## Global Constraints

- **Server repo:**
  - worktree `C:\Users\marti\Documents\omega-server-v3\.claude\worktrees\omega-combo-simulator-38b366`, branch `claude/omega-combo-simulator-38b366` (level with `main`);
  - ESM imports end in `.js`;
  - tests are `node:assert/strict` scripts run with `pnpm exec tsx <file>`, and the pure ones go in the `test` script of `package.json`;
  - check with `pnpm exec tsc --noEmit`;
  - messages and comments follow the module's style (Portuguese comments are fine, as in `decks.*`).
- **Front repo:**
  - worktree `C:\Users\marti\Documents\tournament-next\.claude\worktrees\combo-sharing`, branch `claude/combo-sharing` (from `main` 97158c6);
  - check with `pnpm exec tsc --noEmit`, `pnpm exec eslint <touched paths>` and `pnpm vitest run <paths>`; never `next build`.
- **Install:** neither worktree has `node_modules` yet. Run `pnpm install --frozen-lockfile` in each before its first task.
- **Commits:** stage only the files the task touched (`git add <paths>`), with no `Co-Authored-By` or "Generated with" lines. Edit files with the Edit/Write tools, not `sed -i`.
- **React:** lint treats impure render and set-state-in-effect as errors; derive during render or set state in handlers and timers.
- **Front strings:** every UI string goes in `messages/en.json` and `messages/pt.json` under `Simulator`; tap targets are ≥ 44 px below `lg` (`TOUCH`).
- **Limits (spec):**
  - title 1–80 (trimmed), deck name ≤ 80;
  - ≤ 2000 actions, `note` ≤ 100, `draw.n` 1..60, `counter.delta` −99..99 non-zero;
  - `targets`/`order` ≤ main+extra in-range ids;
  - body ≤ 256 KB (`bodyLimit: 262144`);
  - 500 combos per user (409 `LIMIT`), 24 per page.
- **Responses:**
  - owner routes send `cache-control: private, no-cache`, and `GET /combos/:id` sends `public, max-age=60`;
  - an unknown or malformed id, or another user's combo on `PATCH`/`DELETE`, is 404.
- **Share link format:** `${location.origin}/simulator/c/<id>`.

## Review Focus

1. **A second tab saving the same combo** must get the conflict dialog, never overwrite silently. Test: Task 5 (409 shows `combos.conflict.title`).
2. **Deleting the combo the session is tied to, then Save,** must create a new combo, not `PATCH` a 404. Test: Task 6 (delete the tied one, Save opens the title dialog). Task 5 also covers a `PATCH` that answers 404.
3. **A draft written before this release (v1)** must still open, with `combo: null` and `deckId: null`. Test: Task 3 (`parseSession` of a v1 payload).
4. **A tampered payload** (a card id beyond the deck, an unknown action, a 101-character note) must be refused by the server and shown as damaged by the player. Tests: Task 1 (validator) and Task 7 (damaged state).
5. **A signed-out viewer opening a link,** then Operate from here, must land in the simulator with the line up to that step. Test: Task 7 (Operate from here writes the draft with `actions.slice(0, k)` and `start = min(start, k)`).

---

## Server (`omega-server-v3`)

### Task 1: Combo validation

**Files:**
- Create: `src/modules/combos/combos.validation.ts`
- Test: `src/modules/combos/combos.test.ts` (added to the `test` script in `package.json`)

**Interfaces:**
- Consumes: `HttpError` (`src/http/errors.ts`); `ZONE_MAX`, `parseCursor` (`src/modules/decks/decks.validation.ts`).
- Produces:
  - `class ComboError extends HttpError {}`
  - `type ComboPayload = { deck: { main: number[]; extra: number[]; side: number[] }; name: string; actions: ComboAction[]; start: number }`, where `ComboAction` is the eight-kind union of the front's `Action` (`utils/simulator/types.ts`), `note` included.
  - `type ComboInput = { title: string; deckId: string | null; payload: ComboPayload }`
  - `validateComboInput(raw: unknown): ComboInput` and `validateComboPatch(raw: unknown): ComboInput & { baseRevision: number }`. Both throw `ComboError(400, 'BAD_REQUEST', message)`.
  - `isComboId(raw: string): boolean` (`^[0-9a-f]{16}$`)
  - `MAX_COMBOS = 500`, `PAGE_SIZE = 24`, `BODY_LIMIT = 262144`

- [ ] **Step 1: Write the failing test script** (`node:assert/strict`, the style of `decks.test.ts`), with a fixture deck `{ main: [1..10], extra: [20, 21], side: [] }` (ids 0..11 valid):

```ts
assert.deepEqual(validateComboInput(ok), { title: 'Line', deckId: null, payload: { deck, name: 'Deck', actions: [shuffle, draw5, move], start: 2 } })
// each throws /…/:
//   title '' and 'x'.repeat(81) (after trim); deckId 'XYZ'; unknown top-level field; payload not an object
//   deck main of 61; extra of 16; a passcode 0 or 1.5; name of 81
//   actions of 2001; t 'summon'; card 12 (out of range); zone 'm9'; at 'middle'; draw n 0 and 61;
//   counter delta 0 and 100; targets of 13 ids; note of 101 chars; note 42; start 4 with 3 actions
assert.equal(validateComboInput({ ...ok, payload: { ...payload, actions: [{ ...move, extra: 1 }] } }).payload.actions[0], move) // unknown action fields dropped
assert.deepEqual(validateComboPatch({ ...ok, baseRevision: 3 }).baseRevision, 3)
// validateComboPatch throws without baseRevision, and with 0 or 1.5
assert.equal(isComboId('0123456789abcdef'), true); assert.equal(isComboId('0123'), false)
```

- [ ] **Step 2: Run it and see it fail**

Run: `pnpm exec tsx src/modules/combos/combos.test.ts`
Expected: FAIL, the module is not found.

- [ ] **Step 3: Implement `combos.validation.ts`**

Rebuild every action from known fields only, mirroring `parseAction` in the front's `utils/simulator/draft.ts`. The 18 zone names are `deck hand extra gy banished m0 m1 m2 m3 m4 emz0 emz1 s0 s1 s2 s3 s4 field`. A card id is an integer in `0..main.length+extra.length-1`, and a passcode an integer in `1..2147483647`.

- [ ] **Step 4: Run it and see it pass**

Run: `pnpm exec tsx src/modules/combos/combos.test.ts` and `pnpm exec tsc --noEmit`
Expected: no assertion error, no type error.

- [ ] **Step 5: Commit**

```bash
git add src/modules/combos/combos.validation.ts src/modules/combos/combos.test.ts package.json
git commit -m "feat(combos): payload validation"
```

---

### Task 2: Table, repository, service and routes

**Files:**
- Modify: `src/db/schema.ts` (after the `decks` block), `src/app.ts` (register under `/combos`)
- Create: `src/modules/combos/combos.repository.ts`, `combos.service.ts`, `combos.routes.ts`
- Test: `src/modules/combos/combos.db.test.ts` (NOT in the `test` script)

**Interfaces:**
- Consumes: Task 1; `requireAuth`, `optionalAuth` (`src/plugins/auth.ts`); `rateLimitOptions` (`src/http/rate-limit.ts`); `db` (`src/db/index.ts`).
- Produces the HTTP contract the front uses:

| Route | Body | 2xx | Errors |
|---|---|---|---|
| `POST /combos` | `ComboInput` | 201 `{ id, revision }` | 400, 401, 409 `LIMIT` |
| `PATCH /combos/:id` | `ComboInput & { baseRevision }` | 200 `{ id, revision }` | 400, 401, 404, 409 `CONFLICT` with `details: { revision }` |
| `DELETE /combos/:id` | — | 204 | 401, 404 |
| `GET /combos/mine?cursor=` | — | 200 `{ combos: { id, title, deckName, steps, updatedAt }[], nextCursor: string \| null }` | 401 |
| `GET /combos/:id` | — | 200 `{ id, title, deckId, owner: { id, name }, payload, revision, updatedAt }` | 404 |

- [ ] **Step 1: Write the DB test script** in the style of `decks.db.test.ts`: `buildApp`, `migrate`, two logins, `inject`, and clean up `zz-test` rows in `finally`. It asserts:
  - an anonymous `POST` gives 401;
  - `POST` gives 201 with a 16-hex `id` and `revision` 1;
  - `GET` without a cookie gives 200 with the same `payload`, `cache-control: public, max-age=60`, and the owner's name;
  - `PATCH` by B gives 404;
  - `PATCH` by A with `baseRevision: 1` gives `revision` 2, and again with 1 gives 409 `CONFLICT` with `details.revision === 2`;
  - `/mine` for A lists it with `deckName` and `steps`, and `/mine` for B does not;
  - `deckId` of B's deck saved by A reads back `null`;
  - a body over 256 KB gives 413;
  - `DELETE` by B gives 404, then by A gives 204, and `GET` then gives 404;
  - a malformed id gives 404.
- [ ] **Step 2: Add the table** to `schema.ts` exactly as in the spec ("Table"), named `combos`, with `combos_owner_idx`.
- [ ] **Step 3: Implement repository, service and routes** following `decks.*`:
  - `insertCombo`, `updateCombo` (`WHERE id AND owner_id AND revision = baseRevision`, `revision + 1`, `updated_at = now()`, returning `id`/`revision`), `deleteCombo`, `findCombo` (joined with the owner's name), `listMine(ownerId, after, limit)` (selecting `payload->>'name'` and `steps`, never the whole payload), and `countCombos`;
  - the service maps 0 updated rows to 404 when the combo is not the user's, else to 409 with the current revision;
  - routes are registered with `rateLimitOptions(60)` and `bodyLimit: BODY_LIMIT` on `POST`/`PATCH`, and the cursor reuses `parseCursor` and `${ms}_${id}`.
- [ ] **Step 4: Run the DB test against a local Postgres only.** Copy `.env` from `C:\Users\marti\Documents\omega-server-v3\.env` into the worktree. Check its Postgres host is `localhost`/`127.0.0.1`/a docker service name, never a remote host; if it is remote, skip the run and report. Then run `pnpm exec tsx src/modules/combos/combos.db.test.ts`, `pnpm test` and `pnpm exec tsc --noEmit`.
  Expected: no assertion error, the full `test` script passes, no type error. Delete the copied `.env` afterwards (it is git-ignored, but it does not belong in the worktree).
- [ ] **Step 5: Commit**

```bash
git add src/db/schema.ts src/app.ts src/modules/combos/combos.repository.ts src/modules/combos/combos.service.ts src/modules/combos/combos.routes.ts src/modules/combos/combos.db.test.ts
git commit -m "feat(combos): table and routes to save, list, read and delete combos"
```

---

## Front (`tournament-next`)

### Task 3: Session ties and draft v2

**Files:**
- Modify: `utils/simulator/types.ts`, `session.ts`, `draft.ts`, `app/simulator/boot.ts`, `app/simulator/simulator.client.tsx` (pass `deckId` on load)
- Create: `utils/simulator/combo.ts`
- Test: `utils/simulator/session.test.ts`, `draft.test.ts`, `combo.test.ts`, `app/simulator/boot.test.ts`

**Interfaces:**
- Produces:
  - in `types.ts`: `type ComboPayload = { deck: Deck; name: string; actions: Action[]; start: number }` and `type SavedRef = { id: string; title: string; revision: number; saved: string }`. `Session` gains `deckId: string | null` and `combo: SavedRef | null`.
  - `SessionEvent`: `load` gains `deckId: string | null`; new `{ type: 'saved'; combo: SavedRef | null }` (sets or clears the tie); new `{ type: 'open'; session: Session }` (replaces the whole session). `load`, `reset` and `open` behave as the spec says (`load`/`reset` clear `combo`).
  - `combo.ts`:
    - `payloadOf(s: Session): ComboPayload`
    - `hashPayload(p: ComboPayload): string`: FNV-1a 32-bit of `JSON.stringify(p)`, 8 hex chars
    - `sessionOf(p: ComboPayload, combo: SavedRef | null, deckId: string | null): Session | null`: `parseSession` at `cursor = actions.length`, `null` when damaged
    - `operateFrom(p: ComboPayload, k: number): Session`: `actions.slice(0, k)`, `cursor = k`, `start = min(p.start, k)`, `combo: null`, `deckId: null`
  - Draft writes `v: 2`. `parseSession` reads `v: 1` as `deckId: null, combo: null`, and in `v: 2` checks `deckId` (16-hex or null) and `combo` (null, or a 16-hex `id`, a title of 1–80, `revision` an integer ≥ 1, `saved` matching `^[0-9a-f]{8}$`).
  - `bootSession` sets `deckId` from a valid `?deck=`.

- [ ] **Step 1: Write the failing tests:**
  - **session:** `saved` sets and clears `combo`; `open` replaces the session; `load` and `reset` clear `combo`; `load` keeps the given `deckId`.
  - **draft:**
    - a v2 round trip with `combo` and `deckId`;
    - a v1 payload reads with both `null` (Review Focus 3);
    - a v2 payload with `combo.saved` `'xyz'` → `null`, and with `deckId` `'nope'` → `null`.
  - **combo:**
    - `hashPayload` is stable, and changes when a caption changes;
    - `operateFrom(p, 2)` on `start: 3` gives `start: 2`, 2 actions and `cursor` 2;
    - `sessionOf` of a payload whose second action is invalid at its step → `null`.
  - **boot:** `?d=…&deck=0123456789abcdef` gives `deckId` that id, and `&deck=bad` gives `null`.
- [ ] **Step 2: Run them and see them fail**

Run: `pnpm vitest run utils/simulator app/simulator/boot.test.ts`
Expected: FAIL on the new tests.

- [ ] **Step 3: Implement the four modules,** and in `simulator.client.tsx` pass `deckId: build.deckId` in the picker's `load`.
- [ ] **Step 4: Run them and see them pass**

Run: `pnpm vitest run utils/simulator app/simulator`, `pnpm exec tsc --noEmit`, `pnpm exec eslint utils/simulator app/simulator`
Expected: PASS (existing tests updated only where `emptySession()` now has `deckId: null, combo: null`).

- [ ] **Step 5: Commit**

```bash
git add utils/simulator app/simulator/boot.ts app/simulator/boot.test.ts app/simulator/simulator.client.tsx
git commit -m "feat(simulator): sessions remember their deck and saved combo (draft v2)"
```

---

### Task 4: API client

**Files:**
- Create: `utils/combos.ts`
- Test: `utils/combos.test.ts`

**Interfaces:**
- Consumes: `API_URL` (`utils/auth.ts`); `ComboPayload` (Task 3).
- Produces:
  - `type ComboInput = { title: string; deckId: string | null; payload: ComboPayload }`
  - `type ComboSummary = { id: string; title: string; deckName: string; steps: number; updatedAt: string }`
  - `type SharedCombo = { id: string; title: string; deckId: string | null; owner: { id: string; name: string }; payload: ComboPayload; revision: number; updatedAt: string }`
  - `saveCombo(input) → Promise<{ id: string; revision: number }>`; `updateCombo(id, input, baseRevision) → Promise<{ id: string; revision: number }>`; `deleteCombo(id) → Promise<void>`; `listMyCombos(cursor?) → Promise<{ combos: ComboSummary[]; nextCursor: string | null }>`; `getCombo(id) → Promise<SharedCombo | null>` (404 → `null`)
  - `class ComboApiError extends Error { status; code? }`; `class ComboConflictError extends ComboApiError { revision: number }` (409 `CONFLICT`)
  - `comboUrl(id: string): string` = `${location.origin}/simulator/c/${id}`

- [ ] **Step 1: Write the failing tests** with `fetch` stubbed:
  - each function's method, path, body and `credentials: 'include'`;
  - 404 on `getCombo` → `null`;
  - 409 `CONFLICT` → `ComboConflictError` with `revision` from `details`;
  - 409 `LIMIT` → `ComboApiError` with code `LIMIT`;
  - 204 → `undefined`.
- [ ] **Step 2: Run them and see them fail** (`pnpm vitest run utils/combos.test.ts`).
- [ ] **Step 3: Implement `utils/combos.ts`** in the pattern of `utils/decks.ts` (`request`, `json`).
- [ ] **Step 4: Run them and see them pass** (`pnpm vitest run utils/combos.test.ts`, `pnpm exec tsc --noEmit`, `pnpm exec eslint utils/combos.ts`).
- [ ] **Step 5: Commit**

```bash
git add utils/combos.ts utils/combos.test.ts
git commit -m "feat(simulator): combos API client"
```

---

### Task 5: Save, Save as new, conflict and Share

**Files:**
- Create: `app/simulator/save-dialog.tsx`
- Modify: `app/simulator/simulator.client.tsx`, `toolbar.tsx`, `messages/en.json`, `messages/pt.json`
- Test: `app/simulator/simulator.client.test.tsx`

**Interfaces:**
- Consumes: Tasks 3–4; `useAuth` (`@hooks/index`); `setReturnTo` (`@utils/return-to`).
- Produces:
  - `SaveDialog` props: `{ open: boolean; initialTitle: string; busy: boolean; onClose(): void; onSave(title: string, asNew: boolean): void }`;
  - toolbar buttons `toolbar.save` (with an unsaved dot when `hashPayload(payloadOf(session)) !== session.combo?.saved`), `toolbar.myCombos` (Task 6) and `toolbar.share`.

- [ ] **Step 1: Write the failing client tests** (`@utils/combos` mocked):
  - signed out, Save shows `combos.signIn` with a `/login` link and saves nothing;
  - first Save opens the dialog with the deck name prefilled; confirming calls `saveCombo` with `{ title, deckId, payload }`, and a second Save after a step calls `updateCombo(id, input, 1)` without a dialog;
  - Save as new always calls `saveCombo`;
  - `updateCombo` rejecting with `ComboConflictError` shows `combos.conflict.title`. "Reload" calls `getCombo` and loads it; "Save as new" calls `saveCombo` (Review Focus 1);
  - `updateCombo` rejecting with 404 opens the title dialog, and confirming calls `saveCombo` (decision 6);
  - Share on an unsaved session saves first, then writes `comboUrl(id)` to the clipboard (stubbed); a clipboard failure shows the link in a read-only field;
  - 409 `LIMIT` shows `combos.limit`, and a 400 shows `combos.saveFailed`.
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement** `SaveDialog` (`Dialog`, a `TextInput` of 1–80 characters, buttons `combos.save` and `combos.saveAsNew`) and wire it into the client. Successful saves dispatch `saved` with `saved: hashPayload(payload)`. Network errors show an `Alert` with Retry, and the session stays unchanged.
- [ ] **Step 4: Run them and see them pass** (`pnpm vitest run app/simulator utils`, tsc, eslint on `app/simulator`).
- [ ] **Step 5: Commit**

```bash
git add app/simulator/save-dialog.tsx app/simulator/simulator.client.tsx app/simulator/toolbar.tsx app/simulator/simulator.client.test.tsx messages/en.json messages/pt.json
git commit -m "feat(simulator): save combos, save as new, conflicts and share links"
```

---

### Task 6: My combos

**Files:**
- Create: `app/simulator/my-combos.tsx`
- Modify: `app/simulator/simulator.client.tsx`, `messages/en.json`, `messages/pt.json`
- Test: `app/simulator/simulator.client.test.tsx`

**Interfaces:**
- Consumes: `listMyCombos`, `getCombo`, `deleteCombo` (Task 4); `sessionOf`, `hashPayload` (Task 3).
- Produces: `MyCombos` with props `{ open: boolean; onClose(): void; onOpen(combo: SharedCombo): void; onDeleted(id: string): void }`. It is a `Dialog` listing title, `deckName`, `steps` and the relative date, with Load more and per-row Open and Delete (Delete asks to confirm).

- [ ] **Step 1: Write the failing tests:**
  - the list renders two summaries, and Load more fetches with `nextCursor`;
  - Open loads the combo: hand and history match, and Save then updates it (`updateCombo`);
  - Open while the session has actions asks `confirm.title` first;
  - deleting the tied combo, then Save, opens the title dialog and calls `saveCombo` (Review Focus 2);
  - a damaged combo (`sessionOf` → `null`) shows `combos.damaged` and loads nothing.
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement `MyCombos`** and wire it in. `onOpen` dispatches `open` with `sessionOf(payload, { id, title, revision, saved: hashPayload(payload) }, deckId)`, and `onDeleted` of the tied id dispatches `saved` with `null`.
- [ ] **Step 4: Run them and see them pass.**
- [ ] **Step 5: Commit**

```bash
git add app/simulator/my-combos.tsx app/simulator/simulator.client.tsx app/simulator/simulator.client.test.tsx messages/en.json messages/pt.json
git commit -m "feat(simulator): my combos list to open and delete saved combos"
```

---

### Task 7: Shared player

**Files:**
- Create: `app/simulator/use-replay.ts`, `app/simulator/c/[id]/page.tsx`, `app/simulator/c/[id]/combo-player.loader.tsx`, `app/simulator/combo-player.tsx`
- Modify: `app/simulator/simulator.client.tsx` (use `useReplay`), `messages/en.json`, `messages/pt.json`
- Test: `app/simulator/combo-player.test.tsx`

**Interfaces:**
- Consumes: Tasks 3–4; `BoardView`, `ReplayBar`, `History`, `CardPanel`, `useDrag`, `timeline`, `sessionReducer`.
- Produces:
  - `useReplay(p: { session: Session; boards: Board[]; dispatch: React.Dispatch<SessionEvent>; onShow(card: number): void })` returning `{ playing; speed; setSpeed; toggle(); step(to: number); go(to: number) }`. It is moved out of `simulator.client.tsx` unchanged in behaviour (per-action times, panel follows the step), and the simulator's existing replay tests must pass untouched.
  - `page.tsx`: `generateMetadata` fetches `${API_URL}/combos/${id}` with `{ next: { revalidate: 60 } }`. Title is `"<title> — Combo Simulator"`, the description names the deck and the step count, and it returns `noIndex: true`. On any failure it falls back to the simulator's generic metadata.
  - `ComboPlayer` with props `{ id: string }`:
    - states `player.loading`, `player.notFound`, `player.damaged`, and `player.failed` with Retry;
    - a read-only board: `useDrag({ enabled: false })`, menus never open, and a click shows the card panel;
    - the replay bar, the caption as text, and the history;
    - a 3 s countdown (`player.autoplay`, Cancel, `player.playNow`), then playback from `start`;
    - **Operate from here** (`player.operate`) writes `operateFrom(payload, cursor)` to the draft and pushes `/simulator`, after a confirm when the stored draft has actions;
    - **Edit** (owner only, `player.edit`) writes `sessionOf(payload, ref, deckId)` and pushes `/simulator`.

- [ ] **Step 1: Write the failing tests** (`getCombo`, `next/navigation` and `@hooks/index` mocked):
  - not found: `getCombo` → `null` shows `player.notFound`;
  - damaged: a payload with an action invalid at its step shows `player.damaged` (Review Focus 4);
  - autoplay: a valid combo shows the title, `player.autoplay` counts down, and after 3000 ms (fake timers) the bar shows `replay.pause` and the cursor is at `start`;
  - Cancel stops the countdown;
  - Operate from here at step `k` writes a draft whose `actions` length is `k`, with `start = min(start, k)` and `combo` null, and pushes `/simulator` (Review Focus 5);
  - Edit shows only for the owner.
- [ ] **Step 2: Run them and see them fail.**
- [ ] **Step 3: Implement `useReplay`** (moving the client's code) and **the page, loader and player.** Run `pnpm vitest run app/simulator` after the move and before building the player: the simulator suite must stay green.
- [ ] **Step 4: Run them and see them pass** (`pnpm vitest run app/simulator utils`, tsc, eslint on `app/simulator`).
- [ ] **Step 5: Commit**

```bash
git add app/simulator/use-replay.ts app/simulator/simulator.client.tsx "app/simulator/c/[id]/page.tsx" "app/simulator/c/[id]/combo-player.loader.tsx" app/simulator/combo-player.tsx app/simulator/combo-player.test.tsx messages/en.json messages/pt.json
git commit -m "feat(simulator): shared combo player with autoplay and operate from here"
```

---

### Task 8: End-to-end browser check

**Files:** none (a fix found here goes in the owning task's file with its test).

- [ ] **Step 1: Run every suite:**
  - server: `pnpm test` and `pnpm exec tsc --noEmit`;
  - front: `pnpm vitest run`, `pnpm exec tsc --noEmit`, `pnpm exec eslint app/simulator utils`.
- [ ] **Step 2: Start the server branch.** Use port 3001 (`PORT=3001`) with the main checkout's `.env` copied in after the same host check as Task 2. Start the front on 5174 with the temporary `next.config.ts` rewrite `/api-proxy/:path*` → `http://localhost:3001/:path*` and a `.env.development.local` of `NEXT_PUBLIC_API_URL=http://localhost:5174/api-proxy`, both reverted at the end.
- [ ] **Step 3: Walk the flow:**
  - sign in through the proxy (or note that the session cookie cannot cross the proxy and verify signed-out paths only);
  - build a line with a caption, Save, change a step, see the unsaved dot, Save again;
  - Share and open the copied link in a second tab, signed out;
  - autoplay, Operate from here at a middle step, and check the simulator shows that line;
  - My combos: open and delete.
  Expected: every step behaves as the spec says, with no console errors.
- [ ] **Step 4: Revert the temporary files and stop both servers.** `git status --short` must be clean in both worktrees.
