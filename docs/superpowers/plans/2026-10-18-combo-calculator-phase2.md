# Combo Calculator — Phase 2 (Comparator and Sweeps) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Several builds (≤ 6) in one calculation with tabs, a compare table with deltas against build A, copies / deck-size / turn sweeps charted with a target line, and OPT/HOPT badges on card rows.

**Architecture:** The reducer grows from one build to a list with an active index (`originals` and `saved` become parallel arrays); the share payload already carries `builds[]`, so the link format does not change. A pure `utils/combo/sweep.ts` re-runs `evaluate` over a range (copies of one card, main-deck size, turn), trading copies with filler cards so the deck size holds. Three new client components (`build-tabs.tsx`, `compare.tsx`, `sweeps.tsx`) sit on `TabBar`, `DataTable` and `LineChart` from the design system. No server change.

**Tech Stack:** Next 16 / React 19 / Tailwind 4 / next-intl / Vitest + happy-dom; BigInt engine from phase 1.

**Spec:** `docs/superpowers/specs/2026-10-18-combo-calculator-design.md`, section "Phase 2 — comparator and sweeps" (read it with this plan). Phase 1 plan: `docs/superpowers/plans/2026-10-18-combo-calculator-phase1.md`.

**Decisions made while planning** (the spec leaves these open; Victor confirms them with the plan):

1. **Copies sweep holds the deck size.** Each extra copy replaces one filler card (a card no rule names), each cut copy adds one; the deck only grows when the filler runs out. A player choosing 2 or 3 copies cuts something else, so this is the question they ask.
2. **Deck-size sweep range** is `max(40, N − filler)..max(60, N)`: filler is added or removed, the tagged cards never change. A point the deck cannot serve (`tooFewCards`, `tooComplex`) is dropped from the series instead of breaking the chart.
3. **Active tab, sweep mode, swept card and target are UI state**, not part of the link: the payload stays `v: 1`.
4. **Duplicate drops `deckId`** (a what-if copy is never written back to the saved deck) and keeps the source's loaded deck as its `original`, so Restore and "Changed" keep meaning the same thing.
5. **Build A is the first tab.** No reordering in this phase; "make this the baseline" is a follow-up if wanted.
6. **The hands panel and the single-card panel show the active build**; the compare table shows all builds. Draw settings and hands are shared, as the spec says.
7. **Sweeps get their own file** (`sweeps.tsx`); the spec listed them under `compare.tsx`.
8. **Tabs span the page** above both columns, so on a phone they sit above the draw settings too.
9. **`deckMeta` and `setSaved` apply to every build sharing the deck id** (the same saved deck opened twice).
10. **The "reaches the target at…" line is printed per series** (each hand and Any), not only for Any.

## Global Constraints

- Repo: front worktree `C:\Users\marti\Documents\tournament-next\.claude\worktrees\gallant-mirzakhani-04dff0`, branch `claude/gallant-mirzakhani-04dff0`, cut from `claude/yugioh-hypergeometric-calculator-0b5d62` (phase 1 is not in `main` yet). Never `cd` to the original checkout. `omega-server-v3` is not touched.
- Every commit stages only the files its task lists (`git add <paths>`), never `git add -A` / `.`. No `Co-Authored-By` or "Generated with" lines in commit messages.
- Edit files with the Edit/Write tools, not `sed -i` or scripts (Git Bash flips CRLF/LF).
- Verification is `pnpm exec tsc --noEmit`, `pnpm exec eslint <touched paths>` (project-wide `pnpm lint` has a pre-existing error in `app/banlist-timeline/timeline.tsx`, not ours), `pnpm vitest run <path>`; never `next build`. The dev server for browser checks runs from this worktree on a port other than 5173; the local API (Docker, :3000) only allows origin :5173, so a temporary `next.config.ts` rewrite proxy is used and reverted before any commit.
- React lint treats impure render and set-state-in-effect as errors: derive UI defaults during render (`selected ?? default`), never `setState` in an effect to copy a prop.
- Design system only: `Panel`, `TabBar` + `tabPanelProps`, `DataTable`, `LineChart`, `Segmented`, `Select`, `TextInput`, `Field`, `Button`, `Chip`, `Alert` from `components/ui`; tokens from `app/styles.css`. No new colours or radii.
- Every UI string goes in `messages/en.json` and `messages/pt.json` under `Calculator`, added in the task that renders it.
- Limits (spec): ≤ 6 builds (`LIMITS.builds`); deck-size sweep 40..60; turn sweep 1..6; copies sweep 0..`copyLimit`; target 1–100 %, default 80.
- Only `deck.main` is drawn from. Cards group by canonical id. The filler row the sweeps add uses id `-1` and never carries a role.
- Desktop two-column layout from 1024 px, stacked below; tap targets ≥ 44 px below `lg` (`max-lg:min-h-11`, as phase 1).

## Review Focus

1. **A link with six builds where one is `tooFewCards` at the current draw** must show "—" in that column and compute the others. Test: Task 5 (`compareRows` with an error result).
2. **Removing the active build from the last tab** must leave `active` in range and the arrays aligned. Test: Task 3.
3. **Sweeping copies of a card no rule references** gives flat lines at a fixed deck size, never a crash. Test: Task 1.
4. **A duplicate of a saved deck must never write roles back to it**: `deckId` null, Save roles hidden on that tab. Tests: Task 3 (reducer), Task 4 (client).
5. **The turn sweep on a small deck** drops the turns the deck cannot serve instead of throwing. Test: Task 1.

---

### Task 1: Sweep engine

**Files:**
- Modify: `utils/combo/atoms.ts` (export `satisfies`)
- Create: `utils/combo/sweep.ts`
- Test: `utils/combo/sweep.test.ts`

**Interfaces:**
- Consumes: `evaluate`, `Evaluation`, `EvaluateError` (`./evaluate`); `referencedSubjects`, `satisfies` (`./atoms`); `DeckCard` (`./deck-cards`); `Analysis`, `Draw`, `Roles` (`./types`).
- Produces (`sweep.ts`):
  - `type SweepPoint = { x: number; deckSize: number; hands: number[]; any: number }` (`hands[i]` and `any` are probabilities 0–1)
  - `FILLER_ID = -1`; `DECK_SIZE_RANGE = [40, 60] as const`; `TURNS = 6`
  - `sweepCopies(cards: readonly DeckCard[], roles: Roles, analysis: Analysis, draw: Draw, cardId: number, limit: number): SweepPoint[]` — `x` = copies `0..max(limit, current)`; the deck size holds by trading with filler and grows only once the filler is gone; `[]` when `cardId` is not among `cards`
  - `sweepDeckSize(cards, roles, analysis, draw): SweepPoint[]` — `x` = main-deck size from `max(40, N − filler)` to `max(60, N)`; filler added or removed
  - `sweepTurn(cards, roles, analysis, draw): SweepPoint[]` — `x` = turn `1..6`, `draw.turn` replaced
  - `copiesFor(points: readonly SweepPoint[], target: number, series: number | 'any'): number | null` — the first `x` whose `hands[series]` / `any` is `≥ target`; `null` when none. Despite the name it serves all three sweeps (`x` is copies, a deck size or a turn).
  - Points where `evaluate` returns an error are dropped.
- Produces (`atoms.ts`): `export const satisfies(card: DeckCard, roles: Roles, s: Subject): boolean` (existing function, now exported).

- [ ] **Step 1: Write failing tests** in `utils/combo/sweep.test.ts`. Helpers copied from `evaluate.test.ts`: `card(id, copies)` → `DeckCard` with `card: null`, `passcode: id`; `fill(from, count)` → `count` distinct one-copy cards; `range(lo, hi)` → `[lo..hi]`.

```ts
const STARTER = { kind: 'role', role: 'Starter' } as const
const analysis: Analysis = {
  hands: [
    { name: 'a', rules: [{ subject: STARTER, min: 1, max: null }] },
    { name: 'b', rules: [{ subject: { kind: 'card', id: 2 }, min: 1, max: null }] },
  ],
}
// 40 cards: card 1 ×2 Starter, card 2 ×1 (named by a rule), 37 filler
const cards = [card(1, 2), card(2, 1), ...fill(3, 37)]
const roles: Roles = new Map([[1, ['Starter']]])
const ev = (c: DeckCard[], draw = DEFAULT_DRAW) => evaluate(c, roles, analysis, draw) as Evaluation

it('copies: endpoints match evaluate and the deck size holds while filler lasts', () => {
  const pts = sweepCopies(cards, roles, analysis, DEFAULT_DRAW, 1, 3)
  expect(pts.map((p) => [p.x, p.deckSize])).toEqual([[0, 40], [1, 40], [2, 40], [3, 40]])
  expect(pts[0]!.any).toBe(ev([card(1, 0), card(2, 1), ...fill(3, 39)]).any.p)
  expect(pts[3]!.any).toBe(ev([card(1, 3), card(2, 1), ...fill(3, 36)]).any.p)
  expect(pts[2]!.hands).toEqual(ev(cards).hands.map((h) => h.odds.p))
  expect(sweepCopies(cards, roles, analysis, DEFAULT_DRAW, 99, 3)).toEqual([])
})
it('copies: with no filler the deck grows; a card no rule names gives flat lines', () => {
  const tight = [card(1, 1), card(2, 1), card(3, 1)]
  const all: Roles = new Map([[1, ['Starter']], [3, ['Starter']]])
  const draw = { ...DEFAULT_DRAW, handSize: 2 }
  expect(sweepCopies(tight, all, analysis, draw, 1, 3).map((p) => [p.x, p.deckSize])).toEqual([[0, 3], [1, 3], [2, 4], [3, 5]])
  const flat = sweepCopies(cards, roles, analysis, DEFAULT_DRAW, 3, 3) // card 3 is filler
  expect(flat.map((p) => p.deckSize)).toEqual([40, 40, 40, 40])
  expect(new Set(flat.map((p) => p.any)).size).toBe(1)
})
it('deck size: filler bounds the range, x is the size, the current size matches evaluate', () => {
  const pts = sweepDeckSize(cards, roles, analysis, DEFAULT_DRAW)
  expect(pts.map((p) => p.x)).toEqual(range(40, 60))
  expect(pts.every((p) => p.deckSize === p.x)).toBe(true)
  expect(pts[0]!.any).toBe(ev(cards).any.p)
  expect(pts[5]!.any).toBe(ev([card(1, 2), card(2, 1), ...fill(3, 42)]).any.p)
  expect(sweepDeckSize([card(1, 42), card(2, 1), ...fill(3, 2)], roles, analysis, DEFAULT_DRAW).map((p) => p.x)).toEqual(range(43, 60))
})
it('turn: 1..6 matching evaluate, dropping turns the deck cannot serve', () => {
  const pts = sweepTurn(cards, roles, analysis, DEFAULT_DRAW)
  expect(pts.map((p) => p.x)).toEqual([1, 2, 3, 4, 5, 6])
  expect(pts[2]!.any).toBe(ev(cards, { ...DEFAULT_DRAW, turn: 3 }).any.p)
  expect(sweepTurn([card(1, 2), ...fill(2, 10)], roles, analysis, { ...DEFAULT_DRAW, handSize: 10 }).map((p) => p.x)).toEqual([1, 2, 3])
})
it('copiesFor: the first x reaching the target, null when none does', () => {
  const pts: SweepPoint[] = [0.3, 0.6, 0.85, 0.9].map((any, i) => ({ x: i, deckSize: 40, hands: [any / 2], any }))
  expect(copiesFor(pts, 0.8, 'any')).toBe(2)
  expect(copiesFor(pts, 0.85, 'any')).toBe(2)
  expect(copiesFor(pts, 0.95, 'any')).toBeNull()
  expect(copiesFor(pts, 0.4, 0)).toBe(3)
  expect(copiesFor([], 0.5, 'any')).toBeNull()
})
```

- [ ] **Step 2: Run, expect failure.** `pnpm vitest run utils/combo/sweep.test.ts` → cannot resolve `./sweep`.
- [ ] **Step 3: Implement.** Export `satisfies` in `atoms.ts`. In `sweep.ts`, one private `split(cards, roles, analysis, keep?: number): { tagged: DeckCard[]; filler: number }`: `tagged` = cards that satisfy any of `referencedSubjects(analysis, null)` or whose `id === keep`; `filler` = Σ copies of the rest. `withFiller(tagged, n)` appends `{ id: FILLER_ID, copies: n, card: null, passcode: FILLER_ID }` when `n > 0`. `point(x, cards, draw)` runs `evaluate` and maps an `Evaluation` to a `SweepPoint` (`null` on error; callers filter). Copies: `delta = x − current`, `filler' = max(0, filler − delta)`. Deck size: `filler' = filler + (x − N)`. Turn: `{ ...draw, turn: x }`.
- [ ] **Step 4: Run, expect pass.** `pnpm vitest run utils/combo`.
- [ ] **Step 5: Commit**

```bash
git add utils/combo/atoms.ts utils/combo/sweep.ts utils/combo/sweep.test.ts
git commit -m "feat(calculator): copies, deck-size and turn sweeps over the exact engine"
```

### Task 2: OPT / HOPT badges

**Files:**
- Modify: `utils/combo/deck-cards.ts`, `app/calculator/card-roles.tsx`, `messages/en.json`, `messages/pt.json`
- Test: `utils/combo/deck-cards.test.ts`, `app/calculator/card-roles.test.tsx`

**Interfaces:**
- Produces: `oncePerTurn(description: string): 'OPT' | 'HOPT' | null` in `deck-cards.ts` — `'HOPT'` when `/you can only (use|activate) (this|1) .* (once|per turn)/i` matches (checked first), else `'OPT'` when `/once per turn/i` matches, else `null`.
- `CardRoles` renders a `Chip` (`tone="neutral"`, `title={t('deck.optHint')}`) with `t('deck.opt')` / `t('deck.hopt')` after the card name when `row.card` is known and `oncePerTurn(row.card.description)` is not null. Informational only.
- Messages: en `deck.opt: "OPT"`, `deck.hopt: "HOPT"`, `deck.optHint: "Once per turn: extra copies in hand are dead. Consider max 1 in the hand's rule."`; pt `deck.opt: "OPT"`, `deck.hopt: "HOPT"`, `deck.optHint: "Uma vez por turno: cópias extras na mão são mortas. Considere máx 1 na regra da mão."`.

- [ ] **Step 1: Write failing tests.** In `deck-cards.test.ts`:

```ts
it('reads once-per-turn clauses from the card text', () => {
  expect(oncePerTurn('You can only use this effect of "Ash Blossom & Joyous Spring" once per turn.')).toBe('HOPT')
  expect(oncePerTurn('You can only activate 1 "Called by the Grave" per turn.')).toBe('HOPT')
  expect(oncePerTurn('Once per turn: You can target 1 monster; destroy it.')).toBe('OPT')
  expect(oncePerTurn('A dragon with ferocious power.')).toBeNull()
})
```

In `card-roles.test.tsx`, with the file's `row` and `limitedCard` helpers:

```ts
it('badges once-per-turn cards from their text', () => {
  render(<CardRoles {...base} rows={[row(1, 1, { ...limitedCard, description: 'You can only use this effect of "X" once per turn.' })]} />)
  expect(screen.getByText('deck.hopt')).toBeTruthy()
})
```

(`base` is whatever no-op prop set the file already uses for `CardRoles`; add one if the tests pass props inline.)

- [ ] **Step 2: Run, expect failure.** `pnpm vitest run utils/combo/deck-cards.test.ts app/calculator/card-roles.test.tsx`.
- [ ] **Step 3: Implement** `oncePerTurn`, the `Chip` in the name's second line (beside `deck.unknown` / `deck.changed`), and the three strings in both languages.
- [ ] **Step 4: Run, expect pass.** Then `pnpm exec tsc --noEmit`, `pnpm exec eslint utils/combo app/calculator`.
- [ ] **Step 5: Commit**

```bash
git add utils/combo/deck-cards.ts utils/combo/deck-cards.test.ts app/calculator/card-roles.tsx app/calculator/card-roles.test.tsx messages/en.json messages/pt.json
git commit -m "feat(calculator): OPT and HOPT badges from the card text"
```

### Task 3: Reducer holds several builds

**Files:**
- Modify: `app/calculator/calculator.reducer.ts`
- Test: `app/calculator/calculator.reducer.test.ts`, `utils/combo/share.test.ts`

**Interfaces:**
- Consumes: phase 1 reducer; `LIMITS.builds`.
- Produces:
  - `type CalcState = { calc: Calculation; active: number; originals: Deck[]; saved: (Saved | null)[] }` — `originals` and `saved` are aligned with `calc.builds`
  - `initialState(calc: Calculation, saved: Saved | null = null): CalcState` → `active: 0`, `originals = builds.map(b => b.deck)`, `saved = [saved, null, …]`
  - `CalcAction` gains:
    `| { type: 'addBuild'; build: Build; saved: Saved | null }` — appended and made active; ignored at `LIMITS.builds`
    `| { type: 'duplicateBuild'; name: string }` — a copy of the active build (`deck`, `roles`, `format` shared; `name` from the action, `deckId: null`), `original` = the source's original, `saved` null; made active; ignored at the limit
    `| { type: 'removeBuild'; index: number }` — ignored with one build or an index out of range; `active` shifts down when a build before it goes, and lands on the build now at that index (or the last one) when the active build goes
    `| { type: 'setActive'; index: number }` — clamped to `0..builds.length − 1`
  - `load` replaces the **active** build, its `original` and its `saved` (roles of cards that stay kept, as before). `rename`, `setFormat`, `toggleRole`, `setCopies`, `restoreDeck` act on the active build. `deckMeta` and `setSaved` apply to **every** build whose `deckId` matches; unchanged state when none does.
  - `emptyCalculation()` unchanged.

- [ ] **Step 1: Write failing tests.** Update the existing cases: `s1.original` → `s1.originals[0]`, `s1.saved` → `s1.saved[0]` (three places). Add:

```ts
it('adds, duplicates, selects and removes builds, keeping originals and saved aligned', () => {
  const s0 = initialState({ ...emptyCalculation(), builds: [build({ main: [1, 1] })] }, { revision: 1, ownerId: 'u1' })
  const s1 = calculatorReducer(s0, { type: 'addBuild', build: { ...build({ main: [2] }), deckId: 'abcdefabcdefabcd' }, saved: { revision: 4, ownerId: 'u1' } })
  expect(s1.active).toBe(1)
  expect(s1.originals).toEqual([{ main: [1, 1], extra: [], side: [] }, { main: [2], extra: [], side: [] }])
  expect(s1.saved).toEqual([{ revision: 1, ownerId: 'u1' }, { revision: 4, ownerId: 'u1' }])
  const s2 = calculatorReducer(s1, { type: 'duplicateBuild', name: 'B copy' })
  expect(s2.active).toBe(2)
  expect(s2.calc.builds[2]).toEqual({ ...s1.calc.builds[1]!, name: 'B copy', deckId: null })
  expect(s2.saved[2]).toBeNull()
  expect(s2.originals[2]).toEqual({ main: [2], extra: [], side: [] })
  const s3 = calculatorReducer(s2, { type: 'setCopies', id: 2, copies: 3, passcode: 2, cards: new Map() })
  expect(s3.calc.builds[2]!.deck.main).toEqual([2, 2, 2]) // the active build
  expect(s3.calc.builds[1]!.deck.main).toEqual([2]) // the source untouched
  expect(calculatorReducer(s3, { type: 'restoreDeck' }).calc.builds[2]!.deck.main).toEqual([2])
  const s4 = calculatorReducer(s3, { type: 'setActive', index: 0 })
  expect(s4.active).toBe(0)
  expect(calculatorReducer(s4, { type: 'setActive', index: 9 }).active).toBe(2)
  const s5 = calculatorReducer({ ...s4, active: 2 }, { type: 'removeBuild', index: 0 })
  expect(s5.calc.builds.map((b) => b.name)).toEqual(['', 'B copy'])
  expect(s5.active).toBe(1)
  expect(s5.saved).toEqual([{ revision: 4, ownerId: 'u1' }, null])
  expect(s5.originals).toHaveLength(2)
  const s6 = calculatorReducer({ ...s5, active: 0 }, { type: 'removeBuild', index: 0 })
  expect(s6.calc.builds.map((b) => b.name)).toEqual(['B copy'])
  expect(s6.active).toBe(0)
  expect(calculatorReducer(s6, { type: 'removeBuild', index: 0 })).toBe(s6)
})
it('stops at six builds', () => {
  const six = Array.from({ length: 5 }).reduce<CalcState>((s) => calculatorReducer(s, { type: 'addBuild', build: build({ main: [1] }), saved: null }), initialState(emptyCalculation()))
  expect(six.calc.builds).toHaveLength(6)
  expect(calculatorReducer(six, { type: 'addBuild', build: build({ main: [1] }), saved: null })).toBe(six)
  expect(calculatorReducer(six, { type: 'duplicateBuild', name: 'x' })).toBe(six)
})
it('load replaces the active build; deckMeta and setSaved find a build by its deck id', () => {
  const s0 = calculatorReducer(initialState({ ...emptyCalculation(), builds: [build({ main: [1] })] }), { type: 'addBuild', build: { ...build({ main: [2] }), deckId: 'abcdefabcdefabcd' }, saved: null })
  const s1 = calculatorReducer({ ...s0, active: 0 }, { type: 'load', build: build({ main: [3] }), saved: null })
  expect(s1.calc.builds.map((b) => b.deck.main)).toEqual([[3], [2]])
  expect(s1.originals[0]).toEqual({ main: [3], extra: [], side: [] })
  const s2 = calculatorReducer(s1, { type: 'deckMeta', deckId: 'abcdefabcdefabcd', format: 2, roles: new Map([[2, ['Starter']]]), saved: { revision: 3, ownerId: 'u1' } })
  expect(s2.calc.builds[1]).toMatchObject({ format: 2, roles: new Map([[2, ['Starter']]]) })
  expect(s2.calc.builds[0]!.format).toBeNull()
  expect(s2.saved).toEqual([null, { revision: 3, ownerId: 'u1' }])
  expect(calculatorReducer(s2, { type: 'setSaved', deckId: 'bbbbbbbbbbbbbbbb', saved: null })).toBe(s2)
})
```

In `share.test.ts`, with the file's `calc()`, `edit`, `inflateForTest`, `deflateForTest` helpers:

```ts
it('round-trips three builds and refuses seven', async () => {
  const a = calc().builds[0]!
  const three: Calculation = {
    ...calc(),
    builds: [a, { ...a, name: 'B', format: null, deckId: null, roles: new Map([[1001, ['Brick']]]) }, { ...a, name: 'C', deck: { ...a.deck, main: [...a.deck.main, 1037, 1038] } }],
  }
  const code = await encodeShare(three)
  expect(code.length).toBeLessThan(3000)
  expect(await decodeShare(code)).toEqual(three)
  const raw = JSON.parse(await inflateForTest(code)) as { builds: unknown[] }
  await expect(decodeShare(await deflateForTest(JSON.stringify({ ...raw, builds: Array<unknown>(7).fill(raw.builds[0]) })))).rejects.toThrow(ShareError)
})
```

- [ ] **Step 2: Run, expect failure.** `pnpm vitest run app/calculator/calculator.reducer.test.ts utils/combo/share.test.ts` (the share case passes already; the reducer cases fail on `originals` / `addBuild`).
- [ ] **Step 3: Implement.** `build(s)` → `s.calc.builds[s.active]!`; `patchBuild` patches at `s.active`; a private `at<T>(list: T[], i: number, value: T): T[]` for the aligned arrays; `byDeckId(s, id)` → indexes of builds with that `deckId`.
- [ ] **Step 4: Run, expect pass.** `pnpm vitest run app/calculator/calculator.reducer.test.ts utils/combo/share.test.ts`. `tsc` will now fail in `calculator.client.tsx` (`state.original`, `state.saved`): expected until Task 4.
- [ ] **Step 5: Commit**

```bash
git add app/calculator/calculator.reducer.ts app/calculator/calculator.reducer.test.ts utils/combo/share.test.ts
git commit -m "feat(calculator): reducer holds up to six builds"
```

### Task 4: Build tabs — add, duplicate, remove, edit per build

**Files:**
- Create: `app/calculator/build-tabs.tsx`
- Modify: `app/calculator/use-calculation.ts`, `app/calculator/calculator.client.tsx`, `messages/en.json`, `messages/pt.json`
- Test: `app/calculator/calculator.client.test.tsx`

**Interfaces:**
- Consumes: Task 3 state and actions; `TabBar`, `tabPanelProps` (`@ui/tab-bar/tab-bar.component`); `Button`.
- Produces (`use-calculation.ts`): `useCalculations(builds: Build[], originals: Deck[], cards: CardMap, analysis: Analysis, draw: Draw, focus: Subject | null): CalculationView[]` — one `useMemo`, the phase-1 body per build; replaces `useCalculation` (the client was its only caller).
- Produces (`build-tabs.tsx`):
  - `buildLabel(build: Build, index: number, untitled: string): string` → `` `${'ABCDEF'[index]} · ${build.name || untitled}` `` (exported; Task 5 reuses it for column headers)
  - `BuildTabs({ builds, active, onSelect, onAdd, onDuplicate, onRemove }: { builds: Build[]; active: number; onSelect(i: number): void; onAdd(): void; onDuplicate(): void; onRemove(): void })`: `TabBar` (`fit`, `label={t('builds.title')}`, `idPrefix="calc-build"`, ids `String(i)`, labels `buildLabel(b, i, t('builds.untitled', { n: i + 1 }))`), then buttons `builds.add` and `builds.duplicate` (`variant="secondary" size="sm"`, `aria-disabled` at `LIMITS.builds` with `title={t('builds.full')}`) and `builds.remove` (`variant="ghost" size="sm"`, only when `builds.length > 1`). Buttons carry `max-lg:min-h-11`.
- Client changes:
  - `picker: 'replace' | 'add' | null` replaces the boolean; `pickDeck` opens `'replace'`, `onAdd` opens `'add'`; `onPick` dispatches `load` or `addBuild` accordingly.
  - `build = state.calc.builds[state.active]!`, `original = state.originals[state.active]!`, `saved = state.saved[state.active] ?? null`; `views = useCalculations(...)`, `view = views[state.active]!`; `originalCopies` from `original`.
  - `allIds` covers every build's three zones and every `original.main`.
  - Boot reads: for `from === 'builder'`, `readSaved(boot.deckId, true)` as before; for `from === 'share'` and a signed-in user, `readSaved(id, false)` for each distinct `deckId` across `boot.calc.builds`.
  - `BuildTabs` renders full width between the alerts and the two-column grid; the left column gets `{...tabPanelProps('calc-build', String(state.active))}`. Duplicate dispatches `{ type: 'duplicateBuild', name: t('builds.copyOf', { name: build.name || t('builds.untitled', { n: state.active + 1 }) }) }`; Remove dispatches `{ type: 'removeBuild', index: state.active }`.
  - Save roles, Reload, the builder link, Restore, the hands panel and the single-card panel all use the active build.
- Messages (en / pt): `builds.title: "Builds" / "Builds"`, `builds.untitled: "Deck {n}" / "Deck {n}"`, `builds.add: "Add build" / "Adicionar build"`, `builds.duplicate: "Duplicate" / "Duplicar"`, `builds.remove: "Remove build" / "Remover build"`, `builds.copyOf: "{name} copy" / "{name} (cópia)"`, `builds.full: "Up to 6 builds" / "Até 6 builds"`.

- [ ] **Step 1: Write failing tests** in `calculator.client.test.tsx` (existing mocks and helpers):

```ts
it('adds a second build from the picker, tabs switch the deck being edited, the link carries both', async () => {
  vi.mocked(listMyDecks).mockResolvedValue({ decks: [summary(ID, 'Blue-Eyes')], nextCursor: null })
  vi.mocked(getDeck).mockResolvedValue(server({ id: ID, name: 'Blue-Eyes', main: [8, 8] }))
  await open(`/calculator?d=${encodeURIComponent(toYdke({ main: [7], extra: [], side: [] }))}&name=First`)
  await act(async () => fireEvent.click(screen.getByText('builds.add')))
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'picker.openNamed' })))
  const tabs = screen.getAllByRole('tab')
  expect(tabs.map((t) => t.textContent)).toEqual(['A · First', 'B · Blue-Eyes'])
  expect(tabs[1]!.getAttribute('aria-selected')).toBe('true')
  expect((screen.getByLabelText('deckName') as HTMLInputElement).value).toBe('Blue-Eyes')
  fireEvent.click(tabs[0]!)
  expect((screen.getByLabelText('deckName') as HTMLInputElement).value).toBe('First')
  await act(async () => {
    await new Promise((r) => setTimeout(r, 400))
  })
  const shared = await decodeShare(new URLSearchParams(location.search).get('c')!)
  expect(shared.builds.map((b) => b.name)).toEqual(['First', 'Blue-Eyes'])
})
it('duplicates the active build as a what-if copy with no saved deck behind it, and removes it again', async () => {
  vi.mocked(getDeck).mockResolvedValue(server({ id: ID, main: [7, 7], revision: 2, ownerId: 'u1' }))
  await open(`/calculator?d=${encodeURIComponent(toYdke({ main: [7, 7], extra: [], side: [] }))}&name=First&deck=${ID}`)
  expect(screen.getByText('save.roles')).toBeTruthy()
  await act(async () => fireEvent.click(screen.getByText('builds.duplicate')))
  expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['A · First', 'B · builds.copyOf'])
  expect(screen.queryByText('save.roles')).toBeNull() // the copy is not the saved deck
  await act(async () => fireEvent.click(screen.getAllByRole('button', { name: 'deck.fewer' })[0]!))
  const copies = () => within(screen.getByRole('group', { name: 'deck.copiesOf' })).getByText(/^\d$/).textContent
  expect(copies()).toBe('1') // the copy's row: 1 copy
  fireEvent.click(screen.getAllByRole('tab')[0]!)
  expect(copies()).toBe('2') // the source still has 2
  fireEvent.click(screen.getAllByRole('tab')[1]!)
  await act(async () => fireEvent.click(screen.getByText('builds.remove')))
  expect(screen.getAllByRole('tab')).toHaveLength(1)
  expect(screen.queryByText('builds.remove')).toBeNull()
})
```

- [ ] **Step 2: Run, expect failure.** `pnpm vitest run app/calculator/calculator.client.test.tsx` (type errors from Task 3 surface here too).
- [ ] **Step 3: Implement** `useCalculations`, `build-tabs.tsx`, the client wiring and the seven strings in both languages.
- [ ] **Step 4: Run, expect pass.** `pnpm vitest run app/calculator`, `pnpm exec tsc --noEmit`, `pnpm exec eslint app/calculator`.
- [ ] **Step 5: Commit**

```bash
git add app/calculator/build-tabs.tsx app/calculator/use-calculation.ts app/calculator/calculator.client.tsx app/calculator/calculator.client.test.tsx messages/en.json messages/pt.json
git commit -m "feat(calculator): build tabs; add, duplicate and remove builds"
```

### Task 5: Compare table

**Files:**
- Create: `app/calculator/compare.tsx`
- Modify: `app/calculator/calculator.client.tsx`, `messages/en.json`, `messages/pt.json`
- Test: `app/calculator/compare.test.tsx`

**Interfaces:**
- Consumes: `DataTable`, `Column` (`@ui/data-table`); `Panel`; `percent` (`./results`); `buildLabel` (Task 4); `Evaluation`, `EvaluateError`; `Build`, `Hand`.
- Produces:
  - `type CompareCell = { p: number | null; delta: number | null }` — `p` null where that build has no result; `delta = (p − p_A) · 100` percentage points, null for build A and wherever either side is null
  - `compareRows(hands: readonly Hand[], results: readonly (Evaluation | EvaluateError)[]): { key: number | 'any'; cells: CompareCell[] }[]` — one row per hand (key = index) then `'any'`
  - `Compare({ builds, hands, results }: { builds: Build[]; hands: Hand[]; results: (Evaluation | EvaluateError)[] })`: `Panel` `compare.title`; inside `<div className="overflow-x-auto">` a `DataTable` with `caption={t('compare.caption', { name: buildLabel(builds[0], 0, …) })}`, a `strong` label column (header empty) and one `numeric` column per build headed `buildLabel(b, i, t('builds.untitled', { n: i + 1 }))`. Rows: `compare.deckSize` (`b.deck.main.length`), each hand (`hand.name || t('hands.name', { n: i + 1 })`), `hands.any`. A cell with `p`: `percent(p, format)` and, for `i > 0` with a delta, a second line `t('compare.delta', { pp: format.number(delta, { signDisplay: 'exceptZero', maximumFractionDigits: 2 }) })` in `signal-sm`, `text-win` when positive, `text-crimson-lift` when negative, `text-ink-muted` at zero. A null `p`: `—` with `title={t(`results.${error}`)}`.
- Client: after `HandBuilder`, `{state.calc.builds.length > 1 ? <Compare builds={state.calc.builds} hands={state.calc.analysis.hands} results={views.map((v) => v.result)} /> : null}`.
- Messages (en / pt): `compare.title: "Compare" / "Comparar"`, `compare.caption: "Change in percentage points against {name}" / "Diferença em pontos percentuais contra {name}"`, `compare.deckSize: "Deck size" / "Tamanho do deck"`, `compare.delta: "{pp} pp" / "{pp} pp"`.

- [ ] **Step 1: Write failing tests** in `compare.test.tsx` (`// @vitest-environment happy-dom`; `next-intl` mocked as in `hand-builder.test.tsx`; helpers `hand(name)`, `evaluation(ps, any)` building `Odds` with `total 100n`, `b(name, size)` → a `Build` with `size` copies of card 1):

```ts
it('deltas are percentage points against build A, blank where a build has no result', () => {
  const rows = compareRows([hand('a'), hand('b')], [evaluation([0.5, 0.2], 0.6), evaluation([0.6, 0.1], 0.65), { error: 'tooFewCards' }])
  expect(rows.map((r) => r.key)).toEqual([0, 1, 'any'])
  expect(rows[0]!.cells.map((c) => c.p)).toEqual([0.5, 0.6, null])
  expect(rows[0]!.cells.map((c) => c.delta)).toEqual([null, expect.closeTo(10, 6), null])
  expect(rows[1]!.cells[1]!.delta).toBeCloseTo(-10, 6)
  expect(rows[2]!.cells[1]!.delta).toBeCloseTo(5, 6)
})
it('renders one column per build with the deck size, each hand, any hand and the deltas', () => {
  render(<Compare builds={[b('X', 40), b('Y', 41)]} hands={[hand('Combo')]} results={[evaluation([0.5], 0.5), evaluation([0.62], 0.62)]} />)
  expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['', 'A · X', 'B · Y'])
  expect(screen.getByText('40')).toBeTruthy()
  expect(screen.getByText('41')).toBeTruthy()
  expect(screen.getAllByText('62%')).toHaveLength(2)
  expect(screen.getAllByText('compare.delta')).toHaveLength(2)
})
```

- [ ] **Step 2: Run, expect failure.** `pnpm vitest run app/calculator/compare.test.tsx`.
- [ ] **Step 3: Implement** `compare.tsx`, mount it, add the four strings in both languages.
- [ ] **Step 4: Run, expect pass.** `pnpm vitest run app/calculator`, `tsc`, `eslint app/calculator`.
- [ ] **Step 5: Commit**

```bash
git add app/calculator/compare.tsx app/calculator/compare.test.tsx app/calculator/calculator.client.tsx messages/en.json messages/pt.json
git commit -m "feat(calculator): compare table with deltas against build A"
```

### Task 6: Sweeps panel

**Files:**
- Create: `app/calculator/sweeps.tsx`
- Modify: `app/calculator/calculator.client.tsx`, `app/calculator/calculator.client.test.tsx` (stub `ResizeObserver`), `messages/en.json`, `messages/pt.json`
- Test: `app/calculator/sweeps.test.tsx`

**Interfaces:**
- Consumes: Task 1 (`sweepCopies`, `sweepDeckSize`, `sweepTurn`, `copiesFor`, `SweepPoint`); `LineChart`, `Series` (`@ui/chart`); `Segmented`; `Select`, `TextInput`, `Field`; `Panel`; `copyLimit`; `percent`; `Banlist`.
- Produces: `Sweeps({ rows, roles, analysis, draw, banlist, focus, nameOf }: { rows: DeckCard[]; roles: Roles; analysis: Analysis; draw: Draw; banlist: Banlist | null; focus: Subject | null; nameOf(id: number): string })`.
  - UI state: `mode: 'copies' | 'deckSize' | 'turn'` (default `'copies'`; `Segmented` labelled `sweeps.title`, options `sweeps.copies` / `sweeps.deckSize` / `sweeps.turn`); `selected: number | null` (card id; `Select` `aria-label={t('sweeps.card')}`, options every row by `nameOf`, shown only in copies mode); `target: number` (default `80`; `TextInput type="number" min={1} max={100} suffix="%" aria-label={t('sweeps.target')}`). The swept card is derived in render: `rows.some((r) => r.id === selected) ? selected : focus?.kind === 'card' && rows.some(r => r.id === focus.id) ? focus.id : (rows.find((r) => roles.has(r.id)) ?? rows[0])?.id ?? null`.
  - `points = useMemo` by mode: copies → `sweepCopies(rows, roles, analysis, draw, cardId, copyLimit(row.card, banlist))`; deckSize → `sweepDeckSize(...)`; turn → `sweepTurn(...)`.
  - Chart: `LineChart` with `title` = `t('sweeps.copiesOf', { name: nameOf(cardId) })` / `t('sweeps.deckSize')` / `t('sweeps.turn')`, `labels = points.map((p) => String(p.x))`, `series` = one per hand (`hand.name || t('hands.name', { n: i + 1 })`, `data = points.map((p) => p.hands[i]! * 100)`) then `{ name: t('hands.any'), data: points.map((p) => p.any * 100) }`, `format={(v) => percent(v / 100, format)}`, `height={240}`.
  - Under the chart a `<ul>` with one `<li>` per series: the series name and `copiesFor(points, target / 100, i | 'any')` → `t(`sweeps.reached.${mode}`, { x })`, or `t('sweeps.notReached')`.
  - `analysis.hands.length === 0` → only `t('sweeps.noHands')`; `points.length === 0` → `t('sweeps.noPoints')`.
- Client: `<Sweeps rows={view.rows} roles={build.roles} analysis={state.calc.analysis} draw={state.calc.draw} banlist={banlist} focus={state.calc.focus} nameOf={nameOf} />` after `Compare` in the left column. The client test's `beforeEach` stubs `ResizeObserver` (`class { observe() {} disconnect() {} }`), as `LineChart` observes its width.
- Messages (en / pt): `sweeps.title: "Sweeps" / "Varreduras"`, `sweeps.copies: "Copies" / "Cópias"`, `sweeps.deckSize: "Deck size" / "Tamanho do deck"`, `sweeps.turn: "Turn" / "Turno"`, `sweeps.card: "Card" / "Carta"`, `sweeps.target: "Target" / "Meta"`, `sweeps.copiesOf: "Copies of {name}" / "Cópias de {name}"`, `sweeps.reached.copies: "{x} copies" / "{x} cópias"`, `sweeps.reached.deckSize: "{x} cards" / "{x} cartas"`, `sweeps.reached.turn: "Turn {x}" / "Turno {x}"`, `sweeps.notReached: "Not reached" / "Não atinge"`, `sweeps.noHands: "Add a playable hand to sweep." / "Adicione uma mão jogável para varrer."`, `sweeps.noPoints: "Nothing to sweep with these settings." / "Nada para varrer com esses ajustes."`.

- [ ] **Step 1: Write failing tests** in `sweeps.test.tsx` (`// @vitest-environment happy-dom`; `vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} })`; `next-intl` mocked with `useTranslations: () => (key: string, v?: Record<string, unknown>) => (v ? `${key}:${Object.values(v).join(',')}` : key)` and the usual `useFormatter`; `row(id, copies)` → `DeckCard` with `card: null`; `STARTER` as in the engine tests):

```ts
const rows = [row(1, 1), row(2, 1), ...Array.from({ length: 38 }, (_, i) => row(10 + i, 1))]
const roles: Roles = new Map([[1, ['Starter']]])
const analysis: Analysis = { hands: [{ name: 'Combo', rules: [{ subject: STARTER, min: 1, max: null }] }] }
const base = { rows, roles, analysis, draw: DEFAULT_DRAW, banlist: null, focus: null, nameOf: (id: number) => `card ${id}` }

it('sweeps copies of the first tagged card and names the first count that reaches the target', () => {
  render(<Sweeps {...base} />)
  expect(screen.getByLabelText('sweeps.copiesOf:card 1')).toBeTruthy() // the chart, titled by the card
  expect(screen.getAllByText('sweeps.notReached')).toHaveLength(2) // Combo and Any at 80 %
  fireEvent.change(screen.getByLabelText('sweeps.target'), { target: { value: '20' } })
  expect(screen.getAllByText('sweeps.reached.copies:2')).toHaveLength(2) // 2 of 40 over 5 cards: 23.7 %
  fireEvent.change(screen.getByLabelText('sweeps.card'), { target: { value: '2' } })
  expect(screen.getByLabelText('sweeps.copiesOf:card 2')).toBeTruthy()
})
it('switches to deck size and turn', () => {
  render(<Sweeps {...base} />)
  fireEvent.click(screen.getByText('sweeps.deckSize'))
  expect(screen.getByLabelText('sweeps.deckSize')).toBeTruthy()
  expect(screen.getByText('60')).toBeTruthy() // the last x label
  fireEvent.click(screen.getByText('sweeps.turn'))
  expect(screen.getByText('6')).toBeTruthy()
})
it('asks for a hand when there is none', () => {
  render(<Sweeps {...base} analysis={{ hands: [] }} />)
  expect(screen.getByText('sweeps.noHands')).toBeTruthy()
})
```

- [ ] **Step 2: Run, expect failure.** `pnpm vitest run app/calculator/sweeps.test.tsx`.
- [ ] **Step 3: Implement** `sweeps.tsx`, mount it, stub `ResizeObserver` in the client test, add the strings in both languages.
- [ ] **Step 4: Run, expect pass.** `pnpm vitest run app/calculator`, `tsc`, `eslint app/calculator`.
- [ ] **Step 5: Commit**

```bash
git add app/calculator/sweeps.tsx app/calculator/sweeps.test.tsx app/calculator/calculator.client.tsx app/calculator/calculator.client.test.tsx messages/en.json messages/pt.json
git commit -m "feat(calculator): sweep charts with a target line"
```

### Task 7: Whole-branch verification

**Files:** none created; fixes land in the files they belong to, committed as `fix(calculator): …`.

- [ ] **Step 1:** `pnpm exec tsc --noEmit` → no output. `pnpm exec eslint utils/combo app/calculator` → no errors. `pnpm vitest run` → every suite green.
- [ ] **Step 2: Dev server from this worktree** on a free port (not 5173), with a temporary `next.config.ts` `rewrites` entry proxying the API path to `http://localhost:3000` so the Docker API accepts the requests; a temporary `.claude/launch.json` entry if the preview tool needs one. Both reverted before the next commit (`git status` must not list them).
- [ ] **Step 3: Browser, desktop width.** Open `/calculator`, paste a 40-card ydke, tag three cards Starter and two Hand Trap, preset "≥1 Starter + ≥1 Hand Trap". Duplicate → tab "B · … copy" active; take a Starter to 2 copies on B. The compare table shows two columns, deck sizes 40 / 39, each hand and "Any hand" with B's deltas in pp, negative in red. Sweeps: copies of that Starter 0..3 with Combo and Any series, target 80 → "Not reached" or a count; deck size mode shows 40..60; turn mode 1..6. A card whose text has "once per turn" shows OPT/HOPT. Copy link, open in a fresh tab: both builds, the same tab labels.
- [ ] **Step 4: Browser, 375 px.** The tab bar scrolls horizontally if needed; the compare table scrolls inside its panel (no page-wide horizontal scroll); the chart fits the width; every button ≥ 44 px tall.
- [ ] **Step 5:** Fix anything found, re-run Step 1, commit each fix with only the touched files. Revert the temporary dev-server changes.
