# Ranked Analytics Rebuild (front) Implementation Plan

> **Executed:** merged into `main` at `daf6cd2` (`feat/ranked-analytics-front`) and `1f8491c` (`feat/admin-panel-rebuild`, the panel pages for decks, ignored setcodes and staples). The follow-up for the rebuilt classification is `2026-11-02-deck-classification-front.md`.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/statistics`, the deck and card pages, the profile statistics, the infographics and the wiki tier list on the five new routes, organised around the four questions.

**Architecture:** `utils/statistics.ts` is rewritten as the typed client of the new API; the page is four sections with season / window / band pickers in the URL; the deck and card pages are server components over `getDeck` / `getCard`; everything that read the old tree is deleted.

**Tech Stack:** Next.js App Router, React 19, next-intl, Tailwind, vitest.

**Spec:** omega-server-v3 `docs/superpowers/specs/2026-11-01-ranked-analytics-rebuild-design.md` (§6 API, §7 front). Depends on the server plan's Task 9 being deployed to the dev API first.

## Global Constraints

- Rates are 0–1 from the API; show as `55.2%`; intervals as a range `54–56` (`pct(lo)`–`pct(hi)`), never as ±.
- A matchup cell is coloured only when `[wrLo, wrHi]` excludes `wrExpected`.
- Games under 100 are hidden by default in every matchup list (`MIN_MATCHUP_GAMES = 100`), with an opt-in control.
- Pickers live in the URL: `?season=`, `?window=season|last7`, `?band=all|<tier>`; `?ladder=` as today.
- Copy keys under `Statistics.*` in `messages/en.json` and `messages/pt.json`; both files keep the same key set (the pre-existing `cards.cols.withWithout` en-only key is removed).
- `pct`, `num`, `nameOf`, `Art`, `faceOf` keep living in `app/statistics/DeepDive.tsx` (rename to `app/statistics/shared.tsx` in Task 2).
- Verify with `tsc --noEmit`, `eslint`, `vitest` and the browser on the dev server (5173) against the dev API; never `next build`.

## Review Focus

1. A season swept through yesterday only: `window=last7` on day 2 of a season has one or two days of games; the page must show the window's `games` and not pretend to a week. Pinned in Task 3 (copy shows `fit.games` and the day count from `weeks`).
2. A deck with `tier: null` and `wrExpected` present (under the floors): the ranking shows it without a tier badge, not as missing. Pinned in Task 3.
3. A signed-out viewer on "Me or the deck": a sign-in prompt, no request to the player route. Pinned in Task 3.
4. An opponent key the API names `null` (setcode without a name): `nameOf` falls back to the key as today. Pinned in Task 2.
5. A deck page for a key with no `stats_decks` row (under 30 games): the route answers 404 and the page renders the "needs a minimum of ranked games" state from `jobs.deckGone`. Pinned in Task 4.

---

### Task 1: Client and types

**Files:**
- Rewrite: `utils/statistics.ts`; Delete: `utils/power-tier.ts`, `utils/power-tier.test.ts`
- Test: `utils/statistics.test.ts` (rewrite)

**Interfaces (Produces):**

```ts
export type Window = 'season' | 'last7'
export type Scope = { ladder: RankedLadderId; season?: string; window: Window; band: string }
export type Season = { id: number; code: string; ladder: RankedLadderId; label: string; startsAt: string; endsAt: string | null; sweptThrough: string | null }
export type Fit = { games: number; decks: number; firstEffect: number; ratingEffect: number; matchupStrength: number; cardStrength: number; phiMedian: number; builtAt: string }
export type DeckStat = { key: string; name: string | null; games: number; matches: number; players: number; share: number; wins: number; losses: number; draws: number; wrRaw: number | null; strength: number; strengthSe: number; phi: number; wrExpected: number; wrLo: number; wrHi: number; tier: 1 | 1.5 | 2 | 3 | 4 | null; firstEffect: number; firstSe: number; g1Games: number; g1Wr: number | null; postGames: number; postWr: number | null; firstG1Wr: number | null; secondG1Wr: number | null; pilotShare: number; mirrorShare: number }
export type Matchup = { key: string; opponent: string; opponentName: string | null; games: number; wins: number; losses: number; draws: number; wrRaw: number | null; wrExpected: number; wrAdjusted: number; wrLo: number; wrHi: number; firstWr: number | null; secondWr: number | null }
export type Week = { key: string; week: number; firstDay: string; games: number; share: number; strength: number; se: number; wrExpected: number; jump: -1 | 0 | 1 }
export type CardStat = { key: string; card: number; name: string | null; lists: number; inclusion: number; copies: number | null; sideRate: number; playRate: number | null; effect: number | null; effectSe: number | null; activations: number; responded: number; respondedBy: { id: number; name: string | null; times: number }[]; extra: boolean; handTrap: boolean }
export type Meta = { season: Season; window: Window; band: string; bands: { band: string; players: number }[]; fit: Fit; decks: DeckStat[]; weeks: Week[] }
export type DeckAnswer = { deck: DeckStat; matchups: Matchup[]; cards: CardStat[]; weeks: Week[]; byBand: (DeckStat & { band: string })[]; against: { id: number; name: string | null; games: number; rate: number; winRate: number | null }[]; sampleDeck: SampleDeck | null }
export type CardAnswer = { card: { id: number; name: string | null; extra: boolean; handTrap: boolean }; all: CardStat; byDeck: CardStat[] }
export type PlayerAnswer = { season: Season | null; record: Tally; decks: PlayerDeck[]; matchups: PlayerMatchup[]; timeline: TimelineRow[] }
export const getSeasons = (): Promise<Season[]>
export const getMeta = (scope: Scope): Promise<Result<Meta>>                 // revalidate 300
export const getDeck = (key: string, scope: Scope): Promise<Result<DeckAnswer>>
export const getCard = (id: number, scope: Pick<Scope, 'ladder' | 'season'>): Promise<Result<CardAnswer>>
export const getPlayerStatistics = (id: string, scope: Pick<Scope, 'ladder' | 'season'>, cookie: string | null): Promise<Result<PlayerAnswer>>
export const matchupCall = (m: Pick<Matchup, 'wrLo' | 'wrHi' | 'wrExpected'>): 'favorable' | 'neutral' | 'unfavorable'   // interval excludes the expected
export const bestAgainst = (decks: DeckStat[], matchups: Matchup[], top = 5): { key: string; wr: number } | null   // share-weighted wrAdjusted against the `top` most played
export const scopeQuery = (scope: Scope): string; export const statisticsHref, deckHref, cardHref as today with `scope`
```

- [ ] **Step 1: Write the failing tests** — `matchupCall({ wrLo: 0.52, wrHi: 0.58, wrExpected: 0.5 })` → favorable; `wrExpected: 0.53` → neutral; `wrHi: 0.49, wrExpected: 0.5` → unfavorable; `bestAgainst` on three decks with hand-made matchups returns the deck with the highest share-weighted adjusted rate; `scopeQuery({ ladder: 'tcg', window: 'last7', band: 'Gold' })` = `ladder=tcg&window=last7&band=Gold`; `getMeta` and `getDeck` with a mocked `fetch` (as the current test mocks it) map 404 to `{ ok: false, status: 404 }`.
- [ ] **Step 2:** run `npx vitest run utils/statistics.test.ts --exclude ".claude/**" --exclude ".worktrees/**"`: fails.
- [ ] **Step 3:** implement; delete `power-tier.ts` and its test.
- [ ] **Step 4:** tests pass; `tsc --noEmit` will fail on the pages until Task 2–5 (expected); commit `feat(statistics): client for the rebuilt API`.

---

### Task 2: Shared pieces

**Files:**
- Rename: `app/statistics/DeepDive.tsx` → `app/statistics/shared.tsx` keeping `pct`, `num`, `nameOf`, `Art`, `faceOf`, `NOTE`, `ROW`, `NUM`, `SortHeads`, `sortBy`, `useSort`, `Bar`; delete the card/group/against tables from it (rebuilt in Task 4)
- Create: `app/statistics/shared.test.tsx`; `app/statistics/Interval.tsx` (`<Interval lo hi value expected? />`: a 40–70% bar with the interval band, the value tick and an optional expected tick; coloured by `matchupCall` when `expected` is given)
- Create: `app/statistics/Pickers.tsx` (season, window, band as `Segmented`/`Select` writing `?season=&window=&band=` through `router.replace`)

- [ ] **Step 1:** test `nameOf({ key: '207', name: null })` → `'207'`; `Interval` renders `role="img"` with `aria-label` `"54–56, value 55"` and the band class by call.
- [ ] **Step 2–3:** fail, implement, pass, commit `feat(statistics): interval bar and pickers`.

---

### Task 3: The page

**Files:**
- Rewrite: `app/statistics/page.tsx` (reads `scope` from `searchParams`, calls `getSeasons` + `getMeta`), `app/statistics/MetaDashboard.tsx` (four sections), `app/statistics/dashboard/sections.ts` (`['play', 'face', 'beat', 'me']`)
- Create: `app/statistics/dashboard/WhatToPlay.tsx`, `WhatYouFace.tsx`, `HowToBeat.tsx` (client: deck picker + `getDeck` on pick), `MeOrTheDeck.tsx` (server: session → `getPlayerStatistics`; signed out → prompt)
- Delete: `DeckRanking.tsx`, `MatchupMatrix.tsx`, `DeckComparator.tsx`, `MetaOverview.tsx`, `MetaExtras.tsx`, `MetaTrendsCard.tsx`, `CardsSection.tsx`, `SampleDecks.tsx` (sample deck moves into `HowToBeat`), `DashboardHeader.tsx`, `controls.tsx` (keep `DeckPicker` by moving it to `shared.tsx`), `StatsJob.tsx`, `StatsShell.tsx`
- Move: `OmegaActivity.tsx` to `app/statistics/activity/page.tsx`
- Copy: replace the `Statistics.ranking`, `matrix`, `comparator`, `overview`, `trends`, `cards`, `header`, `method` blocks with `play`, `face`, `beat`, `me`, `pickers`, `method` in both locales; the method text is spec §5 in two paragraphs plus the three reading caveats from the current `method.body`.

- [ ] **Step 1:** `WhatToPlay`: decks sorted by `wrExpected` desc, each row `Interval`, tier badge (none when `tier === null`), share, games, players; callout from `bestAgainst`; a note with `fit.games`, the number of weeks and `fit.firstEffect` as "going first: +X points in game 1" (σ(β)−0.5). Unit test for the sort and the note values with a hand-made `Meta` (`npx vitest run app/statistics/dashboard/WhatToPlay.test.tsx` with `renderToStaticMarkup`).
- [ ] **Step 2:** `WhatYouFace`: share bars for the top 12, weekly share sparkline per deck from `weeks`, risers/fallers by last-week share minus the week before, decks with `jump !== 0` this week.
- [ ] **Step 3:** `HowToBeat`: picker (top 10 tiles + search over `decks`), then `getDeck(key, scope)`: matchups with ≥ `MIN_MATCHUP_GAMES` as `Interval` with `expected`, a "show under 100" toggle, `firstG1Wr`/`secondG1Wr`, `against` top 10, `sampleDeck`.
- [ ] **Step 4:** `MeOrTheDeck`: per deck the viewer's `wr` interval beside `ladder.wrExpected` interval; signed out → `me.signIn` prompt and no fetch (test: render with `session = null` makes no call).
- [ ] **Step 5:** `tsc`, `eslint`, vitest; browser: `/statistics?window=last7&band=Gold` renders the four sections with the pickers reflecting the URL; commit `feat(statistics): the four questions`.

---

### Task 4: Deck and card pages

**Files:**
- Rewrite: `app/statistics/archetypes/[key]/page.tsx` + `app/statistics/DeckPage.tsx` (server, `getDeck`): header with `wrExpected` interval, tier, share, games, players; weeks chart with bands (`LineChart` with `null` gaps, two extra series for lo/hi drawn as a band); matchups by deviation; game 1 first/second; game 1 vs post-side; `byBand` table; cards with `effect` ± `effectSe` as an interval around 0 (logit shown as points: σ(effect) − 0.5); core/flex list from `inclusion` (≥ 0.8 core); `against`; sample deck
- Rewrite: `app/statistics/cards/[id]/page.tsx` + `CardPage.tsx` (`getCard`): `all` row, `byDeck` table with effect intervals, responses
- Delete: the deep-dive request flow (`requestDeepDive`, `getArchetypeIndex`, `StatsJob`), `Statistics.jobs.*` copy except `deckGone`

- [ ] **Step 1:** vitest on the core/flex split and on the effect-to-points conversion.
- [ ] **Step 2:** implement; 404 from `getDeck` renders `jobs.deckGone`.
- [ ] **Step 3:** browser check of one deck and one card; commit `feat(statistics): deck and card pages on the answer rows`.

---

### Task 5: Profile, infographics, wiki tier list

**Files:**
- Modify: `app/profile/statistics/PlayerStatistics.tsx` (new `PlayerAnswer`: record, decks with the ladder comparison, matchups, timeline), `app/profile/[id]/statistics/infographic/[section]/route.tsx`
- Rewrite: `app/statistics/infographic/[section]/route.tsx` (sections `tier-list`, `meta-report`, `deck`: read `getMeta`/`getDeck`; tier board from `tier`, deck card with the interval)
- Modify: `scripts/wiki-tier-list.ts` (tiers from `DeckStat.tier`, score = `wrExpected` with the interval in the copy, matchups from `getDeck` with `matchupCall`)

- [ ] **Step 1:** vitest on the script's pure helpers (`tier`, `leaders`, `risers` over hand-made `DeckStat[]`).
- [ ] **Step 2:** implement; `curl` the two infographic routes on the dev server and open the PNGs; run the script from an empty folder with `docs/wiki-pages` (memory: paths are cwd-relative).
- [ ] **Step 3:** commit `feat(statistics): profile, infographics and tier list on the new API`.

---

### Task 6: Maintenance off and docs

- [ ] Remove the maintenance gate from `app/statistics/page.tsx` (or revert the maintenance commit if it is what production runs).
- [ ] `docs/wiki-pages` README / `WIKI_BLOCKS.md` mentions of `power-tier` updated; `README.md` section on statistics updated.
- [ ] Full `tsc`, `eslint`, `vitest` (with the worktree excludes); browser pass over `/statistics`, one deck, one card, `/statistics/activity`, the profile statistics.
- [ ] Commit `chore(statistics): maintenance off, docs`.
