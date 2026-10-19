# Combo Calculator — Phase 1 (Core) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working `/calculator` that loads a deck (saved, pasted, file, or from the deck builder), lets the player tag cards with roles and define playable hands, and shows exact hypergeometric probabilities behind a shareable `?c=` link.

**Architecture:** A pure TypeScript engine in `utils/combo/` (types, hypergeometric counts, atoms, evaluation, roles ↔ tags, share codec) with vitest coverage, and a client-only page in `app/calculator/` (reducer, boot from URL, URL sync, deck picker, roles editor, hand builder, results) reusing the deck builder's codecs, card cache and decks API client. No server change.

**Tech Stack:** Next 16 / React 19 / Tailwind 4 / next-intl / Vitest + happy-dom; `ygopro-deck-encode` (installed); native `CompressionStream('deflate-raw')`; BigInt.

**Spec:** `docs/superpowers/specs/2026-10-18-combo-calculator-design.md` (read it with this plan).

**Deviations from the spec, decided while planning:**
1. What-if copies edit the build's `deck.main` directly (the link always shows the deck being computed); the deck as loaded is kept in state as `original` for Restore and so a card taken to 0 copies keeps its row.
2. The hands panel and the hand builder are one component (`hand-builder.tsx`): each hand's probability sits beside its rules, "Any hand" in the header.

## Global Constraints

- Repo: front worktree `C:\Users\marti\Documents\tournament-next\.claude\worktrees\yugioh-hypergeometric-calculator-0b5d62`, branch `claude/yugioh-hypergeometric-calculator-0b5d62`. Never `cd` to the original checkout. `omega-server-v3` is not touched.
- Every commit stages only the files its task lists (`git add <paths>`), never `git add -A` / `.`. No `Co-Authored-By` or "Generated with" lines in commit messages.
- Edit files with the Edit/Write tools, not `sed -i` or scripts (Git Bash flips CRLF/LF).
- Verification is `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm vitest run <path>`; never `next build`. Dev server: `pnpm dev` on port 5173 through the browser preview tool.
- React lint treats impure render and set-state-in-effect as errors: data loads resolve in promise callbacks / event handlers; nothing reads `location` or `Date.now()` during render.
- Design system only: tokens and components from `app/styles.css` and `components/ui` (`Panel`, `StatGrid`, `Segmented`, `FilterChip`, `Tag`, `Chip`, `Select`, `TextInput`, `Field`, `Button`, `buttonClasses`, `Alert`, `Dialog`, `PageHeader`). No new colours or radii.
- Every UI string goes in `messages/en.json` and `messages/pt.json` under a new `Calculator` namespace (Task 6), plus one key in `DeckEditor.io.as` (Task 10).
- Limits (spec): hand size 1–20, extra draws 0–20, turn 1–10, rule `min` 0–20, `max` null or `min`–20, ≤ 12 hands, ≤ 12 rules per hand, ≤ 6 builds, ≤ 8 roles per card, role ≤ 24 chars, `?c=` ≤ 8192 chars; `evaluate` refuses above 5 000 000 compositions. Default roles `['Starter', 'Extender', 'Hand Trap', 'Brick']`.
- Only `deck.main` is drawn from. Cards group by canonical id (`canonicalId` in `utils/deck/model.ts`); a passcode the card cache lacks groups by itself.
- Desktop two-column layout from 1024 px (`lg:`), stacked below; tap targets ≥ 44 px below `lg` (`max-lg:min-h-11`, as the deck builder).

## Review Focus

1. **Unknown passcodes** (the API has no such card, or the lookup failed) must still be counted and tagged, shown by passcode. Tests: Task 1 (`distinctCards`), Task 7 (row renders the passcode).
2. **`?d=` with `+` turned into spaces** by `URLSearchParams` must still decode (the deck builder restores them). Test: Task 5 (`bootState`).
3. **Draw count above the deck size** (hand 20 on a 12-card deck, or turn 10 on a 40-card deck with 20 extra draws) must show `tooFewCards`, never throw or divide by zero. Tests: Task 2 (`evaluate`), Task 6 (notice renders).
4. **Role spelled twice** (`starter` added when `Starter` exists, or in a saved deck's tags) must be one role, counted once. Tests: Task 3 (`toggleRole`, `rolesFromTags`), Task 2 (atoms match the normalized string).
5. **A link carrying `max < min`, 9 roles on a card, or a 61-card main deck** must be refused as damaged, not computed. Test: Task 4 (`decodeShare`).

---

### Task 1: Types, hypergeometric counts and distinct cards

**Files:**
- Create: `utils/combo/types.ts`, `utils/combo/hypergeometric.ts`, `utils/combo/deck-cards.ts`
- Test: `utils/combo/hypergeometric.test.ts`, `utils/combo/deck-cards.test.ts`

**Interfaces:**
- Consumes: `Deck`, `CardData`, `CardMap` (`@utils/deck/types`); `canonicalId` (`@utils/deck/model`); `cardStatus` (`@utils/deck/rules`); `Banlist` (`@utils/wiki`).
- Produces (`types.ts`):
  - `type Subject = { kind: 'role'; role: string } | { kind: 'card'; id: number }` (`id` canonical)
  - `type Rule = { subject: Subject; min: number; max: number | null }`
  - `type Hand = { name: string; rules: Rule[] }`; `type Analysis = { hands: Hand[] }`
  - `type Draw = { going: 'first' | 'second'; handSize: number | null; extraDraws: number; turn: number }`
  - `type Roles = ReadonlyMap<number, readonly string[]>`
  - `type Build = { name: string; deck: Deck; roles: Roles; format: number | null; deckId: string | null }`
  - `type Calculation = { builds: Build[]; analysis: Analysis; draw: Draw; focus: Subject | null }`
  - `DEFAULT_ROLES: readonly string[]`, `DEFAULT_DRAW: Draw` (`first`, `null`, `0`, `1`)
  - `LIMITS = { handSize: [1, 20], extraDraws: [0, 20], turn: [1, 10], rule: [0, 20], hands: 12, rules: 12, builds: 6, rolesPerCard: 8, roleLength: 24, share: 8192, name: 80, handName: 40 } as const`
  - `subjectKey(s: Subject): string` → `role:Starter` / `card:46986414`; `sameSubject(a: Subject, b: Subject): boolean`
- Produces (`hypergeometric.ts`):
  - `choose(n: number, k: number): bigint` (`0n` when `k < 0` or `k > n`)
  - `type Odds = { favorable: bigint; total: bigint; p: number }`
  - `odds(favorable: bigint, total: bigint): Odds` with `p = total === 0n ? 0 : Number((favorable * 10n ** 15n) / total) / 1e15`
  - `distribution(N: number, K: number, n: number): Odds[]`: `P(X = k)` for `k = 0..min(K, n)`, `total = choose(N, n)`
  - `atLeast(dist: Odds[], k: number): Odds` (sum of `favorable` for indexes `≥ k`, same `total`)
- Produces (`deck-cards.ts`):
  - `type DeckCard = { id: number; copies: number; card: CardData | null; passcode: number }` (`passcode`: the first print seen, for art and for adding copies)
  - `canonicalOf(id: number, cards: CardMap): number`
  - `distinctCards(ids: readonly number[], cards: CardMap): DeckCard[]` in first-appearance order
  - `withCopies(main: readonly number[], canonical: number, copies: number, cards: CardMap, passcode: number): number[]`: keeps the first `copies` prints of that card in place, drops the rest, appends `passcode` for missing ones
  - `copyLimit(card: CardData | null, banlist: Banlist | null): number`: `cardStatus(...).copies` when the list gives copies, else `3`

- [ ] **Step 1: Write failing tests** in `utils/combo/hypergeometric.test.ts`:

```ts
it('counts combinations exactly', () => {
  expect(choose(40, 5)).toBe(658008n)
  expect(choose(37, 5)).toBe(435897n)
  expect(choose(5, 6)).toBe(0n)
  expect(choose(60, 30)).toBe(118264581564861424n)
})
it('gives the exact distribution of 3 copies in 40 over 5 cards', () => {
  const d = distribution(40, 3, 5)
  expect(d.map((o) => o.favorable)).toEqual([435897n, 198135n, 23310n, 666n])
  expect(d[0]!.total).toBe(658008n)
  expect(atLeast(d, 1).favorable).toBe(222111n)
  expect(atLeast(d, 1).p).toBeCloseTo(0.33755, 4)
  expect(atLeast(d, 4)).toEqual(odds(0n, 658008n))
})
```

and in `utils/combo/deck-cards.test.ts` (cards: `{ id: 46986414, alias: null, ruleId: null, idOriginal: 46986414, alternateArts: [46986431] }` keyed under both `46986414` and `46986431`, as `useCardCache` does):

```ts
it('groups alternate artworks under one canonical card and keeps unknown passcodes', () => {
  const rows = distinctCards([46986414, 46986431, 999, 46986414], cards)
  expect(rows.map((r) => [r.id, r.copies, r.passcode])).toEqual([[46986414, 3, 46986414], [999, 1, 999]])
  expect(rows[1]!.card).toBeNull()
})
it('sets copies in place and appends new ones at the end', () => {
  expect(withCopies([1, 46986414, 2, 46986431], 46986414, 1, cards, 46986414)).toEqual([1, 46986414, 2])
  expect(withCopies([1, 46986414, 2], 46986414, 3, cards, 46986414)).toEqual([1, 46986414, 2, 46986414, 46986414])
  expect(withCopies([1, 2], 7, 2, cards, 7)).toEqual([1, 2, 7, 7])
})
it('caps copies at the format limit, 3 without one', () => {
  expect(copyLimit(limitedCard, tcgList)).toBe(1)
  expect(copyLimit(limitedCard, null)).toBe(3)
  expect(copyLimit(null, tcgList)).toBe(3)
})
```

- [ ] **Step 2: Run, expect failure.** `pnpm vitest run utils/combo` → fails to resolve the modules.
- [ ] **Step 3: Implement** the three files. `choose` multiplies and divides incrementally in BigInt (`result = result * (n - i) / (i + 1)`), using `min(k, n − k)`.
- [ ] **Step 4: Run, expect pass.** `pnpm vitest run utils/combo`.
- [ ] **Step 5: Commit**

```bash
git add utils/combo/types.ts utils/combo/hypergeometric.ts utils/combo/deck-cards.ts utils/combo/hypergeometric.test.ts utils/combo/deck-cards.test.ts
git commit -m "feat(calculator): combo types, exact hypergeometric counts, distinct cards"
```

### Task 2: Atoms and exact evaluation

**Files:**
- Create: `utils/combo/atoms.ts`, `utils/combo/evaluate.ts`
- Test: `utils/combo/evaluate.test.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces (`atoms.ts`):
  - `referencedSubjects(analysis: Analysis, focus: Subject | null): Subject[]` deduped by `subjectKey`
  - `type Atom = { size: number; signature: ReadonlySet<string> }` (subject keys)
  - `type Atoms = { atoms: Atom[]; other: number; total: number }` (`atoms` only those with a non-empty signature)
  - `atomize(cards: DeckCard[], roles: Roles, subjects: Subject[]): Atoms`. A card satisfies `role` when `roles.get(card.id)` includes it (exact string, roles are normalized on write) and `card` when `subject.id === card.id`. Cards with equal signatures merge.
  - `subjectCopies(cards: DeckCard[], roles: Roles, subject: Subject): number`
- Produces (`evaluate.ts`):
  - `drawCount(draw: Draw): number` = `(handSize ?? (going === 'first' ? 5 : 6)) + extraDraws + (turn − 1)`
  - `MAX_COMPOSITIONS = 5_000_000`; `estimateCompositions(atomCount: number, n: number): bigint` = `choose(n + m − 1, m − 1)` with `m = atomCount + 1` (the "other" atom), `1n` when `m = 1`
  - `type HandResult = { name: string; odds: Odds }`
  - `type Evaluation = { hands: HandResult[]; any: Odds; draw: number; deckSize: number }`
  - `type EvaluateError = { error: 'tooFewCards' | 'tooComplex' }`
  - `evaluate(cards: DeckCard[], roles: Roles, analysis: Analysis, draw: Draw): Evaluation | EvaluateError`

- [ ] **Step 1: Write failing tests** in `utils/combo/evaluate.test.ts`. Helpers in the test file: `card(id, copies)` → `DeckCard` with `card: null`; `fill(from, count)` → `count` distinct one-copy cards; `rule(subject, min, max = null)`; and a brute-force oracle `oracle(ids: number[], roles: Roles, analysis: Analysis, n: number): bigint` that enumerates every `n`-subset of the expanded card list (`ids` repeated per copy) and counts the subsets any hand passes (counts per subject from the drawn cards' roles / ids).

```ts
const STARTER = { kind: 'role', role: 'Starter' } as const
const TRAP = { kind: 'role', role: 'Hand Trap' } as const
const BRICK = { kind: 'role', role: 'Brick' } as const

it('counts an overlapping role once: {Starter, Engine} x3 + {Starter} x3 in 40', () => {
  const cards = [card(1, 3), card(2, 3), ...fill(3, 34)]
  const roles = new Map([[1, ['Starter', 'Engine']], [2, ['Starter']]])
  const r = evaluate(cards, roles, { hands: [{ name: 'h', rules: [rule(STARTER, 1)] }] }, DEFAULT_DRAW)
  expect(r).toMatchObject({ any: { favorable: 379752n, total: 658008n }, draw: 5, deckSize: 40 })
})
it('matches a brute-force oracle on AND, OR, max, max 0, a named card and 0-copy cards', () => {
  // 12 cards, 5 drawn: A x3 Starter, B x2 Hand Trap, C x2 Brick, D x1 Starter+Hand Trap, 4 fillers, E x0 Starter.
  const cards = [card(1, 3), card(2, 2), card(3, 2), card(4, 1), ...fill(5, 4), card(9, 0)]
  const roles = new Map([[1, ['Starter']], [2, ['Hand Trap']], [3, ['Brick']], [4, ['Starter', 'Hand Trap']], [9, ['Starter']]])
  const analyses: Analysis[] = [
    { hands: [{ name: 'a', rules: [rule(STARTER, 1), rule(TRAP, 1)] }] },
    { hands: [{ name: 'a', rules: [rule(STARTER, 1)] }, { name: 'b', rules: [rule(TRAP, 2)] }] },
    { hands: [{ name: 'a', rules: [rule(STARTER, 1, 1), rule(BRICK, 0, 0)] }] },
    { hands: [{ name: 'a', rules: [rule({ kind: 'card', id: 4 }, 1)] }, { name: 'b', rules: [rule({ kind: 'card', id: 9 }, 1)] }] },
  ]
  for (const analysis of analyses) {
    const r = evaluate(cards, roles, analysis, { ...DEFAULT_DRAW, handSize: 5 })
    expect('error' in r).toBe(false)
    const ids = cards.flatMap((c) => Array(c.copies).fill(c.id))
    expect((r as Evaluation).any.favorable).toBe(oracle(ids, roles, analysis, 5))
    expect((r as Evaluation).any.total).toBe(choose(12, 5))
  }
})
it('reports each hand and the union, not their sum', () => {
  const cards = [card(1, 3), card(2, 3), ...fill(3, 34)]
  const roles = new Map([[1, ['Starter']], [2, ['Hand Trap']]])
  const r = evaluate(cards, roles, { hands: [{ name: 'a', rules: [rule(STARTER, 1)] }, { name: 'b', rules: [rule(TRAP, 1)] }] }, DEFAULT_DRAW) as Evaluation
  expect(r.hands.map((h) => h.odds.favorable)).toEqual([222111n, 222111n])
  expect(r.any.favorable).toBeLessThan(444222n)
  expect(r.any.favorable).toBe(658008n - choose(34, 5))
})
it('draw count and refusals', () => {
  expect(drawCount(DEFAULT_DRAW)).toBe(5)
  expect(drawCount({ going: 'second', handSize: null, extraDraws: 0, turn: 1 })).toBe(6)
  expect(drawCount({ going: 'first', handSize: 7, extraDraws: 2, turn: 3 })).toBe(11)
  expect(evaluate(fill(1, 12), new Map(), { hands: [] }, { ...DEFAULT_DRAW, handSize: 20 })).toEqual({ error: 'tooFewCards' })
  expect(estimateCompositions(2, 5)).toBe(21n)
  const many = fill(1, 40)
  const roles = new Map(many.map((c) => [c.id, [`r${c.id}`]]))
  const hands = many.map((c) => ({ name: String(c.id), rules: [rule({ kind: 'role', role: `r${c.id}` }, 1)] }))
  expect(evaluate(many, roles, { hands }, { ...DEFAULT_DRAW, handSize: 20 })).toEqual({ error: 'tooComplex' })
})
it('an empty analysis evaluates to zero hands and p 0', () => {
  expect(evaluate(fill(1, 40), new Map(), { hands: [] }, DEFAULT_DRAW)).toMatchObject({ hands: [], any: { favorable: 0n } })
})
```

- [ ] **Step 2: Run, expect failure.** `pnpm vitest run utils/combo/evaluate.test.ts`.
- [ ] **Step 3: Implement.** `evaluate`: `n = drawCount(draw)`, `N = Σ copies`; `n > N` → `tooFewCards`; `atomize` with `referencedSubjects(analysis, null)`; `estimateCompositions(atoms.length, n) > MAX_COMPOSITIONS` → `tooComplex`. Enumeration, the one algorithm the signature leaves open:

```
recurse(i, remaining, weight, counts):
  if i === atoms.length:
    if remaining > other: return
    w = weight * choose(other, remaining)
    for each hand h: pass_h = every rule: min ≤ count(rule.subject) ≤ (max ?? ∞)
    favorable_h += w where pass_h; favorable_any += w if any pass_h
    return
  lo = max(0, remaining − (Σ sizes of atoms after i) − other); hi = min(atoms[i].size, remaining)
  for k in lo..hi:
    for each subject key in atoms[i].signature: counts[key] += k
    recurse(i + 1, remaining − k, weight * choose(atoms[i].size, k), counts)
    undo the counts
```

`counts` is a `Map<string, number>` keyed by `subjectKey`; a rule's count defaults to 0. `total = choose(N, n)`.
- [ ] **Step 4: Run, expect pass.** `pnpm vitest run utils/combo`.
- [ ] **Step 5: Commit**

```bash
git add utils/combo/atoms.ts utils/combo/evaluate.ts utils/combo/evaluate.test.ts
git commit -m "feat(calculator): exact multivariate evaluation over role atoms"
```

### Task 3: Roles ↔ saved-deck tags

**Files:**
- Create: `utils/combo/roles.ts`
- Test: `utils/combo/roles.test.ts`

**Interfaces:**
- Consumes: Task 1 (`Roles`, `LIMITS`, `DEFAULT_ROLES`, `canonicalOf`); `Deck`, `CardMap`.
- Produces:
  - `normalizeRole(raw: string): string | null`: trim, collapse inner whitespace, `null` when empty or longer than 24
  - `sameRole(a: string, b: string): boolean` (case-insensitive, after `normalizeRole`)
  - `rolesFromTags(tags: Record<string, string[]>, cards: CardMap): Roles`: passcode keys → canonical ids; labels normalized, merged across keys, deduped by `sameRole` (first spelling wins), ≤ 8 kept
  - `tagsFromRoles(roles: Roles, deck: Deck, cards: CardMap): Record<string, string[]>`: for each canonical id with ≥ 1 role, key = the first passcode in `main`, `extra`, `side` whose `canonicalOf` matches; ids with no passcode in the deck are skipped
  - `toggleRole(roles: Roles, id: number, role: string): Roles`: new Map; removes the matching role (`sameRole`) if present, else appends the normalized one; returns `roles` unchanged when the card already has 8 or `normalizeRole` is `null`; deletes the key when its list empties
  - `palette(roles: Roles): string[]`: `DEFAULT_ROLES` then every other role in use, sorted with `localeCompare`, deduped by `sameRole`

- [ ] **Step 1: Write failing tests** in `utils/combo/roles.test.ts` (`cards` as in Task 1: `46986431` → card `46986414`):

```ts
it('reads tags under any print into one canonical card and dedupes spellings', () => {
  const roles = rolesFromTags({ '46986431': ['Starter'], '46986414': [' starter ', 'Engine'], '7': ['Brick'] }, cards)
  expect(roles.get(46986414)).toEqual(['Starter', 'Engine'])
  expect(roles.get(7)).toEqual(['Brick'])
})
it('writes tags keyed by a print the deck holds', () => {
  const roles = new Map([[46986414, ['Starter']], [8, ['Brick']]])
  expect(tagsFromRoles(roles, { main: [1, 46986431], extra: [], side: [8] }, cards)).toEqual({ '46986431': ['Starter'], '8': ['Brick'] })
  expect(tagsFromRoles(new Map([[9, ['X']]]), { main: [1], extra: [], side: [] }, cards)).toEqual({})
})
it('toggles roles case-insensitively and stops at 8', () => {
  const one = toggleRole(new Map(), 1, 'Starter')
  expect(one.get(1)).toEqual(['Starter'])
  expect(toggleRole(one, 1, 'STARTER').has(1)).toBe(false)
  const eight = new Map([[1, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']]])
  expect(toggleRole(eight, 1, 'i')).toBe(eight)
  expect(toggleRole(one, 1, '   ')).toBe(one)
  expect(normalizeRole('x'.repeat(25))).toBeNull()
  expect(normalizeRole('  Hand   Trap ')).toBe('Hand Trap')
})
it('palette: defaults first, then the roles in use', () => {
  expect(palette(new Map([[1, ['Engine', 'starter']], [2, ['Board Breaker']]]))).toEqual(['Starter', 'Extender', 'Hand Trap', 'Brick', 'Board Breaker', 'Engine'])
})
```

- [ ] **Step 2: Run, expect failure.** `pnpm vitest run utils/combo/roles.test.ts`.
- [ ] **Step 3: Implement** `utils/combo/roles.ts`.
- [ ] **Step 4: Run, expect pass.**
- [ ] **Step 5: Commit**

```bash
git add utils/combo/roles.ts utils/combo/roles.test.ts
git commit -m "feat(calculator): roles mapped to and from saved-deck tags"
```

### Task 4: Share codec

**Files:**
- Modify: `utils/deck/codecs/omega.ts:4` (`export const pipe`)
- Create: `utils/combo/share.ts`
- Test: `utils/combo/share.test.ts`

**Interfaces:**
- Consumes: `pipe` (omega.ts), `assertDeck` (`@utils/deck/codecs/ydk`), Task 1 types and `LIMITS`, Task 3 `normalizeRole`.
- Produces:
  - `class ShareError extends Error` (`name = 'ShareError'`)
  - `encodeShare(calc: Calculation): Promise<string>`: JSON of `{ v: 1, builds: [{ name, deck, roles: [...roles] as [number, string[]][], format, deckId }], analysis, draw, focus }` → UTF-8 → raw DEFLATE (`pipe` with `CompressionStream('deflate-raw')`) → base64url (`+`→`-`, `/`→`_`, no `=`)
  - `decodeShare(text: string): Promise<Calculation>`: reverse; throws `ShareError` when `text.length > LIMITS.share`, base64 or inflate fails, JSON fails, `v !== 1`, or any field is off: builds 1–6; `name` string ≤ 80; `deck` three integer arrays passing `assertDeck`; roles pairs `[positive int, string[]]` with ≤ 8 entries each a non-null `normalizeRole`; `format` int or null; `deckId` null or `/^[0-9a-f]{16}$/`; hands ≤ 12 with `name` ≤ 40 and rules ≤ 12; a rule's subject `{ kind: 'role', role }` (normalized non-null) or `{ kind: 'card', id }` (positive int); `min` int 0–20; `max` null or int `min`–20; draw `going` in `first|second`, `handSize` null or int 1–20, `extraDraws` int 0–20, `turn` int 1–10; `focus` a subject or null. Roles come back normalized; unknown keys are ignored.

- [ ] **Step 1: Write failing tests** in `utils/combo/share.test.ts` (a `calc()` helper builds a full `Calculation` with one 40-card build, two roles, two hands, `draw` going second with `turn: 2`, `focus` a card):

```ts
it('round-trips a calculation through a URL-safe string', async () => {
  const code = await encodeShare(calc())
  expect(code).toMatch(/^[A-Za-z0-9_-]+$/)
  expect(code.length).toBeLessThan(1200)
  const back = await decodeShare(code)
  expect(back).toEqual(calc())
})
it('refuses damaged or out-of-range links', async () => {
  await expect(decodeShare('not-base64!!')).rejects.toThrow(ShareError)
  await expect(decodeShare('x'.repeat(8193))).rejects.toThrow(ShareError)
  const edit = async (f: (raw: Record<string, unknown>) => void) => { const raw = JSON.parse(await inflateForTest(await encodeShare(calc()))); f(raw); return deflateForTest(JSON.stringify(raw)) }
  await expect(decodeShare(await edit((r) => (r.v = 2)))).rejects.toThrow(ShareError)
  await expect(decodeShare(await edit((r) => ((r.analysis as Analysis).hands[0]!.rules[0]!.max = 0)))).rejects.toThrow(ShareError) // min 1 > max 0
  await expect(decodeShare(await edit((r) => ((r.builds as { roles: unknown[][] }[])[0]!.roles[0]![1] = Array(9).fill('r'))))).rejects.toThrow(ShareError)
  await expect(decodeShare(await edit((r) => ((r.builds as { deck: Deck }[])[0]!.deck.main = Array(61).fill(1))))).rejects.toThrow(ShareError)
  await expect(decodeShare(await edit((r) => ((r.draw as Draw).turn = 11)))).rejects.toThrow(ShareError)
})
```

`inflateForTest` / `deflateForTest` are test-file helpers over `pipe` and the same base64url alphabet.

- [ ] **Step 2: Run, expect failure.** `pnpm vitest run utils/combo/share.test.ts`.
- [ ] **Step 3: Implement.** Export `pipe` from `omega.ts` (keep its signature). Validation in `decodeShare` is a set of small predicates (`int(v, lo, hi)`, `str(v, max)`) that throw `ShareError`; roles rebuilt as a `Map`.
- [ ] **Step 4: Run, expect pass.** Also `pnpm vitest run utils/deck` (omega codec unchanged).
- [ ] **Step 5: Commit**

```bash
git add utils/deck/codecs/omega.ts utils/combo/share.ts utils/combo/share.test.ts
git commit -m "feat(calculator): shareable ?c= payload with strict decoding"
```

### Task 5: Reducer and boot

**Files:**
- Create: `app/calculator/calculator.reducer.ts`, `app/calculator/boot.ts`
- Test: `app/calculator/calculator.reducer.test.ts`, `app/calculator/boot.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4; `fromYdke` (`@utils/deck/codecs/ydke`), `DeckCodeError`, `EMPTY_DECK`.
- Produces (`calculator.reducer.ts`):
  - `type Saved = { revision: number; ownerId: string }` (the saved deck's, never in the link)
  - `type CalcState = { calc: Calculation; original: Deck; saved: Saved | null }`
  - `type CalcAction =`
    `| { type: 'load'; build: Build; saved: Saved | null }` — replaces `builds[0]` and `original`; `roles` = previous roles for canonical ids still in the new deck, then `build.roles` merged with `toggleRole` semantics (union, deduped); resets `saved`
    `| { type: 'deckMeta'; deckId: string | null; format: number | null; roles: Roles; saved: Saved | null }` — after `getDeck` for `?deck=`; roles merged as in `load`
    `| { type: 'rename'; name: string }` (≤ 80)
    `| { type: 'setFormat'; format: number | null }`
    `| { type: 'toggleRole'; id: number; role: string }` (the palette is derived from the roles in use; there is no add-role action)
    `| { type: 'setCopies'; id: number; copies: number; passcode: number; cards: CardMap }` — `withCopies` on `builds[0].deck.main`, `copies` clamped to 0–3
    `| { type: 'restoreDeck' }` — `deck = original`
    `| { type: 'addHand'; hand?: Hand }` — default `{ name: '', rules: [{ subject: { kind: 'role', role: 'Starter' }, min: 1, max: null }] }`; ignored at 12 hands
    `| { type: 'removeHand'; index: number }`
    `| { type: 'renameHand'; index: number; name: string }` (≤ 40)
    `| { type: 'addRule'; hand: number; rule: Rule }` — ignored at 12 rules
    `| { type: 'setRule'; hand: number; index: number; rule: Rule }` — `min` clamped 0–20; `max` clamped to `min`–20 or null
    `| { type: 'removeRule'; hand: number; index: number }`
    `| { type: 'setDraw'; draw: Partial<Draw> }` — clamped to `LIMITS`
    `| { type: 'setFocus'; focus: Subject | null }`
  - `initialState(calc: Calculation, saved?: Saved | null): CalcState` (`original = calc.builds[0].deck`)
  - `emptyCalculation(): Calculation` (one build "", `EMPTY_DECK`, no roles, `format: null`, `deckId: null`; `analysis.hands = []`; `DEFAULT_DRAW`; `focus: null`)
  - `calculatorReducer(s: CalcState, a: CalcAction): CalcState`
- Produces (`boot.ts`):
  - `type Boot = { calc: Calculation; from: 'share' | 'builder' | 'empty'; notice: 'damagedLink' | null; deckId: string | null }`
  - `bootState(search: string): Promise<Boot>`: `?c=` → `decodeShare` (`ShareError` → `emptyCalculation()`, `notice: 'damagedLink'`, `from: 'empty'`); else `?d=` → `fromYdke(d.replaceAll(' ', '+'))` into one build named `?name=` (trimmed, ≤ 80, else `''`), `deckId` from `?deck=` when it matches `/^[0-9a-f]{16}$/` (`DeckCodeError` → `damagedLink`); else `from: 'empty'`

- [ ] **Step 1: Write failing tests.** `calculator.reducer.test.ts`:

```ts
it('load keeps roles of cards that stay and merges the new build\'s roles', () => {
  const s0 = initialState({ ...emptyCalculation(), builds: [build({ main: [1, 2] }, new Map([[1, ['Starter']], [2, ['Brick']]]))] })
  const s1 = calculatorReducer(s0, { type: 'load', build: build({ main: [1, 3] }, new Map([[1, ['engine']], [3, ['Hand Trap']]])), saved: null })
  expect(s1.calc.builds[0]!.roles).toEqual(new Map([[1, ['Starter', 'engine']], [3, ['Hand Trap']]]))
  expect(s1.original).toEqual({ main: [1, 3], extra: [], side: [] })
})
it('what-if copies edit main and restore brings the loaded deck back', () => {
  const s0 = initialState({ ...emptyCalculation(), builds: [build({ main: [1, 1, 2] })] })
  const s1 = calculatorReducer(s0, { type: 'setCopies', id: 1, copies: 3, passcode: 1, cards: new Map() })
  expect(s1.calc.builds[0]!.deck.main).toEqual([1, 1, 2, 1])
  const s2 = calculatorReducer(s1, { type: 'setCopies', id: 1, copies: 0, passcode: 1, cards: new Map() })
  expect(s2.calc.builds[0]!.deck.main).toEqual([2])
  expect(calculatorReducer(s2, { type: 'restoreDeck' }).calc.builds[0]!.deck.main).toEqual([1, 1, 2])
})
it('clamps rules and draw settings', () => {
  const s0 = calculatorReducer(initialState(emptyCalculation()), { type: 'addHand' })
  const s1 = calculatorReducer(s0, { type: 'setRule', hand: 0, index: 0, rule: { subject: { kind: 'role', role: 'Starter' }, min: 25, max: 1 } })
  expect(s1.calc.analysis.hands[0]!.rules[0]).toEqual({ subject: { kind: 'role', role: 'Starter' }, min: 20, max: 20 })
  expect(calculatorReducer(s1, { type: 'setDraw', draw: { turn: 0, extraDraws: 99 } }).calc.draw).toEqual({ ...DEFAULT_DRAW, turn: 1, extraDraws: 20 })
  const twelve = Array.from({ length: 12 }).reduce<CalcState>((s) => calculatorReducer(s, { type: 'addHand' }), s0)
  expect(calculatorReducer(twelve, { type: 'addHand' })).toBe(twelve)
})
```

`boot.test.ts`:

```ts
it('boots from a share link, a builder link with + turned into spaces, and nothing', async () => {
  const code = await encodeShare(calc())
  expect(await bootState(`?c=${code}`)).toMatchObject({ from: 'share', notice: null, calc: calc() })
  const ydke = toYdke({ main: [14558127, 14558127, 46986414], extra: [], side: [] })
  const spaced = `?d=${ydke.replaceAll('+', ' ')}&name=Snake-Eye&deck=abcdefabcdefabcd`
  expect(await bootState(spaced)).toMatchObject({ from: 'builder', deckId: 'abcdefabcdefabcd', calc: { builds: [{ name: 'Snake-Eye', deck: { main: [14558127, 14558127, 46986414] } }] } })
  expect(await bootState('?c=garbage!!')).toMatchObject({ from: 'empty', notice: 'damagedLink' })
  expect(await bootState('?d=ydke://!!!')).toMatchObject({ from: 'empty', notice: 'damagedLink' })
  expect(await bootState('')).toMatchObject({ from: 'empty', notice: null })
})
```

- [ ] **Step 2: Run, expect failure.** `pnpm vitest run app/calculator`.
- [ ] **Step 3: Implement** both files.
- [ ] **Step 4: Run, expect pass.**
- [ ] **Step 5: Commit**

```bash
git add app/calculator/calculator.reducer.ts app/calculator/boot.ts app/calculator/calculator.reducer.test.ts app/calculator/boot.test.ts
git commit -m "feat(calculator): state reducer and URL boot"
```

### Task 6: Page, shell, URL sync, draw settings and results

**Files:**
- Create: `app/calculator/page.tsx`, `app/calculator/calculator.loader.tsx`, `app/calculator/calculator.client.tsx`, `app/calculator/results.tsx`, `app/calculator/use-calculation.ts`
- Modify: `messages/en.json`, `messages/pt.json` (new `Calculator` namespace), `utils/const.ts:121-128` (Tools children)
- Test: `app/calculator/calculator.client.test.tsx`

**Interfaces:**
- Consumes: Tasks 1–5; `useCardCache` (`@app/deck-builder/use-card-cache`); `getBanlists`, `Banlist` (`@utils/wiki`); `getDeck` (`@utils/decks`); `pageMetadata`; `Header`; `PageHeader`, `Panel`, `StatGrid`, `Segmented`, `Select`, `TextInput`, `Field`, `Button`, `Alert`.
- Produces:
  - `page.tsx`: `generateMetadata` → `pageMetadata({ title: t('title'), path: '/calculator', description: t('meta') })` with `getTranslations('Calculator')`; renders `<Header />` and `<main className="min-h-dvh pt-16"><CalculatorLoader /></main>`
  - `calculator.loader.tsx`: `dynamic(() => import('./calculator.client'), { ssr: false })`
  - `calculator.client.tsx` default export `Calculator`: on mount `bootState(location.search)` → state `boot: Boot | null` (loading text while null); then `<Loaded boot={boot} />` holding `useReducer(calculatorReducer, initialState(boot.calc))`, `useCardCache` (`ensure` on every id of the build on change), `getBanlists` into `banlists: Banlist[] | null`, `banlist = banlists?.find(b => format === null ? b.format === 'tcg' : b.id === format) ?? null`, `getDeck(boot.deckId)` when `from === 'builder'` → `deckMeta` (404/error → `Alert` `deckRolesUnavailable` + Retry). URL sync: effect on `state.calc`, 300 ms timer, `encodeShare` → `history.replaceState(null, '', `/calculator?c=${code}`)`. Layout: `PageHeader` (eyebrow `t('eyebrow')`, title = build name `TextInput` or `t('title')`, `end` = Copy link + Pick deck buttons), then `lg:grid lg:grid-cols-[minmax(0,1fr)_400px] gap-6`; left column the deck (Tasks 7) and hands (Task 8), right column sticky `DrawSettings`, `FocusPanel`. Below `lg` the right column renders first.
  - `use-calculation.ts`: `useCalculation(build: Build, original: Deck, cards: CardMap, analysis: Analysis, draw: Draw, focus: Subject | null): { rows: DeckCard[]; result: Evaluation | EvaluateError; palette: string[]; focusDist: Odds[] | null; focusCopies: number }` — `rows = distinctCards([...main, ...original.main], cards)` with each row's `copies` recounted from `main` alone (so a card taken to 0 keeps its row); `focusDist = focus && !('error' in result) ? distribution(deckSize, subjectCopies(rows, roles, focus), drawCount(draw)) : null`; all under `useMemo`
  - `results.tsx`:
    - `percent(p: number, format: ReturnType<typeof useFormatter>): string` → `format.number(p, { style: 'percent', maximumFractionDigits: 2 })`
    - `Fraction({ odds }: { odds: Odds })` → `<span className="text-ink-muted data">{favorable} / {total}</span>` with `format.number` on `Number(...)` (BigInt digits grouped)
    - `DrawSettings({ draw, deckSize, onChange }: { draw: Draw; deckSize: number; onChange(d: Partial<Draw>): void })`: `Segmented` first/second (`label` `t('draw.going')`), `TextInput type=number` hand size (blank = by going, 1–20), extra draws (0–20), turn (1–10), each with `aria-label` = its `draw.*` label, a `Chip` showing `t('draw.total', { n: drawCount(draw), deck: deckSize })`
    - `FocusPanel({ subjects, focus, onFocus, dist, copies, draw, error }: { subjects: { roles: string[]; cards: DeckCard[]; nameOf(id: number): string }; focus: Subject | null; onFocus(s: Subject | null): void; dist: Odds[] | null; copies: number; draw: number; error: EvaluateError['error'] | null })`: `Select` of roles then cards (value = `subjectKey`, `aria-label` `results.focus`), `StatGrid` of `≥1`, `≥2`, `0` (value `percent`, hint `Fraction`), and a small table of `= k` for every `k`; `error` → `Alert` `results.<error>`; else `dist === null` → `t('results.pickSubject')`
    - The build name `TextInput` in the header carries `aria-label` `t('deckName')`.
  - `utils/const.ts`: `{ item: "Combo Calculator", to: "/calculator" }` after Deck Builder
  - `messages/*.json` `Calculator` keys (en / pt):

```json
"Calculator": {
  "title": "Combo Calculator", "meta": "Exact odds of opening your Yu-Gi-Oh! combos: roles, playable hands, going first or second, shareable links.",
  "eyebrow": "Deck consistency", "loading": "Loading…", "deckName": "Deck name", "untitled": "Deck",
  "pickDeck": "Choose deck", "copyLink": "Copy link", "copied": "Link copied", "copyFailed": "Copy the link below", "openBuilder": "Open in Deck Builder",
  "damagedLink": "This calculation link is damaged, so the calculator opened empty.", "dismiss": "Dismiss", "retry": "Retry",
  "deckRolesUnavailable": "The saved deck's roles did not load.", "lookupFailed": "Some cards did not load; they are counted by passcode.",
  "deck": { "title": "Main Deck", "size": "{count} cards", "notDrawn": "Extra and Side ({count}) are not drawn", "format": "Format", "copies": "{count} copies", "copiesOf": "Copies of {name}", "fewer": "One less {name}", "more": "One more {name}", "changed": "Changed", "restore": "Restore deck", "unknown": "Unknown card", "addRole": "New role", "addRolePlaceholder": "Role name", "roleOf": "Toggle {role} on {name}" },
  "draw": { "title": "Draw", "going": "Going", "first": "First (5)", "second": "Second (6)", "handSize": "Hand size", "handSizeHint": "Blank: by going first or second", "extraDraws": "Extra draws", "turn": "Turn", "total": "{n} of {deck} cards seen" },
  "results": { "focus": "Single card or role", "pickSubject": "Pick a card or role", "atLeast1": "At least 1", "atLeast2": "At least 2", "none": "None", "exactly": "Exactly {k}", "copiesInDeck": "{count} in deck", "tooFewCards": "The deck has fewer cards than you draw.", "tooComplex": "Too many distinct roles to compute exactly. Merge some roles." },
  "hands": { "title": "Playable hands", "any": "Any hand", "add": "Add hand", "remove": "Remove hand", "name": "Hand {n}", "rename": "Hand name", "rule": "Rule", "subject": "Card or role", "min": "Min", "max": "Max", "maxHint": "Blank: no limit", "addRule": "Add rule", "removeRule": "Remove rule", "noRules": "Add a rule.", "unusedRole": "No card has this role", "presets": "Start from", "preset": { "starter": "≥1 Starter", "starterTrap": "≥1 Starter + ≥1 Hand Trap", "starterTrapNoBrick": "≥1 Starter + ≥1 Hand Trap, no Brick" } },
  "picker": { "title": "Choose a deck", "mine": "My decks", "paste": "Paste code", "file": "File", "signedOut": "Sign in to see your saved decks.", "signIn": "Sign in", "empty": "No saved decks yet.", "loading": "Loading…", "failed": "Your decks did not load.", "more": "Load more", "open": "Open", "openNamed": "Open {name}", "placeholder": "Omega code, ydke:// URL or .ydk text", "import": "Import", "invalid": "That is not a deck code.", "chooseFile": "Choose .ydk file", "tooBig": "That file is too big to be a deck.", "counts": "Main {main} · Extra {extra} · Side {side}" },
  "save": { "roles": "Save roles to deck", "saving": "Saving…", "saved": "Roles saved to the deck.", "changed": "The deck changed elsewhere. Reload it and save again.", "reload": "Reload deck", "rejected": "The server refused the roles.", "failed": "Could not save the roles.", "signIn": "Sign in to save roles to your deck." }
}
```

```json
"Calculator": {
  "title": "Combo Calculator", "meta": "Chance exata de abrir seus combos de Yu-Gi-Oh!: funções, mãos jogáveis, going first ou second, links compartilháveis.",
  "eyebrow": "Consistência do deck", "loading": "Carregando…", "deckName": "Nome do deck", "untitled": "Deck",
  "pickDeck": "Escolher deck", "copyLink": "Copiar link", "copied": "Link copiado", "copyFailed": "Copie o link abaixo", "openBuilder": "Abrir no Deck Builder",
  "damagedLink": "O link deste cálculo está corrompido, então a calculadora abriu vazia.", "dismiss": "Fechar", "retry": "Tentar de novo",
  "deckRolesUnavailable": "As funções do deck salvo não carregaram.", "lookupFailed": "Algumas cartas não carregaram; elas contam pelo passcode.",
  "deck": { "title": "Main Deck", "size": "{count} cartas", "notDrawn": "Extra e Side ({count}) não são comprados", "format": "Formato", "copies": "{count} cópias", "copiesOf": "Cópias de {name}", "fewer": "Uma cópia a menos de {name}", "more": "Uma cópia a mais de {name}", "changed": "Alterado", "restore": "Restaurar deck", "unknown": "Carta desconhecida", "addRole": "Nova função", "addRolePlaceholder": "Nome da função", "roleOf": "Alternar {role} em {name}" },
  "draw": { "title": "Compra", "going": "Ordem", "first": "First (5)", "second": "Second (6)", "handSize": "Mão inicial", "handSizeHint": "Vazio: conforme first ou second", "extraDraws": "Compras extras", "turn": "Turno", "total": "{n} de {deck} cartas vistas" },
  "results": { "focus": "Carta ou função", "pickSubject": "Escolha uma carta ou função", "atLeast1": "Pelo menos 1", "atLeast2": "Pelo menos 2", "none": "Nenhuma", "exactly": "Exatamente {k}", "copiesInDeck": "{count} no deck", "tooFewCards": "O deck tem menos cartas do que você compra.", "tooComplex": "Funções distintas demais para calcular exato. Junte algumas funções." },
  "hands": { "title": "Mãos jogáveis", "any": "Qualquer mão", "add": "Adicionar mão", "remove": "Remover mão", "name": "Mão {n}", "rename": "Nome da mão", "rule": "Regra", "subject": "Carta ou função", "min": "Mín", "max": "Máx", "maxHint": "Vazio: sem limite", "addRule": "Adicionar regra", "removeRule": "Remover regra", "noRules": "Adicione uma regra.", "unusedRole": "Nenhuma carta tem essa função", "presets": "Começar com", "preset": { "starter": "≥1 Starter", "starterTrap": "≥1 Starter + ≥1 Hand Trap", "starterTrapNoBrick": "≥1 Starter + ≥1 Hand Trap, sem Brick" } },
  "picker": { "title": "Escolher deck", "mine": "Meus decks", "paste": "Colar código", "file": "Arquivo", "signedOut": "Entre para ver seus decks salvos.", "signIn": "Entrar", "empty": "Nenhum deck salvo ainda.", "loading": "Carregando…", "failed": "Seus decks não carregaram.", "more": "Carregar mais", "open": "Abrir", "openNamed": "Abrir {name}", "placeholder": "Código Omega, URL ydke:// ou texto .ydk", "import": "Importar", "invalid": "Isso não é um código de deck.", "chooseFile": "Escolher arquivo .ydk", "tooBig": "Esse arquivo é grande demais para ser um deck.", "counts": "Main {main} · Extra {extra} · Side {side}" },
  "save": { "roles": "Salvar funções no deck", "saving": "Salvando…", "saved": "Funções salvas no deck.", "changed": "O deck mudou em outro lugar. Recarregue e salve de novo.", "reload": "Recarregar deck", "rejected": "O servidor recusou as funções.", "failed": "Não foi possível salvar as funções.", "signIn": "Entre para salvar funções no seu deck." }
}
```

- [ ] **Step 1: Write failing tests** in `app/calculator/calculator.client.test.tsx` (`// @vitest-environment happy-dom`; mocks copied from `app/deck-builder/deck-editor.client.test.tsx` lines 11–30: `next/navigation`, `next/image`, `next-intl` with `useTranslations: () => (key: string) => key` (values ignored, so a key is the full accessible name), `useFormatter: () => ({ number: (n: number) => String(n) })`, `@hooks/index` `useAuth → auth` (`auth.user = { id: 'u1' }`), `@utils/wiki` `getBanlists → Promise.resolve([])`, `@utils/cards` `cardsByIds → new Map()`, `@utils/decks` with `getDeck`, `updateDeck`, `listMyDecks` as `vi.fn()` and the real error classes; `vi.stubGlobal('matchMedia', …)`; a helper `open(url)` that does `window.history.replaceState(null, '', url)`, renders `<Calculator />` and `await act(async () => {})` for the async boot. Every component test in `app/calculator` uses these same mocks.):

```ts
it('a damaged ?c= opens empty with the notice', async () => {
  await open('/calculator?c=garbage!!')
  expect(screen.getByText('damagedLink')).toBeTruthy()
})
it('a builder link loads the deck, its name, and the saved deck\'s roles', async () => {
  vi.mocked(getDeck).mockResolvedValue(server({ id: 'abcdefabcdefabcd', tags: { '14558127': ['Hand Trap'] }, format: 2 }))
  await open(`/calculator?d=${encodeURIComponent(toYdke({ main: [14558127, 14558127, 46986414], extra: [], side: [] }))}&name=Snake-Eye&deck=abcdefabcdefabcd`)
  expect((screen.getByLabelText('deckName') as HTMLInputElement).value).toBe('Snake-Eye')
  expect(getDeck).toHaveBeenCalledWith('abcdefabcdefabcd')
  expect(screen.getByText('draw.total')).toBeTruthy()
})
it('a hand size above the deck shows tooFewCards and the URL carries ?c=', async () => {
  await open(`/calculator?d=${encodeURIComponent(toYdke({ main: [1, 2, 3], extra: [], side: [] }))}`)
  await act(async () => fireEvent.change(screen.getByLabelText('draw.handSize'), { target: { value: '20' } }))
  expect(screen.getByText('results.tooFewCards')).toBeTruthy()
  await act(async () => { await new Promise((r) => setTimeout(r, 350)) })
  expect(location.search.startsWith('?c=')).toBe(true)
})
```

- [ ] **Step 2: Run, expect failure.** `pnpm vitest run app/calculator/calculator.client.test.tsx`.
- [ ] **Step 3: Implement** the page, loader, client shell, `use-calculation.ts`, `results.tsx`, the messages and the nav entry. The deck column and hands column render placeholders (`<div />`) until Tasks 7 and 8 replace them. Copy link: `navigator.clipboard.writeText(location.href)` → toast `copied`; on rejection show a read-only `TextInput` with the URL and `copyFailed`.
- [ ] **Step 4: Run, expect pass.** Then `pnpm exec tsc --noEmit` and `pnpm lint`.
- [ ] **Step 5: Commit**

```bash
git add app/calculator/page.tsx app/calculator/calculator.loader.tsx app/calculator/calculator.client.tsx app/calculator/results.tsx app/calculator/use-calculation.ts app/calculator/calculator.client.test.tsx messages/en.json messages/pt.json utils/const.ts
git commit -m "feat(calculator): page shell, draw settings, single-card odds, share URL"
```

### Task 7: Card roles editor with what-if copies

**Files:**
- Create: `app/calculator/card-roles.tsx`
- Modify: `app/calculator/calculator.client.tsx` (mount it in the deck column with the format `Select`)
- Test: `app/calculator/card-roles.test.tsx`

**Interfaces:**
- Consumes: Tasks 1, 3, 5, 6; `CARD_ART_URL`; `Image` (`next/image`, `fill sizes="48px"` as `my-decks.tsx`); `FilterChip`, `Button`, `TextInput`, `Chip`.
- Produces: `CardRoles(p: { rows: DeckCard[]; roles: Roles; palette: string[]; original: Deck; banlist: Banlist | null; notDrawn: number; onToggle(id: number, role: string): void; onCopies(id: number, copies: number, passcode: number): void; onRestore(): void })`. One row per `rows` entry: art, name (`card?.name ?? String(passcode)` with `t('deck.unknown')` muted when `card === null`), `−` / `+` buttons (`aria-label` `fewer` / `more`), `+` disabled (`aria-disabled`) at `copies ≥ copyLimit(card, banlist)`, `−` at 0; a `Chip` `changed` when the row's copies differ from `original.main`; the palette as `FilterChip`s (`aria-label` `roleOf`); last row of the palette a "new role" `TextInput` whose Enter calls `onToggle(id, value)` for that row and clears. Header: `t('deck.size', { count })`, `t('deck.notDrawn', { count: notDrawn })`, Restore button when any row changed. `+` on a card with copies above the limit (an imported illegal deck) stays disabled; `−` works.

- [ ] **Step 1: Write failing tests** in `app/calculator/card-roles.test.tsx` (happy-dom; mock `next/image` and `next-intl` as before):

```ts
it('shows unknown cards by passcode and toggles roles', () => {
  const onToggle = vi.fn()
  render(<CardRoles rows={[row(999, 2, null)]} roles={new Map()} palette={['Starter']} original={{ main: [999, 999], extra: [], side: [] }} banlist={null} notDrawn={0} onToggle={onToggle} onCopies={() => {}} onRestore={() => {}} />)
  expect(screen.getByText('999')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: 'deck.roleOf' }))
  expect(onToggle).toHaveBeenCalledWith(999, 'Starter')
})
it('caps + at the format limit and marks changed rows', () => {
  const onCopies = vi.fn()
  render(<CardRoles rows={[row(1, 1, limitedCard)]} roles={new Map()} palette={[]} original={{ main: [1, 1], extra: [], side: [] }} banlist={tcgList} notDrawn={3} onToggle={() => {}} onCopies={onCopies} onRestore={() => {}} />)
  expect(screen.getByRole('button', { name: 'deck.more' }).getAttribute('aria-disabled')).toBe('true')
  fireEvent.click(screen.getByRole('button', { name: 'deck.fewer' }))
  expect(onCopies).toHaveBeenCalledWith(1, 0, 1)
  expect(screen.getByText('deck.changed')).toBeTruthy()
  expect(screen.getByText('deck.restore')).toBeTruthy()
})
```

- [ ] **Step 2: Run, expect failure.**
- [ ] **Step 3: Implement** `card-roles.tsx`; wire it in the client: `rows` from `useCalculation`, `onToggle → toggleRole`, `onCopies → setCopies` (with the cache's `cards`), `onRestore → restoreDeck`, a `Select banlist` of `banlists` above it (`setFormat`, disabled when `banlists` is `[]`), and the `Alert` `lookupFailed` + Retry when the cache's `failed` set is non-empty.
- [ ] **Step 4: Run, expect pass.** `pnpm vitest run app/calculator`, `pnpm exec tsc --noEmit`, `pnpm lint`.
- [ ] **Step 5: Commit**

```bash
git add app/calculator/card-roles.tsx app/calculator/card-roles.test.tsx app/calculator/calculator.client.tsx
git commit -m "feat(calculator): card roles editor with what-if copies"
```

### Task 8: Hand builder

**Files:**
- Create: `app/calculator/hand-builder.tsx`
- Modify: `app/calculator/calculator.client.tsx` (mount it under the deck column)
- Test: `app/calculator/hand-builder.test.tsx`

**Interfaces:**
- Consumes: Tasks 1, 2, 5, 6 (`percent`, `Fraction`); `Panel`, `Select`, `TextInput`, `Button`, `Chip`, `Alert`.
- Produces: `HandBuilder(p: { analysis: Analysis; subjects: { roles: string[]; cards: DeckCard[]; nameOf(id: number): string }; result: Evaluation | EvaluateError; unusedRoles: ReadonlySet<string>; onAdd(hand?: Hand): void; onRemove(index: number): void; onRename(index: number, name: string): void; onRule(hand: number, index: number, rule: Rule): void; onAddRule(hand: number): void; onRemoveRule(hand: number, index: number): void })`. `Panel` titled `hands.title`, `meta` = `hands.any` + `percent(result.any.p)` + `Fraction` when the result is an `Evaluation`, else the matching notice. Each hand: name `TextInput` (placeholder `hands.name {n}`, `aria-label` `hands.rename`), inline `percent` + `Fraction`, rules as rows: subject `Select` (roles, then cards by `nameOf`; value `subjectKey`; `aria-label` `hands.subject`), `min` and `max` `TextInput type=number` with `aria-label` `hands.min` / `hands.max` (`max` blank = null; a typed value below `min` is sent as `min`), remove button; `hands.unusedRole` `Chip` on a role rule in `unusedRoles`. Empty analysis: three preset buttons (`hands.preset.*`) calling `onAdd` with the hand from the spec, and `hands.add`. `onAddRule` adds `{ subject: first role, min: 1, max: null }`.

- [ ] **Step 1: Write failing tests** in `app/calculator/hand-builder.test.tsx`:

```ts
it('presets create the hand from the spec', () => {
  const onAdd = vi.fn()
  render(<HandBuilder {...base} analysis={{ hands: [] }} onAdd={onAdd} />)
  fireEvent.click(screen.getByText('hands.preset.starterTrapNoBrick'))
  expect(onAdd).toHaveBeenCalledWith({ name: '', rules: [
    { subject: { kind: 'role', role: 'Starter' }, min: 1, max: null },
    { subject: { kind: 'role', role: 'Hand Trap' }, min: 1, max: null },
    { subject: { kind: 'role', role: 'Brick' }, min: 0, max: 0 },
  ] })
})
it('shows each hand\'s odds, the union, and flags a role no card has', () => {
  render(<HandBuilder {...base} analysis={{ hands: [hand('a', [rule(STARTER, 1)]), hand('b', [rule({ kind: 'role', role: 'Engine' }, 1)])] }} result={evaluation([0.5, 0.25], 0.6)} unusedRoles={new Set(['Engine'])} />)
  expect(screen.getAllByText('50%').length).toBe(1)
  expect(screen.getByText('60%')).toBeTruthy()
  expect(screen.getByText('hands.unusedRole')).toBeTruthy()
})
it('a max typed below min is sent as min', () => {
  const onRule = vi.fn()
  render(<HandBuilder {...base} analysis={{ hands: [hand('a', [rule(STARTER, 2)])] }} onRule={onRule} />)
  fireEvent.change(screen.getByLabelText('hands.max'), { target: { value: '1' } })
  expect(onRule).toHaveBeenCalledWith(0, 0, { subject: STARTER, min: 2, max: 2 })
})
```

(`base` supplies no-op callbacks, `subjects` with roles `['Starter', 'Hand Trap', 'Brick']`, an `Evaluation` with empty hands; `evaluation(ps, any)` builds `Odds` with `total 100n` and `favorable = p * 100`.)

- [ ] **Step 2: Run, expect failure.**
- [ ] **Step 3: Implement** and wire: `unusedRoles` = roles referenced by rules that `subjectCopies(...) === 0` and `kind === 'role'`; `nameOf` from the card cache (`cards.get(passcode)?.name ?? String(passcode)`).
- [ ] **Step 4: Run, expect pass.** `pnpm vitest run app/calculator`, `tsc`, `lint`.
- [ ] **Step 5: Commit**

```bash
git add app/calculator/hand-builder.tsx app/calculator/hand-builder.test.tsx app/calculator/calculator.client.tsx
git commit -m "feat(calculator): playable-hand builder with per-hand and union odds"
```

### Task 9: Deck picker, save roles, open in deck builder

**Files:**
- Create: `app/calculator/deck-picker.tsx`
- Modify: `app/calculator/calculator.client.tsx`
- Test: `app/calculator/deck-picker.test.tsx`, add two cases to `app/calculator/calculator.client.test.tsx`

**Interfaces:**
- Consumes: `readDeck` (`@app/deck-builder/deck-io`), `listMyDecks`, `getDeck`, `updateDeck`, `DeckConflictError`, `DeckApiError` (`@utils/decks`); `rolesFromTags`, `tagsFromRoles` (Task 3); `useAuth`; `setReturnTo`; `toYdke`; `Dialog`, `TabBar`/`Segmented`, `TextArea`, `Button`, `buttonClasses`, `Alert`.
- Produces:
  - `DeckPicker(p: { open: boolean; onClose(): void; lookup(ids: number[]): Promise<CardMap>; onPick(build: Build, saved: Saved | null): void })`. Tabs `picker.mine` / `picker.paste` / `picker.file` (`Segmented`). Mine: signed out → `picker.signedOut` + sign-in link (`setReturnTo('/calculator' + location.search)`); signed in → `listMyDecks` pages (name, label, `picker.counts`, Open) exactly like `DeckList` in `my-decks.tsx` minus delete; Open → `getDeck(id)` → `onPick({ name, deck, roles: rolesFromTags(tags, await lookup(all ids)), format, deckId: id }, { revision, ownerId })`. Paste: `TextArea` + Import → `readDeck(text, lookup)` → `onPick({ name: '', deck, roles: new Map(), format: null, deckId: null }, null)`; `DeckCodeError` → `picker.invalid` inline. File: `<input type=file accept=".ydk">`, > 64 KB → `picker.tooBig`, else `file.text()` → the paste path, name = file name without `.ydk`.
  - In the client: `pickDeck` button opens the picker; `from === 'empty'` with no deck opens it on mount. **Save roles**: button `save.roles` shown when `builds[0].deckId !== null`, `saved !== null`, `user?.id === saved.ownerId`; click → `updateDeck(deckId, { tags: tagsFromRoles(roles, deck, cards) }, saved.revision)` → on success `deckMeta` with the new `revision` and toast `save.saved`; `DeckConflictError` → `Alert` `save.changed` with `save.reload` (re-runs `getDeck` → `deckMeta`); `DeckApiError` 400 → `save.rejected`, 401 → `save.signIn` link; other → `save.failed`. **Open in deck builder**: a `Link` (`buttonClasses({ variant: 'secondary' })`) to `/deck-builder/${deckId}` when the user owns the deck, else `/deck-builder?d=${encodeURIComponent(toYdke(deck))}&name=${encodeURIComponent(name)}`.

- [ ] **Step 1: Write failing tests.** `deck-picker.test.tsx`:

```ts
it('imports a pasted ydke into a build', async () => {
  const onPick = vi.fn()
  render(<DeckPicker open onClose={() => {}} lookup={async () => new Map()} onPick={onPick} />)
  fireEvent.click(screen.getByText('picker.paste'))
  fireEvent.change(screen.getByPlaceholderText('picker.placeholder'), { target: { value: toYdke({ main: [1, 2], extra: [], side: [] }) } })
  await act(async () => fireEvent.click(screen.getByText('picker.import')))
  expect(onPick).toHaveBeenCalledWith({ name: '', deck: { main: [1, 2], extra: [], side: [] }, roles: new Map(), format: null, deckId: null }, null)
})
it('rejects garbage inline', async () => {
  render(<DeckPicker open onClose={() => {}} lookup={async () => new Map()} onPick={() => {}} />)
  fireEvent.click(screen.getByText('picker.paste'))
  fireEvent.change(screen.getByPlaceholderText('picker.placeholder'), { target: { value: 'hello' } })
  await act(async () => fireEvent.click(screen.getByText('picker.import')))
  expect(screen.getByText('picker.invalid')).toBeTruthy()
})
it('opens a saved deck with its roles and revision', async () => {
  vi.mocked(listMyDecks).mockResolvedValue({ decks: [summary('abcdefabcdefabcd', 'Blue-Eyes')], nextCursor: null })
  vi.mocked(getDeck).mockResolvedValue(server({ id: 'abcdefabcdefabcd', main: [1, 1], tags: { '1': ['Starter'] }, revision: 4, ownerId: 'u1' }))
  const onPick = vi.fn()
  await act(async () => { render(<DeckPicker open onClose={() => {}} lookup={async () => new Map()} onPick={onPick} />) })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'picker.openNamed' })))
  expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ deckId: 'abcdefabcdefabcd', roles: new Map([[1, ['Starter']]]) }), { revision: 4, ownerId: 'u1' })
})
```

`calculator.client.test.tsx` additions:

```ts
it('saves roles to the owner\'s deck and surfaces a conflict', async () => {
  vi.mocked(getDeck).mockResolvedValue(server({ id: 'abcdefabcdefabcd', main: [1], tags: {}, revision: 2, ownerId: 'u1' }))
  vi.mocked(updateDeck).mockRejectedValueOnce(new DeckConflictError(server({ revision: 3 })))
  await open(`/calculator?d=${encodeURIComponent(toYdke({ main: [1], extra: [], side: [] }))}&deck=abcdefabcdefabcd`)
  await act(async () => fireEvent.click(screen.getAllByRole('button', { name: 'deck.roleOf' })[0]!)) // Starter, first in the palette
  await act(async () => fireEvent.click(screen.getByText('save.roles')))
  expect(updateDeck).toHaveBeenCalledWith('abcdefabcdefabcd', { tags: { '1': ['Starter'] } }, 2) // three arguments: no explicit `force`
  expect(screen.getByText('save.changed')).toBeTruthy()
})
it('hides Save roles for a deck the user does not own', async () => {
  vi.mocked(getDeck).mockResolvedValue(server({ id: 'abcdefabcdefabcd', ownerId: 'u2' }))
  await open(`/calculator?d=${encodeURIComponent(toYdke({ main: [1], extra: [], side: [] }))}&deck=abcdefabcdefabcd`)
  expect(screen.queryByText('save.roles')).toBeNull()
})
```

- [ ] **Step 2: Run, expect failure.**
- [ ] **Step 3: Implement** the picker and the client wiring.
- [ ] **Step 4: Run, expect pass.** `pnpm vitest run app/calculator`, `tsc`, `lint`.
- [ ] **Step 5: Commit**

```bash
git add app/calculator/deck-picker.tsx app/calculator/deck-picker.test.tsx app/calculator/calculator.client.tsx app/calculator/calculator.client.test.tsx
git commit -m "feat(calculator): deck picker, save roles to deck, open in deck builder"
```

### Task 10: Deck builder export entry

**Files:**
- Modify: `app/deck-builder/toolbar.tsx:20-21` (`ExportKind`, `EXPORTS`), `app/deck-builder/deck-editor.client.tsx:404-408` (`exportAs`), `messages/en.json` and `messages/pt.json` (`DeckEditor.io.as.calculator`)
- Test: add one case to `app/deck-builder/deck-editor.client.test.tsx`

**Interfaces:**
- Produces: `ExportKind` includes `'calculator'`, last in `EXPORTS`; `exportAs('calculator')` opens `/calculator?d=<toYdke(deckIn(deck, cards, false))>&name=<state.name>[&deck=<state.deckId>]` (params through `URLSearchParams`) with `window.open(url, '_blank', 'noopener')`; the empty-deck guard stays first. Messages: en `"calculator": "Open in Combo Calculator"`, pt `"calculator": "Abrir no Combo Calculator"`.

- [ ] **Step 1: Write the failing test** in `app/deck-builder/deck-editor.client.test.tsx`, using the file's `open(deckId)` helper (line 81) and `server()`:

```ts
it('opens the combo calculator with the deck, name and id', async () => {
  const opened = vi.fn()
  vi.stubGlobal('open', opened)
  vi.mocked(getDeck).mockResolvedValue(server({ name: 'Saved', main: [1] }))
  await open(ID)
  fireEvent.click(screen.getByText('io.export'))
  fireEvent.click(screen.getByText('io.as.calculator'))
  const url = new URL(opened.mock.calls[0]![0] as string, 'http://x')
  expect(url.pathname).toBe('/calculator')
  expect(url.searchParams.get('d')).toBe(toYdke({ main: [1], extra: [], side: [] }))
  expect(url.searchParams.get('name')).toBe('Saved')
  expect(url.searchParams.get('deck')).toBe(ID)
  expect(opened.mock.calls[0]![1]).toBe('_blank')
})
```

- [ ] **Step 2: Run, expect failure.** `pnpm vitest run app/deck-builder/deck-editor.client.test.tsx`.
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run, expect pass.** `pnpm vitest run app/deck-builder`, `tsc`, `lint`.
- [ ] **Step 5: Commit**

```bash
git add app/deck-builder/toolbar.tsx app/deck-builder/deck-editor.client.tsx app/deck-builder/deck-editor.client.test.tsx messages/en.json messages/pt.json
git commit -m "feat(deck-builder): export entry that opens the combo calculator"
```

### Task 11: Whole-branch verification

**Files:** none created; fixes land in the files they belong to.

- [ ] **Step 1:** `pnpm exec tsc --noEmit` → no output. `pnpm lint` → no errors. `pnpm vitest run` → all green.
- [ ] **Step 2: Browser, desktop width** (`pnpm dev` via the preview tool, port 5173): open `/deck-builder`, paste a 40-card ydke, Export → "Open in Combo Calculator": the new tab shows the deck's cards, the deck name, `5 of 40 cards seen`. Tag three cards Starter and two Hand Trap; preset "≥1 Starter + ≥1 Hand Trap, no Brick": the hand shows a percentage and a fraction; switch to going second: the percentage rises and `6 of 40`. Take a Starter to 0 copies: its row stays, `Changed`, Restore brings it back. Copy link, open it in a fresh tab: identical state. Hand size 50: `tooFewCards`.
- [ ] **Step 3: Browser, phone width** (375 px): the results column renders above the deck, every button ≥ 44 px tall, no horizontal scroll, the picker dialog usable.
- [ ] **Step 4: Signed in:** Choose deck → My decks → Open: roles from the deck's tags (if any) appear; toggle one; Save roles to deck → toast; reload the deck in the picker: the role is there.
- [ ] **Step 5:** Fix anything found, run the three commands again, commit each fix as `fix(calculator): …` with only the touched files.
