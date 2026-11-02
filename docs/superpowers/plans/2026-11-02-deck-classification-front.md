# Deck Classification (front) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Read the rebuilt classification the way a player does: families (the lead setcode) in "What you will face", in the weekly report's movers and in the report infographic, while the tiers stay per key; and the match page shows the staff's staples instead of the fixed hand-trap list.

**Architecture:** The API already serves one `A*` row per family (every key A leads, summed) but no week rows for it, so `utils/statistics.ts` gains `leadOf`, `families` and `familyWeeks` (share and games summed over the members' week rows), and the three readers of `shareMoves` (`WhatYouFace`, `scripts/tier-list.ts`, the `meta-report` infographic) move to family weeks. The match page renames `handTraps` to the server's `staples`.

**Tech Stack:** Next.js App Router, React 19, next-intl, Tailwind, vitest.

**Spec:** omega-server-v3 `docs/superpowers/specs/2026-11-01-deck-classification-design.md`; the API contract is omega-server-v3 `docs/front/STATISTICS_API.md` (deck keys and the `A*` rows) and `docs/front/ANALYTICS_API.md` §2.1 and §4 (`staples`). The previous front plan (`2026-11-01-ranked-analytics-rebuild-front.md`) is executed and merged; this one builds on it.

## Global Constraints

- Keys as the API gives them: `''` unknown, `A`, `A>B>C` (A leads), `A*` (family). The lead of a key is the text before the first `>`; `A*` has lead `A`. Never split on `+`.
- Family rows (`A*`) have `name`, `share`, `games`, `wrExpected` and a `tier`, but no week rows, no `matchups` and no `cards`: anything that needs those reads the family's most played member key.
- Tiers, "What to play", "How to beat", the deck page and the tier-list page stay per key. Only share readings change.
- Copy keys under `Statistics.*` in `messages/en.json` and `messages/pt.json`; both files keep the same key set.
- Verify with `tsc --noEmit`, `eslint`, `npx vitest run --exclude ".claude/**" --exclude ".worktrees/**"`; never `next build`. Browser checks need an API running omega-server-v3 at 1013a1d or later (its local test DB holds tcg-2 2026-10-10, season 13).

## Review Focus

1. A family with one plain member: the row reads like the plain deck and shows no variants line. Pinned in Task 2.
2. An `A*` row whose members are all under the 30-game floor (no plain row): the family still lists, with no members and no crash. Pinned in Task 1.
3. A week where one member has a row and another does not: the family's share is the sum of the rows present, never `NaN`. Pinned in Task 1.
4. A staple activation with `player: null` (the log could not attribute it): the line renders without a side stripe. Pinned in Task 4.
5. A report issue with a single week of data: no risers, no fallers, and the intro still says "no TCG deck gained share". Pinned in Task 3.

---

### Task 1: Families in the client

**Files:**
- Modify: `utils/statistics.ts` (after `plainDecks`)
- Test: `utils/statistics.test.ts`

**Interfaces (Produces):**

```ts
export const leadOf = (key: string): string                      // '' → '', 'A' → 'A', 'A>B' → 'A', 'A*' → 'A'
export type Family = { family: DeckStat; members: DeckStat[] }   // family: the `A*` row; members: the plain keys A leads, most played first
export const families = (decks: readonly DeckStat[]): Family[]   // one per `A*` row, most played first; members may be empty
export type ShareWeek = Pick<Week, 'key' | 'week' | 'firstDay' | 'games' | 'share'>
export const familyWeeks = (weeks: readonly Week[], families: readonly Family[]): ShareWeek[]
  // per family and week with at least one member row: key = family.family.key, games and share summed, firstDay the rows' (equal)
export const shareMoves = (weeks: readonly Pick<Week, 'key' | 'week' | 'share'>[], top?: number)   // same body, wider input
```

- [ ] **Step 1: Write the failing tests** — `leadOf` on the four shapes above; `families([ '1*' .3, '1' .2, '1>2' .1, '3*' .05, '' ])` → two families, `1*` first with members `['1', '1>2']`, `3*` with `[]`; `familyWeeks` with weeks `{1, w1, .2}, {1>2, w1, .1}, {1, w2, .25}` (no `1>2` row in w2) → `[{ key: '1*', week: 1, share: 0.3, games: sum }, { key: '1*', week: 2, share: 0.25 }]`; `shareMoves(familyWeeks(...))` returns `1*` falling by 0.05.
- [ ] **Step 2:** run `npx vitest run utils/statistics.test.ts --exclude ".claude/**" --exclude ".worktrees/**"`: fails.
- [ ] **Step 3:** implement; `families` keeps the `A*` row's own order by `share` desc; members sorted by `share` desc.
- [ ] **Step 4:** tests pass; `tsc --noEmit`; commit `feat(statistics): families from the lead rows`.

---

### Task 2: "What you will face" by family

**Files:**
- Modify: `app/statistics/dashboard/WhatYouFace.tsx`
- Create: `app/statistics/dashboard/WhatYouFace.test.tsx` (same harness as `WhatToPlay.test.tsx`: `renderToStaticMarkup` inside `NextIntlClientProvider` with `messages/en.json`, `@omega/card-art` mocked)
- Modify: `messages/en.json`, `messages/pt.json` — `Statistics.face.meta` becomes "By family, share of games" / "Por família, participação nos jogos"; new `Statistics.face.variants`: "{count, plural, one {# build} other {# builds}}" / "{count, plural, one {# build} other {# builds}}"

**Interfaces (Consumes):** `families`, `familyWeeks`, `shareMoves`, `weekJumps`, `nameOf`, `deckHref` from Task 1 and `shared.tsx`.

- [ ] **Step 1: Write the failing test** — meta with decks `1*` (name "Snake-Eye", share .3), `1` (.2), `1>2` (.1), `3*` ("Maliss", .25), `3` (.25), `''`; weeks for `1`, `1>2`, `3` over weeks 1 and 2 such that `1` alone falls while `1*` rises. Assert: the first table row names "Snake-Eye" with `30.0%` and the variants line "2 builds"; the "Maliss" row has no variants line; "Rising" lists "Snake-Eye", not "1"; the "Snake-Eye" row links to its most played build, `/statistics/archetypes/1?…`, and a family with no members links to its own key (`/statistics/archetypes/3*?…`, which the API answers with no matchups and no cards).
- [ ] **Step 2:** run `npx vitest run app/statistics/dashboard/WhatYouFace.test.tsx --exclude ".claude/**" --exclude ".worktrees/**"`: fails.
- [ ] **Step 3:** implement: `const fams = families(meta.decks)`; `top = fams.slice(0, TOP)`; the share bar and the spark read the family row and `familyWeeks`; under a row with two or more members a native `<details>` whose summary is `t('variants', { count })` and whose body lists each member as `nameOf` + `pct(share)` linking to `deckHref(member.key)`; risers and fallers from `shareMoves(familyWeeks(meta.weeks, fams))` named through the family row; jumps unchanged (per key, named through `plainDecks`).
- [ ] **Step 4:** test passes; `tsc`, `eslint`; browser: `/statistics` shows families with the builds folded; commit `feat(statistics): what you will face reads families`.

---

### Task 3: Report movers by family

**Files:**
- Modify: `scripts/tier-list.ts` (`Ladder`, `risers`, `fallers`), `scripts/wiki-tier-list.ts` (`movementTable`, `spotlight`, `buildReport` intro, the `Ladder` construction), `app/statistics/infographic/[section]/route.tsx` (`meta-report` section only, lines around `shareMoves`)
- Test: `scripts/tier-list.test.ts`

**Interfaces (Produces):**

```ts
export type Ladder = { …as today…; families: Family[] }          // families(meta.decks), set where the ladder is built (`scripts/wiki-tier-list.ts:578`)
export type Move = { family: DeckStat; deck: DeckStat | null; delta: number }
  // family: the `A*` row; deck: its most played member that is in `decks` (listed), else null
export const risers = (ladder: Pick<Ladder, 'decks' | 'meta' | 'families'>): Move[]
export const fallers = (ladder: Pick<Ladder, 'decks' | 'meta' | 'families'>): Move[]
```

- [ ] **Step 1: Write the failing tests** — `risers` over a ladder whose meta has `1*`, `1`, `1>2`, `3*`, `3` and member weeks as in Task 1: returns `1*` first with `deck` = `1` (the most played listed member) and the summed delta; a ladder with one week of data returns `[]` for both (Review Focus 5).
- [ ] **Step 2:** run `npx vitest run scripts/tier-list.test.ts --exclude ".claude/**" --exclude ".worktrees/**"`: fails.
- [ ] **Step 3:** implement. `movementTable` names `move.family` and shows its share. `spotlight` opens on the family: "{family} gained X points of meta share last week …; its most played build, {deck}, has an expected win rate of … (95% interval …)"; best/worst matchup, cards used against it and the sample deck read `answers.get(deck.key)` and are skipped when `deck` is null. The intro's "X rose fastest" names the family. The `meta-report` infographic draws `shareMoves(familyWeeks(data.weeks, families(data.decks)))` named through the family rows.
- [ ] **Step 4:** tests pass; `tsc`, `eslint`; `curl` the `meta-report` infographic on the dev server and open the PNG; run the script against the dev API from an empty folder with `docs/wiki-pages` and read the report's movers; commit `feat(statistics): report movers by family`.

---

### Task 4: Match page staples

**Files:**
- Modify: `utils/analytics.ts` (`GameStats`: `handTraps` → `staples`, `player: Side | null`, `chainedTo.controller: Side | null`; delete the unreferenced `PlayerSeason` type and the types only it uses), `components/omega/analytics/game-stats.tsx` (section label "Staples", empty copy "No enabled staple was activated this game.")
- Test: `utils/analytics.test.ts`

- [ ] **Step 1: Write the failing test** — a `GameStats` fixture with one staple whose `player` is `null` type-checks and `game-stats.tsx` renders it (`renderToStaticMarkup`) with no side stripe and the text "started the chain".
- [ ] **Step 2:** run `npx vitest run utils/analytics.test.ts --exclude ".claude/**" --exclude ".worktrees/**"`: fails (type error on `handTraps`).
- [ ] **Step 3:** implement; `SIDE[trap.player]` becomes a lookup that returns no classes for `null`, and the name column shows "unknown" for the player.
- [ ] **Step 4:** tests pass; `tsc`, `eslint`; browser: one analysed match on `/profile/…/matches` shows the Staples section; commit `feat(analytics): match page reads the staples list`.
