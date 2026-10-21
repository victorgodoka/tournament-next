# Calculator tag board — design

Date: 2026-10-20
Status: approved in brainstorming, awaiting spec review
Repos: `tournament-next` (front only). No backend change.
Builds on: `2026-10-18-combo-calculator-design.md`.

## Goal

Replace the calculator's per-row role chips (`app/calculator/card-roles.tsx`) with a **tag board**: a brush
strip of tags over a grid of the deck's cards, where the player picks a tag and paints it onto cards, plus a
hands-on tour that teaches it. The interaction model is the one players know from other probability tools
(tag palette, paint on cards, guided tour); the look and the details are our own, and several of them do
more than those tools do:

- Which tags count is derived from the player's own hands, not a fixed list.
- A drag paints several cards in one stroke; number keys pick a brush.
- Without a brush, a plain click opens the card's menu; right-click and long-press always do.
- The playable-hand percentage shows the change each paint caused.
- One tile per distinct card (`×N`), since tags belong to the card, not the copy.
- The tour waits for the player to do each step rather than describing it.

## Decisions

| Topic | Decision |
|---|---|
| Placement | `/calculator` only. The deck builder keeps its "Combo Calculator" export link. |
| Tag depth | Flat tags (strings), richer presentation: glyph, colour, description, suggested rule. No sub-modes, no going-first flags, no search/draw semantics. |
| Defaults | 8 default tags (below). Still plain strings: saved deck `tags`, share links and `normalizeRole` are unchanged. |
| Auto-tag | Out of scope. Public decks barely carry tags yet. |
| Layout | Brush strip (sticky) over a card grid in the main column; the aside keeps draw settings and focus, with an odds headline on top. |
| Tour | 5 action-driven spotlight steps; opens once on first visit; `?` reopens. |
| Icons | New solid glyphs in `@ui/icon`'s `PATHS`, tinted per tag. |

## Tag model

### Default tags (`utils/combo/types.ts`)

`DEFAULT_ROLES` grows from `['Starter', 'Extender', 'Hand Trap', 'Brick']` to:

`['Starter', 'Extender', 'Hand Trap', 'Board Breaker', 'Brick', 'Non-Engine', 'Searcher', 'Needs Normal Summon']`

The original four keep their spelling (Brick moves from fourth to fifth; order only affects palette display), so existing decks and links read the same. `palette(roles)`
already returns the defaults then the custom tags in use, so the strip order is the palette order.

### Tag metadata (`app/calculator/tags.ts`)

```ts
type TagMeta = { icon: IconName; tone: string; suggest: 'need' | 'avoid' | null }
export const TAG_META: Record<string, TagMeta>   // keyed by default role name
export const tagMeta = (role: string): TagMeta   // a default's meta (any spelling), else CUSTOM
export const suggestedRule = (role: string): Rule | null
```

| Tag | Glyph | Tone (CSS colour token) | Suggest |
|---|---|---|---|
| Starter | `play` (exists) | `--color-win` | need → `≥ 1` |
| Extender | `extend` | `--color-series-1` | none |
| Hand Trap | `hand` | `--color-series-2` | none |
| Board Breaker | `burst` | `--color-series-3` | none |
| Brick | `brick` | `--color-loss` | avoid → `= 0` |
| Non-Engine | `ring` | `--color-series-4` | none |
| Searcher | `search` (exists) | `--color-series-5` | none |
| Needs Normal Summon | `summon` | `--color-series-6` | none |
| custom | `tag` | `--color-ink-muted` | need → `≥ 1` |

`suggest: null` tags have no "use in hands" action. Descriptions are i18n strings
`Calculator.tags.desc.<key>` (en and pt), keyed by a slug of the default name; custom tags have none.

### Reducer (`app/calculator/calculator.reducer.ts`)

New action `{ type: 'setRole'; id: number; role: string; on: boolean }`: `on` adds the role (`addRole`),
`!on` removes it (any spelling). The same state back when nothing changes. A drag stroke uses it so every
tile in the stroke gets the same direction. `toggleRole` stays for the card menu.

`utils/combo/roles.ts` gains `removeRole(roles, id, role)` (the removal half of `toggleRole`, which then
uses it).

"Use in hands" reuses existing actions: with hands, one `addRule` per hand that does not already have a
rule on that role; with no hands, `addHand` with a hand holding just that rule.

## UI

### Layout (`calculator.client.tsx`)

`<CardRoles …>` is replaced by `<TagBoard …>` with the same inputs plus `hands` (to derive the groups),
`onSetRole`, `onSuggest` and `onPainted`. The aside gets `<OddsHeadline>` above `<DrawSettings>`.

```
┌───────────────────────────────────────────┬──────────────────┐
│ In your hands: [▶ Starter 6] [▦ Brick 2]  │ Playable  74.3%  │ sticky
│ Labels: [✋ Hand Trap 3 +] … [+ New] [?]  │      ▲ +3.1      │
│ Painting Brick: makes the hand dead · Esc │ Draw settings    │
├───────────────────────────────────────────┤ Focus            │
│ Untagged 9 ┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐┌──┐   │                  │
│            │×3││×2││×1││  ││  ││  ││  │   │                  │
│            └──┘└──┘└──┘└──┘└──┘└──┘└──┘   │                  │
│ Hands · Compare · Sweeps · Simulator      │                  │
└───────────────────────────────────────────┴──────────────────┘
```

### `tag-board.tsx`

UI-only state: `brush: string | null`, `dimTagged: boolean`, `menu: { id: number } | null`, `creating: boolean`.

**Brush strip** (`data-tour="strip"`), sticky under the site header on `lg`, fixed to the bottom of the
viewport below `lg` (horizontal scroll, safe-area padding, the grid gets matching bottom padding):

- Two groups. **In your hands**: tags any rule of any hand references (`rule.subject.kind === 'role'`,
  `sameRole`). **Labels**: the rest of the palette. A group with no tags is not rendered.
- Each pill: glyph in the tag's tone, name, copies carrying it in the main deck (`subjectCopies`), and the
  key hint `1`–`9` for the first nine pills in display order ('In your hands' first, then 'Labels') (`lg` only). `aria-pressed` when it is the brush.
  Clicking the active pill puts the brush down.
- A label with a suggested rule shows a small `+` button "Use in hands" (`aria-label` names the rule).
- `+ New tag`: an inline text field (≤ 24 chars, `normalizeRole`); Enter makes it the brush. It joins the
  palette once a card carries it (the palette is derived from roles, as today).
- **Untagged N** toggle: N is distinct main cards with ≥ 1 copy and no tag. Pressed: tagged tiles dim.
- `?` button reopens the tour.
- Status line, only with a brush: the tag's description (or "Custom tag") and "Esc to stop" (`aria-live`).

**Grid** (`data-tour="grid"`): one `CardTile` (`app/deck-builder/card-tile.tsx`, used as is, not modified)
per row of `view.rows`, `count` = copies, wrapped in a relative cell that adds:

- Tag pips along the bottom edge: one dot per tag in the tag's tone, max 4 then `+N`.
- A 2px ring in the brush's tone when the card carries the brush's tag.
- 0-copy rows dimmed (they are still in the original deck; Restore deck brings them back).
- Grid: `grid-template-columns: repeat(auto-fill, minmax(76px, 1fr))`; `minmax(64px, 1fr)` below `sm`.

**Pointer handling** (on each cell):

- `pointerdown` with a brush (mouse, or touch tap): `on = !has(brush)`, `setRole(id, brush, on)`, start a
  stroke `{ on }`, call `onPainted()`. `pointerenter` while a stroke is live and the primary button is held
  (`e.buttons & 1`): `setRole(id, brush, stroke.on)`. `pointerup`/`pointercancel` anywhere ends the stroke
  (a `window` listener added on stroke start). Touch does not drag-paint (it scrolls); each tap paints.
- `click` without a brush: opens the menu.
- `contextmenu` (mouse) or long-press (`useLongPress` from `app/deck-builder/gestures.ts`): opens the menu,
  brush or not; `preventDefault` on `contextmenu`.
- Keyboard: tiles are buttons. Enter/Space with a brush paints; without one, opens the menu.

**Keys** (a `keydown` listener on `window` while the board is mounted, ignored when focus is in an input,
textarea, select or contenteditable): `1`–`9` pick that palette entry as brush (again: put down); `Escape`
puts the brush down, or closes the menu first when it is open.

**Card menu** (native `popover="auto"`, anchored under the tile via its bounding rect, flipped above when
there is no room; a bottom sheet below `sm`), `role="dialog"`, labelled by the card name:

- Card name, OPT/HOPT chip (`oncePerTurn`), "Changed" chip when copies differ from the loaded deck.
- Copies − N + within `copyLimit(card, banlist)` (same rules and `aria-*` as today's row).
- A checklist of every palette tag (checkbox per tag, `toggleRole`), plus the new-tag field.
- Closes on Escape, outside click (popover light dismiss) and when the card leaves the grid.

The Main Deck panel's title, size meta, "not drawn" line and Restore button carry over from `CardRoles`.

### `odds-headline.tsx`

Above `DrawSettings` in the aside (`data-tour="odds"`). Shows "Playable hand" and `percent(any.p)` when the
analysis has hands and the evaluation succeeded; otherwise a one-line hint ("Add a hand to see the odds").
Delta: `TagBoard` calls `onPainted()` before dispatching a paint; the client stores the current `any.p` as
`baseline` (event handler, not effect) and a `paintedAt` time. The headline shows `▲/▼ |p − baseline|` in
percentage points (1 decimal; hidden when it rounds to 0.0) for 4 s after the last paint (a timeout clears
`baseline`). A stroke keeps the baseline from its first tile.

## Hands-on tour (`tour.tsx`)

Steps, each anchored to a `data-tour` element:

| # | Anchor | Text (gist) | Advances when |
|---|---|---|---|
| 1 | `strip` | Pick a tag: it becomes your brush. | a brush is picked |
| 2 | `grid` | Click cards to paint the tag on them; click again to remove it. Drag to paint a row. | 2 paints since step 2 began |
| 3 | `grid` | Press Esc to put the brush down, then click a card: tags and copies live in its menu. Right-click works too. | the card menu opens |
| 4 | `odds` | Every paint moves the odds; the arrow shows by how much. | Next |
| 5 | `hands` (the HandBuilder panel) | A playable hand is a set of rules. Tags under "In your hands" are the ones it uses. | Done |

- `TagBoard` reports events to the tour through a prop `onTour(event: 'brush' | 'paint' | 'menu')`; the
  client holds `tourStep: number | null` and advances it in the event handler.
- **Spotlight**: a fixed element with `pointer-events: none` placed over the anchor's bounding rect (8px
  padding, radius 6) and `box-shadow: 0 0 0 100vmax var(--color-scrim-soft)`. The page stays usable under
  it. Position follows `scroll` (capture) and `resize` through one `requestAnimationFrame` loop while open.
  The anchor is scrolled into view (`block: 'center'`) when a step starts.
- **Card**: `role="dialog"`, `aria-modal="false"`, title + text + `n / 5` + Skip (✕) + Back/Next where the
  step has them. Placed beside the anchor (below, else above, clamped to the viewport); below `sm` it is a
  card fixed to the bottom above the strip. No focus trap; step changes are announced (`aria-live="polite"`).
- **First visit**: opens at step 1 when the deck has ≥ 1 main card and `localStorage['calc-tour']` is not
  `'done'` (read and write in try/catch; on failure the tour simply opens). Skip or Done writes `'done'`.
- `prefers-reduced-motion`: no transitions on the spotlight.

## i18n

New keys under `Calculator` in `messages/en.json` and `messages/pt.json`: `tags.*` (group titles, untagged,
use in hands, new tag, brush status, descriptions per default tag), `menu.*`, `odds.*`, `tour.*`. The
`deck.*` keys the board still uses stay; `deck.addRole`, `deck.addRolePlaceholder` and `deck.roleOf` move
to `tags.*` and are removed from `deck.*`.

## Files

| File | Change |
|---|---|
| `utils/combo/types.ts` | `DEFAULT_ROLES` → 8 tags |
| `utils/combo/roles.ts` | `removeRole`; `toggleRole` uses it |
| `components/ui/icon/*` | glyphs `extend`, `hand`, `burst`, `brick`, `ring`, `summon`, `tag` |
| `app/calculator/tags.ts` | new: `TAG_META`, `tagMeta`, `suggestedRule`, `tagSlug` |
| `app/calculator/calculator.reducer.ts` | `setRole` |
| `app/calculator/tag-board.tsx` | new, replaces `card-roles.tsx` (deleted) |
| `app/calculator/card-menu.tsx` | new |
| `app/calculator/odds-headline.tsx` | new |
| `app/calculator/tour.tsx` | new |
| `app/calculator/calculator.client.tsx` | wiring: board, headline, baseline/delta, tour step, `data-tour="hands"` |
| `messages/en.json`, `messages/pt.json` | keys above |

## Testing

Vitest (`happy-dom` where the DOM is needed), run from this worktree's root:

- `roles.test.ts`: `removeRole`; existing palette tests updated for 8 defaults.
- `calculator.reducer.test.ts`: `setRole` adds, removes, is a no-op when already in that state.
- `tags.test.ts`: `tagMeta` by any spelling, custom fallback, `suggestedRule` for need/avoid/null.
- `tag-board.test.tsx` (replaces `card-roles.test.tsx`): groups split by the hands' rules; pill counts;
  brush paint calls `onSetRole` with the right direction; a stroke over a tagged and an untagged tile uses
  the first tile's direction for both; click without brush opens the menu; `1` picks the first tag and
  `Escape` drops it; "Use in hands" calls `onSuggest`; untagged toggle dims tagged tiles; menu copies
  −/+ respect the limit (cases carried over from `card-roles.test.tsx`).
- `tour.test.tsx`: opens on first visit with cards, not when `'done'`; advances on `brush`, after two
  `paint`, on `menu`; Skip writes `'done'`; storage that throws still opens.

Then `tsc --noEmit` and eslint (no production build), and a browser check on a dev server for this
worktree (port 5174): paint, drag-paint, menu, keys, delta, tour on desktop and at 375px.

## Out of scope

Auto-tag (heuristic or community), tag sub-modes (search/draw/reveal counts, combo lines from a tag),
going-first/second flags, the tag board inside the deck builder, undo.
