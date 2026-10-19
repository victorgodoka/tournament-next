# Combo Simulator — Sub-project 1 (Board and Local Replay) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A manual Yu-Gi-Oh! board at `/simulator`: load an Omega deck, draw or pick a hand, move cards by drag or menu, mark activations, targets, Xyz materials, negation and counters, and step through or play back the line, with a local draft.

**Architecture:** Pure logic in `utils/simulator/` (types, reducer, session reducer, drop mapping, draft validation): the board at any step is `timeline(deck, actions)[cursor]`. React in `app/simulator/` on the calculator's page pattern (`page.tsx` → `ssr: false` loader → client), reusing `DeckPicker`, `useCardCache`, `CardTile`, `CardFacts` and `useLongPress`. No server change, no new dependency.

**Tech Stack:** Next 16 / React 19 / Tailwind 4 / next-intl / Vitest + happy-dom + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-19-combo-simulator-design.md` (read it with this plan).

**Decisions made while planning** (the spec leaves these open; Victor confirms them with the plan):

1. **`isValid(board, action)` is exported.** `apply` returns the same board when it is false. `activate` is valid but changes nothing, so the client checks `isValid`, never `apply(...) !== board`.
2. **Piles are top-first** (`[0]` is the top) for `deck`, `gy`, `banished`, `extra`; `at: 'top'` inserts at 0, `'bottom'` appends. The hand always appends. `draw` appends the deck's top cards to the hand in order.
3. **Materials travel only to a monster slot.** A monster leaving for anywhere else sends its materials to the GY top in stack order; when the monster itself goes to the GY it lands on top of them. A monster with materials that becomes a material brings its materials along, after itself.
4. **`at: 'top'` on an occupied monster slot** puts the card on top of the whole stack (Xyz over / rank-up in one move). Shift on drop on an occupied monster slot does this.
5. **Shift on a pile** means the variant that pile has: deck → bottom, banished → face-down, extra → face-up (Pendulum). Hand and GY ignore Shift. The menu offers every variant.
6. **Counters clamp to 0..99**; a counter action's `delta` is a non-zero integer in −99..99.
7. **"New hand"** is reset + shuffle + draw 5. It asks to confirm only when the session holds an action other than `shuffle` / `draw`, so testing hands repeatedly needs one click. "Draw 1" stays separate.
8. **Board grid is 7 × 3:** Banished sits in the EMZ row's last column, above the GY, instead of an eighth column.
9. **Phone:** card panel and history stack under the board as two tabs (`TabBar`), not a sliding sheet. The pile panel is fixed to the bottom of the screen. On touch, a card in the pile panel opens the menu on tap instead of dragging, because dragging would fight the list's scroll.
10. **Keyboard activation of a card** (a `click` with `detail === 0`) opens its menu; a mouse click selects it for the card panel.
11. **No `deckId` in the session yet**; `?deck=` is ignored until sub-project 2 or 4 needs it. The draft is stored as `{ v: 1, ...session }`.
12. **The draft validator replays the log** and rejects a draft whose action is invalid at its step.
13. **Extra files beyond the spec's table:** `utils/simulator/session.ts`, `app/simulator/boot.ts`, `use-drag.ts`, `pile-panel.tsx`, `card-panel.tsx`.
14. **`share.ts` guards are not reused**: they throw `ShareError`, the draft validator returns `null`. They aren't needed verbatim, so the spec's "move to a shared module" clause does not trigger.

## Global Constraints

- Repo: worktree `C:\Users\marti\Documents\tournament-next\.claude\worktrees\omega-combo-simulator`, branch `claude/omega-combo-simulator` (cut from `main`). Never `cd` to the original checkout. `omega-server-v3` is not touched.
- Every commit stages only the files its task lists (`git add <paths>`), never `git add -A` / `.`. No `Co-Authored-By` or "Generated with" lines in commit messages.
- Edit files with the Edit/Write tools, not `sed -i` or scripts (Git Bash flips CRLF/LF).
- Verification is `pnpm exec tsc --noEmit`, `pnpm exec eslint <touched paths>` (project-wide `pnpm lint` has a pre-existing error in `app/banlist-timeline/timeline.tsx`, not ours), `pnpm vitest run <path>`; never `next build`. The dev server for browser checks runs from this worktree on a port other than 5173; the local API (Docker, :3000) only allows origin :5173, so a temporary `next.config.ts` rewrite proxy is used and reverted before any commit.
- React lint treats impure render and set-state-in-effect as errors: derive during render; DOM measurement (arrows, FLIP) writes to the DOM through refs inside `useLayoutEffect`, never `setState`.
- Design system only: `Panel`, `TabBar` + `tabPanelProps`, `Button`, `Chip`, `Alert`, `Dialog`, `Icon` from `components/ui`; tokens from `app/styles.css`. No new colours or radii. No new npm dependency.
- Every UI string goes in `messages/en.json` and `messages/pt.json` under `Simulator`, added in the task that renders it. Tests mock `useTranslations` to return the key, so the key names below are part of the contract.
- Limits (spec + decisions): ≤ 2000 actions (`LIMITS.actions`), name ≤ 80 chars, counters 0..99, replay step 800 ms, `MOVE_SLOP` 10 px and `LONG_PRESS_MS` 450 from `app/deck-builder/gestures.ts`.
- Tap targets ≥ 44 px below `lg` (`max-lg:min-h-11`) for toolbar, menu and history buttons; cards are exempt (the board must fit 375 px).
- Motion only under `motion-safe` / `prefers-reduced-motion: no-preference`.

## Review Focus

1. **No card is ever lost or duplicated.** Bouncing an Xyz with materials, rank-up over a stack, detaching, shuffling: every instance id stays in exactly one zone. Test: Task 1 (`every card is in exactly one zone after any action`).
2. **A drop on nothing, or on the card's own zone, adds no history step** and the card snaps back. Test: Task 2 (`dropAction` returns `null`).
3. **Storage that throws** (Safari private mode, quota): the page still works and nothing crashes. Test: Task 3 (`writeDraft` with a throwing `setItem`, `readDraft` with a throwing `getItem`).
4. **Shortcuts typed into a text field** must not undo the board. Test: Task 8 (Ctrl+Z on an `<input>` changes nothing).
5. **Interacting during playback** must not truncate the line. Test: Task 8 (no menu opens while playing).

---

### Task 1: Board model and reducer

**Files:**
- Create: `utils/simulator/types.ts`, `utils/simulator/board.ts`
- Test: `utils/simulator/board.test.ts`

**Interfaces:**
- Consumes: `Deck` (`@utils/deck/types`).
- Produces (`types.ts`): `Face`, `Pos`, `Card`, `Pile`, `MonsterSlot`, `SpellSlot`, `Slot`, `ZoneId`, `Board`, `Action`, `Session` exactly as the spec's Data model; plus
  - `PILES = ['deck', 'hand', 'extra', 'gy', 'banished'] as const`, `MONSTER_SLOTS = ['m0', 'm1', 'm2', 'm3', 'm4', 'emz0', 'emz1'] as const`, `SPELL_SLOTS = ['s0', 's1', 's2', 's3', 's4', 'field'] as const`, `ZONES: readonly ZoneId[]` (all three, in that order)
  - `LIMITS = { actions: 2000, name: 80, counters: 99, draw: 60 } as const`
- Produces (`board.ts`):
  - `initial(deck: Deck): Board`
  - `isValid(board: Board, action: Action): boolean`
  - `apply(board: Board, action: Action): Board` (same reference when invalid)
  - `locate(board: Board, card: number): { zone: ZoneId; index: number } | null`
  - `isSlot(zone: ZoneId): zone is Slot`, `isMonsterSlot(zone: ZoneId): zone is MonsterSlot`
  - `timeline(deck: Deck, actions: readonly Action[]): Board[]` (length `actions.length + 1`, `[0]` is `initial(deck)`)
  - `shuffleAction(board: Board, random?: () => number): Extract<Action, { t: 'shuffle' }>` (Fisher–Yates over `zones.deck`, `random` defaults to `Math.random`)

- [ ] **Step 1: Write the failing tests**

Fixture: `deck = { main: [101..110], extra: [201, 202, 203], side: [] }` (instances 0–9 main, 10–12 extra); `run(...actions)` reduces over `initial(deck)`; `zone(b, id) = locate(b, id)?.zone`.

```ts
it('initial: main top-first in deck, extra face-down, turn 1')
//   zones.deck = [0..9], zones.extra = [10, 11, 12], cards[0] = { id: 0, code: 101, face: 'up', pos: 'atk', counters: 0, negated: false },
//   cards[10].face = 'down', turn = 1, every slot and hand/gy/banished = []
it('draw takes from the top in order and stops at an empty deck')
//   run(draw 3).zones.hand = [0, 1, 2]; run(draw 99).zones.hand.length = 10; on an empty deck draw is invalid (toBe same board)
it('move to an empty slot takes it; face and pos default to up and atk')
//   run(draw 1, move 0 → m2, face down, pos def): cards[0] face 'down' pos 'def'; without face/pos: 'up'/'atk'
it('move to an occupied monster slot appends a material')                    // m0 = [0, 1]
it('at top on an occupied monster slot puts the card over the whole stack')   // m0 [0, 1] + move 2 → m0 at top = [2, 0, 1]
it('a monster with materials that becomes a material brings them along')     // m0 [0, 1], m1 [2]; move 0 → m1 = m1 [2, 0, 1], m0 []
it('materials travel to another monster slot and go to the GY top otherwise')
//   m0 [0, 1] → move 0 → m3 = m3 [0, 1]; m0 [0, 1], gy [5] → move 0 → hand: gy [1, 5]; → move 0 → gy: gy [0, 1, 5]
it('moving a material detaches only that card')                              // m0 [0, 1, 2]; move 1 → gy = m0 [0, 2], gy [1]
it('an occupied spell or field slot is invalid')
it('leaving the field clears counters and negate and resets pos to atk')
it('face per destination: gy, hand and deck up; banished up unless down; extra down unless up')
it('pile at top inserts first, bottom appends; the hand always appends')
it('shuffle needs a permutation of the current deck')
//   reversed order is applied; a missing id, a duplicate, a foreign id, and [] on an empty deck are invalid
it('counter clamps to 0..99 and only touches a field card that is not a material')
it('negate and flip only touch a field card that is not a material')
it('activate is valid for any card and returns the same board')
//   isValid(b, activate 0 with targets [3]) = true; apply(...) toBe b; a target id out of range = invalid
it('endTurn adds a turn')
it('ids out of range are invalid')                                         // card 13 / -1 in move, flip, negate, counter, activate
it('every card is in exactly one zone after any action')
//   a fixed 30-action script mixing draw, moves to every zone kind, materials, at top, detaches, bounce, shuffle;
//   after each step, the concatenation of all zones sorted equals [0..12]
it('timeline is deterministic and starts at initial')
//   timeline(deck, log).length = log.length + 1; [0] equals initial(deck); two runs are toEqual
it('shuffleAction gives a valid permutation')                              // isValid(b0, shuffleAction(b0, () => 0.5)) = true
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm vitest run utils/simulator/board.test.ts`
Expected: FAIL, `Cannot find module './board'`.

- [ ] **Step 3: Implement `types.ts` and `board.ts`**

`apply` copies only what it touches (the `zones` record shallowly, each changed zone array, each changed `Card`), so `timeline` shares structure between steps. `isValid` holds every rule in the spec's reducer table plus decisions 2–6; `apply` calls it first. Add `// ponytail: timeline keeps every step's board (≤ 2000, structurally shared); switch to checkpoints if logs grow`.

- [ ] **Step 4: Run them and see them pass**

Run: `pnpm vitest run utils/simulator/board.test.ts`, then `pnpm exec tsc --noEmit` and `pnpm exec eslint utils/simulator`
Expected: all pass, no type or lint errors.

- [ ] **Step 5: Commit**

```bash
git add utils/simulator/types.ts utils/simulator/board.ts utils/simulator/board.test.ts
git commit -m "feat(simulator): board model and reducer"
```

---

### Task 2: Session reducer and drop mapping

**Files:**
- Create: `utils/simulator/session.ts`, `utils/simulator/drop.ts`
- Test: `utils/simulator/session.test.ts`, `utils/simulator/drop.test.ts`

**Interfaces:**
- Consumes: Task 1 (`Board`, `Action`, `Session`, `ZoneId`, `Pile`, `LIMITS`, `isValid`, `locate`, `isSlot`, `isMonsterSlot`, `ZONES`).
- Produces (`session.ts`):
  - `type SessionEvent = { type: 'load'; deck: Deck; name: string } | { type: 'reset' } | { type: 'act'; actions: Action[] } | { type: 'undo' } | { type: 'redo' } | { type: 'seek'; cursor: number } | { type: 'setStart'; start: number }`
  - `emptySession(): Session` (empty deck, name `''`, no actions, cursor 0, start 0)
  - `sessionReducer(session: Session, event: SessionEvent): Session` (same reference for a no-op)
- Produces (`drop.ts`):
  - `dropAction(board: Board, card: number, zone: ZoneId | null, shift: boolean): Action | null`
  - `type MoveVariant = 'plain' | 'set' | 'top' | 'bottom' | 'faceDown' | 'faceUp'`
  - `moveOptions(board: Board, card: number): { zone: ZoneId; variant: MoveVariant; action: Action }[]` (every valid destination, `ZONES` order; slots offer `plain` and, when empty, `set`; occupied monster slots offer `plain` and `top`; deck `top`/`bottom`; banished `plain`/`faceDown`; extra `plain`/`faceUp`; hand and GY `plain`; never the card's own slot)

- [ ] **Step 1: Write the failing tests**

```ts
// session.test.ts
it('act drops the future and advances the cursor')       // actions [a, b, c], cursor 1, act [d] → [a, d], cursor 2
it('act pulls start back to the cursor')                 // start 3, cursor 1, act [d] → start 1
it('act refuses to pass LIMITS.actions')                 // 2000 actions + act [d] → same session
it('undo and redo stay within 0..length and no-op at the ends')
it('seek and setStart clamp to 0..actions.length')
it('load trims the name to 80 and starts empty; reset keeps deck and name')

// drop.test.ts — board: draw 6 from the Task 1 deck, then card 0 in m0, card 1 in s0
it('null zone, own slot and a material onto its own slot give null')
it('empty monster slot: plain move, Shift sets face-down DEF')
it('occupied monster slot: material, Shift goes on top')
it('empty spell or field slot: plain, Shift sets face-down; occupied gives null')
it('Shift per pile: deck bottom, banished face-down, extra face-up, hand and GY plain')
it('a drop onto the card own pile without Shift gives null')
it('moveOptions lists only valid actions and never the own slot')
//   for card 2 (hand): every option passes isValid; no option for s0 (occupied); m0 offers plain and top
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm vitest run utils/simulator/session.test.ts utils/simulator/drop.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `session.ts` and `drop.ts`**

`dropAction` and `moveOptions` both return only actions that pass `isValid`.

- [ ] **Step 4: Run them and see them pass**

Run: `pnpm vitest run utils/simulator`, `pnpm exec tsc --noEmit`, `pnpm exec eslint utils/simulator`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add utils/simulator/session.ts utils/simulator/session.test.ts utils/simulator/drop.ts utils/simulator/drop.test.ts
git commit -m "feat(simulator): session reducer and drop mapping"
```

---

### Task 3: Draft and boot

**Files:**
- Create: `utils/simulator/draft.ts`, `app/simulator/boot.ts`
- Test: `utils/simulator/draft.test.ts`, `app/simulator/boot.test.ts`

**Interfaces:**
- Consumes: Task 1 (`timeline`-style replay through `isValid` / `apply`, `initial`, `LIMITS`, `ZONES`), Task 2 (`emptySession`, `sessionReducer`); `assertDeck` (`@utils/deck/codecs/ydk`), `fromYdke` (`@utils/deck/codecs/ydke`), `DeckCodeError`.
- Produces (`draft.ts`):
  - `DRAFT_KEY = 'simulator:draft'`
  - `parseSession(raw: unknown): Session | null`: expects `{ v: 1, deck, name, actions, cursor, start }`; checks deck with `assertDeck`, name a string ≤ 80, every action's shape and ranges (ids in `0..main+extra-1`, zones in `ZONES`, `draw.n` 1..60, `counter.delta` non-zero in −99..99, `targets` and `order` arrays of in-range ints), cursor and start in `0..actions.length`, ≤ 2000 actions, then replays from `initial(deck)` and rejects the first action that fails `isValid`
  - `readDraft(storage: Pick<Storage, 'getItem'> | null): Session | null`
  - `writeDraft(storage: Pick<Storage, 'setItem'> | null, session: Session): void` (never throws)
  - `draftStorage(): Storage | null` (`window.localStorage` inside `try/catch`)
- Produces (`boot.ts`):
  - `bootSession(search: string, storage: Pick<Storage, 'getItem'> | null): { session: Session; notice: 'damagedLink' | null }`: `?d=` wins (spaces put back to `+` before `fromYdke`, `name` trimmed to 80); a damaged `?d=` gives `emptySession()` and `'damagedLink'` without reading the draft; otherwise the draft, else empty.

- [ ] **Step 1: Write the failing tests**

```ts
// draft.test.ts — a Map-backed storage stub
it('round-trips a session')                      // writeDraft then readDraft toEqual the session
it('missing key and corrupted JSON give null')
it('rejects a tampered draft')
//   v: 2; card id 13; zone 'm9'; counter delta 0; cursor > actions.length; 61 main cards;
//   a second move into an occupied s0 (valid shape, invalid at its step) → each null
it('null storage reads null and writes nothing')
it('a throwing getItem reads null and a throwing setItem does not throw')

// boot.test.ts
it('?d= boots that deck, restoring + and trimming the name')   // name of 100 chars → 80; ydke with '+' sent as ' '
it('a damaged ?d= opens empty with damagedLink and ignores the draft')
it('without ?d= the draft is restored, else the session is empty')
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm vitest run utils/simulator/draft.test.ts app/simulator/boot.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement `draft.ts` and `boot.ts`**

- [ ] **Step 4: Run them and see them pass**

Run: `pnpm vitest run utils/simulator app/simulator/boot.test.ts`, `pnpm exec tsc --noEmit`, `pnpm exec eslint utils/simulator app/simulator`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add utils/simulator/draft.ts utils/simulator/draft.test.ts app/simulator/boot.ts app/simulator/boot.test.ts
git commit -m "feat(simulator): local draft and URL boot"
```

---

### Task 4: Page, toolbar and board

**Files:**
- Create: `app/simulator/page.tsx`, `app/simulator/simulator.loader.tsx`, `app/simulator/simulator.client.tsx`, `app/simulator/board.tsx`
- Modify: `utils/const.ts` (Tools menu: `{ item: "Combo Simulator", to: "/simulator" }` after "Combo Calculator"), `messages/en.json`, `messages/pt.json` (new `Simulator` namespace)
- Test: `app/simulator/simulator.client.test.tsx`

**Interfaces:**
- Consumes: Tasks 1–3; `DeckPicker` (`@app/calculator/deck-picker`, `onPick(build)` uses `build.deck` and `build.name`), `useCardCache` (`@app/deck-builder/use-card-cache`), `CardTile` (`@app/deck-builder/card-tile`), `Header`, `PageHeader`, `Button`, `Alert`, `Dialog` (`size="sm"`).
- Produces:
  - `simulator.client.tsx` default export `Simulator` (boots once with `bootSession(window.location.search, draftStorage())`, then renders `Loaded`); inside `Loaded`: `perform(actions: Action[])` dispatches `act` only when every action passes `isValid` in sequence; draft written 300 ms after each session change
  - `board.tsx`: `BoardView` with props `{ board: Board; cards: CardMap; selected: number | null; onCard(id: number, e: React.MouseEvent): void; onMenu(id: number, e: React.MouseEvent): void; onPile(pile: Pile): void }`. Later tasks add props; each zone is `role="group"` with `aria-label={t(`zones.${zone}`)}` and `data-zone={zone}`; each card is a button with `data-card={id}` and its name (or passcode) as accessible name
- i18n keys rendered here: `title`, `meta`, `eyebrow`, `loading`, `turn`, `toolbar.{deck,newHand,draw,endTurn,undo,redo,reset}`, `confirm.{title,body,discard,cancel}`, `damagedLink`, `dismiss`, `lookupFailed`, `retry`, `zones.{deck,hand,extra,gy,banished,field,m0..m4,s0..s4,emz0,emz1}`, `negated`, `faceDown`.

- [ ] **Step 1: Write the failing tests**

Mocks as in `app/calculator/calculator.client.test.tsx` (`next/navigation`, `next/image`, `next-intl` returning keys, `@hooks/index`, `@utils/cards` → empty `Map`, `@utils/decks`). `open(url)` renders `<Simulator />` and lets the boot settle. Deck: `toYdke({ main: [1, 2, 3, 4, 5, 6], extra: [7], side: [] })`. `hand()` = buttons inside the `zones.hand` group.

```ts
it('New hand draws 5 from the deck in the URL')            // hand() length 5; zones.deck pile shows count 1
it('Draw 1 adds a card and Undo takes it back')            // 6, then 5; Undo disabled at cursor 0
it('New hand asks to confirm once the session has more than draws')
//   New hand → End turn → New hand: dialog 'confirm.title'; 'confirm.cancel' keeps it; 'confirm.discard' gives a fresh hand of 5
it('the draft survives a reload without ?d=')              // New hand; cleanup; open('/simulator'): hand() length 5
it('a damaged ?d= shows damagedLink')
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm vitest run app/simulator/simulator.client.test.tsx`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement page, loader, client and `BoardView`**

- `page.tsx` / `simulator.loader.tsx` copy the calculator's pattern (`generateMetadata` with `title` / `meta`, path `/simulator`).
- With no deck, the `DeckPicker` opens by itself, as in the calculator. Picking a deck dispatches `load`, after `confirm.*` when the session has actions. Reset dispatches `reset`, after confirming the same way.
- Grid: 7 columns × 3 rows. Row 1: EMZ in columns 3 and 5, Banished in column 7. Row 2: Field, M1–M5, GY. Row 3: Extra, S1–S5, Deck. The hand row sits under the grid. The board wrapper is a size container; `--card-w: min(84px, calc((100cqw - 24px) / 7))`, 4 px gaps, cards 59:86.
- Hand overlap: each hand card sits in a `min-w-0 flex-1 max-w-(--card-w)` wrapper with a full-width child, so cards overlap instead of wrapping or scrolling.
- Card visuals per the spec: `public/back.webp` for face-down on the field; DEF `rotate-90`; negated `grayscale` + `Icon` with label `negated`; counters badge; materials offset under the top card with a `×N` count; a face-down card in a pile gets a `faceDown` marker. Piles show the count and the top card (deck and extra show the back).
- Lookup failures show the `lookupFailed` alert with `retry`, as in the calculator.

- [ ] **Step 4: Run them and see them pass**

Run: `pnpm vitest run app/simulator utils/simulator`, `pnpm exec tsc --noEmit`, `pnpm exec eslint app/simulator utils/const.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/simulator/page.tsx app/simulator/simulator.loader.tsx app/simulator/simulator.client.tsx app/simulator/board.tsx app/simulator/simulator.client.test.tsx utils/const.ts messages/en.json messages/pt.json
git commit -m "feat(simulator): page, toolbar and board"
```

---

### Task 5: Card menu, pile panel and card panel

**Files:**
- Create: `app/simulator/card-menu.tsx`, `app/simulator/pile-panel.tsx`, `app/simulator/card-panel.tsx`
- Modify: `app/simulator/simulator.client.tsx`, `app/simulator/board.tsx`, `messages/en.json`, `messages/pt.json`
- Test: `app/simulator/simulator.client.test.tsx`

**Interfaces:**
- Consumes: Task 2 `moveOptions`; Task 4 `BoardView`, `perform`; `CardFacts` (`@app/deck-builder/card-facts`), `Panel`.
- Produces:
  - `CardMenu` props `{ board: Board; card: number; at: { x: number; y: number }; onAct(actions: Action[]): void; onTargets(card: number): void; onDetails(card: number): void; onClose(): void }`. It is a conditionally rendered `role="menu"`, fixed at `at` and clamped to the viewport. Items are `role="menuitem"`. Arrow keys move between items, the first item takes focus on open, and Escape, a pointer down outside, or choosing an item closes it with focus returned to the card. "Move to…" swaps the list for `moveOptions` plus `menu.back`.
  - Items by zone: a field card that is not a material gets `menu.{activate,activateTargets,flip,position,negate,counterUp,counterDown,moveTo,details}` (`counterDown` only with counters > 0); every other card gets `menu.{activate,activateTargets,moveTo,details}`. Move options are named `t(`zones.${zone}`)` and, unless `plain`, `` ` — ${t(`move.${variant}`)}` ``.
  - `PilePanel` props `{ board: Board; pile: Pile; cards: CardMap; onCard(id: number, e: React.MouseEvent): void; onMenu(id: number, e: React.MouseEvent): void; onClose(): void }`: cards top-first, close button `pile.close`. On desktop it sits at the top of the side column; below `lg` it is fixed to the bottom with `max-h-[45dvh]` and scrolls. A touch tap opens the menu.
  - `CardPanel` props `{ code: number | null; card: CardData | null }`: tile and `CardFacts`, the passcode when the card is unknown, `cardPanel.empty` when nothing is selected.
  - Client: a mouse click selects, a keyboard click (`detail === 0`) or right-click opens the menu, and a pile click opens `PilePanel`.

- [ ] **Step 1: Write the failing tests**

```ts
it('Move to puts a hand card in a monster zone and Undo brings it back')
//   New hand; contextMenu on hand()[0]; 'menu.moveTo'; 'zones.m2' → m2 group has 1 card, hand 4; Undo → hand 5
it('keyboard opens the menu on the first item and Escape returns focus to the card')
it('a field card gets flip, position, negate and counters; a hand card does not')
it('counters go up and the badge shows the count')         // counterUp twice → '2' inside the card
it('the deck pile panel moves a card to the hand')
//   click zones.deck pile → panel lists 1 card; its menu → 'menu.moveTo' → 'zones.hand' → hand 6
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm vitest run app/simulator/simulator.client.test.tsx`
Expected: the new tests FAIL (no `menu` role).

- [ ] **Step 3: Implement `CardMenu`, `PilePanel`, `CardPanel` and wire them in the client**

- [ ] **Step 4: Run them and see them pass**

Run: `pnpm vitest run app/simulator utils/simulator`, `pnpm exec tsc --noEmit`, `pnpm exec eslint app/simulator`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/simulator/card-menu.tsx app/simulator/pile-panel.tsx app/simulator/card-panel.tsx app/simulator/simulator.client.tsx app/simulator/board.tsx app/simulator/simulator.client.test.tsx messages/en.json messages/pt.json
git commit -m "feat(simulator): card menu, pile panel and card panel"
```

---

### Task 6: Drag, double-click and long-press

**Files:**
- Create: `app/simulator/use-drag.ts`
- Modify: `app/simulator/board.tsx`, `app/simulator/pile-panel.tsx`, `app/simulator/simulator.client.tsx`
- Test: `app/simulator/simulator.client.test.tsx`

**Interfaces:**
- Consumes: Task 2 `dropAction`; `useLongPress`, `MOVE_SLOP` (`@app/deck-builder/gestures`).
- Produces:
  - `useDrag(opts: { enabled: boolean; onDrop(card: number, zone: ZoneId | null, shift: boolean): void })` → `{ bind(card: number, touch: boolean): { onPointerDown; onPointerMove; onPointerUp; onPointerCancel; onClickCapture }; ghostRef: React.RefObject<HTMLDivElement | null>; dragging: number | null }`.
  - Behaviour: the drag starts past `MOVE_SLOP`; `setPointerCapture?.()` is guarded because happy-dom may lack it. The ghost follows through `ghostRef.current.style.translate`, with no state per move. On release, the zone is `document.elementFromPoint(x, y)?.closest('[data-zone]')?.getAttribute('data-zone')`. The click that follows a drag is swallowed. `touch: false` ignores `pointerType === 'touch'` (pile panel, decision 9).
  - `BoardView` gains `onActivate(id: number): void` (native `onDoubleClick`) and `drag`. Board cards compose `useLongPress().bind(() => onMenu(...))` with `drag.bind(id, true)`. Cards get `touch-none`; empty zones keep page scrolling.

- [ ] **Step 1: Write the failing tests**

```ts
it('dragging a hand card onto an empty monster zone moves it')
//   stub document.elementFromPoint to return the 'zones.m0' group; pointerDown (0,0) → pointerMove (50,50) → pointerUp
//   on hand()[0] with pointerType 'mouse', pointerId 1 → m0 has 1 card, hand 4
it('a drop outside any zone adds no step')
//   elementFromPoint → document.body; hand still 5, and one Undo empties it (the last step is still the draw)
it('double-click activates without moving the card')
//   dblClick a hand card → hand still 5; one Undo keeps the hand at 5 (the step undone was the activation)
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm vitest run app/simulator/simulator.client.test.tsx`
Expected: the new tests FAIL.

- [ ] **Step 3: Implement `useDrag` and wire it into `BoardView` and `PilePanel`**

- [ ] **Step 4: Run them and see them pass**

Run: `pnpm vitest run app/simulator utils/simulator`, `pnpm exec tsc --noEmit`, `pnpm exec eslint app/simulator`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/simulator/use-drag.ts app/simulator/board.tsx app/simulator/pile-panel.tsx app/simulator/simulator.client.tsx app/simulator/simulator.client.test.tsx
git commit -m "feat(simulator): drag, double-click and long-press"
```

---

### Task 7: Targets, activation highlight and arrows

**Files:**
- Modify: `app/simulator/simulator.client.tsx`, `app/simulator/board.tsx`, `messages/en.json`, `messages/pt.json`
- Test: `app/simulator/simulator.client.test.tsx`

**Interfaces:**
- Consumes: Task 5 `CardMenu.onTargets`.
- Produces:
  - Client state `targeting: { source: number; targets: number[] } | null`. While it is set, a card click toggles a target (the source excluded) and menus and drag are off. A bar shows `targets.prompt`, `targets.confirm` (disabled with 0 targets) and `targets.cancel`; Escape cancels. Confirm performs `{ t: 'activate', card: source, targets }`.
  - `BoardView` gains `activation: { card: number; targets: number[] } | null`, derived in the client as `actions[cursor - 1]` when that is an `activate`. The source card gets `data-active` and a glow (`motion-safe` pulse, else an outline). Each target gets `data-targeted`. An `aria-hidden` SVG over the board draws one arrow per target, from the source's `[data-card]` (or its pile's `[data-zone]` when the card is inside a pile) to the target's. It is drawn in `useLayoutEffect` through a ref and redrawn by a `ResizeObserver`.

- [ ] **Step 1: Write the failing tests**

```ts
it('activate with targets marks the source and the target')
//   card A in m0, card B in hand; menu on B → 'menu.activateTargets' → click A → 'targets.confirm'
//   → B has data-active, A has data-targeted; Undo removes both marks
it('Escape leaves target mode without a step')
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm vitest run app/simulator/simulator.client.test.tsx`
Expected: the new tests FAIL.

- [ ] **Step 3: Implement target mode, highlight and arrows**

- [ ] **Step 4: Run them and see them pass**

Run: `pnpm vitest run app/simulator utils/simulator`, `pnpm exec tsc --noEmit`, `pnpm exec eslint app/simulator`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/simulator/simulator.client.tsx app/simulator/board.tsx app/simulator/simulator.client.test.tsx messages/en.json messages/pt.json
git commit -m "feat(simulator): targets, activation highlight and arrows"
```

---

### Task 8: History, replay, animation and shortcuts

**Files:**
- Create: `app/simulator/history.tsx`
- Modify: `app/simulator/simulator.client.tsx`, `app/simulator/board.tsx`, `messages/en.json`, `messages/pt.json`
- Test: `app/simulator/simulator.client.test.tsx`

**Interfaces:**
- Consumes: Task 1 `locate`; Task 2 `seek` / `setStart` / `undo` / `redo` events; `TabBar`, `tabPanelProps`, `Chip`.
- Produces:
  - `History` props `{ session: Session; boards: Board[]; nameOf(id: number): string; disabled: boolean; onSeek(cursor: number): void; onSetStart(start: number): void }`. Row 0 is `history.start`. Row `i` describes `actions[i - 1]` using `boards[i - 1]` to find the source zone. Keys: `history.{move,draw,shuffle,activate,flip,negate,counter,endTurn}` with values `{ card, from, to, n, targets, delta, turn }`, zones named by `zones.*`. The row equal to `cursor` has `aria-current="step"`. Each row is a button that seeks there, plus `history.replayFromHere`, which sets `start = i`. The start row carries a `history.startMark` chip.
  - Replay in the client: a `replay.play` / `replay.pause` button, with `REPLAY_STEP_MS = 800`. Play seeks to `start` when the cursor is at the end or before `start`, then redoes once per step and stops at the end. While playing, menus, drag, target mode and the toolbar (except pause) are off.
  - FLIP in `BoardView`: in `useLayoutEffect`, keep each `[data-card]` rect in a ref, and on the next board animate the delta with `el.animate(..., { duration: 250, easing: 'ease-out' })`, only when `matchMedia('(prefers-reduced-motion: no-preference)').matches`.
  - Shortcuts on `window` `keydown`: Ctrl/Cmd+Z undo; Ctrl/Cmd+Y and Ctrl/Cmd+Shift+Z redo; ←/→ undo/redo; Space play/pause. They are ignored when the target matches `input, textarea, select, [contenteditable]` or a `dialog[open]` exists; Space is also ignored on a `button`. A handled key calls `preventDefault`.
  - Layout: from `lg`, the side column stacks `PilePanel`, `CardPanel`, `History`. Below `lg`, `CardPanel` and `History` sit under the board in a `TabBar` with `tabs.card` / `tabs.history`.

- [ ] **Step 1: Write the failing tests**

```ts
it('history lists steps and seeking shows that moment')
//   New hand → rows 'history.start', 'history.shuffle', 'history.draw'; click 'history.shuffle' → hand 0
it('acting after a seek drops the later steps')            // then Draw 1 → still 3 rows, last 'history.draw'
it('replay starts at the chosen step and plays to the end')
//   New hand, Draw 1; 'history.replayFromHere' on the draw-5 row; vi.useFakeTimers(); 'replay.play'
//   → hand 5; advance 800 ms → hand 6; button back to 'replay.play'
it('no menu opens while the replay plays')                 // during play, contextMenu on a hand card → no 'menu' role
it('Ctrl+Z undoes, but not when typed into an input')
//   Draw 1, keyDown window ctrl+z → hand back; keyDown on an appended <input> with ctrl+z → hand unchanged
```

- [ ] **Step 2: Run them and see them fail**

Run: `pnpm vitest run app/simulator/simulator.client.test.tsx`
Expected: the new tests FAIL.

- [ ] **Step 3: Implement `History`, replay, FLIP, shortcuts and the phone tabs**

- [ ] **Step 4: Run them and see them pass**

Run: `pnpm vitest run app/simulator utils/simulator`, `pnpm exec tsc --noEmit`, `pnpm exec eslint app/simulator`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/simulator/history.tsx app/simulator/simulator.client.tsx app/simulator/board.tsx app/simulator/simulator.client.test.tsx messages/en.json messages/pt.json
git commit -m "feat(simulator): history, replay, animation and shortcuts"
```

---

### Task 9: Browser check

**Files:**
- Modify only if the check finds a bug (and add the test that pins it to the owning file's test).

- [ ] **Step 1: Run the whole suite and the static checks**

Run: `pnpm vitest run`, `pnpm exec tsc --noEmit`, `pnpm exec eslint app/simulator utils/simulator utils/const.ts`
Expected: all pass (apart from failures already on `main`, listed if any).

- [ ] **Step 2: Check the page in the browser on desktop**

Start the dev server from this worktree on a port other than 5173 (with the temporary proxy from Global Constraints). Then:
- open `/simulator?d=<ydke of a real Omega deck with an Xyz>`;
- run New hand;
- drag to a monster zone and Shift-drop to set;
- overlay an Xyz and rank up with Shift;
- bounce the Xyz and see its materials in the GY;
- activate with a target and see the arrow;
- step with ←/→, play the replay and reload to confirm the draft.

Expected: every step behaves as the spec says, and the console shows no errors.

- [ ] **Step 3: Check the page at 375 × 812 with touch emulation and with reduced motion**

Expected: the board fits without horizontal scroll and the hand overlaps. A finger drag moves a card, a long-press opens the menu and a double-tap activates. The pile panel sits at the bottom and opens the menu on tap. The Card / History tabs work. With reduced motion, no animation plays and the glow is an outline.

- [ ] **Step 4: Revert the proxy and confirm the tree is clean**

Run: `git status --short`
Expected: no changes, or only the files a fix touched (committed with their test).
