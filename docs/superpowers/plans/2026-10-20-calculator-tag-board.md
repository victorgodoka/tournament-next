# Calculator Tag Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the calculator's per-row role chips with a tag board (brush strip + card grid + card menu), an odds headline with a per-paint delta, and a hands-on tour.

**Architecture:** Tags stay plain strings in `Build.roles`; a new `setRole` reducer action backs drag strokes. Presentation metadata and pure helpers live in `app/calculator/tags.ts`. `TagBoard` owns UI-only state (brush, stroke, menu, dim) and reports to the client through callbacks; the client owns the delta baseline and the tour step.

**Tech Stack:** Next 16 / React 19.2, next-intl, Tailwind v4 tokens, Vitest + Testing Library (happy-dom), native `popover`.

**Spec:** `docs/superpowers/specs/2026-10-20-calculator-tag-board-design.md`

## Global Constraints

- Work in the worktree `C:\Users\marti\Documents\tournament-next\.worktrees\calculator-tag-board` (branch `feat/calculator-tag-board`). Never touch the main checkout.
- Do not modify `app/deck-builder/card-tile.tsx` or `app/deck-builder/gestures.ts`; import them as they are.
- No new dependencies.
- React lint: purity and set-state-in-effect are errors. State changes happen in event handlers or lazy `useState` initialisers; effects only subscribe/unsubscribe listeners or write to DOM refs.
- Edit files with Edit/Write only, never sed/python/node (line endings).
- Commits: Conventional Commits, no `Co-Authored-By` trailer.
- Verification is `npx tsc --noEmit`, `npx eslint <files>` and `npx vitest run <paths>`; never `next build`.
- Every user-facing string goes in `messages/en.json` and `messages/pt.json` under `Calculator`.
- Tag names ≤ 24 chars through `normalizeRole`; ≤ 8 tags per card (existing `LIMITS`).
- Touch targets: `max-lg:min-h-11` (the existing `TOUCH` constant) on every button below `lg`.
- Before the first test run: `(Get-Item node_modules).LinkType` must print `Junction`. If `node_modules` is still a plain directory (a stale copy whose last file was locked), remove it and run `New-Item -ItemType Junction -Path node_modules -Target C:\Users\marti\Documents\tournament-next\node_modules` in PowerShell.

## Review Focus

1. Number keys typed into the deck name, a hand name or the new-tag field must type, not switch the brush. Pinned in Task 4.
2. A drag released outside the grid or the window must end the stroke; moving over a tile afterwards must not paint. Pinned in Task 4.
3. A new tag typed as a default in another case (`" brick "`) must become the Brick brush, not a second "brick" tag. Pinned in Task 4.
4. A brush whose tag no card carries yet (a fresh custom tag, or the last card unpainted) must keep its pill, pressed, in the strip. Pinned in Task 4.
5. An analysis that fails (`tooFewCards`, `tooComplex`) must not show a percentage or a delta in the headline. Pinned in Task 5.

---

### Task 1: Tag model: eight defaults, `removeRole`, `setRole`

**Files:**
- Modify: `utils/combo/types.ts:27` (`DEFAULT_ROLES`)
- Modify: `utils/combo/roles.ts` (add `removeRole`; `toggleRole` uses it)
- Modify: `app/calculator/calculator.reducer.ts` (action `setRole`)
- Test: `utils/combo/roles.test.ts`, `app/calculator/calculator.reducer.test.ts`, `app/calculator/use-calculation.test.ts:27`

**Interfaces:**
- Produces: `DEFAULT_ROLES = ['Starter', 'Extender', 'Hand Trap', 'Board Breaker', 'Brick', 'Non-Engine', 'Searcher', 'Needs Normal Summon']`
- Produces: `removeRole(roles: Roles, id: number, role: string): Roles` (same map back when the card lacks the role)
- Produces: `CalcAction` member `{ type: 'setRole'; id: number; role: string; on: boolean }` (same state back when nothing changes)

- [ ] **Step 1: Write the failing tests**

In `roles.test.ts` replace the palette expectation and add `removeRole`:

```ts
it('palette: defaults first, then the roles in use', () => {
  expect(palette(new Map([[1, ['Engine', 'starter']], [2, ['board breaker']]]))).toEqual(['Starter', 'Extender', 'Hand Trap', 'Board Breaker', 'Brick', 'Non-Engine', 'Searcher', 'Needs Normal Summon', 'Engine'])
})
it('removeRole drops any spelling and keeps the same map when absent', () => {
  const roles = new Map([[1, ['Starter', 'Brick']]])
  expect(removeRole(roles, 1, 'brick')).toEqual(new Map([[1, ['Starter']]]))
  expect(removeRole(new Map([[1, ['Brick']]]), 1, 'Brick')).toEqual(new Map())
  expect(removeRole(roles, 1, 'Extender')).toBe(roles)
  expect(removeRole(roles, 2, 'Starter')).toBe(roles)
})
```

In `calculator.reducer.test.ts`:

```ts
it('setRole adds or removes in the asked direction and is a no-op when already there', () => {
  const s0 = initialState({ ...emptyCalculation(), builds: [build({ main: [1] }, new Map([[1, ['Starter']]]))] })
  const on = calculatorReducer(s0, { type: 'setRole', id: 1, role: 'brick', on: true })
  expect(on.calc.builds[0]!.roles).toEqual(new Map([[1, ['Starter', 'Brick']]]))
  expect(calculatorReducer(on, { type: 'setRole', id: 1, role: 'Brick', on: true })).toBe(on)
  const off = calculatorReducer(on, { type: 'setRole', id: 1, role: 'Starter', on: false })
  expect(off.calc.builds[0]!.roles).toEqual(new Map([[1, ['Brick']]]))
  expect(calculatorReducer(off, { type: 'setRole', id: 1, role: 'Starter', on: false })).toBe(off)
})
```

In `use-calculation.test.ts:27` expect the eight defaults.

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run utils/combo/roles.test.ts app/calculator/calculator.reducer.test.ts app/calculator/use-calculation.test.ts`
Expected: FAIL (`removeRole` is not exported; palette has 4 defaults; `setRole` returns undefined).

- [ ] **Step 3: Implement**

`DEFAULT_ROLES` as above. `removeRole` is the removal branch of `toggleRole` (through the existing private `replace`), returning `roles` unchanged when the card has no spelling of the role; `toggleRole` calls it. Reducer case `setRole`: `a.on ? addRole(...) : removeRole(...)`, return `s` when the map comes back identical, else `patchBuild(s, { roles })`.

- [ ] **Step 4: Run to verify they pass, plus the rest of the combo suite**

Run: `npx vitest run utils/combo app/calculator`
Expected: PASS, except tests that query `deck.roleOf`, which Task 4 replaces. Note which ones fail; nothing else may.

- [ ] **Step 5: Commit**

```bash
git add utils/combo/types.ts utils/combo/roles.ts utils/combo/roles.test.ts app/calculator/calculator.reducer.ts app/calculator/calculator.reducer.test.ts app/calculator/use-calculation.test.ts
git commit -m "feat(calculator): eight default tags and a directional setRole"
```

---

### Task 2: Tag metadata, glyphs and copy

**Files:**
- Create: `app/calculator/tags.ts`
- Test: `app/calculator/tags.test.ts`
- Modify: `components/ui/icon/icon.component.tsx` (`PATHS`)
- Modify: `messages/en.json`, `messages/pt.json` (`Calculator.tags`, `Calculator.menu`, `Calculator.odds`, `Calculator.tour`)

**Interfaces:**
- Consumes: `DEFAULT_ROLES`, `sameRole`, `normalizeRole` (Task 1 / existing), `IconName` from `@ui/icon`
- Produces:
  - `type TagMeta = { icon: IconName; tone: string; suggest: 'need' | 'avoid' | null; slug: string | null }`. `tone` is a CSS colour value such as `'var(--color-win)'`; `slug` is the i18n key under `Calculator.tags.desc`, `null` for custom tags.
  - `tagMeta(role: string): TagMeta`: the default's meta for any spelling, else `CUSTOM` (`{ icon: 'tag', tone: 'var(--color-ink-muted)', suggest: 'need', slug: null }`)
  - `suggestedRule(role: string): Rule | null`: `need` → `{ subject: { kind: 'role', role }, min: 1, max: null }`; `avoid` → `min: 0, max: 0`; `null` → `null`. `role` passes through `normalizeRole`.
  - `tagGroups(palette: readonly string[], hands: readonly Hand[]): { used: string[]; labels: string[] }`: palette order kept; `used` = roles some rule of some hand names (`subject.kind === 'role'`, `sameRole`).
  - `untaggedCount(rows: readonly DeckCard[], roles: Roles): number`: rows with `copies > 0` and no role.
  - `roleCopies(rows: readonly DeckCard[], roles: Roles, role: string): number`: `subjectCopies(rows, roles, { kind: 'role', role })`.

Table (spec values, verbatim):

| Role | icon | tone | suggest | slug |
|---|---|---|---|---|
| Starter | `play` | `var(--color-win)` | need | `starter` |
| Extender | `extend` | `var(--color-series-1)` | null | `extender` |
| Hand Trap | `hand` | `var(--color-series-2)` | null | `handTrap` |
| Board Breaker | `burst` | `var(--color-series-3)` | null | `boardBreaker` |
| Brick | `brick` | `var(--color-loss)` | avoid | `brick` |
| Non-Engine | `ring` | `var(--color-series-4)` | null | `nonEngine` |
| Searcher | `search` | `var(--color-series-5)` | null | `searcher` |
| Needs Normal Summon | `summon` | `var(--color-series-6)` | null | `needsNormalSummon` |

- [ ] **Step 1: Write the failing test `tags.test.ts`**

```ts
describe('tags', () => {
  it('tagMeta finds a default by any spelling and falls back to custom', () => {
    expect(tagMeta('hand trap')).toMatchObject({ icon: 'hand', slug: 'handTrap', suggest: null })
    expect(tagMeta('Engine')).toEqual({ icon: 'tag', tone: 'var(--color-ink-muted)', suggest: 'need', slug: null })
  })
  it('suggestedRule: need is ≥ 1, avoid is = 0, none is null', () => {
    expect(suggestedRule('starter')).toEqual({ subject: { kind: 'role', role: 'Starter' }, min: 1, max: null })
    expect(suggestedRule('Brick')).toEqual({ subject: { kind: 'role', role: 'Brick' }, min: 0, max: 0 })
    expect(suggestedRule('Hand Trap')).toBeNull()
    expect(suggestedRule('Engine')).toEqual({ subject: { kind: 'role', role: 'Engine' }, min: 1, max: null })
  })
  it('tagGroups splits by the rules of every hand, keeping palette order', () => {
    const hands = [{ name: '', rules: [{ subject: { kind: 'role', role: 'brick' }, min: 0, max: 0 }] }, { name: '', rules: [{ subject: { kind: 'card', id: 1 }, min: 1, max: null }, { subject: { kind: 'role', role: 'Starter' }, min: 1, max: null }] }] as Hand[]
    expect(tagGroups(['Starter', 'Extender', 'Brick', 'Engine'], hands)).toEqual({ used: ['Starter', 'Brick'], labels: ['Extender', 'Engine'] })
    expect(tagGroups(['Starter'], [])).toEqual({ used: [], labels: ['Starter'] })
  })
  it('untaggedCount ignores 0-copy rows; roleCopies sums copies', () => {
    const rows = [{ id: 1, copies: 3, card: null, passcode: 1 }, { id: 2, copies: 0, card: null, passcode: 2 }, { id: 3, copies: 2, card: null, passcode: 3 }]
    const roles = new Map([[1, ['Starter']]])
    expect(untaggedCount(rows, roles)).toBe(1)
    expect(roleCopies(rows, roles, 'starter')).toBe(3)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run app/calculator/tags.test.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Add glyphs to `PATHS`**

Seven 24×24 solid paths, evenodd, matching the set's weight. Each line names the shape to draw:
- `extend`: a short arrow continuing from a filled bar.
- `hand`: an open palm.
- `burst`: an eight-point starburst.
- `brick`: two offset rows of bricks.
- `ring`: a thick circle with a hollow centre.
- `summon`: an upward chevron over a flat base.
- `tag`: a luggage tag with a hole.

- [ ] **Step 4: Implement `tags.ts`** with the table and signatures above.

- [ ] **Step 5: Add the copy**

The exact strings to merge under `"Calculator"` in each file:

`messages/en.json`
```json
"tags": {
  "title": "Tags",
  "inHands": "In your hands",
  "labels": "Labels",
  "brush": "{role} brush, {count} in deck",
  "useInHands": "Use {role} in your hands",
  "newTag": "New tag",
  "newTagPlaceholder": "Tag name",
  "untagged": "Untagged {count}",
  "untaggedHint": "Dim the cards that already have a tag",
  "help": "How tagging works",
  "painting": "Painting {role}",
  "stop": "Esc to stop",
  "custom": "Custom tag",
  "toggle": "{role} on {name}",
  "tile": "{name}, {count} in deck",
  "desc": {
    "starter": "Opens a full combo by itself.",
    "extender": "Adds to a combo already under way.",
    "handTrap": "Interrupts the opponent straight from your hand.",
    "boardBreaker": "Answers a set-up board when you go second.",
    "brick": "Can't do anything when drawn.",
    "nonEngine": "Not part of the combo: staples, techs, siding.",
    "searcher": "Finds other cards: searches, draws, excavates.",
    "needsNormalSummon": "Spends your one Normal Summon for the turn."
  }
},
"menu": { "copies": "Copies", "tags": "Tags", "close": "Close" },
"odds": { "playable": "Playable hand", "noHands": "Add a playable hand to see the odds", "up": "Up {points} points", "down": "Down {points} points" },
"tour": {
  "progress": "{n} / {total}",
  "skip": "Skip tour",
  "back": "Back",
  "next": "Next",
  "done": "Done",
  "doIt": "Do it to continue",
  "s1Title": "Pick a brush",
  "s1": "Click a tag: it becomes your brush. Keys 1–9 work too.",
  "s2Title": "Paint your cards",
  "s2": "Click cards to paint the tag on, click again to take it off. Hold and drag to paint several.",
  "s3Title": "Every card has a menu",
  "s3": "Press Esc to put the brush down, then click a card: its tags and copies are there. Right-click opens it any time.",
  "s4Title": "Watch the odds",
  "s4": "Each paint moves the playable-hand odds; the arrow shows by how much.",
  "s5Title": "Your playable hand",
  "s5": "A playable hand is a set of rules. Tags it uses sit under “In your hands”; the + on a label adds it."
}
```

`messages/pt.json`
```json
"tags": {
  "title": "Tags",
  "inHands": "Nas suas mãos",
  "labels": "Rótulos",
  "brush": "Pincel {role}, {count} no deck",
  "useInHands": "Usar {role} nas suas mãos",
  "newTag": "Nova tag",
  "newTagPlaceholder": "Nome da tag",
  "untagged": "Sem tag {count}",
  "untaggedHint": "Esmaecer as cartas que já têm tag",
  "help": "Como funcionam as tags",
  "painting": "Pintando {role}",
  "stop": "Esc para parar",
  "custom": "Tag personalizada",
  "toggle": "{role} em {name}",
  "tile": "{name}, {count} no deck",
  "desc": {
    "starter": "Abre um combo completo sozinha.",
    "extender": "Soma a um combo já em andamento.",
    "handTrap": "Interrompe o oponente direto da sua mão.",
    "boardBreaker": "Responde a um campo montado quando você joga em segundo.",
    "brick": "Não faz nada quando comprada.",
    "nonEngine": "Fora do combo: staples, techs, side.",
    "searcher": "Encontra outras cartas: busca, compra, escava.",
    "needsNormalSummon": "Gasta a sua única Invocação-Normal do turno."
  }
},
"menu": { "copies": "Cópias", "tags": "Tags", "close": "Fechar" },
"odds": { "playable": "Mão jogável", "noHands": "Adicione uma mão jogável para ver as chances", "up": "Subiu {points} pontos", "down": "Caiu {points} pontos" },
"tour": {
  "progress": "{n} / {total}",
  "skip": "Pular tour",
  "back": "Voltar",
  "next": "Próximo",
  "done": "Pronto",
  "doIt": "Faça para continuar",
  "s1Title": "Escolha um pincel",
  "s1": "Clique numa tag: ela vira o seu pincel. As teclas 1–9 também servem.",
  "s2Title": "Pinte as suas cartas",
  "s2": "Clique nas cartas para pintar a tag, clique de novo para tirar. Segure e arraste para pintar várias.",
  "s3Title": "Toda carta tem um menu",
  "s3": "Aperte Esc para largar o pincel e clique numa carta: as tags e as cópias estão lá. O botão direito abre a qualquer momento.",
  "s4Title": "Veja as chances",
  "s4": "Cada pintura mexe nas chances de mão jogável; a seta mostra quanto.",
  "s5Title": "A sua mão jogável",
  "s5": "Uma mão jogável é um conjunto de regras. As tags que ela usa ficam em “Nas suas mãos”; o + num rótulo adiciona."
}
```

- [ ] **Step 6: Run the test, then type-check**

Run: `npx vitest run app/calculator/tags.test.ts` → PASS. `npx tsc --noEmit` → no new errors.

- [ ] **Step 7: Commit**

```bash
git add app/calculator/tags.ts app/calculator/tags.test.ts components/ui/icon/icon.component.tsx messages/en.json messages/pt.json
git commit -m "feat(calculator): tag metadata, glyphs and copy"
```

---

### Task 3: Card menu

**Files:**
- Create: `app/calculator/card-menu.tsx`
- Test: `app/calculator/card-menu.test.tsx`

**Interfaces:**
- Consumes: `tagMeta` (Task 2), `copyLimit`, `oncePerTurn`, `DeckCard` (existing), `normalizeRole`
- Produces:
```ts
type CardMenuProps = {
  row: DeckCard
  roles: Roles
  palette: readonly string[]
  /** The tile the menu opened from: positions it. */
  anchor: HTMLElement | null
  changed: boolean
  banlist: Banlist | null
  onToggle(id: number, role: string): void
  onCopies(id: number, copies: number, passcode: number): void
  onClose(): void
}
export const CardMenu: (p: CardMenuProps) => JSX.Element
```

Behaviour (spec, Card menu):
- A `div` with `popover="auto"`, `role="dialog"` and `aria-label` = card name (or passcode). A ref callback calls `el.showPopover?.()` on mount. Below `sm` it is a bottom sheet (`max-sm:inset-x-0 max-sm:bottom-0 max-sm:top-auto`). From `sm`, a positioning function sets `style.top/left` from `anchor.getBoundingClientRect()`: below the tile, flipped above when `rect.bottom + menuHeight > innerHeight`, left clamped to `[8, innerWidth − menuWidth − 8]`. Reuse the chamfer look of `app/deck-builder/toolbar.tsx`'s `MENU` (`cut notch`, `--fill: var(--color-surface-200)`), minus its fixed `top-32`.
- The `toggle` event with `newState === 'closed'` calls `onClose()` (covers light dismiss and Escape).
- Content: name; OPT/HOPT chip (`deck.opt` / `deck.hopt`, title `deck.optHint`); `deck.changed` chip when `changed`; the copies group (aria-label `deck.copiesOf`) with −/count/+ buttons (`deck.fewer` / `deck.more`, `aria-disabled` at 0 / at `copyLimit`), identical to today's row; a `menu.tags` list with one checkbox per palette tag (glyph in tone, label `tags.toggle` with `{ role, name }`, checked by `sameRole`, change → `onToggle(row.id, role)`); the new-tag field (`tags.newTag` aria-label, `tags.newTagPlaceholder`, maxLength 24; Enter with a non-empty `normalizeRole` → `onToggle`, clears); a ✕ button `menu.close` → `onClose()`.

- [ ] **Step 1: Write the failing tests** (mock `next-intl` to return keys, as `card-roles.test.tsx` does; carry its fixtures `magician`, `limitedCard`, `tcgList`, `row`)

```ts
it('lists every palette tag as a checkbox and toggles it', () => {
  const onToggle = vi.fn()
  render(<CardMenu row={row(1, 1, magician)} roles={new Map([[1, ['Starter']]])} palette={['Starter', 'Brick']} anchor={null} changed={false} banlist={null} onToggle={onToggle} onCopies={noop} onClose={noop} />)
  const boxes = screen.getAllByRole('checkbox', { name: 'tags.toggle' }) as HTMLInputElement[]
  expect(boxes.map((b) => b.checked)).toEqual([true, false])
  fireEvent.click(boxes[1]!)
  expect(onToggle).toHaveBeenCalledWith(1, 'Brick')
})
it('caps + at the format limit, marks a changed card, badges HOPT', () => { /* limitedCard at 1 copy with tcgList: deck.more aria-disabled="true"; deck.fewer → onCopies(1, 0, 1); 'deck.changed' shown; a HOPT description shows 'deck.hopt' */ })
it('Enter on the new-tag field toggles the normalised tag and clears', () => { /* ' brick ' → onToggle(1, 'Brick'); value '' */ })
it('closes on its toggle event and on ✕', () => { /* dispatch new Event('toggle') with newState 'closed' (Object.assign) → onClose; click 'menu.close' → onClose */ })
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run app/calculator/card-menu.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `card-menu.tsx`** per Behaviour.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run app/calculator/card-menu.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/calculator/card-menu.tsx app/calculator/card-menu.test.tsx
git commit -m "feat(calculator): card menu with tags and what-if copies"
```

---

### Task 4: Tag board replaces the role rows

**Files:**
- Create: `app/calculator/tag-board.tsx`
- Test: `app/calculator/tag-board.test.tsx`
- Delete: `app/calculator/card-roles.tsx`, `app/calculator/card-roles.test.tsx`
- Modify: `app/calculator/calculator.client.tsx:357-367` (render `TagBoard`), `app/calculator/calculator.client.test.tsx` (the four tests at lines 114, 137, 166 and 176)
- Modify: `messages/en.json`, `messages/pt.json`: remove `deck.addRole`, `deck.addRolePlaceholder`, `deck.roleOf`

**Interfaces:**
- Consumes: `tagMeta`, `tagGroups`, `untaggedCount`, `roleCopies` (Task 2); `CardMenu` (Task 3); `setRole` action (Task 1); `CardTile` (`@app/deck-builder/card-tile`), `useLongPress` (`@app/deck-builder/gestures`)
- Produces:
```ts
export type TourEvent = 'brush' | 'paint' | 'menu'
type TagBoardProps = {
  rows: DeckCard[]
  roles: Roles
  palette: string[]
  hands: readonly Hand[]
  originalCopies: ReadonlyMap<number, number>
  banlist: Banlist | null
  notDrawn: number
  onSetRole(id: number, role: string, on: boolean): void
  onToggle(id: number, role: string): void
  onCopies(id: number, copies: number, passcode: number): void
  onRestore(): void
  /** Adds the tag's suggested rule to the hands (Task 4 wires it in the client). */
  onSuggest(role: string): void
  /** Called once at the start of every paint stroke, before its first `onSetRole`. */
  onPainted?(): void
  onTour?(event: TourEvent): void
  /** The `?` button. Not rendered when absent. */
  onHelp?(): void
}
export const TagBoard: (p: TagBoardProps) => JSX.Element
```

Behaviour: the spec's `tag-board.tsx` section is the source; these are the decisions it leaves open:
- Returns a fragment: the strip (`data-tour="strip"`), then a `Panel` titled `deck.title` with meta `deck.size`, the Restore action (when any row's copies differ from `originalCopies`) and the `deck.notDrawn` line, then the grid (`data-tour="grid"`). The strip sits outside the Panel so `sticky` holds through the left column (`lg:sticky lg:top-[calc(var(--header-h,64px)+8px)] lg:z-(--z-sticky)`). Below `lg` it is `fixed inset-x-0 bottom-0 z-(--z-sticky)` with `pb-[env(safe-area-inset-bottom)]`, and the grid gets `max-lg:pb-24`.
- Pills shown = `palette` plus `brush` when no palette entry `sameRole`s it (Review Focus 4). Key hints/`1`–`9` index into that same shown list, `used` group first then `labels` (the order the strip renders).
- Pill: `button`, `aria-pressed`, `aria-label` `tags.brush` with `{ role, count: roleCopies(...) }`, glyph `<Icon>` with `style={{ color: meta.tone }}`. Click: same tag as brush → `brush = null`; else `brush = role` and `onTour?.('brush')`. A label with `suggestedRule(role)` gets a sibling `+` button, `aria-label` `tags.useInHands` → `onSuggest(role)`.
- New tag: a `+ New tag` button reveals a `TextInput` (autofocus). Enter with `normalizeRole(value)` non-null → `brush = normalized`, `onTour?.('brush')`, field hides. Escape hides it.
- Untagged: `button` with `aria-pressed={dimTagged}`, text `tags.untagged` `{ count: untaggedCount(...) }`, title `tags.untaggedHint`. Pressed: tiles of rows with ≥ 1 role get `opacity-(--opacity-dim)`.
- Status line (only with a brush), `aria-live="polite"`: `tags.painting` `{ role }`, then the description (`tags.desc.<slug>`, or `tags.custom`), then `tags.stop`.
- Cell = `<div className="relative" data-card={row.id}>` around `<CardTile id={row.passcode} card={row.card ?? undefined} sizes="80px" count={row.copies} label={t('tags.tile', { name, count: row.copies })} …>`, then pips (`aria-hidden`, up to 4 dots `size-1.5` in tone, then `+N`) and, when the row carries the brush's tag, a `pointer-events-none absolute inset-0 outline-2` ring in its tone. 0-copy rows: `opacity-(--opacity-dim)`.
- `?` button (`aria-label` `tags.help`) at the strip's end, only when `onHelp` is given. Key hints `1`–`9` render on the first nine shown pills, `max-lg:hidden`.
- Paint = `onPainted?.()`, `onSetRole(id, brush, !hasRole)`, `onTour?.('paint')`. Stroke: `stroke = useRef<{ on: boolean } | null>(null)`. `const { bind, kind } = useLongPress()`, with `bind(openMenu)` spread on every tile.
  - `onPointerDown` with a brush, `e.pointerType === 'mouse'` and `e.button === 0`: paint, `stroke.current = { on }`, then one `window` `pointerup`/`pointercancel` listener (`{ once: true }`) that clears it.
  - `onPointerEnter` with `stroke.current && e.pointerType === 'mouse' && (e.buttons & 1)`: `onSetRole(id, brush, stroke.current.on)` when the row's state differs, plus `onTour?.('paint')`.
  - `onClick`: `kind(e) === 'long'` → nothing (the long-press opened the menu). With a brush: `tap` (touch/pen) or keyboard (`e.detail === 0`) → paint once, no stroke; a mouse click → nothing (its pointer-down painted). Without a brush → open the menu. Touch never paints on pointer-down, so a scroll that starts on a tile paints nothing.
- Menu: `menu = { id, anchor: HTMLElement }` state. Opened by `click` without brush, `contextmenu` (`preventDefault`) and long-press. On open, `onTour?.('menu')`. Rendered only while `rows.some(r => r.id === menu.id)`.
- Keys: a `useEffect` on `[brush, shown, menu]` adds a `keydown` listener on `window`. It's skipped when `e.target` is an `input`, `textarea`, `select` or `[contenteditable]`, or when a modifier is held. `1`–`9` pick the shown pill at that index (same toggle-off and tour rules as a click). `Escape` closes the menu first, else drops the brush.

- [ ] **Step 1: Write the failing tests `tag-board.test.tsx`** (happy-dom; mock `next/image` and `next-intl` like `card-roles.test.tsx`; helper `renderBoard(over: Partial<TagBoardProps>)` with two rows: `row(1, 3, magician)` and `row(2, 1, null)`, `palette: ['Starter', 'Extender', 'Hand Trap', 'Brick']`, `hands: [{ name: '', rules: [{ subject: { kind: 'role', role: 'Starter' }, min: 1, max: null }] }]`)

```ts
it('groups pills by the hands and offers Use in hands only on labels with a suggestion', () => {
  renderBoard()
  expect(screen.getByText('tags.inHands')).toBeTruthy()
  expect(screen.getByText('tags.labels')).toBeTruthy()
  const pills = screen.getAllByRole('button', { name: 'tags.brush' })
  expect(pills).toHaveLength(4) // Starter (used) first, then Extender, Hand Trap, Brick
  expect(screen.getAllByRole('button', { name: 'tags.useInHands' })).toHaveLength(1) // Brick only: Starter is used, the others suggest nothing
})
it('a brush paints on pointer-down in the direction of the first tile and keeps it through the stroke', () => {
  const onSetRole = vi.fn(); const onPainted = vi.fn(); const onTour = vi.fn()
  renderBoard({ roles: new Map([[2, ['Brick']]]), onSetRole, onPainted, onTour })
  fireEvent.click(screen.getAllByRole('button', { name: 'tags.brush' })[3]!) // Brick
  const [a, b] = screen.getAllByRole('button', { name: /tags\.tile/ })
  fireEvent.pointerDown(a!, { button: 0, buttons: 1, pointerType: 'mouse' })
  fireEvent.pointerEnter(b!, { buttons: 1, pointerType: 'mouse' })
  expect(onSetRole.mock.calls).toEqual([[1, 'Brick', true]]) // b already has Brick: the stroke adds, so b is left alone
  expect(onPainted).toHaveBeenCalledTimes(1)
  expect(onTour).toHaveBeenCalledWith('brush')
  expect(onTour).toHaveBeenCalledWith('paint')
})
it('a stroke ends on pointerup anywhere: a later hover does not paint', () => { /* pointerDown a, fireEvent.pointerUp(window), pointerEnter b with buttons 1 → onSetRole called once */ })
it('touch paints on the tap, never on pointer-down', () => { /* pick brush; pointerDown tile 1 with pointerType 'touch' → onSetRole not called; click (detail 1) → onSetRole(1, role, true) once */ })
it('without a brush a click opens the menu; Escape closes it, then a second Escape is a no-op', () => { /* click tile → dialog named 'Dark Magician'; onTour('menu'); keyDown(window, Escape) → no dialog */ })
it('right-click opens the menu even with a brush, and does not paint', () => { /* pick brush, contextMenu on tile → dialog present, onSetRole not called */ })
it('keys 1–9 pick the shown pill; Escape drops the brush; keys typed in a field are ignored', () => {
  renderBoard()
  fireEvent.keyDown(window, { key: '1' })
  expect(screen.getAllByRole('button', { name: 'tags.brush' })[0]!.getAttribute('aria-pressed')).toBe('true')
  fireEvent.keyDown(window, { key: 'Escape' })
  expect(screen.queryByText('tags.stop')).toBeNull()
  fireEvent.click(screen.getByText('tags.newTag'))
  fireEvent.keyDown(screen.getByPlaceholderText('tags.newTagPlaceholder'), { key: '2' })
  expect(screen.getAllByRole('button', { name: 'tags.brush' }).every((p) => p.getAttribute('aria-pressed') === 'false')).toBe(true)
})
it('a new tag in another case becomes the default brush; a fresh custom tag keeps a pressed pill', () => { /* ' brick ' + Enter → Brick pill pressed, pill count still 4; 'Engine' + Enter → 5 pills, last pressed */ })
it('Use in hands calls onSuggest; Untagged dims tagged tiles', () => { /* click tags.useInHands → onSuggest('Brick'); roles {1: Starter}: click tags.untagged → tile 1 cell has class opacity-(--opacity-dim), tile 2 does not */ })
it('the menu closes when its card leaves the rows', () => { /* open menu on tile 1, rerender with rows [row(2,…)] → no dialog */ })
it('Restore shows when copies differ from the loaded deck', () => { /* originalCopies {1: 2} vs row copies 3 → deck.restore shown, click → onRestore */ })
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run app/calculator/tag-board.test.tsx`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement `tag-board.tsx`** per Behaviour.

- [ ] **Step 4: Run to verify they pass**

Run: `npx vitest run app/calculator/tag-board.test.tsx`
Expected: PASS.

- [ ] **Step 5: Wire the client and retire `CardRoles`**

In `calculator.client.tsx`, replace `<CardRoles …>` with `<TagBoard …>`, passing `hands={state.calc.analysis.hands}`, `onSetRole={(id, role, on) => dispatch({ type: 'setRole', id, role, on })}`, the existing `onToggle`, `onCopies`, `onRestore`, and `onSuggest`:

```ts
const suggest = (role: string) => {
  const rule = suggestedRule(role)
  if (!rule) return
  const hands = state.calc.analysis.hands
  if (!hands.length) return dispatch({ type: 'addHand', hand: { name: '', rules: [rule] } })
  hands.forEach((hand, i) => {
    if (!hand.rules.some((r) => r.subject.kind === 'role' && sameRole(r.subject.role, role))) dispatch({ type: 'addRule', hand: i, rule })
  })
}
```

Wrap `<HandBuilder>` in `<div data-tour="hands">`. Delete `card-roles.tsx` and `card-roles.test.tsx`. Remove the three `deck.*` keys from both message files.

In `calculator.client.test.tsx`, replace each `deck.roleOf` click with: click the first tile (`getAllByRole('button', { name: /tags\.tile/ })[0]`), then the first `tags.toggle` checkbox. The share-link test at line 137 asserts the menu's checkboxes instead: Starter `checked`, Brick (index 4 of the 8 defaults) not. `deck.fewer` is now inside the menu: open it first.

- [ ] **Step 6: Run the calculator suite and lint**

Run: `npx vitest run app/calculator utils/combo` → PASS (all). `npx tsc --noEmit` → clean. `npx eslint app/calculator` → clean.

- [ ] **Step 7: Commit**

```bash
git add app/calculator messages/en.json messages/pt.json
git commit -m "feat(calculator): tag board with brush painting replaces role rows"
```

---

### Task 5: Odds headline with the per-paint delta

**Files:**
- Create: `app/calculator/odds-headline.tsx`
- Test: `app/calculator/odds-headline.test.tsx`
- Modify: `app/calculator/calculator.client.tsx` (aside, `onPainted`)

**Interfaces:**
- Consumes: `Evaluation`, `EvaluateError` (`@utils/combo/evaluate`), `percent` (`./results`), `TagBoard.onPainted` (Task 4)
- Produces:
```ts
type OddsHeadlineProps = {
  result: Evaluation | EvaluateError
  hasHands: boolean
  /** `any.p` when the last paint stroke began; `null`: no delta. */
  baseline: number | null
}
export const OddsHeadline: (p: OddsHeadlineProps) => JSX.Element
/** Percentage points, one decimal; `null` when it rounds to 0.0. */
export const deltaPoints = (p: number, baseline: number): number | null
```

Behaviour: a compact `Panel tone="framed"` (`data-tour="odds"`) titled `odds.playable`. With `hasHands` and no `error`, it shows `percent(any.p)` in `display-2` and, when `deltaPoints` is non-null, `▲ +3.1` (`text-win`) or `▼ −3.1` (`text-loss`), with sr-only `odds.up` / `odds.down` `{ points }`. Without hands: `odds.noHands`. With an error: `results.<error>`, no percentage, no delta (Review Focus 5).

Client: `const [baseline, setBaseline] = useState<number | null>(null)` and `const baselineTimer = useRef<ReturnType<typeof setTimeout>>(undefined)`. `onPainted`: when `view.result` has no error, `setBaseline(view.result.any.p)`, then `clearTimeout(baselineTimer.current)` and `baselineTimer.current = setTimeout(() => setBaseline(null), 4000)`. Clear the timer on unmount (`useEffect(() => () => clearTimeout(baselineTimer.current), [])`). Render `<OddsHeadline result={view.result} hasHands={state.calc.analysis.hands.length > 0} baseline={baseline} />` first in the aside.

- [ ] **Step 1: Write the failing tests**

```ts
it('deltaPoints rounds to one decimal and hides 0.0', () => {
  expect(deltaPoints(0.743, 0.712)).toBe(3.1)
  expect(deltaPoints(0.5, 0.5004)).toBeNull()
  expect(deltaPoints(0.4, 0.45)).toBe(-5)
})
it('shows the percentage and an up arrow against the baseline', () => { /* result.any.p 0.743, baseline 0.712 → '74%' (mock formatter), '▲', 'odds.up' */ })
it('no hands: the hint, no percentage', () => { /* hasHands false → 'odds.noHands' */ })
it('an evaluation error shows the error and no delta', () => { /* result { error: 'tooFewCards' }, baseline 0.5 → 'results.tooFewCards', no '▲'/'▼' */ })
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run app/calculator/odds-headline.test.tsx` → FAIL (module not found).

- [ ] **Step 3: Implement the headline and the client wiring.**

- [ ] **Step 4: Run to verify**

Run: `npx vitest run app/calculator` → PASS. Add one client test: open a deck with a Starter hand (`?c=` with a hand `Starter ≥ 1`), paint Starter on card 1 through the board, expect `▲` in the document.

- [ ] **Step 5: Commit**

```bash
git add app/calculator
git commit -m "feat(calculator): odds headline shows what each paint changed"
```

---

### Task 6: Hands-on tour

**Files:**
- Create: `app/calculator/tour.tsx`
- Test: `app/calculator/tour.test.tsx`
- Modify: `app/calculator/calculator.client.tsx` (state, first visit, events, `onHelp`)
- Modify: `app/calculator/calculator.client.test.tsx` (`beforeEach`: `localStorage.setItem('calc-tour', 'done')`; one first-visit test without it)

**Interfaces:**
- Consumes: `TourEvent`, `TagBoard.onTour`/`onHelp` (Task 4); anchors `data-tour="strip" | "grid" | "odds" | "hands"` (Tasks 4–5)
- Produces:
```ts
export type TourState = { step: number; paints: number } | null   // step 1..5
export const TOUR_STEPS: readonly { anchor: 'strip' | 'grid' | 'odds' | 'hands'; key: 's1' | 's2' | 's3' | 's4' | 's5'; waits: TourEvent | null }[]
/** 1 + brush → 2; 2 + paint → paints + 1, at 2 paints → 3; 3 + menu → 4; anything else: the same state back. */
export const tourAfter = (state: TourState, event: TourEvent): TourState
/** `localStorage['calc-tour'] === 'done'`; false when storage throws. */
export const tourSeen = (): boolean
/** Writes 'done'; swallows storage errors. */
export const markTourSeen = (): void
type TourProps = { state: NonNullable<TourState>; onBack(): void; onNext(): void; onClose(): void }
export const Tour: (p: TourProps) => JSX.Element
```

Behaviour: the spec's Hands-on tour section, plus:
- `waits` is `brush`/`paint`/`menu` for steps 1–3 and `null` for 4–5. A waiting step shows `tour.doIt` instead of Next. Step 4 shows Next, step 5 shows `tour.done`. Steps ≥ 2 show Back.
- Spotlight and card are two `fixed` elements positioned by one `useEffect` keyed on `state.step`. It finds `document.querySelector('[data-tour="<anchor>"]')`, calls `scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' })`, then runs a `requestAnimationFrame` loop that writes `style.top/left/width/height` to refs (no React state) and cancels on cleanup. A missing anchor hides the spotlight and centres the card. `reduced` = `matchMedia('(prefers-reduced-motion: reduce)').matches`; the spotlight's move transition is `motion-safe:` only.
- The card is `role="dialog"`, `aria-modal="false"`, `aria-labelledby` its title, with a visually hidden `aria-live="polite"` line repeating `tour.progress` and the title. ✕ uses `aria-label` `tour.skip`.

Client:
- `const [tour, setTour] = useState<TourState>(() => (boot.calc.builds[0]!.deck.main.length > 0 && !tourSeen() ? { step: 1, paints: 0 } : null))`.
- In `DeckPicker`'s `onPick`, after the dispatch, when `tour === null && !tourSeen() && b.deck.main.length > 0`, call `setTour({ step: 1, paints: 0 })`.
- `onTour={(e) => setTour((s) => tourAfter(s, e))}`; `onHelp={() => setTour({ step: 1, paints: 0 })}`.
- Close: `markTourSeen(); setTour(null)` on ✕ and Done. Next/Back move `step` by ±1 with `paints: 0`.

- [ ] **Step 1: Write the failing tests**

```ts
it('tourAfter advances on the awaited events only', () => {
  const s1 = { step: 1, paints: 0 }
  expect(tourAfter(s1, 'paint')).toBe(s1)
  const s2 = tourAfter(s1, 'brush')
  expect(s2).toEqual({ step: 2, paints: 0 })
  expect(tourAfter(tourAfter(s2, 'paint'), 'paint')).toEqual({ step: 3, paints: 0 })
  expect(tourAfter({ step: 3, paints: 0 }, 'menu')).toEqual({ step: 4, paints: 0 })
  expect(tourAfter(null, 'brush')).toBeNull()
})
it('tourSeen and markTourSeen survive a throwing storage', () => {
  const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied') })
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied') })
  expect(tourSeen()).toBe(false)
  expect(() => markTourSeen()).not.toThrow()
  spy.mockRestore()
})
it('renders the step with its buttons: doIt while waiting, Next on 4, Done on 5', () => { /* step 1 → 'tour.s1Title', 'tour.doIt', no 'tour.back'; step 4 → 'tour.next' and 'tour.back'; step 5 → 'tour.done' */ })
it('Skip calls onClose', () => { /* click name 'tour.skip' */ })
```

Client (`calculator.client.test.tsx`), without the `done` flag:

```ts
it('the tour opens on a first visit with a deck and advances as the board is used', async () => {
  localStorage.removeItem('calc-tour')
  await open(`/calculator?d=${encodeURIComponent(toYdke({ main: [1, 2], extra: [], side: [] }))}`)
  expect(screen.getByText('tour.s1Title')).toBeTruthy()
  await act(async () => fireEvent.click(screen.getAllByRole('button', { name: 'tags.brush' })[0]!))
  expect(screen.getByText('tour.s2Title')).toBeTruthy()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'tour.skip' })))
  expect(screen.queryByText('tour.s2Title')).toBeNull()
  expect(localStorage.getItem('calc-tour')).toBe('done')
})
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run app/calculator/tour.test.tsx app/calculator/calculator.client.test.tsx` → FAIL.

- [ ] **Step 3: Implement `tour.tsx` and the client wiring.**

- [ ] **Step 4: Run to verify**

Run: `npx vitest run app/calculator utils/combo` → PASS. `npx tsc --noEmit` → clean. `npx eslint app/calculator components/ui/icon utils/combo` → clean.

- [ ] **Step 5: Commit**

```bash
git add app/calculator
git commit -m "feat(calculator): hands-on tour of the tag board"
```

---

### Task 7: Browser verification

**Files:**
- Create (not committed): `.claude/launch.json` in the worktree (name `calculator-tag-board`, `npm run dev -- --port 5174`, port 5174). Copy `.env.development` from the main checkout if it is missing.

- [ ] **Step 1:** `preview_start` `calculator-tag-board`; open `/calculator?d=<ydke of a 40-card deck>` (build one from any deck in `listMyDecks`, or paste through the picker).
- [ ] **Step 2: Desktop 1280px.** Check that:
  - the tour opens at step 1;
  - picking Brick advances it;
  - two paints advance it;
  - Esc then a click opens the menu and advances it;
  - Skip closes it.
  - Also: drag across three tiles paints all three; `1` picks Starter; the headline shows ▲/▼ after a paint once a hand exists; "Use in hands" on Brick adds `Brick = 0` to the hand; Untagged dims tagged tiles; right-click opens the menu; the strip stays sticky while scrolling to Sweeps.

  Read console errors with `read_console_messages` (no errors).
- [ ] **Step 3: 375px (`resize_window` mobile).** Check that:
  - the strip is pinned to the bottom and scrolls horizontally;
  - a tap paints;
  - a long-press opens the menu as a bottom sheet;
  - the tour card sits above the strip.
- [ ] **Step 4:** Screenshot both widths for the user; reset with `resize_window` preset `desktop`; `preview_stop`.
- [ ] **Step 5:** Fix anything found in the owning task's file, re-run `npx vitest run app/calculator utils/combo`, `npx tsc --noEmit`, `npx eslint app/calculator`, and commit `fix(calculator): …`.
