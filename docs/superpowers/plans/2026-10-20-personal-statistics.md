# Personal statistics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/profile/:id/statistics` shows one duelist's record, with match win rate and game win rate overall, per deck and per matchup, on the Ranked and Tournaments tabs.

**Architecture:** The API only gains fields. Ranked: a personal tally (`addPersonalMatch`) runs beside `addGlobalMatch` in `playerStatisticsBody` and comes out as `record`. Tournaments: `computeStats`/`buildPlayerStats` count `games` next to the match counts. The front swaps the meta `Report` on the Ranked tab for a new `RankedReport` built from the `TournamentReport` pieces, then deletes the `player` mode of `Report`/`DeepDive`.

**Tech Stack:** omega-server-v3 (Fastify, TypeScript, `tsx` script tests with `node:assert`, run in the `app-dev` container); tournament-next (Next.js, React, Tailwind).

**Spec:** `docs/superpowers/specs/2026-10-20-personal-statistics-design.md` (tournament-next)

## Global Constraints

- Both repos work on branch `feat/personal-statistics` (tournament-next already has it; create it in omega-server-v3 from `main` before Task 1). Never push.
- Commit messages: Conventional Commits, **no** `Co-Authored-By` trailer.
- Edit files with the Edit tool only: no `sed -i`/python/node rewrites (omega-server-v3 mixes CRLF and LF).
- Win rate = wins / (wins + losses + draws); a draw is not a win; `null` (shown `—`) when the sum is 0.
- Mirrors **count** in every personal number.
- Ranked API spells `losses` (statistics API); tournament API spells `loses` (tournament API). Don't rename either.
- API tests: `docker compose exec app-dev npx tsx <file>` from `C:\Users\marti\Documents\omega-server-v3`; typecheck `docker compose exec app-dev npx tsc --noEmit`.
- Front checks: `npx tsc --noEmit` and `npx eslint <changed files>` in tournament-next. No `next build`.
- UI copy is English.
- Rollout: API first, then front.

## Review Focus

1. A duelist with no analyzed match (fresh account, empty season) → every rate reads `—`, lists are empty, no NaN. Pinned in Task 1 (`personalRecord(emptyPersonal(), {})`) and Task 5 (empty panel).
2. A match with no result (`result: -1`) or a draw (`result: 2`) → out of the match W/L/D, or counted as a draw; its games still count. Pinned in Task 1.
3. The duelist's own deck unknown (`archetype: null`) → counted in the overall record, absent from `decks` and `matchups`. Pinned in Task 1.
4. A `record.decks` row with no row in `archetypes` (the 100-deck cut, or a key mismatch) → the row renders with the art placeholder, not a crash. Pinned in Task 5 (`Art` with `card` undefined).
5. A player payload without `record` (front live before the API, or a stale cache) → the Ranked tab shows the "Couldn't read the statistics" box, not a crash. Pinned in Task 5 (guard in `RankedBody`).

---

### Task 1: Personal tally (API)

**Files:**
- Modify: `C:\Users\marti\Documents\omega-server-v3\src\modules\analytics\analytics.global.ts` (new block after `addGlobalMatch`, ~line 411)
- Test: `C:\Users\marti\Documents\omega-server-v3\src\modules\analytics\analytics.test.ts` (add the three names to the `./analytics.global.js` import; new block after the `only` block, ~line 642)

**Interfaces:**
- Consumes (same file / `analytics.season.js`): `Tally` (`[games, wins, losses, draws]`), `tally()`, `count(t, outcome)`, `Outcome`, `sideDeck`, `sortedKey`, `archetypeName`, `matchWinner`, `GlobalMatchInput`, `Groups`, `Rules`, `NO_RULES`.
- Produces:
  ```ts
  export interface PersonalState {
    matches: Tally
    games: Tally
    /** sortedKey(archetype) -> [matches, games]; never '' */
    decks: Record<string, [Tally, Tally]>
    /** `${mine}|${opp}` (both sortedKey, neither '') -> [matches, games] */
    matchups: Record<string, [Tally, Tally]>
  }
  export const emptyPersonal = (): PersonalState
  export const addPersonalMatch = (
    state: PersonalState, match: GlobalMatchInput, me: Side,
    catalog: Catalog & { setcodesOf: (id: number) => readonly number[] }, groups: Groups, rules: Rules = NO_RULES,
  ): void
  export type Tally3 = { wins: number; losses: number; draws: number }
  export const personalRecord = (state: PersonalState, names: Record<number, string>) => ({
    matches: Tally3, games: Tally3,
    decks: { archetype: number[]; name: string | null; matches: Tally3; games: Tally3 }[],
    matchups: { archetype: number[]; opponent: number[]; name: string | null; opponentName: string | null; matches: Tally3; games: Tally3 }[],
  })
  export type PersonalRecord = ReturnType<typeof personalRecord>
  ```

- [ ] **Step 1: Write the failing test** in `analytics.test.ts`

```ts
// Record pessoal (/statistics/players/:id): match e game do lado dele, espelho dentro.
{
  const deckAs = (side: 'player1' | 'player2', code: number | null) =>
    sideDeck(decks[side], { ...catalog, setcodesOf: () => (code === null ? [] : [code]) }, globalGroups)
  const [mineX, oppB] = [deckAs('player1', X), deckAs('player2', BRANDED)]
  const g = (winner: (typeof games)[number]['winner']) => ({ ...games[0]!, winner })
  // matchWinner da sempre player1 num match decidido: a derrota e jogar do lado player2.
  const play = (state: PersonalState, me: 'player1' | 'player2', result: number, winners: (typeof games)[number]['winner'][], global: { player1: SideDeck; player2: SideDeck }) =>
    addPersonalMatch(state, { record: { ...record, result }, decoded: decks, games: winners.map(g), stats: [], global }, me, { ...catalog, setcodesOf: () => [] }, globalGroups)

  // O exemplo do pedido: 3 vitorias 2:1 e uma derrota 1:2.
  const four = emptyPersonal()
  for (let i = 0; i < 3; i++) play(four, 'player1', 0, ['player1', 'player2', 'player1'], { player1: mineX, player2: oppB })
  play(four, 'player2', 0, ['player1', 'player2', 'player1'], { player1: oppB, player2: mineX })
  const out = personalRecord(four, { [X]: 'Ex', [BRANDED]: 'Branded' })
  assert.deepEqual(out.matches, { wins: 3, losses: 1, draws: 0 })
  assert.deepEqual(out.games, { wins: 7, losses: 5, draws: 0 })
  assert.deepEqual(out.decks, [{ archetype: [X], name: 'Ex', matches: { wins: 3, losses: 1, draws: 0 }, games: { wins: 7, losses: 5, draws: 0 } }])
  assert.deepEqual(out.matchups, [{ archetype: [X], opponent: [BRANDED], name: 'Ex', opponentName: 'Branded', matches: { wins: 3, losses: 1, draws: 0 }, games: { wins: 7, losses: 5, draws: 0 } }])

  const edge = emptyPersonal()
  play(edge, 'player1', 0, ['player1', 'player1'], { player1: mineX, player2: deckAs('player2', X) }) // espelho conta
  play(edge, 'player1', -1, ['player1', null], { player1: mineX, player2: oppB }) // sem resultado: fora do match; game sem vencedor fora
  play(edge, 'player1', 2, ['draw'], { player1: mineX, player2: oppB }) // empate
  play(edge, 'player1', 0, ['player1'], { player1: deckAs('player1', null), player2: oppB }) // deck dele desconhecido: so no geral
  play(edge, 'player1', 0, ['player1'], { player1: mineX, player2: deckAs('player2', null) }) // oponente desconhecido: fora do matchup
  const e = personalRecord(edge, { [X]: 'Ex', [BRANDED]: 'Branded' })
  assert.deepEqual(e.matches, { wins: 3, losses: 0, draws: 1 })
  assert.deepEqual(e.games, { wins: 5, losses: 0, draws: 1 })
  assert.deepEqual(e.decks.map((d) => [d.archetype, d.matches]), [[[X], { wins: 2, losses: 0, draws: 1 }]])
  assert.deepEqual(e.matchups.map((m) => [m.archetype, m.opponent, m.matches.wins + m.matches.draws]), [[[X], [X], 1], [[X], [BRANDED], 1]])

  const none = personalRecord(emptyPersonal(), {})
  assert.deepEqual(none, { matches: { wins: 0, losses: 0, draws: 0 }, games: { wins: 0, losses: 0, draws: 0 }, decks: [], matchups: [] })
}
```

Also import `addPersonalMatch, emptyPersonal, personalRecord, type PersonalState, type SideDeck` from `./analytics.global.js`.

- [ ] **Step 2: Run it and see it fail**

Run: `docker compose exec app-dev npx tsx src/modules/analytics/analytics.test.ts`
Expected: FAIL, `addPersonalMatch` is not exported.

- [ ] **Step 3: Implement `emptyPersonal`, `addPersonalMatch`, `personalRecord` in `analytics.global.ts`**

- Decks: `match.global?.[side] ?? sideDeck(match.decoded[side], catalog, groups, rules)` for both sides, keyed with `sortedKey(deck.archetype)`.
- Game outcome from `me`: the same expression as `addGlobalMatch` line 305 (no mirror nulling). Match outcome: the same from `matchWinner(match.record.result)`.
- `count` the match once and each game into `state.matches`/`state.games`, into `decks[mine]` when `mine !== ''`, into `matchups[`${mine}|${opp}`]` when neither is `''`.
- `personalRecord`: Tally → `{ wins: t[1], losses: t[2], draws: t[3] }`; keys back to `number[]` with `split('+').map(Number)`; `name`/`opponentName` = `archetypeName(names, key)`. Order both lists by match W+L+D desc, then games W+L+D desc, then key. In the edge case above the mirror and the X-vs-Branded matchup tie on matches (1 each) and on games, so the key decides: `'240|240'` < `'240|349'`.

- [ ] **Step 4: Run the test and the typecheck**

Run: `docker compose exec app-dev npx tsx src/modules/analytics/analytics.test.ts` → no assertion error (the file's existing output plus no throw).
Run: `docker compose exec app-dev npx tsc --noEmit` → no errors.

- [ ] **Step 5: Commit** (omega-server-v3)

```bash
git add src/modules/analytics/analytics.global.ts src/modules/analytics/analytics.test.ts
git commit -m "feat(statistics): personal match and game tally"
```

---

### Task 2: `record` on `GET /statistics/players/:id` (API)

**Files:**
- Modify: `C:\Users\marti\Documents\omega-server-v3\src\modules\analytics\analytics.service.ts:679-691` (`playerStatisticsBody`) and its `./analytics.global.js` import (~line 32)
- Modify: `C:\Users\marti\Documents\omega-server-v3\docs\front\STATISTICS_API.md` §6, `C:\Users\marti\Documents\omega-server-v3\docs\STATISTICS.md` (the "One duelist" row, line 21)

**Interfaces:**
- Consumes: Task 1's `emptyPersonal`, `addPersonalMatch`, `personalRecord`; `statisticsOf(...)` already returns `{ statistics, names }`.
- Produces: the response field `record: PersonalRecord` (Task 1 shape), next to everything already there.

- [ ] **Step 1: Wire it**

In the `foldMatches` callback, compute `me` once, call `addGlobalMatch(..., me)` as today, then `addPersonalMatch(personal, match, me, withSetcodes, catalog.groups, catalog.rules)`. Destructure `names` from `statisticsOf` too, and return `record: personalRecord(personal, names.archetypes)`.

- [ ] **Step 2: Typecheck**

Run: `docker compose exec app-dev npx tsc --noEmit` → no errors.

- [ ] **Step 3: Check the live response**

Pick a public duelist with ranked matches (open `http://localhost:5173/leaderboard`, take a profile id). Then:
Run: `curl -s "http://localhost:3000/statistics/players/<id>?ladder=tcg" | jq '{analyzed: .matches.analyzed, m: .record.matches, g: .record.games, decks: (.record.decks | length), first: .record.decks[0]}'`
Expected: `m.wins + m.losses + m.draws <= analyzed`, `g` W+L+D at least that, `decks >= 1`, `first.name` not null. (No `jq` in the shell: read the same fields from the raw JSON.)

- [ ] **Step 4: Document**

§6: add `record` to the response list. Give its shape, then say: mirrors in; a draw is not a win; unknown decks count only in `matches`/`games`; counts only (the front divides). Name `decks`/`matchups` order as by matches. Add to the STATISTICS.md row that `addPersonalMatch` runs beside `addGlobalMatch`.

- [ ] **Step 5: Commit** (omega-server-v3)

```bash
git add src/modules/analytics/analytics.service.ts docs/front/STATISTICS_API.md docs/STATISTICS.md
git commit -m "feat(statistics): match and game record on a duelist's statistics"
```

---

### Task 3: Game record on tournament stats (API)

**Files:**
- Modify: `C:\Users\marti\Documents\omega-server-v3\src\modules\tournaments\tournaments.types.ts:115-133`
- Modify: `C:\Users\marti\Documents\omega-server-v3\src\modules\tournaments\tournaments.service.ts` (`computeStats` 414-596, `buildPlayerStats` 761-793)
- Modify: `C:\Users\marti\Documents\omega-server-v3\docs\front\TOURNAMENT_API.md` (player stats section)
- Test: `C:\Users\marti\Documents\omega-server-v3\src\modules\tournaments\tournaments.test.ts` (unit block before the DB section; invariants in the "Estatisticas do duelista" block, ~line 262)

**Interfaces:**
- Produces: `export interface GameRecord { wins: number; loses: number; draws: number }`; `ArchetypeStat.games: GameRecord`; `MatchupStat.games: GameRecord`; `buildPlayerStats(...).record` = `{ wins, loses, draws, games: GameRecord }`.

- [ ] **Step 1: Write the failing tests**

Unit block (add `computeStats` to the `./tournaments.service.js` import):

```ts
// Games por deck e matchup: venceu 2:0 e 2:1.
{
  const deck = (archetype: string) => ({ archetype, archetypes: [], main: [], extra: [], side: [] })
  const t = [{
    summary: { status: 'finished' },
    standings: [
      { player: { id: 'me' }, rank: 1, deck: deck('Branded') },
      { player: { id: 'a' }, rank: 2, deck: deck('Kashtira') },
      { player: { id: 'b' }, rank: 3, deck: deck('Snake-Eye') },
    ],
    rounds: [
      { matches: [{ player1: 'me', player2: 'a', outcome: 'player1', games: [{ winner: 'player1' }, { winner: 'player1' }], first: null }] },
      { matches: [{ player1: 'b', player2: 'me', outcome: 'player2', games: [{ winner: 'player2' }, { winner: 'player1' }, { winner: 'player2' }], first: null }] },
    ],
  }] as unknown as Parameters<typeof computeStats>[0]
  const mine = computeStats(t, 10, Infinity, 'me')
  assert.deepEqual(mine.archetypes.map((a) => [a.archetype, a.wins, a.games]), [['Branded', 2, { wins: 4, loses: 1, draws: 0 }]])
  assert.deepEqual(
    Object.fromEntries(mine.matchups.map((m) => [m.opponent, m.games])),
    { Kashtira: { wins: 2, loses: 0, draws: 0 }, 'Snake-Eye': { wins: 2, loses: 1, draws: 0 } },
  )
  const all = computeStats(t, 10)
  assert.deepEqual(all.archetypes.find((a) => a.archetype === 'Snake-Eye')!.games, { wins: 1, loses: 2, draws: 0 })
}
```

DB block (after line 263):

```ts
    const g = mine.record.games
    assert.equal(g.wins + g.loses + g.draws, mine.matches.games)
    // Os games dos decks sao parte dos games dele (deck sem arquetipo fica de fora).
    assert.ok(mine.archetypes.reduce((n, a) => n + a.games.wins + a.games.loses + a.games.draws, 0) <= mine.matches.games)
```

- [ ] **Step 2: Run it and see it fail**

Run: `docker compose exec app-dev npx tsx src/modules/tournaments/tournaments.test.ts`
Expected: FAIL in the unit block (`games` undefined).

- [ ] **Step 3: Implement**

- `archetypeStat` and the matchup object start with `games: { wins: 0, loses: 0, draws: 0 }`.
- Beside the existing match counting in the archetype loop (549-555) and the matchup (568-571), count every `match.games[].winner` from the same side (`'draw'` → draws, `=== side` → wins, else loses).
- `buildPlayerStats`: `record` starts with `games: { wins: 0, loses: 0, draws: 0 }`. In the loop, where a played match of his is counted, count each of its games from `mine`.

- [ ] **Step 4: Run the tests and the typecheck**

Run: `docker compose exec app-dev npx tsx src/modules/tournaments/tournaments.test.ts` → prints `tournaments ok`.
Run: `docker compose exec app-dev npx tsc --noEmit` → no errors.

- [ ] **Step 5: Document and commit** (omega-server-v3)

TOURNAMENT_API.md: `games` on archetype and matchup rows (games won/lost/drawn from that row's deck, the first deck for a matchup), `record.games` on the player stats.

```bash
git add src/modules/tournaments/tournaments.types.ts src/modules/tournaments/tournaments.service.ts src/modules/tournaments/tournaments.test.ts docs/front/TOURNAMENT_API.md
git commit -m "feat(tournaments): game record per deck, matchup and duelist"
```

---

### Task 4: Game win rate on the Tournaments tab (front)

**Files:**
- Modify: `C:\Users\marti\Documents\tournament-next\utils\types.ts:497-599` (`ArchetypeStat`, `MatchupStat`, `PlayerTournamentStats`)
- Modify: `C:\Users\marti\Documents\tournament-next\components\omega\tournament\labels.ts` (after `formatRecord`)
- Modify: `C:\Users\marti\Documents\tournament-next\app\profile\statistics\TournamentReport.tsx`

**Interfaces:**
- Consumes: Task 3's fields.
- Produces: `export type GameRecord = { wins: number; loses: number; draws: number }` (utils/types); `export const recordRate = (r: { wins: number; loses: number; draws: number }): number | null` (labels.ts; `null` when the sum is 0). Task 5 uses `recordRate`, `formatRecord`, `RecordBar` with `{ wins, loses, draws }`.

- [ ] **Step 1: Types and `recordRate`**

`ArchetypeStat.games: GameRecord`, `MatchupStat` gains `games: GameRecord`, `PlayerTournamentStats.record` becomes `{ wins: number; loses: number; draws: number; games: GameRecord }`. Fix anything `tsc` flags (objects that build these types).

- [ ] **Step 2: `TournamentReport`**

- 01 `StatGrid` `columns={6}`, items in order:
  - `Tournaments` (unchanged);
  - `Match record` (unchanged);
  - `Match win rate` = `rate(recordRate(record))`, hint `Matches, byes out`;
  - `Game win rate` = `rate(recordRate(record.games))`, hint `${W+L+D of record.games} games`;
  - `Going first`, `Going second` (unchanged).
- "Record by deck": the `Win rate` column becomes `Match WR`; after it add `Games` (W+L+D of `row.games`, numeric) and `Game WR` (`rate(recordRate(row.games))`, numeric, strong).
- Matchups: add `Match WR` (`rate(recordRate(row))`) and `Game WR` (`rate(recordRate(row.games))`) after `Record`.

- [ ] **Step 3: Check**

Run: `npx tsc --noEmit` → no errors. Run: `npx eslint utils/types.ts components/omega/tournament/labels.ts app/profile/statistics/TournamentReport.tsx` → no errors.

- [ ] **Step 4: Commit** (tournament-next)

```bash
git add utils/types.ts components/omega/tournament/labels.ts app/profile/statistics/TournamentReport.tsx
git commit -m "feat(profile): game win rate on a duelist's tournament statistics"
```

---

### Task 5: Personal Ranked report (front)

**Files:**
- Modify: `C:\Users\marti\Documents\tournament-next\utils\statistics.ts:131-135` (`PlayerStatisticsData`)
- Modify: `C:\Users\marti\Documents\tournament-next\app\statistics\MetaStatistics.tsx:189` (export `TurnBlock`)
- Create: `C:\Users\marti\Documents\tournament-next\app\profile\statistics\RankedReport.tsx`
- Modify: `C:\Users\marti\Documents\tournament-next\app\profile\statistics\PlayerStatistics.tsx` (`asReport`, `RankedBody`, its two callers)

**Interfaces:**
- Consumes: Task 2's `record`; Task 4's `recordRate`, `formatRecord`, `formatRate`; `RecordBar`, `ShareStack`, `WinRateBars` (`@omega/tournament/stats-charts`); `DataTable`, `Panel`, `StatGrid`, `Notice`; `Section`, `TurnBlock` (`@app/statistics/MetaStatistics`); `Art`, `faceOf`, `nameOf`, `num` (`@app/statistics/DeepDive`); `archKey` (`@utils/statistics`).
- Produces:
  ```ts
  // utils/statistics.ts
  export type Tally3 = { wins: number; losses: number; draws: number }
  export type PersonalRecord = {
    matches: Tally3; games: Tally3
    decks: { archetype: ArchetypeKey; name: string | null; matches: Tally3; games: Tally3 }[]
    matchups: { archetype: ArchetypeKey; opponent: ArchetypeKey; name: string | null; opponentName: string | null; matches: Tally3; games: Tally3 }[]
  }
  // PlayerStatisticsData gains `record: PersonalRecord`
  // RankedReport.tsx ('use client')
  export const RankedReport = ({ data }: { data: PlayerStatisticsData }) => JSX.Element
  ```

- [ ] **Step 1: Types and the `TurnBlock` export**

- [ ] **Step 2: `RankedReport.tsx`**

Convert `Tally3` with a one-line `tour = ({ wins, losses, draws }: Tally3) => ({ wins, loses: losses, draws })`, so `recordRate`/`formatRecord`/`RecordBar` work unchanged. Art: `byKey = new Map(data.archetypes.map((a) => [archKey(a.archetype), a]))`, then `<Art card={faceOf(byKey.get(archKey(row.archetype)) ?? { cards: [] })} size={32} className="size-8" />`. A missing row gives the placeholder.

Contents, in order:
- the closed notice when `data.season?.endsAt` (copy: `{label} is closed. These are its final numbers.`, the same markup as `Report`'s `closed`);
- when `data.matches.analyzed === 0`: only the `01` grid plus `<Panel title="No ranked games yet" meta="Nothing played">`;
- `01 · At a glance`, `StatGrid columns={5}`:
  - `Match record` = `formatRecord(tour(record.matches))`, hint `${num(W+L+D of games)} games`;
  - `Match win rate`, hint `Mirrors in`;
  - `Game win rate`, hint `Every game, mirrors in`;
  - `Going first` / `Going second` = `pct(turnOrder.all.first|second.winRate)`, hint `${num(games)} games`;
- `02 · Decks`, stamp `By matches · mirrors in`:
  - `ShareStack` titled `Deck share`, meta `Of their matches` (share = deck matches ÷ Σ deck matches, `othersLabel="Others"`);
  - `WinRateBars` titled `Match win rate`, meta `Matches`, note `formatRecord(tour(row.matches))`;
  - a `DataTable` captioned `Record by deck`: Deck (art + `nameOf(row)`, strong), Matches, Record (`RecordBar`), Match WR (strong), Games, Game WR (strong);
- `03 · Matchups`, stamp `Their deck first · mirrors in`: a `DataTable` with the first 20 rows. Columns: Deck (`row.name ?? nameOf(...)`, strong), Opponent (`row.opponentName`, the same fallback), Record, Match WR, Game WR, Matches;
- `04 · Turn order`, stamp `Every game · mirrors and unknown decks in`: three `TurnBlock` with `player` (All games / Game 1 / Games 2–3, the same titles and metas as `Report`), in a `grid gap-6 lg:grid-cols-3`;
- `<Notice title="How it's counted">` with: "Only this duelist's side. A match counts once, a game once per game played; mirrors count, a draw is not a win. Decks nobody could name count in the totals only. Read live from the duels, the newest 1000 matches at most."

- [ ] **Step 3: Wire `PlayerStatistics.tsx`**

`RankedBody` renders `result.data.record ? <RankedReport data={result.data} /> : <EmptyBox title="Couldn't read the statistics">The game server didn&apos;t answer. Try again in a moment.</EmptyBox>` inside `div.pt-section`, after the cut notice. Add the comment `{/* No record: an API older than the field (the API ships first). */}`. Delete `asReport` and the `Report`/`Statistics` imports. Delete the `label` prop of `RankedBody` and its two call sites (it only fed `asReport`).

- [ ] **Step 4: Check**

Run: `npx tsc --noEmit` → no errors. Run: `npx eslint utils/statistics.ts app/statistics/MetaStatistics.tsx app/profile/statistics/RankedReport.tsx app/profile/statistics/PlayerStatistics.tsx` → no errors.

- [ ] **Step 5: Commit** (tournament-next)

```bash
git add utils/statistics.ts app/statistics/MetaStatistics.tsx app/profile/statistics/RankedReport.tsx app/profile/statistics/PlayerStatistics.tsx
git commit -m "feat(profile): personal ranked report with match and game win rate"
```

---

### Task 6: Delete the meta report's player mode (front)

**Files:**
- Modify: `C:\Users\marti\Documents\tournament-next\app\statistics\MetaStatistics.tsx` (`Report` and everything only it used for `player`)
- Modify: `C:\Users\marti\Documents\tournament-next\app\statistics\DeepDive.tsx:193-212`

**Interfaces:**
- Consumes: nothing passes `player` to `Report` after Task 5.
- Produces: `Report = ({ data }: { data: Statistics })`; `DeepDive = ({ archetype, rank }: { archetype: StatArchetype; rank: number })`. `TurnBlock` keeps its `player` prop (Task 5 uses it).

- [ ] **Step 1: Remove**

In `Report`, delete the `player` param and keep the server branch of every `player ? … : …`: glance items and labels, empty panel, `archCols`, the Unique Duelists cell and column, stamps, BarList, scatter axis label, `DeepDiveSearch`/`CardSearch` guards, the `DeepDive` prop, the method note. Delete `overall` (only the player glance used it). In `DeepDive`, delete the `player` prop and keep the server labels.

- [ ] **Step 2: Check**

Run: `grep -n "player" app/statistics/MetaStatistics.tsx app/statistics/DeepDive.tsx` → only `TurnBlock`'s prop, `players`/`Unique Duelists` data, and `player1/2`-style names remain; no `player ?`.
Run: `npx tsc --noEmit` and `npx eslint app/statistics/MetaStatistics.tsx app/statistics/DeepDive.tsx` → no errors.

- [ ] **Step 3: Commit** (tournament-next)

```bash
git add app/statistics/MetaStatistics.tsx app/statistics/DeepDive.tsx
git commit -m "refactor(statistics): drop the meta report's player mode"
```

---

### Task 7: Check both tabs in the browser

The front's `.env.development` already points at `http://localhost:3000`, the `app-dev` container running Tasks 1–3 (restart it if it does not reload: `docker compose restart app-dev`). The dev server is already on 5173. Read through the DOM (`read_page`, `get_page_text`), not screenshots.

- [ ] **Step 1: Ranked** `http://localhost:5173/profile/<id>/statistics` (the Task 2 duelist).
  - Expected: sections `01 At a glance` (Match record, Match win rate, Game win rate, Going first, Going second), `02 Decks` (table with Match WR and Game WR), `03 Matchups`, `04 Turn order`.
  - Expected absent: "Share vs win rate", "Mirrors", "Archetype deep dive", "Most used cards".
  - Hand-check one deck row: Match WR = wins ÷ matches from its Record.
- [ ] **Step 2: Tournaments** `?view=tournaments` on a duelist with finished tournaments: six cells in 01, `Games` and `Game WR` in "Record by deck", `Match WR` and `Game WR` in Matchups.
- [ ] **Step 3: Global** `?view=global`: both reports stacked, no console errors (`read_console_messages` with `onlyErrors`).
- [ ] **Step 4: Meta page** `http://localhost:5173/statistics`: sections 01–06 still render, Unique Duelists column present.
- [ ] **Step 5: Report** what was checked and anything that could not be (for example, no duelist with a closed season at hand).
