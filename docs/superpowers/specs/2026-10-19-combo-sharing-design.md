# Combo simulator: saved combos and share links — design

Date: 2026-10-19
Status: approved in brainstorming, awaiting spec review
Repos: `omega-server-v3` (table, validation, routes) and `tournament-next` (save UI, My combos, shared player).
Builds on: `2026-10-19-combo-simulator-design.md` (sub-project 1) and the replay bar, chosen hands and captions merged
after it. This is sub-project 2 of that spec's roadmap.

## Goal

A signed-in player saves the line on the simulator as a combo with a title, keeps editing it under the same link, and
shares that link. Anyone with the link watches it in a read-only player and can take the line, up to the step on
screen, into their own simulator.

## Decisions

| Topic | Decision |
|---|---|
| Who saves | Signed-in users only (`requireAuth`) |
| Who opens a link | Anyone with it. Unlisted: no listing shows another user's combos |
| Saving again | Updates the same combo and link; "Save as new" makes a copy with its own link |
| Conflicts | `revision` like decks: a save based on an older revision gets 409 and the client offers reload or save as new |
| Finding your combos | "My combos" in the simulator: a list (title, deck name, updated) to open or delete |
| The link | `/simulator/c/<id>`: read-only player, auto-play after a countdown, "Operate from here", Discord preview |
| Validation | Approach A: the server checks shape and limits; the client replays the log (`parseSession`) on open |
| Tie to a deck | `deck_id` stored when the session came from a saved deck; used later by sub-project 4 |
| Out of scope | Deck page "Combos" tab (4), wiki embed (3), public gallery, comments, likes |

## What a combo holds

The shared payload is the session minus the cursor:

```ts
type ComboPayload = {
  deck: Deck            // main, extra, side
  name: string          // the deck's name, ≤ 80
  actions: Action[]     // ≤ 2000, each may carry `note` ≤ 100
  start: number         // where the replay starts, 0..actions.length
}
```

The draft keeps where the session was saved: `Session` gains `combo: { id: string; revision: number; saved: string } | null`,
where `saved` is a hash (FNV-1a, hex) of the payload as last saved. It is not part of the payload. Loading a deck, Reset with discard, and "Operate from here" set it to `null`; opening a combo
from My combos sets it. The draft format bumps to `v: 2`; a `v: 1` draft is read with `combo: null`.

## Server (`omega-server-v3`)

### Table

```sql
CREATE TABLE IF NOT EXISTS combos (
  id          text PRIMARY KEY DEFAULT left(replace(gen_random_uuid()::text, '-', ''), 16)
              CHECK (id ~ '^[0-9a-f]{16}$'),
  owner_id    text NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title       text NOT NULL CHECK (length(title) BETWEEN 1 AND 80),
  deck_id     text REFERENCES decks(id) ON DELETE SET NULL,
  payload     jsonb NOT NULL CHECK (jsonb_typeof(payload) = 'object'),
  steps       integer NOT NULL CHECK (steps BETWEEN 0 AND 2000),
  revision    integer NOT NULL DEFAULT 1,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS combos_owner_idx ON combos (owner_id, updated_at DESC, id);
```

In `src/db/schema.ts`, next to `decks`. A new table, so `CREATE TABLE IF NOT EXISTS` is enough; later column changes
need an `ALTER` (memory: schema changes need ALTER).

### Validation (`combos.validation.ts`)

`validateComboInput(raw) → { title, deckId, payload }` throws `ComboError(400, 'INVALID', …)` on anything off:

- `title`: trimmed string, 1–80.
- `deckId`: `null` or `^[0-9a-f]{16}$`. A deck the user cannot read is stored as `null`, never an error.
- `payload.deck`: the same zone limits and passcode checks as `decks.validation.ts` (`ZONE_MAX`, integer passcodes).
  Copy limits are not checked: a combo may use a deck that breaks a banlist.
- `payload.name`: string ≤ 80.
- `payload.actions`: array ≤ 2000. Each is rebuilt from known fields only, mirroring `utils/simulator/draft.ts`
  `parseAction`: `t` in the eight kinds; card ids integers in `0..main+extra-1`; zones in the 18 zone names;
  `at`/`face`/`pos` enums; `draw.n` 1..60; `counter.delta` a non-zero integer in −99..99; `targets` and `order` arrays
  of in-range ids, at most `main+extra` long; `note` a string ≤ 100.
- `payload.start`: integer in `0..actions.length`.
- The body is refused above 256 KB (route `bodyLimit`).

What it does not check is the game itself (a move into an occupied spell zone, a card that is not where a step says).
The client's `parseSession` replays the log on open; a combo that fails it opens as "This combo is damaged". Only a
hand-built request can store one.

### Routes (`combos.routes.ts`, prefix `/combos`)

| Route | Auth | Result |
|---|---|---|
| `POST /` | required | 201 `{ id, revision }` |
| `PATCH /:id` | owner | body adds `baseRevision`; 200 `{ id, revision }`; 409 `CONFLICT` when `baseRevision` is not current |
| `DELETE /:id` | owner | 204 |
| `GET /mine?cursor=` | required | `{ combos: ComboSummary[], nextCursor }`, 24 per page, newest update first |
| `GET /:id` | optional | `{ id, title, deckId, owner: { id, name }, payload, revision, updatedAt }` |

- A combo of someone else on `PATCH`/`DELETE`, and an unknown or malformed id anywhere, is 404, never 403 (as decks).
- `ComboSummary` = `{ id, title, deckName: payload.name, steps, updatedAt }`, read without loading `payload` whole
  (`payload->>'name'` and `steps`).
- At most 500 combos per user (`MAX_COMBOS`), 409 `LIMIT` beyond.
- Rate limit `rateLimitOptions(60)`; `cache-control: private, no-cache` on owner routes, `public, max-age=60` on
  `GET /:id`.
- Registered in `src/app.ts` like `deckRoutes`; tests added to the `test` script in `package.json`.

## Front (`tournament-next`)

### API client (`utils/combos.ts`)

`saveCombo`, `updateCombo(id, input, baseRevision)`, `deleteCombo`, `listMyCombos(cursor)`, `getCombo(id)`, with
`ComboApiError` and `ComboConflictError`, in the pattern of `utils/decks.ts`.

### In the simulator

- The toolbar gains **Save**, **My combos** and **Share**. They are off while a replay plays.
- **Save**:
  - signed out: sends the player to sign in, and the draft keeps the line;
  - with no `combo`: a dialog asks the title, with the deck name prefilled, then `POST`;
  - with a `combo`: `PATCH` with its revision, no dialog.
  - **Save as new** sits in the same dialog and always `POST`s.
- **Conflict (409)**: a dialog offers "Reload the saved one" (discards local changes) or "Save as new".
- **Share**: saves first if the session has no `combo` or has unsaved changes, then copies `/simulator/c/<id>` with
  the same clipboard fallback as the calculator.
- **My combos**: a dialog listing title, deck name, steps and updated date, with "Load more". Open asks to discard
  when the session has actions. Delete asks to confirm; deleting the combo the session is tied to sets `combo` to `null`.
- **Unsaved changes**: when the hash of the current payload differs from `combo.saved`, Save shows a dot.

### Shared player (`app/simulator/c/[id]/`)

- `page.tsx` server-renders `generateMetadata` from `GET /combos/:id`: the title, the deck name and the step count, for
  the Discord preview. When the API fails, the generic simulator title is used.
- The client fetches the combo, runs `parseSession` on `{ v: 2, ...payload, cursor: start, combo: null }`, and shows:
  - the title, the owner's name, and the deck name;
  - the board read-only: no menus, no drag, no target mode, no toolbar;
  - the replay bar, the captions and the history (rows seek).
- **Auto-play**: a 3-second countdown with Cancel and Play now, then playback from `start`.
- **Operate from here**: writes the line up to the step on screen into the viewer's draft as a new session. With `k`
  the step on screen, the session is `actions.slice(0, k)`, `cursor = k`, `start = min(payload.start, k)`, and
  `combo: null`. It then opens `/simulator`, asking first when the viewer's draft has actions.
- **States**:
  - Loading.
  - Not found (404): "This combo does not exist or was deleted".
  - Damaged (fails `parseSession`): "This combo is damaged".
  - Network error, with Retry.
- The owner viewing their own link also gets "Edit": it loads the combo into the simulator, tied to it.

## Errors

- **Save while signed out**: sign in with the return path to `/simulator`; the draft keeps the line.
- **400 from the server**: "Could not save this combo" (only a hand-tampered session gets here).
- **Network failure on save**: an `Alert` with Retry; nothing in the session changes.
- **Combo limit (409 `LIMIT`)**: "You have 500 combos saved; delete one to save another".

## Testing

- **Server** (`combos.test.ts` with `app.inject`, `combos.db.test.ts` against Postgres as the deck tests do):
  - the validation table: each rule and its limit, unknown fields dropped, the 256 KB body;
  - routes: owner-only `PATCH`/`DELETE` as 404 for others, the 409 on a stale revision, `GET /:id` without a
    session, `/mine` paging, the 500 limit.
- **Front**:
  - `utils/combos.test.ts`: request shapes and error mapping;
  - draft v1 → v2 read;
  - client tests: Save (first save asks the title, then updates silently), the conflict dialog, Share copies the link,
    My combos open/delete;
  - the shared player: plays from `start`, Operate from here writes the draft, damaged and not-found states.
- **Browser check**: save, share, open the link signed out, play, Operate from here.

## Files

| Repo | File | Holds |
|---|---|---|
| server | `src/db/schema.ts` | `combos` table and index |
| server | `src/modules/combos/combos.validation.ts` | `validateComboInput`, `ComboError` |
| server | `src/modules/combos/combos.repository.ts` | SQL |
| server | `src/modules/combos/combos.service.ts` | ownership, revision, limits |
| server | `src/modules/combos/combos.routes.ts` | the five routes |
| server | `src/app.ts`, `package.json` | registration, test script |
| front | `utils/combos.ts` | API client |
| front | `utils/simulator/types.ts`, `draft.ts` | `Session.combo`, draft v2 |
| front | `app/simulator/save-dialog.tsx`, `my-combos.tsx` | Save / Save as new / conflict, My combos |
| front | `app/simulator/simulator.client.tsx`, `toolbar.tsx` | Save, My combos, Share |
| front | `app/simulator/c/[id]/page.tsx`, `combo-player.tsx` | the shared player |
| front | `messages/en.json`, `messages/pt.json` | strings |
