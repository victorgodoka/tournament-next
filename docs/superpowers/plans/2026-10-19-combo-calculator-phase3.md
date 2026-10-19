# Combo Calculator — Phase 3 (Simulator and Draw Effects) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A seeded hand simulator under the exact panels: deal the opening hand a shared link reproduces, resolve the deck's draw effects (Desires, Prosperity, Duality, Extravagance, Upstart) when toggled, and estimate each hand's odds by Monte Carlo with a 95 % half-width beside the exact figure.

**Architecture:** Two pure modules in `utils/combo/`: `rng.ts` (xorshift128+ from a 32-bit seed) and `simulate.ts` (a pile drawn by Fisher–Yates steps, the hand check, the five effect scripts with the game's lockouts and the excavation policy, `dealHand`, `monteCarlo` returning raw counts, `estimate`). `Calculation` gains `seed` and `effects`; the share payload becomes `v: 2` and still reads `v: 1`. One client component, `simulator.tsx`, closes the left column and runs the simulation in 5 000-hand chunks between animation frames. No server change.

**Tech Stack:** Next 16 / React 19 / Tailwind 4 / next-intl / Vitest + happy-dom; the BigInt exact engine from phase 1; `crypto.getRandomValues` for fresh seeds.

**Spec:** `docs/superpowers/specs/2026-10-18-combo-calculator-design.md`, section "Phase 3 — simulator and draw effects" (read it with this plan; the three open items were settled with Victor on 2026-10-19 and are written into that section). Earlier plans: `2026-10-18-combo-calculator-phase1.md`, `2026-10-18-combo-calculator-phase2.md`.

**Decisions made while planning** (the spec leaves these open; Victor confirms them with the plan):

1. **Two engine files, not one.** The spec's table names `simulate.ts`; the generator gets its own `rng.ts` because its tests (reproducibility, uniformity) stand alone and nothing else in it is about cards.
2. **The pile tracks only what is still in the deck.** A drawn, banished or bottomed card is simply out of the pool; the hand is a separate array. Duality's leftovers go back with `putBack(pile, 2)`: the next draw is uniform over the pool, so where they sit is irrelevant. Prosperity's leftovers need nothing: out of the pool is the bottom.
3. **Effect copies that cannot resolve stay in hand** (a second Desires, a locked Upstart) and count for the rules like any card. A resolved copy is removed before the policy or the rules look at the hand.
4. **Minimum deck for Desires is 12 cards** (10 to banish, 2 to draw); Duality and Prosperity need as many as they excavate; Upstart and Extravagance as many as they draw. Below that the log says `deck`.
5. **Extravagance only as the first effect.** Its "start of Main Phase 1" timing means nothing can have resolved before it; it comes first in the fixed order, so this only bites a copy drawn by another effect, logged `lock`.
6. **`emptyCalculation()` takes a `seed` parameter defaulting to `randomSeed()`**, and `decodeShare` of a `v: 1` payload calls `randomSeed()` too: the only places the engine is not deterministic, both documented. Tests that compare against `emptyCalculation()` spread it and never compare the seed.
7. **The simulation's generator is `rng(seed)` as well**, so one link gives the same deal and the same estimate on every machine.
8. **A stale result is derived, never cleared.** The result keeps the `inputs` object it was computed for; `stale = sim.key !== inputs` in render. An effect cleanup cancels the pending frame when `inputs` change, so no frame computes on old inputs and no state is set from an effect.
9. **`satisfies` takes a card id.** It only ever read `card.id`; the hand check needs it for bare ids. Three call sites change (`atoms.ts` ×2, `sweep.ts` ×1).
10. **The estimates table reuses `compare.delta`** for the difference cell ("{pp} pp"), coloured as the compare table colours deltas.

## Global Constraints

- Repo: front worktree `C:\Users\marti\Documents\tournament-next\.claude\worktrees\upbeat-morse-6b1c0f`, branch `claude/upbeat-morse-6b1c0f`, cut from `main` (phases 1 and 2 merged as `b51adf9` and `a2f877e`). Never `cd` to the original checkout. `omega-server-v3` is not touched.
- Every commit stages only the files its task lists (`git add <paths>`), never `git add -A` / `.`. No `Co-Authored-By` or "Generated with" lines in commit messages.
- Edit files with the Edit/Write tools, not `sed -i` or scripts (files are LF; Git Bash tools flip line endings).
- Verification is `pnpm exec tsc --noEmit`, `pnpm exec eslint <touched paths>` (project-wide `pnpm lint` has a pre-existing error in `app/banlist-timeline/timeline.tsx`, not ours), `pnpm vitest run <path>`; never `next build`. The dev server for browser checks runs from this worktree on a port other than 5173; the local API (Docker, :3000) only allows origin :5173, so a temporary `next.config.ts` `rewrites` entry with `fallback: [{ source: '/:path*', destination: 'http://localhost:3000/:path*' }]` is added and reverted before any commit.
- React lint treats impure render and set-state-in-effect as errors: derive UI values in render, set state only in event handlers and promise callbacks, never read refs during render.
- Design system only: `Panel`, `Switch`, `Segmented`, `Button`, `Chip`, `TextInput`, `Field`, `Alert`, `DataTable` from `components/ui`; tokens from `app/styles.css`. No new colours or radii.
- Every UI string goes in `messages/en.json` and `messages/pt.json` under `Calculator.simulator`, added in the task that renders it.
- Limits (spec): `seed` 0..4294967295; `runs` 1 000..200 000, default 10 000, chunk 5 000; `effects.resolve` ≤ 5 distinct ids among `DRAW_EFFECTS`; banish counts 3 or 6, default 6; half-width `1.96 · √(p̂(1−p̂)/runs)`.
- Only `deck.main` is drawn from; the Extra Deck enters only as its size (what Prosperity and Extravagance can banish). Cards are canonical ids throughout the simulator.
- Desktop two-column layout from 1024 px, stacked below; tap targets ≥ 44 px below `lg` (`max-lg:min-h-11`).

## Review Focus

1. **Every link shared before this phase** (`v: 1`) must open with a working simulator: fresh seed, effects off. Test: Task 2 (`decodeShare` of a v1 payload).
2. **A toggled Pot on a deck too thin for it** (Desires with 11 cards left, Prosperity 6 with a 4-card Extra Deck) must never draw past the deck or throw: capped to 3, or logged as not resolved. Test: Task 3.
3. **A deck smaller than the draw** must show the `tooFewCards` notice in the simulator and no hand, not a crash; the engine deals what it has. Tests: Task 4 (`dealHand` on a 3-card deck), Task 5 (component with an error result).
4. **A hand with zero rules never passes** in the simulator either, matching `evaluate`. Test: Task 3 (`handPasses`).
5. **Editing the deck mid-simulation** must not leave figures that look current: the estimates render as stale and no further chunk runs. Test: Task 5 (rerender with other rows).

---

### Task 1: Seeded generator

**Files:**
- Create: `utils/combo/rng.ts`
- Test: `utils/combo/rng.test.ts`

**Interfaces:**
- Produces (`rng.ts`):
  - `type Rng = { next(): number; int(n: number): number }` — `next()` in `[0, 1)` with 53 random bits; `int(n)` an integer in `[0, n)`
  - `rng(seed: number): Rng` — xorshift128+ (V8's shifts 23, 17, 26) on two 64-bit words held as four 32-bit halves; the state is `mix(seed + k·0x9e3779b9)` for `k = 1..4` where `mix` is splitmix32's output function (`t ^= t >>> 16; t = imul(t, 0x21f0aaad); t ^= t >>> 15; t = imul(t, 0x735a2d97); t ^= t >>> 15`), so seed 0 is a live state
  - `randomSeed(): number` — `crypto.getRandomValues(new Uint32Array(1))[0]`
  - `nextSeed(seed: number): number` — `(seed + 0x9e3779b9) >>> 0`: a bijection on 32-bit seeds, so Deal again never repeats within 2³² deals
  - `MAX_SEED = 0xffffffff`

- [ ] **Step 1: Write failing tests** in `utils/combo/rng.test.ts`:

```ts
it('is reproducible from a seed, differs between seeds, stays in [0, 1)', () => {
  const take = (r: Rng) => Array.from({ length: 5 }, () => r.next())
  const first = take(rng(42))
  expect(take(rng(42))).toEqual(first)
  expect(take(rng(43))).not.toEqual(first)
  expect(first.every((x) => x >= 0 && x < 1)).toBe(true)
  expect(new Set(take(rng(0))).size).toBe(5) // seed 0 is a live state
})
it('int(n) is in range and uniform enough', () => {
  const r = rng(7)
  const buckets = Array<number>(10).fill(0)
  for (let i = 0; i < 10_000; i++) buckets[r.int(10)]!++
  expect(buckets.reduce((a, b) => a + b)).toBe(10_000) // every value landed in 0..9
  // 1000 expected per bucket, standard deviation 30: 850..1150 is five of them.
  expect(Math.min(...buckets)).toBeGreaterThan(850)
  expect(Math.max(...buckets)).toBeLessThan(1150)
})
it('seeds are 32-bit unsigned integers and nextSeed moves', () => {
  const s = randomSeed()
  expect(Number.isInteger(s) && s >= 0 && s <= MAX_SEED).toBe(true)
  expect(nextSeed(1)).not.toBe(1)
  expect(nextSeed(MAX_SEED)).toBeLessThanOrEqual(MAX_SEED)
  expect(nextSeed(nextSeed(5))).not.toBe(nextSeed(5))
})
```

- [ ] **Step 2: Run, expect failure.** `pnpm vitest run utils/combo/rng.test.ts` → cannot resolve `./rng`.
- [ ] **Step 3: Implement** `rng.ts`. 64-bit helpers on `[hi, lo]` pairs: `shl(h, l, 23)` → `[(h << 23 | l >>> 9) >>> 0, (l << 23) >>> 0]`; `shr(h, l, k)` → `[h >>> k, (l >>> k | h << (32 − k)) >>> 0]`; xor per half; add with carry `lo = l0 + l1; hi = (h0 + h1 + (lo > 0xffffffff ? 1 : 0)) >>> 0; lo >>>= 0`. One step: `s1 = state0; s0 = state1; state0 = s0; s1 ^= s1 << 23; s1 ^= s1 >>> 17; s1 ^= s0; s1 ^= s0 >>> 26; state1 = s1; sum = state0 + state1`. `next() = ((sum.hi >>> 5) * 67108864 + (sum.lo >>> 6)) / 9007199254740992`; `int(n) = Math.floor(next() * n)`.
- [ ] **Step 4: Run, expect pass.** `pnpm vitest run utils/combo/rng.test.ts`; `pnpm exec eslint utils/combo/rng.ts utils/combo/rng.test.ts`.
- [ ] **Step 5: Commit**

```bash
git add utils/combo/rng.ts utils/combo/rng.test.ts
git commit -m "feat(calculator): seeded xorshift128+ for the simulator"
```

### Task 2: Seed and effects in the calculation, share v2, reducer actions

**Files:**
- Modify: `utils/combo/types.ts`, `utils/combo/share.ts`, `app/calculator/calculator.reducer.ts`
- Test: `utils/combo/share.test.ts`, `app/calculator/calculator.reducer.test.ts`, `app/calculator/boot.test.ts` (fixture only)

**Interfaces:**
- Consumes: `randomSeed`, `MAX_SEED` (Task 1).
- Produces (`types.ts`):
  - `type EffectKind = 'extravagance' | 'prosperity' | 'duality' | 'desires' | 'upstart'`
  - `DRAW_EFFECTS: Record<EffectKind, number> = { extravagance: 49238328, prosperity: 84211599, duality: 98645731, desires: 35261759, upstart: 70368879 }` (canonical ids; the key order is the resolution order)
  - `type Banish = 3 | 6`; `type Effects = { resolve: number[]; prosperity: Banish; extravagance: Banish }`; `DEFAULT_EFFECTS: Effects = { resolve: [], prosperity: 6, extravagance: 6 }`
  - `Calculation` gains `seed: number; effects: Effects`
  - `LIMITS` gains `runs: [1000, 200000]`
- Produces (`share.ts`): `encodeShare` writes `v: 2` (`seed` and `effects` ride the spread). `decodeShare`: `v === 1` → `seed: randomSeed()`, `effects: DEFAULT_EFFECTS`; `v === 2` → `seed = int(r.seed, 0, MAX_SEED, 'seed')`, `effects` from a private `effects(v)`: `resolve` an array of ≤ 5 ints each among `Object.values(DRAW_EFFECTS)` with no duplicate, `prosperity` and `extravagance` each `3` or `6`; any other `v` → `fail('version')`.
- Produces (`calculator.reducer.ts`):
  - `emptyCalculation(seed: number = randomSeed()): Calculation` adds `seed`, `effects: DEFAULT_EFFECTS`
  - `CalcAction` gains `| { type: 'setSeed'; seed: number }` (stored as `seed >>> 0`), `| { type: 'toggleEffect'; id: number }` (same state back unless `id` is a `DRAW_EFFECTS` value; adds to or removes from `resolve`), `| { type: 'setBanish'; card: 'prosperity' | 'extravagance'; count: Banish }`

- [ ] **Step 1: Write failing tests.** In `share.test.ts`: give the `calc()` fixture `seed: 123456789, effects: { resolve: [35261759], prosperity: 3, extravagance: 6 }`; hoist the `edit` helper out of the "refuses damaged" test to module scope; in that test change the wrong-version case from `r.v = 2` to `r.v = 3`. Add:

```ts
it('reads a v1 link with a fresh seed and default effects, and refuses bad effects', async () => {
  const raw = JSON.parse(await inflateForTest(await encodeShare(calc()))) as Record<string, unknown>
  expect(raw.v).toBe(2)
  const v1 = { ...raw, v: 1 }
  delete v1.seed
  delete v1.effects
  const back = await decodeShare(await deflateForTest(JSON.stringify(v1)))
  expect(back).toEqual({ ...calc(), seed: expect.any(Number), effects: DEFAULT_EFFECTS })
  expect(Number.isInteger(back.seed) && back.seed >= 0 && back.seed <= MAX_SEED).toBe(true)
  const bad = async (f: (raw: Record<string, unknown>) => void) => expect(decodeShare(await edit(f))).rejects.toThrow(ShareError)
  await bad((r) => (r.seed = -1))
  await bad((r) => (r.seed = 1.5))
  await bad((r) => delete r.effects)
  await bad((r) => ((r.effects as Effects).resolve = [1]))
  await bad((r) => ((r.effects as Effects).resolve = [35261759, 35261759]))
  await bad((r) => ((r.effects as { prosperity: number }).prosperity = 4))
})
```

In `calculator.reducer.test.ts`:

```ts
it('setSeed stores a 32-bit seed, toggleEffect knows only the five cards, setBanish takes 3 or 6', () => {
  const s0 = initialState(emptyCalculation(9))
  expect(s0.calc.seed).toBe(9)
  expect(s0.calc.effects).toEqual({ resolve: [], prosperity: 6, extravagance: 6 })
  const s1 = calculatorReducer(s0, { type: 'setSeed', seed: 77 })
  expect(s1.calc.seed).toBe(77)
  const s2 = calculatorReducer(s1, { type: 'toggleEffect', id: DRAW_EFFECTS.desires })
  expect(s2.calc.effects.resolve).toEqual([DRAW_EFFECTS.desires])
  expect(calculatorReducer(s2, { type: 'toggleEffect', id: DRAW_EFFECTS.desires }).calc.effects.resolve).toEqual([])
  expect(calculatorReducer(s2, { type: 'toggleEffect', id: 12345 })).toBe(s2)
  expect(calculatorReducer(s2, { type: 'setBanish', card: 'prosperity', count: 3 }).calc.effects).toEqual({ resolve: [DRAW_EFFECTS.desires], prosperity: 3, extravagance: 6 })
})
```

In `boot.test.ts` the `calc()` fixture gains `seed: 1, effects: DEFAULT_EFFECTS` (the type requires them; the assertions keep working).

- [ ] **Step 2: Run, expect failure.** `pnpm vitest run utils/combo/share.test.ts app/calculator/calculator.reducer.test.ts app/calculator/boot.test.ts` (type errors on the fixtures, `DEFAULT_EFFECTS` missing).
- [ ] **Step 3: Implement** the types, the codec and the three actions. `pnpm exec tsc --noEmit` must be clean: `boot.ts` and the client only spread `emptyCalculation()`, so nothing else changes.
- [ ] **Step 4: Run, expect pass.** The three test files, then `pnpm exec tsc --noEmit`, `pnpm exec eslint utils/combo app/calculator`.
- [ ] **Step 5: Commit**

```bash
git add utils/combo/types.ts utils/combo/share.ts utils/combo/share.test.ts app/calculator/calculator.reducer.ts app/calculator/calculator.reducer.test.ts app/calculator/boot.test.ts
git commit -m "feat(calculator): share link carries the simulator seed and draw-effect toggles"
```

### Task 3: Pile, hand check and the five effect scripts

**Files:**
- Modify: `utils/combo/atoms.ts` (`satisfies` by id), `utils/combo/sweep.ts` (call site)
- Create: `utils/combo/simulate.ts`
- Test: `utils/combo/simulate.test.ts`

**Interfaces:**
- Consumes: `Rng` (Task 1); `Effects`, `EffectKind`, `DRAW_EFFECTS` (Task 2); `Hand`, `Analysis`, `Roles`, `Subject` (`./types`); `DeckCard` (`./deck-cards`).
- Produces (`atoms.ts`): `satisfies(id: number, roles: Roles, s: Subject): boolean` (was `card: DeckCard`; callers pass `card.id`).
- Produces (`simulate.ts`):
  - `type Pile = { ids: number[]; lo: number }` — `ids[lo..]` is the pool, `ids[..lo)` what left the deck
  - `expandIds(cards: readonly DeckCard[]): number[]` — each card's id `copies` times, deck order
  - `newPile(ids: readonly number[]): Pile`; `poolSize(pile: Pile): number`
  - `drawOne(pile: Pile, rng: Rng): number | undefined` — one Fisher–Yates step: swap a uniformly random pool card into `ids[lo]`, return it, `lo++`; `undefined` when the pool is empty
  - `putBack(pile: Pile, k: number): void` — the last `k` drawn cards return to the pool (`lo -= k`)
  - `handPasses(hand: readonly number[], roles: Roles, h: Hand): boolean` — `rules.length > 0` and every rule's count (cards in `hand` satisfying its subject) within `[min, max]`
  - `type Skipped = 'lock' | 'once' | 'extraDeck' | 'deck'`
  - `type EffectLog = { effect: EffectKind; drew: number[]; excavated: number[]; added: number | null; skipped: Skipped | null }`
  - `type Context = { roles: Roles; analysis: Analysis; effects: Effects; extraSize: number }`
  - `banishable(wanted: Banish, extraSize: number): 0 | 3 | 6` — `wanted` when `extraSize ≥ wanted`, else `3` when `extraSize ≥ 3`, else `0`
  - `pickExcavated(excavated: readonly number[], hand: readonly number[], roles: Roles, analysis: Analysis): number` — index into `excavated`: for each hand in order that `hand` does not pass, the first excavated card with which it passes; else the first excavated card satisfying some rule's subject whose count in `hand` is below that rule's `max` (`null` counts as unbounded); else `0`
  - `resolveEffects(hand: number[], pile: Pile, ctx: Context, rng: Rng): EffectLog[]` — mutates `hand` and `pile`; the loop in the spec: rounds over `Object.keys(DRAW_EFFECTS)` order while something resolved, one attempt per copy in hand not yet logged as skipped (a `blocked` count per kind), a resolved copy spliced out of `hand` before anything else happens. State: `used: Set<EffectKind>` (once per turn: desires, prosperity, duality), `drawLocked` (set by extravagance and prosperity), `drewByEffect` (set by extravagance, desires, upstart), `resolved` count (extravagance refused once > 0).
    - extravagance: `resolved > 0 || drawLocked` → `lock`; `n = banishable(effects.extravagance, extraSize)`; `n === 0` → `extraDeck`; `poolSize < n / 3` → `deck`; draw `n / 3` into `hand`
    - prosperity: `used` → `once`; `drewByEffect` → `lock`; `n = banishable(effects.prosperity, extraSize)`; `0` → `extraDeck`; `poolSize < n` → `deck`; excavate `n` (draw them), `added = excavated[pickExcavated(…)]`, push it to `hand`; the rest stay out (bottom); `drawLocked = true`
    - duality: `used` → `once`; `poolSize < 3` → `deck`; excavate 3, pick, swap the chosen to `ids[lo − 3]`, `putBack(pile, 2)`, push the chosen
    - desires: `used` → `once`; `drawLocked` → `lock`; `poolSize < 12` → `deck`; draw 10 (banished, dropped), draw 2 into `hand`; `drewByEffect = true`
    - upstart: `drawLocked` → `lock`; `poolSize < 1` → `deck`; draw 1; `drewByEffect = true`

- [ ] **Step 1: Write failing tests** in `utils/combo/simulate.test.ts`. Helpers as in `evaluate.test.ts` (`card`, `fill`, `rule`, `STARTER`, `TRAP`), plus `const D = DRAW_EFFECTS`, `const rest = (n: number) => Array.from({ length: n }, (_, i) => 200 + i)` (untagged ids), `roles = new Map([[1, ['Starter']], [2, ['Hand Trap']]])`, `analysis` with hands `A: ≥1 Starter` and `B: ≥1 Starter, ≥1 Hand Trap`, and `const ctx = (resolve: number[], over: Partial<Context> = {}): Context => ({ roles, analysis, effects: { resolve, prosperity: 6, extravagance: 6 }, extraSize: 15, ...over })`.

```ts
it('draws without replacement and puts back', () => {
  const pile = newPile(expandIds([card(1, 2), card(2, 1)]))
  const drawn = [drawOne(pile, rng(1)), drawOne(pile, rng(1)), drawOne(pile, rng(1))].sort()
  expect(drawn).toEqual([1, 1, 2])
  expect(drawOne(pile, rng(1))).toBeUndefined()
  putBack(pile, 2)
  expect(poolSize(pile)).toBe(2)
})
it('handPasses counts roles and cards; a hand with no rules never passes', () => {
  expect(handPasses([1, 200, 201], roles, { name: '', rules: [rule(STARTER, 1)] })).toBe(true)
  expect(handPasses([1, 200, 201], roles, { name: '', rules: [rule(STARTER, 1), rule(TRAP, 1)] })).toBe(false)
  expect(handPasses([1, 1, 2], roles, { name: '', rules: [rule({ kind: 'card', id: 1 }, 1, 1)] })).toBe(false) // two copies, max 1
  expect(handPasses([1, 2], roles, { name: '', rules: [] })).toBe(false)
})
it('Desires banishes 10 and draws 2, leaves the hand, once per turn', () => {
  const hand = [D.desires, D.desires, 200, 201, 202]
  const pile = newPile(rest(35).map((id) => id + 100))
  const log = resolveEffects(hand, pile, ctx([D.desires]), rng(1))
  expect(hand).toHaveLength(6) // 5 − 1 pot + 2 drawn
  expect(hand.filter((c) => c === D.desires)).toHaveLength(1) // the second copy stays
  expect(poolSize(pile)).toBe(35 - 12)
  expect(log.map((l) => [l.effect, l.skipped])).toEqual([['desires', null], ['desires', 'once']])
  expect(log[0]!.drew).toHaveLength(2)
  const thin = [D.desires, 200, 201, 202, 203]
  expect(resolveEffects(thin, newPile(rest(11)), ctx([D.desires]), rng(1))[0]!.skipped).toBe('deck')
  expect(thin).toContain(D.desires)
})
it('Prosperity excavates by the toggle, capped by the Extra Deck, and adds the card that completes the first hand', () => {
  const hand = [D.prosperity, 2, 200, 201, 202] // a Trap, no Starter: a Starter completes A (and B)
  const pile = newPile([300, 301, 1, 302, 303, 304]) // exactly 6: all excavated
  const log = resolveEffects(hand, pile, ctx([D.prosperity]), rng(1))
  expect(hand).toEqual([2, 200, 201, 202, 1])
  expect(log[0]).toMatchObject({ effect: 'prosperity', added: 1, skipped: null })
  expect(log[0]!.excavated).toHaveLength(6)
  expect(poolSize(pile)).toBe(0) // the rest went to the bottom
  const capped = [D.prosperity, 200, 201, 202, 203]
  const pile3 = newPile([300, 301, 302, 303])
  expect(resolveEffects(capped, pile3, ctx([D.prosperity], { extraSize: 4 }), rng(1))[0]!.excavated).toHaveLength(3)
  expect(poolSize(pile3)).toBe(1)
  const noExtra = [D.prosperity, 200, 201, 202, 203]
  expect(resolveEffects(noExtra, newPile(rest(10)), ctx([D.prosperity], { extraSize: 2 }), rng(1))[0]!.skipped).toBe('extraDeck')
  expect(noExtra).toContain(D.prosperity)
  expect(banishable(6, 15)).toBe(6)
  expect(banishable(6, 5)).toBe(3)
  expect(banishable(3, 2)).toBe(0)
})
it('Duality excavates 3 and shuffles the rest back; the policy falls back to a card that advances a rule, then the first excavated', () => {
  const hand = [D.duality, 200, 201, 202, 203]
  const pile = newPile([300, 2, 301]) // no Starter completes a hand; the Trap advances B
  resolveEffects(hand, pile, ctx([D.duality]), rng(1))
  expect(hand).toEqual([200, 201, 202, 203, 2])
  expect(poolSize(pile)).toBe(2)
  const plain = [D.duality, 200, 201, 202, 203]
  const log = resolveEffects(plain, newPile([300, 301, 302]), ctx([D.duality]), rng(1))
  expect(plain[4]).toBe(log[0]!.excavated[0])
  expect(pickExcavated([300, 1], [2], roles, analysis)).toBe(1) // the Starter completes A given a Trap in hand
})
it('Extravagance draws 1 per 3 banished and locks Desires and Upstart', () => {
  const hand = [D.extravagance, D.desires, D.upstart, 200, 201]
  const log = resolveEffects(hand, newPile(rest(30)), ctx([D.extravagance, D.desires, D.upstart]), rng(1))
  expect(log.map((l) => [l.effect, l.skipped])).toEqual([['extravagance', null], ['desires', 'lock'], ['upstart', 'lock']])
  expect(hand).toHaveLength(6) // −1 pot + 2 drawn; Desires and Upstart stay
  expect(resolveEffects([D.extravagance, 200, 201, 202, 203], newPile(rest(30)), ctx([D.extravagance], { extraSize: 5 }), rng(1))[0]!.drew).toHaveLength(1)
})
it('an effect drawn by an effect resolves; Upstart has no once-per-turn; Extravagance and Prosperity are locked after a draw', () => {
  const hand = [D.upstart, 200, 201, 202, 203]
  const log = resolveEffects(hand, newPile([D.upstart, D.upstart]), ctx([D.upstart]), rng(1))
  expect(log.map((l) => [l.effect, l.skipped])).toEqual([['upstart', null], ['upstart', null], ['upstart', 'deck']])
  expect(hand).toEqual([200, 201, 202, 203, D.upstart]) // the last copy found an empty deck
  const late = [D.upstart, 200, 201, 202, 203]
  expect(resolveEffects(late, newPile([D.extravagance, D.prosperity]), ctx([D.upstart, D.extravagance, D.prosperity]), rng(1)).map((l) => [l.effect, l.skipped])).toEqual([
    ['upstart', null],
    [expect.stringMatching(/extravagance|prosperity/), 'lock'],
  ])
})
it('a resolved Pot leaves the hand before the rules see it', () => {
  const brick: Roles = new Map([...roles, [D.desires, ['Brick']]])
  const noBrick: Analysis = { hands: [{ name: 'C', rules: [rule({ kind: 'role', role: 'Brick' }, 0, 0)] }] }
  const hand = [D.desires, 200, 201, 202, 203]
  expect(handPasses(hand, brick, noBrick.hands[0]!)).toBe(false)
  resolveEffects(hand, newPile(rest(30)), ctx([D.desires], { roles: brick, analysis: noBrick }), rng(1))
  expect(handPasses(hand, brick, noBrick.hands[0]!)).toBe(true)
})
```

- [ ] **Step 2: Run, expect failure.** `pnpm vitest run utils/combo/simulate.test.ts` → cannot resolve `./simulate`.
- [ ] **Step 3: Implement.** Change `satisfies` to take an id (its body already only used `card.id`) and the three call sites. Write `simulate.ts` as the Interfaces block says; `resolveEffects` holds one private `attempt(kind): EffectLog` with the five branches, each returning early with a `skipped` reason, and the round loop from the spec.
- [ ] **Step 4: Run, expect pass.** `pnpm vitest run utils/combo` (the sweep and evaluate suites cover the `satisfies` change); `pnpm exec tsc --noEmit`; `pnpm exec eslint utils/combo`.
- [ ] **Step 5: Commit**

```bash
git add utils/combo/atoms.ts utils/combo/sweep.ts utils/combo/simulate.ts utils/combo/simulate.test.ts
git commit -m "feat(calculator): draw-effect scripts with the game's lockouts and the excavation policy"
```

### Task 4: Deal, Monte Carlo and estimates

**Files:**
- Modify: `utils/combo/simulate.ts`
- Test: `utils/combo/simulate.test.ts`

**Interfaces:**
- Consumes: Task 3; `drawCount`, `Evaluation` (`./evaluate`); `Draw` (`./types`); `rng`, `nextSeed` (Task 1).
- Produces (`simulate.ts`):
  - `type Deal = { hand: number[]; passes: boolean[]; any: boolean; log: EffectLog[]; left: number }` — `left`: cards still in the pool
  - `dealHand(cards: readonly DeckCard[], roles: Roles, analysis: Analysis, draw: Draw, effects: Effects, extraSize: number, seed: number, extra = 0): Deal` — pure: `rng(seed)`, a fresh pile of `expandIds(cards)`, `drawCount(draw)` draws (stopping when the pool empties), `resolveEffects`, then `extra` more draws; `passes[i] = handPasses(hand, roles, analysis.hands[i])`
  - `type Counts = { runs: number; hits: number[]; any: number }`
  - `monteCarlo(cards, roles, analysis, draw, effects, extraSize, runs: number, rng: Rng): Counts` — `runs` deals (no `extra`) on one generator, each from a fresh copy of the expanded ids
  - `addCounts(a: Counts, b: Counts): Counts`
  - `standardError(p: number, n: number): number` — `n > 0 ? √(p(1−p)/n) : 0`
  - `type Estimate = { rate: number; exact: number | null; diff: number | null; halfWidth: number }` — `diff` in percentage points `(rate − exact) · 100`; `halfWidth = 1.96 · standardError(rate, runs)`
  - `type Estimates = { runs: number; hands: Estimate[]; any: Estimate }`
  - `estimate(counts: Counts, exact: Evaluation | null): Estimates` — `exact` and `diff` are `null` without an evaluation; `rate = 0` when `runs = 0`

- [ ] **Step 1: Write failing tests**, appended to `simulate.test.ts`; `deck = [card(1, 3), card(2, 3), ...fill(200, 34)]` (40 cards, 3 Starters, 3 Traps):

```ts
it('deals the same hand for a seed, another for the next seed, and Draw next keeps the first cards', () => {
  const a = dealHand(deck, roles, analysis, DEFAULT_DRAW, DEFAULT_EFFECTS, 15, 42)
  expect(a.hand).toHaveLength(5)
  expect(a.left).toBe(35)
  expect(dealHand(deck, roles, analysis, DEFAULT_DRAW, DEFAULT_EFFECTS, 15, 42).hand).toEqual(a.hand)
  expect(dealHand(deck, roles, analysis, DEFAULT_DRAW, DEFAULT_EFFECTS, 15, nextSeed(42)).hand).not.toEqual(a.hand)
  const more = dealHand(deck, roles, analysis, DEFAULT_DRAW, DEFAULT_EFFECTS, 15, 42, 2)
  expect(more.hand.slice(0, 5)).toEqual(a.hand)
  expect(more.hand).toHaveLength(7)
  expect(more.left).toBe(33)
  expect(more.hand.filter((id) => id === 1).length).toBeLessThanOrEqual(3)
  expect(a.passes).toEqual(analysis.hands.map((h) => handPasses(a.hand, roles, h)))
  expect(a.any).toBe(a.passes.some(Boolean))
  expect(a.log).toEqual([])
})
it('deals what the deck has when it is shorter than the draw, and logs a toggled effect', () => {
  const short = dealHand([card(1, 3)], roles, analysis, DEFAULT_DRAW, DEFAULT_EFFECTS, 0, 1)
  expect(short.hand).toEqual([1, 1, 1])
  expect(short.left).toBe(0)
  const pots = dealHand([card(D.desires, 40)], roles, analysis, DEFAULT_DRAW, { ...DEFAULT_EFFECTS, resolve: [D.desires] }, 15, 1)
  expect(pots.log[0]).toMatchObject({ effect: 'desires', skipped: null })
  expect(pots.hand).toHaveLength(6)
  expect(pots.left).toBe(23)
})
it('monteCarlo lands within 3 standard errors of evaluate at 50k runs', () => {
  const exact = evaluate(deck, roles, analysis, DEFAULT_DRAW) as Evaluation
  const counts = monteCarlo(deck, roles, analysis, DEFAULT_DRAW, DEFAULT_EFFECTS, 15, 50_000, rng(1))
  expect(counts.runs).toBe(50_000)
  const est = estimate(counts, exact)
  expect(est.runs).toBe(50_000)
  const pairs: [Estimate, number][] = [[est.hands[0]!, exact.hands[0]!.odds.p], [est.hands[1]!, exact.hands[1]!.odds.p], [est.any, exact.any.p]]
  for (const [e, p] of pairs) {
    expect(Math.abs(e.rate - p)).toBeLessThanOrEqual(3 * standardError(p, 50_000))
    expect(e.exact).toBe(p)
    expect(e.diff).toBeCloseTo((e.rate - p) * 100, 10)
    expect(e.halfWidth).toBeCloseTo(1.96 * standardError(e.rate, 50_000), 12)
  }
})
it('counts add across chunks; without an exact result the estimate leaves exact and diff null', () => {
  const r = rng(5)
  const a = monteCarlo(deck, roles, analysis, DEFAULT_DRAW, DEFAULT_EFFECTS, 15, 5_000, r)
  const b = monteCarlo(deck, roles, analysis, DEFAULT_DRAW, DEFAULT_EFFECTS, 15, 5_000, r)
  const sum = addCounts(a, b)
  expect(sum.runs).toBe(10_000)
  expect(sum.hits).toEqual([a.hits[0]! + b.hits[0]!, a.hits[1]! + b.hits[1]!])
  expect(sum.any).toBe(a.any + b.any)
  expect(estimate(sum, null).any).toEqual({ rate: sum.any / 10_000, exact: null, diff: null, halfWidth: 1.96 * standardError(sum.any / 10_000, 10_000) })
  expect(estimate({ runs: 0, hits: [0, 0], any: 0 }, null).any.rate).toBe(0)
  expect(standardError(0.5, 10_000)).toBeCloseTo(0.005, 12)
  expect(standardError(0.5, 0)).toBe(0)
})
it('three Upstarts raise the Starter odds well past the exact figure without them', () => {
  const upstarts = [card(1, 3), card(D.upstart, 3), ...fill(200, 34)]
  const exact = evaluate(upstarts, roles, analysis, DEFAULT_DRAW) as Evaluation
  const est = estimate(monteCarlo(upstarts, roles, analysis, DEFAULT_DRAW, { ...DEFAULT_EFFECTS, resolve: [D.upstart] }, 15, 50_000, rng(2)), exact)
  expect(est.hands[0]!.rate).toBeGreaterThan(exact.hands[0]!.odds.p + 3 * standardError(exact.hands[0]!.odds.p, 50_000))
})
```

- [ ] **Step 2: Run, expect failure.** `pnpm vitest run utils/combo/simulate.test.ts` → `dealHand` is not exported.
- [ ] **Step 3: Implement** `dealHand`, `monteCarlo` (expand the ids once, `ids.slice()` per run; the hand check per run is `analysis.hands.map(h => handPasses(...))`), `addCounts`, `standardError`, `estimate`.
- [ ] **Step 4: Run, expect pass.** `pnpm vitest run utils/combo/simulate.test.ts` (the 50k runs should take well under a second each). A seeded run is deterministic, so a miss of the 3-standard-error bound is either a bug or a 0.3 % unlucky seed: with the exact figure printed beside the rate, a near miss means another seed in the test, never a wider bound. Then `pnpm exec tsc --noEmit`; `pnpm exec eslint utils/combo`.
- [ ] **Step 5: Commit**

```bash
git add utils/combo/simulate.ts utils/combo/simulate.test.ts
git commit -m "feat(calculator): seeded hand dealing and Monte Carlo estimates"
```

### Task 5: Simulator panel

**Files:**
- Create: `app/calculator/simulator.tsx`
- Modify: `app/calculator/calculator.client.tsx`, `messages/en.json`, `messages/pt.json`
- Test: `app/calculator/simulator.test.tsx`, `app/calculator/calculator.client.test.tsx`

**Interfaces:**
- Consumes: Tasks 1–4 (`dealHand`, `monteCarlo`, `addCounts`, `estimate`, `nextSeed`, `rng`, `Counts`, `Deal`, `EffectLog`); `DRAW_EFFECTS`, `Effects`, `Banish`, `EffectKind`, `LIMITS`, `subjectKey`; `referencedSubjects` (`@utils/combo/atoms`); `Evaluation`, `EvaluateError`; `DeckCard`; `percent` (`./results`); `CARD_ART_URL` (`@utils/const`); `Panel`, `Switch`, `Segmented`, `Button`, `Chip`, `TextInput`, `Alert`, `DataTable`, `Column`.
- Produces (`simulator.tsx`):
  - `CHUNK = 5_000`, `DEFAULT_RUNS = 10_000`
  - `Simulator(p: SimulatorProps)` with `SimulatorProps = { rows: DeckCard[]; roles: Roles; analysis: Analysis; draw: Draw; effects: Effects; extraSize: number; seed: number; result: Evaluation | EvaluateError; nameOf(id: number): string; onSeed(seed: number): void; onToggleEffect(id: number): void; onBanish(card: 'prosperity' | 'extravagance', count: Banish): void }`
  - UI state: `extra: number` (0; Deal again resets it), `runsText: string` (`'10000'`), `sim: { key: object; counts: Counts; running: boolean } | null`; `frame = useRef(0)` for the pending animation frame.
  - `inputs = useMemo(() => ({ rows, roles, analysis, draw, effects, extraSize }), [...])`; `deal = useMemo(() => dealHand(rows, roles, analysis, draw, effects, extraSize, seed, extra), [inputs, seed, extra])`; `stale = sim !== null && sim.key !== inputs`; `running = sim?.running === true && !stale`; `useEffect(() => () => cancelAnimationFrame(frame.current), [inputs])`.
  - Draw effects block: title `simulator.effects` with `title={t('simulator.policy')}` on the heading; rows for `Object.entries(DRAW_EFFECTS)` whose id has a row with `copies > 0`, in that order: `Switch` `quiet` with `checked={effects.resolve.includes(id)}`, `label={t('simulator.resolve', { name: nameOf(id) })}`, `hint={t(`simulator.effect.${kind}`)}`, `onChange={() => onToggleEffect(id)}`; for `prosperity` and `extravagance` also a `Segmented<Banish>` `size="sm"` `label={t('simulator.banish')}` options `3` / `6` labelled by the number, `onChange={(count) => onBanish(kind, count)}`. No rows: `<p className="text-ink-muted signal-sm">{t('simulator.noEffects', { cards: <the five names via nameOf, joined ', '> })}</p>` (ids unknown to the card cache print as numbers, which is acceptable).
  - Deal block: when `'error' in result && result.error === 'tooFewCards'`, only `<Alert tone="warn" edged title={t('results.tooFewCards')} />`. Otherwise a header row (`simulator.deal`, meta `t('simulator.cardsInHand', { count: deal.hand.length })` and `t('simulator.deckLeft', { count: deal.left })`) with buttons `simulator.dealAgain` (`onSeed(nextSeed(seed))`, `setExtra(0)`) and `simulator.drawNext` (`setExtra(e => e + 1)`, `aria-disabled` when `deal.left === 0`), both `variant="secondary" size="sm"` with `max-lg:min-h-11`; a `<ul aria-label={t('simulator.deal')} className="flex flex-wrap gap-2">` with one `<li className="flex w-24 flex-col gap-1">` per card: the art (`Image` on `CARD_ART_URL(row.passcode)` inside `relative aspect-[4/3] bg-surface-300`, nothing when the row has no `card`), the name in `truncate signal-sm`, the card's roles as `Chip`s with `tone="cyan"` when the role is among `referencedSubjects(analysis, null)`, `neutral` otherwise; then a `<ul>` with one line per hand (`hand.name || t('hands.name', { n })`) and one for `hands.any`, each ending in `<Chip tone="positive">{t('simulator.passes')}</Chip>` or `<Chip>{t('simulator.fails')}</Chip>`; then the log, one `<li>` per entry: `t('simulator.drew', { name, cards })` when `drew.length`, `t('simulator.excavated', { name, cards, card })` when `added !== null`, `t(`simulator.skipped.${skipped}`, { name })` otherwise (`cards` = names joined with ', ').
  - Simulate block: `TextInput type="number" inputMode="numeric" min={1000} max={200000} step={1000} aria-label={t('simulator.runs')} prefix={t('simulator.runs')}`; `Button` `simulator.simulate` (`running ? stop : start`, label `simulator.stop` while running). `start`: `runs = clamp(Number(runsText) || DEFAULT_RUNS, LIMITS.runs)`, `r = rng(seed)`, `key = inputs`, `counts = { runs: 0, hits: analysis.hands.map(() => 0), any: 0 }`, `setSim({ key, counts, running: true })`, then `tick = () => { counts = addCounts(counts, monteCarlo(…inputs…, Math.min(CHUNK, runs − counts.runs), r)); setSim({ key, counts, running: counts.runs < runs }); if (counts.runs < runs) frame.current = requestAnimationFrame(tick) }`, `frame.current = requestAnimationFrame(tick)`. `stop`: `cancelAnimationFrame(frame.current)`, `setSim(s => s && { ...s, running: false })`. While running: `t('simulator.progress', { done: counts.runs, total: runs })`. With `sim`: the label `t('simulator.estimateLabel', { n: counts.runs })` in `signal-sm text-ink-muted`, `stale ? <p className="text-ink-muted signal-sm">{t('simulator.stale')}</p> : null`, and a `DataTable` (`caption={t('simulator.estimateLabel', …)}`) with columns `simulator.hand` (`strong`), `simulator.estimate`, `simulator.halfWidth`, `simulator.exact`, `simulator.diff` (the last four `numeric`) and one row per hand plus `hands.any`: `percent(rate)`, `± ${percent(halfWidth)}`, `exact === null ? '—' : percent(exact)`, `diff === null ? '—' : t('compare.delta', { pp: format.number(diff, { signDisplay: 'exceptZero', maximumFractionDigits: 2 }) })` coloured `text-win` / `text-crimson-lift` / `text-ink-muted` by sign. Hidden entirely when `result.error === 'tooFewCards'`.
- Client: after `<Sweeps …/>`: `<Simulator rows={view.rows} roles={build.roles} analysis={state.calc.analysis} draw={state.calc.draw} effects={state.calc.effects} extraSize={build.deck.extra.length} seed={state.calc.seed} result={view.result} nameOf={nameOf} onSeed={(seed) => dispatch({ type: 'setSeed', seed })} onToggleEffect={(id) => dispatch({ type: 'toggleEffect', id })} onBanish={(card, count) => dispatch({ type: 'setBanish', card, count })} />`.
- Messages, en / pt, under `Calculator.simulator`:
  - `title`: "Simulator" / "Simulador"
  - `effects`: "Draw effects" / "Efeitos de compra"
  - `resolve`: "Resolve {name} when drawn" / "Resolver {name} ao comprar"
  - `effect.extravagance`: "Banish 3 or 6 from the Extra Deck, draw 1 per 3. No effect draws afterwards." / "Bane 3 ou 6 do Extra Deck, compra 1 a cada 3. Sem compras por efeito depois."
  - `effect.prosperity`: "Banish 3 or 6 from the Extra Deck, excavate as many, add 1. Once per turn; no effect draws this turn." / "Bane 3 ou 6 do Extra Deck, escava a mesma quantidade, adiciona 1. Uma vez por turno; sem compras por efeito neste turno."
  - `effect.duality`: "Excavate 3, add 1, shuffle the rest back. Once per turn." / "Escava 3, adiciona 1, embaralha o resto de volta. Uma vez por turno."
  - `effect.desires`: "Banish 10, draw 2. Once per turn." / "Bane 10, compra 2. Uma vez por turno."
  - `effect.upstart`: "Draw 1." / "Compra 1."
  - `banish`: "Extra Deck cards banished" / "Cartas banidas do Extra Deck"
  - `noEffects`: "No draw effects in this deck. Supported: {cards}." / "Nenhum efeito de compra neste deck. Suportados: {cards}."
  - `policy`: "Excavated card added: the first that completes a hand, in hand order; else the first that advances a rule; else the first excavated." / "Carta escavada adicionada: a primeira que completa uma mão, na ordem das mãos; senão a primeira que avança uma regra; senão a primeira escavada."
  - `deal`: "Deal a hand" / "Abrir uma mão"; `dealAgain`: "Deal again" / "Abrir de novo"; `drawNext`: "Draw next" / "Comprar a próxima"
  - `cardsInHand`: "{count} in hand" / "{count} na mão"; `deckLeft`: "{count} left in deck" / "{count} no deck"
  - `passes`: "Passes" / "Passa"; `fails`: "Fails" / "Não passa"
  - `drew`: "{name}: drew {cards}" / "{name}: comprou {cards}"
  - `excavated`: "{name}: excavated {cards}, added {card}" / "{name}: escavou {cards}, adicionou {card}"
  - `skipped.lock`: "{name}: not resolved, effect draws are locked this turn" / "{name}: não resolvido, compras por efeito travadas neste turno"
  - `skipped.once`: "{name}: not resolved, once per turn" / "{name}: não resolvido, uma vez por turno"
  - `skipped.extraDeck`: "{name}: not resolved, too few Extra Deck cards" / "{name}: não resolvido, poucas cartas no Extra Deck"
  - `skipped.deck`: "{name}: not resolved, too few cards in the Deck" / "{name}: não resolvido, poucas cartas no Deck"
  - `simulate`: "Simulate" / "Simular"; `stop`: "Stop" / "Parar"; `runs`: "Hands" / "Mãos"
  - `progress`: "{done} of {total} hands" / "{done} de {total} mãos"
  - `estimateLabel`: "Estimate (Monte Carlo, {n} hands)" / "Estimativa (Monte Carlo, {n} mãos)"
  - `hand`: "Hand" / "Mão"; `estimate`: "Estimate" / "Estimativa"; `halfWidth`: "±95 %" / "±95 %"; `exact`: "Exact, no effects" / "Exato, sem efeitos"; `diff`: "Difference" / "Diferença"
  - `stale`: "The deck, hands or settings changed since this run." / "O deck, as mãos ou os ajustes mudaram desde esta simulação."

- [ ] **Step 1: Write failing tests** in `simulator.test.tsx` (`// @vitest-environment happy-dom`; `next-intl` mocked as in `sweeps.test.tsx`, values after the key; `vi.mock('next/image', () => ({ default: () => null }))`; `afterEach(cleanup)`). Fixture: `row(id, copies)` → `DeckCard` with `card: null`; `rows = [row(1, 3), row(2, 3), row(D.desires, 1), row(D.prosperity, 1), ...32 filler rows ids 200..]` (40 cards); `roles = new Map([[1, ['Starter']], [2, ['Hand Trap']]])`; `analysis` with one hand `Combo: ≥1 Starter`; `result = evaluate(rows, roles, analysis, DEFAULT_DRAW)`; `base = { rows, roles, analysis, draw: DEFAULT_DRAW, effects: DEFAULT_EFFECTS, extraSize: 15, seed: 42, result, nameOf: (id) => `card ${id}`, onSeed: vi.fn(), onToggleEffect: vi.fn(), onBanish: vi.fn() }`.

```tsx
it('deals drawCount cards, says which hands pass, Deal again advances the seed, Draw next adds a card', () => {
  render(<Simulator {...base} />)
  const hand = () => within(screen.getByRole('list', { name: 'simulator.deal' })).getAllByRole('listitem')
  expect(hand()).toHaveLength(5)
  const d = dealHand(rows, roles, analysis, DEFAULT_DRAW, DEFAULT_EFFECTS, 15, 42)
  d.hand.forEach((id, i) => expect(hand()[i]!.textContent).toContain(`card ${id}`))
  expect(screen.getAllByText(d.any ? 'simulator.passes' : 'simulator.fails')).toHaveLength(2) // Combo and Any agree with one hand
  fireEvent.click(screen.getByText('simulator.drawNext'))
  expect(hand()).toHaveLength(6)
  fireEvent.click(screen.getByText('simulator.dealAgain'))
  expect(base.onSeed).toHaveBeenCalledWith(nextSeed(42))
})
it('lists the deck's draw effects with a switch each and a 3 / 6 control on Prosperity', () => {
  render(<Simulator {...base} />)
  expect(screen.getAllByRole('switch')).toHaveLength(2)
  // The label wraps the switch and its hint, so the accessible name carries both.
  fireEvent.click(screen.getByRole('switch', { name: new RegExp(`simulator\\.resolve:card ${D.desires}`) }))
  expect(base.onToggleEffect).toHaveBeenCalledWith(D.desires)
  fireEvent.click(within(screen.getByRole('group', { name: 'simulator.banish' })).getByText('3'))
  expect(base.onBanish).toHaveBeenCalledWith('prosperity', 3)
  cleanup()
  render(<Simulator {...base} rows={rows.filter((r) => r.id !== D.desires && r.id !== D.prosperity)} />)
  expect(screen.getByText(/^simulator\.noEffects/)).toBeTruthy()
})
it('runs the simulation in chunks, labels the estimates, and marks them stale when the deck changes', async () => {
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown as number)
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
  const { rerender } = render(<Simulator {...base} />)
  fireEvent.change(screen.getByLabelText('simulator.runs'), { target: { value: '7000' } })
  await act(async () => {
    fireEvent.click(screen.getByText('simulator.simulate'))
    await new Promise((r) => setTimeout(r, 50))
  })
  expect(screen.getAllByText('simulator.estimateLabel:7000').length).toBeGreaterThan(0)
  const table = screen.getByRole('table')
  expect(within(table).getAllByRole('row')).toHaveLength(3) // header, Combo, Any
  const exact = `${Math.round((result as Evaluation).any.p * 100)}%`
  expect(within(table).getAllByText(exact).length).toBeGreaterThan(0)
  expect(screen.queryByText('simulator.stale')).toBeNull()
  rerender(<Simulator {...base} rows={rows.slice(0, 39)} />)
  expect(screen.getByText('simulator.stale')).toBeTruthy()
})
it('shows the too-few-cards notice instead of a hand', () => {
  render(<Simulator {...base} rows={[row(1, 3)]} result={{ error: 'tooFewCards' }} />)
  expect(screen.getByText('results.tooFewCards')).toBeTruthy()
  expect(screen.queryByText('simulator.dealAgain')).toBeNull()
})
```

In `calculator.client.test.tsx` (existing mocks and `open` helper; import `decodeShare`, `nextSeed`):

```ts
it('mounts the simulator; Deal again changes the seed the link carries', async () => {
  await open(`/calculator?d=${encodeURIComponent(toYdke({ main: Array.from({ length: 40 }, (_, i) => 100 + i), extra: [], side: [] }))}&name=Sim`)
  await act(async () => {
    await new Promise((r) => setTimeout(r, 400))
  })
  const seed = (await decodeShare(new URLSearchParams(location.search).get('c')!)).seed
  await act(async () => fireEvent.click(screen.getByText('simulator.dealAgain')))
  await act(async () => {
    await new Promise((r) => setTimeout(r, 400))
  })
  expect((await decodeShare(new URLSearchParams(location.search).get('c')!)).seed).toBe(nextSeed(seed))
})
```

- [ ] **Step 2: Run, expect failure.** `pnpm vitest run app/calculator/simulator.test.tsx app/calculator/calculator.client.test.tsx`.
- [ ] **Step 3: Implement** `simulator.tsx`, mount it in the client, add the strings in both languages (same keys, both files).
- [ ] **Step 4: Run, expect pass.** `pnpm vitest run app/calculator`; `pnpm exec tsc --noEmit`; `pnpm exec eslint app/calculator`; `node -e` check that `Object.keys(en.Calculator.simulator)` equals `Object.keys(pt.Calculator.simulator)` (and the nested `effect` / `skipped` keys).
- [ ] **Step 5: Commit**

```bash
git add app/calculator/simulator.tsx app/calculator/simulator.test.tsx app/calculator/calculator.client.tsx app/calculator/calculator.client.test.tsx messages/en.json messages/pt.json
git commit -m "feat(calculator): simulator panel; dealt hands, draw effects and Monte Carlo estimates"
```

### Task 6: Whole-branch verification

**Files:** none created; fixes land in the files they belong to, committed as `fix(calculator): …`.

- [ ] **Step 1:** `pnpm exec tsc --noEmit` → no output. `pnpm exec eslint utils/combo app/calculator` → no errors. `pnpm vitest run` from this worktree → every suite green.
- [ ] **Step 2: Dev server from this worktree** on a free port (not 5173) with the temporary `next.config.ts` rewrite from Global Constraints; a temporary `.claude/launch.json` entry if the preview tool needs one. Both reverted before the next commit (`git status` must not list them).
- [ ] **Step 3: Browser, desktop width.** Open `/calculator`, paste a 40-card ydke that holds Pot of Prosperity (84211599) and three Upstart Goblin (70368879) with a 15-card Extra Deck; tag three cards Starter, preset "≥1 Starter". Simulator panel at the bottom of the left column. Draw effects: two rows, Prosperity with a 3 / 6 control. Deal a hand: five cards with role chips, Combo and Any marked; Deal again changes the hand and the address bar (the `c=` value); Draw next adds a sixth card; reloading the page shows the same hand. Toggle Prosperity on and Deal again until it is in hand: the log line names the excavated cards and the one added, the hand lost the Pot and gained that card. Simulate 10 000: progress, then a table whose estimate for Combo sits within the half-width of the exact figure with Prosperity off, and above it with Prosperity on (difference positive). Simulate 200 000: the page stays responsive (the Stop button works mid-run). Edit a copy count mid-run or after: the stale line appears, no further progress.
- [ ] **Step 4: Browser, 375 px.** The effect rows wrap; the hand wraps as a grid of thumbs; the estimates table scrolls inside its panel (no page-wide horizontal scroll); every button and the runs field are at least 44 px tall.
- [ ] **Step 5:** Fix anything found, re-run Step 1, commit each fix with only the touched files. Revert the temporary dev-server changes. Report the branch to Victor and offer to merge locally into `main`, as phase 2 was.
