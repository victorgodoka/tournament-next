# Combo simulator — design

Date: 2026-10-19
Status: approved in brainstorming, awaiting spec review
Repos: `tournament-next` (front only). `omega-server-v3` is not touched in this sub-project.
Reference: https://duel-simulator.miyauchidp.dev/ (a manual board with replays, no rules engine)

## Goal

A manual Yu-Gi-Oh! board at `/simulator`: the player loads an Omega deck, draws or picks an opening
hand, moves cards between zones by hand, and plays the line back step by step. Nothing checks the rules.
The board is a sandbox and its history is the combo.

The core requirement is a deterministic action log. Undo, history, replay and (later) sharing all come from
one list of small actions, so a recorded line always replays identically and stays small enough to store or
put in a URL.

## Roadmap

The four uses the simulator serves are split into sub-projects, each with its own spec, plan and
implementation. This spec covers **sub-project 1** only.

| # | Sub-project | Serves | Depends on |
|---|---|---|---|
| 1 | Board and local replay (`tournament-next`) | Testing hands, practicing lines | — |
| 2 | Saved replays and share link (`omega-server-v3` table + `POST`/`GET /replays`, front share dialog) | Sharing combos | 1 |
| 3 | Read-only replay player embedded in wiki articles | Wiki guides | 1, 2 |
| 4 | "Combos" tab on a saved deck, listing replays tied to its `deckId` | Combos tied to a deck | 1, 2 |

## Decisions

| Topic | Decision |
|---|---|
| Rules | None. Manual board, like the reference. No Normal Summon count, no HOPT, no costs |
| Engine | Rejected: ygopro-core in WASM would need Lua scripts for Omega's custom cards and loses the manual mode |
| State | Action log + pure reducer: `board = actions.slice(0, cursor).reduce(apply, initial(deck))` |
| Shuffle | Recorded as the resulting order, not a seed: replays never depend on an RNG |
| Opponent side | Out. Only the player's side |
| Opening hand | Both: "Shuffle + draw 5" and dragging specific cards out of the open deck |
| Card actions | Move, set / flip, ATK/DEF, activate (highlight + target arrows), Xyz materials, negate marker, counters |
| Devices | Desktop and phone from day one. Drag on pointer events (mouse, finger, pen), long-press opens the card menu |
| Drag library | None. Pointer events + `document.elementFromPoint` over `data-zone`; drop logic is a pure function |
| Deck input | The calculator's `DeckPicker` (my decks, pasted ydk / ydke / Omega code, `.ydk` file) and `?d=` hand-off |
| Persistence | One draft in `localStorage`. No server, no share link (sub-project 2) |
| Route and nav | `/simulator`; Tools menu entry "Combo Simulator" next to "Combo Calculator" (`utils/const.ts`) |

## Constraints found during exploration

- **Deck input exists.** `app/deck-builder/deck-io.ts#readDeck` reads every pasted format and splits main
  from extra on Omega codes via card lookups. `app/calculator/deck-picker.tsx` wraps it with "My decks",
  paste and file tabs; its `onPick(build)` gives `build.deck` and `build.name`. The simulator reuses the
  picker as is and ignores `roles` and `format`.
- **`?d=` convention.** The deck builder and calculator boot from `?d=<ydke>&name=…&deck=<id>`
  (`app/calculator/boot.ts`); `URLSearchParams` turns `+` into a space, so it is restored before
  `fromYdke`. The simulator boots the same way.
- **Card lookups.** The calculator's `ensure` (from `app/deck-builder/use-card-cache.ts`) resolves
  passcodes to `CardData`; the simulator uses the same hook.
- **Card visuals.** `CardTile` (`app/deck-builder/card-tile.tsx`) draws a 59:86 scan or a frame-coloured
  plate when data or the scan is missing. `CardFacts` (`app/deck-builder/card-facts.tsx`, `{ card }`) is
  the stats and text block. The card back is `public/back.webp` (unused today).
- **Touch helpers.** `app/deck-builder/gestures.ts` exports `useLongPress`, `LONG_PRESS_MS` (450) and
  `MOVE_SLOP` (10 px). The deck builder drags with native HTML5 drag-and-drop, which does not work with a
  finger, so the simulator does not reuse that part.
- **Untrusted payload helpers.** `utils/combo/share.ts` validates a decoded payload with small `int` /
  `arr` / `obj` / `str` guards. The draft validator follows the same style, because the same `Session`
  becomes a server payload in sub-project 2. If the guards are needed verbatim, they move to a shared
  module rather than being copied.
- **Page pattern.** `/calculator` is `page.tsx` (metadata + `Header`) → a `ssr: false` loader → the client
  component, because it boots from the query string. Same here.

## Data model (`utils/simulator/`)

```ts
/** Every copy is an instance; `id` is its index in [...deck.main, ...deck.extra]. */
type Card = { id: number; code: number; face: 'up' | 'down'; pos: 'atk' | 'def'; counters: number; negated: boolean }

type Pile = 'deck' | 'hand' | 'extra' | 'gy' | 'banished'
type Slot = 'field' | 'm0' | 'm1' | 'm2' | 'm3' | 'm4' | 's0' | 's1' | 's2' | 's3' | 's4' | 'emz0' | 'emz1'
type ZoneId = Pile | Slot

/** Every zone is an ordered list. In a monster slot, [0] is the monster and the rest are its Xyz materials. */
type Board = { cards: Card[]; zones: Record<ZoneId, number[]>; turn: number }

type Action =
  | { t: 'move'; card: number; to: ZoneId; at?: 'top' | 'bottom'; face?: 'up' | 'down'; pos?: 'atk' | 'def' }
  | { t: 'flip'; card: number; face: 'up' | 'down'; pos: 'atk' | 'def' }
  | { t: 'activate'; card: number; targets: number[] }
  | { t: 'negate'; card: number; on: boolean }
  | { t: 'counter'; card: number; delta: number }
  | { t: 'shuffle'; order: number[] }
  | { t: 'draw'; n: number }
  | { t: 'endTurn' }

type Session = { deck: Deck; name: string; actions: Action[]; cursor: number; start: number }
```

- `initial(deck)`: main in deck order in `deck` (top = index 0), extra in `extra` face-down, everything
  else face-up ATK, no counters, turn 1.
- `face` only shows in two piles: `banished` (face-down banish) and `extra` (a face-up Pendulum). The
  player always sees their own cards; a face-down card in a pile is drawn with a marker, not as the back.
- `apply(board, action) → board` is pure and total: an action it cannot apply returns the same board.

### Reducer rules

| Situation | Result |
|---|---|
| `move` to an empty slot | The card takes the slot. `face` / `pos` default to up / ATK |
| `move` to an occupied monster slot (`m*`, `emz*`) | The card goes under as an Xyz material (appended) |
| `move` to an occupied `s*` or `field` slot | Invalid: board unchanged |
| `move` of a monster out of the field | Its materials go to the GY (top), in order |
| `move` of a monster to another monster slot | Its materials travel with it |
| `move` of a material out of its stack | Detaches only that card |
| Any card leaves the field | `counters = 0`, `negated = false`, `pos = 'atk'` |
| `move` to `gy`, `hand`, `deck` | Face-up (`face` is ignored) |
| `move` to `banished` | Face-up unless `face: 'down'` |
| `move` to `extra` | Face-down unless `face: 'up'` (Pendulum) |
| `move` to a pile with `at` | `top` (default) or `bottom` |
| `draw` with `n` > deck size | Draws what is left |
| `shuffle` whose `order` is not a permutation of the current deck | Invalid: board unchanged |
| `counter` | Floors at 0; only on field cards |
| `negate`, `flip` | Only on field cards |
| `activate` | No state change; the UI reads it to highlight the card and draw target arrows |
| `endTurn` | `turn + 1` |
| Card id out of range | Invalid: board unchanged |

Pendulum zones are `s0` / `s4` as under Master Rule 5; nothing marks them specially. Face-up Pendulums in
the Extra Deck use `face: 'up'` on an `extra` move.

## Screen (`app/simulator/`)

```
              [EMZ]           [EMZ]
[Field] [M1] [M2] [M3] [M4] [M5] [GY]   [Banished]
[Extra] [S1] [S2] [S3] [S4] [S5] [Deck]
[  hand: cards overlap to fit the width, never scroll  ]
```

- **Desktop (≥ lg):** board centred; side panel with the card panel (`CardFacts` for the last card
  touched) above the history. Toolbar: Deck, Shuffle + draw 5, Draw 1, End turn, Undo, Redo, Play,
  Reset.
- **Phone (375 px):** the seven columns fit at about 46 px per card. Card panel and history move to a bottom
  sheet with tabs. The hand never scrolls horizontally because scrolling would fight the drag; cards overlap
  more as the hand grows.
- **Piles** (Deck, Extra, GY, Banished) show a count and the top card. Tapping one opens a non-modal panel
  listing its cards in order; they drag from the panel onto the board, which stays visible. That is how a
  specific hand is built from the open deck.
- **Card visuals:** face-down on the field shows `back.webp`; DEF rotates 90°; negated is desaturated with an icon;
  counters as a badge; Xyz materials peek out under the monster with a count. On an `activate` step the
  card glows and an SVG arrow runs to each target; with `prefers-reduced-motion` the glow becomes an outline
  and nothing animates.

### Gestures

| | Desktop | Phone |
|---|---|---|
| Show details | click | tap |
| Move | drag | drag (after `MOVE_SLOP`) |
| Set / bottom of pile | Shift on drop | card menu |
| Activate | double-click | double-tap |
| Card menu | right-click | long-press (`useLongPress`) |

**Card menu** (shows only what applies in the card's zone): Activate · Activate with targets… (target mode:
tap targets, then Confirm; Escape cancels) · Flip · ATK/DEF · Negate · Counters + / − · Move to… (every
zone; piles offer top or bottom) · Details.

**Move to…** is also the keyboard path: every card is a `button`, Enter or the context-menu key opens the
menu. Shortcuts: Ctrl/Cmd+Z undo, Ctrl/Cmd+Y and Ctrl/Cmd+Shift+Z redo, ←/→ step, Space play/pause.
Shortcuts are ignored while focus is in a text field.

### Drag

`dropAction(board, card, zone, shift) → Action | null` is pure: it maps a drop to the action (empty slot →
`move`; Shift on a monster slot → face-down DEF; Shift on a spell slot → face-down; Shift on a pile →
`at: 'bottom'`; occupied monster slot → material; invalid → `null`). The pointer layer only captures the
pointer, moves a ghost, and on release finds the zone under the finger with `elementFromPoint` and the
nearest `[data-zone]`. A drop that maps to `null` snaps back.

## History and replay

- **History** lists every action as a readable row with the card's thumbnail: "Ash Blossom: Hand → GY",
  "Activated Branded Fusion → Albaz", "Drew 5", "End of turn 1". Clicking a row moves `cursor` there and
  the board shows that moment. Acting with the cursor before the end drops the actions after it.
- **Replay** plays from `start` to the end, one step every ~800 ms, with pause; ←/→ step. Moves animate
  with FLIP (Web Animations API), only under `motion-safe`. "Replay starts here" on a history row sets
  `start`, so a replay can open on the finished hand and show only the combo. Speed control and per-step
  waits are out until someone asks.

## Deck loading

- The Deck button opens `DeckPicker`. Picking a deck starts a new session; when the current one has
  actions, a confirm dialog asks first.
- `/simulator?d=<ydke>&name=…&deck=<id>` boots with that deck, like the calculator. A damaged `?d=`
  opens empty with a notice. This gives sub-project 4 its "Open in simulator" link for free.

## Draft

- The `Session` is written to `localStorage` (`simulator:draft`) after every action and read on load when
  there is no `?d=`. Reads and writes sit in `try/catch` and the page works without storage.
- The read is validated like an untrusted payload: deck limits (`assertDeck`), every action's shape and
  ranges, `cursor` and `start` within `actions.length`, at most 2000 actions. Anything off discards the
  draft silently and the page opens empty.

## Errors

- A deck that fails to load shows an `Alert`, as the picker does.
- A passcode missing from the card cache renders as `CardTile`'s plate with the passcode.
- An action the reducer rejects changes nothing; the drop snaps back.

## Testing

Vitest + Testing Library (happy-dom), as the rest of the app.

- `utils/simulator/board.test.ts`: every row of the reducer table; `shuffle` determinism; replaying the
  same log twice gives equal boards.
- `utils/simulator/drop.test.ts`: the `dropAction` table.
- `utils/simulator/draft.test.ts`: valid draft, corrupted JSON, tampered action, out-of-range cursor.
- `app/simulator/simulator.client.test.tsx`: open a card menu, use Move to…, check the zone and the new
  history row; undo restores it.
- i18n: a `Simulator` namespace in `messages/en.json` and `messages/pt.json`.

## Files

| File | Holds |
|---|---|
| `utils/simulator/types.ts` | `Card`, `ZoneId`, `Board`, `Action`, `Session`, limits |
| `utils/simulator/board.ts` | `initial`, `apply`, `boardAt(session)` |
| `utils/simulator/drop.ts` | `dropAction` |
| `utils/simulator/draft.ts` | `readDraft`, `writeDraft`, the validator |
| `app/simulator/page.tsx`, `simulator.loader.tsx` | Metadata, `Header`, `ssr: false` loader |
| `app/simulator/simulator.client.tsx` | Session state, toolbar, shortcuts, boot |
| `app/simulator/board.tsx` | Zones, cards, drag layer, target arrows |
| `app/simulator/card-menu.tsx` | Card menu and target mode |
| `app/simulator/history.tsx` | History rows and replay controls |

## Out of scope

- Opponent side, hand traps played by the opponent, a second deck.
- Rules: summon limits, once-per-turn, costs, chain resolution, life points, phases.
- Image recognition of decks (the reference reads Neuron screenshots; Omega has the deck list already).
- Share links, server storage, wiki embeds, deck "Combos" tab (sub-projects 2–4).
- Replay speed control, per-step waits, grouping simultaneous moves.
