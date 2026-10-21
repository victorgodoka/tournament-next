# Personal statistics: match and game win rate — design

Date: 2026-10-20
Status: approved in brainstorming, awaiting spec review
Repos: `omega-server-v3` (API), `tournament-next` (front)

## Goal

`/profile/:id/statistics` must read as **one duelist's record**, not as a copy of the meta report.
A player asked to see their **match win rate** next to the game win rate, overall and **per deck**:

> If a player wins 3 matches and loses 1, his winrate should be 75%. If in these 3 matches the
> player won 2:1 three times he should have a 66% game-winrate.

Both numbers on both tabs (Ranked and Tournaments), overall and per deck and per matchup.

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Direction for the Ranked tab | A **personal report** in the shape of the Tournaments tab. The meta-only sections go. |
| Scope | **Both tabs**: Ranked and Tournaments get match WR + game WR. Global inherits both. |
| API approach (Ranked) | **Additive**: keep the global fold (it names the decks and gives turn order), add a personal match + game tally beside it. No field removed. |
| Mirrors | **Counted**: it is the player's real record. |
| Draws | Not a win: WR = wins / (wins + losses + draws), as `tallyOut` and the tournament win rate already do. |

## Background (current code)

- The Ranked tab renders the meta report's own `Report` (`app/statistics/MetaStatistics.tsx`) with
  `player`; `asReport` in `PlayerStatistics.tsx` dresses the player payload as a `Statistics`.
- `GET /statistics/players/:id` (`loadPlayerStatistics` → `playerStatisticsBody`,
  `analytics.service.ts`) folds the newest 1000 matches with `addGlobalMatch(…, only)` and runs
  `statisticsOf(…, 'player')`. Its only consumer is this page.
- The global state counts results **per game**, and its deck win rates leave mirrors out. Nothing
  counts a **match** result per deck (only per card, `cardUse.match`).
- The Tournaments tab (`TournamentReport.tsx`, `GET /tournaments/players/:id/stats` →
  `buildPlayerStats` + `computeStats(…, only)`) is already personal: match record, match WR per
  deck, matchups. It has no game WR. Its matches carry `games[].winner`.

## What does not make sense for one duelist (removed from Ranked)

- "Share" and the share vs win rate scatter: one player's "meta share" is only how often they
  play each deck.
- Deck win rate without mirrors, and the Mirrors column: a mirror is part of their record.
- Section 05 deep dive and section 06 most used cards: meta analysis (popularity, responded rate,
  generic cards) on a one-player sample.
- Season trends (already empty for a player) and the meta "How it's counted" note.

## Backend (`omega-server-v3`)

### Ranked: `GET /statistics/players/:id`

New `addPersonalMatch(state, match, catalog, groups, rules, me)` in `analytics.global.ts`, called
right after `addGlobalMatch` in the `foldMatches` callback of `playerStatisticsBody`:

- Classifies both decks with `match.global?.[side] ?? sideDeck(…)` (the same rule as
  `addGlobalMatch`), keyed by `archetype` (the main key, setcodes ascending, as
  `archetypes[].archetype`). `null` = unknown deck.
- For every game: the outcome from `me`'s side (`game.winner`), **mirrors in**, counted into the
  overall games tally, the deck's games tally and the matchup's games tally.
- Once per match: `matchWinner(match.record.result)` from `me`'s side, into the same three places
  as the match tally.
- Unknown deck: counted in the overall tallies only. An unknown opponent deck keeps the match out of
  matchups.
- A game without a recorded winner (`winner === null`) is out of the games tally; a match without a
  result (`matchWinner` null) is out of the match tally.

State: `{ matches: Tally3, games: Tally3, decks: Record<key, { matches, games }>, matchups:
Record<'mine|opp', { matches, games }> }`, `Tally3 = { wins, losses, draws }` (counts only).

Response gains one field, `record`; nothing else changes:

```ts
record: {
  matches: { wins, losses, draws }   // every analyzed match, unknown decks in
  games:   { wins, losses, draws }
  decks:    { archetype: number[]; name: string | null; matches: Tally3; games: Tally3 }[]          // by matches, desc
  matchups: { archetype: number[]; opponent: number[]; name: string | null; opponentName: string | null;
              matches: Tally3; games: Tally3 }[]                                                   // by matches, desc
}
```

Names come from `archetypeName(names.archetypes, key)`. `playerStatisticsBody` keeps the `names`
that `statisticsOf` already returns (today it only destructures `statistics`); those names cover
every archetype in `total.games`, the opponents' included. Rates are the front's job.

Update `docs/front/STATISTICS_API.md` §6 and the `docs/STATISTICS.md` row.

### Tournaments: `GET /tournaments/players/:id/stats`

- `computeStats`: every deck (`ArchetypeStat`) and matchup (`MatchupStat`) gains
  `games: { wins, loses, draws }`, from `match.games[].winner` on the counted side (the matchup's
  first side). Counted with or without `only`, so the tournament page receives it too and ignores it.
  Keeps this API's `loses` spelling.
- `buildPlayerStats`: `record` gains `games: { wins, loses, draws }`, counted in the loop that
  already builds `record` (played matches only, byes out).

## Front (`tournament-next`)

### Ranked tab: new `app/profile/statistics/RankedReport.tsx`

Client component (the tables take formatter functions), built from the pieces `TournamentReport`
uses (`Section`, `StatGrid`, `ShareStack`, `WinRateBars`, `DataTable`, `RecordBar`), plus
`TurnBlock` exported from `MetaStatistics.tsx`.

1. **01 · At a glance**, `StatGrid` of 5: Match record (`W–L–D`, hint `N games`), Match win rate,
   Game win rate, Going first, Going second (game WR from `turnOrder.all`).
2. **02 · Decks**: Deck share (of their matches, `ShareStack`) beside match WR per deck
   (`WinRateBars`); then a table: Deck (face art + name), Matches, Record (`RecordBar`),
   **Match WR**, Games, **Game WR**, by matches. Art: the deck's row in `archetypes`, joined by key.
3. **03 · Matchups**: Deck, Opponent, Record, Match WR, Game WR, Matches; the first 20 by matches
   (the API sends them all: one player's matchups are few).
4. **04 · Turn order**: the three `TurnBlock`s of today (All games / Game 1 / Games 2–3).
5. A short personal method note: mirrors count, a draw is not a win, newest 1000 matches.

Kept around it: the season picker, the 1000-match cut notice, the closed-season notice.
`RankedBody` renders `RankedReport`; `asReport` goes.

Cleanup: once nothing passes `player`, delete the `player` branches of `Report` and of `DeepDive`
(`app/statistics/DeepDive.tsx`).

### Tournaments tab: `TournamentReport.tsx`

- 01 gains **Game win rate**: Tournaments, Match record, Match WR, Game WR, Going first, Going
  second (`StatGrid` of 6).
- Record by deck and Matchups tables gain Games and Game WR.
- Cards unchanged.

### Types

`PlayerStatisticsData` gains `record`; `ArchetypeStat`, `MatchupStat` gain `games`;
`PlayerTournamentStats.record` gains `games`.

## Acceptance

- 3 matches won 2:1 and 1 lost 1:2: match WR **75%**, game WR **7/12 ≈ 58.3%**. The three 2:1
  wins alone: 100% and 6/9 ≈ 66.7%.
- Per deck and per matchup, the same two rates, mirrors in.
- No share scatter, Mirrors column, deep dive or most used cards on the Ranked tab.

## Testing

- API (`pnpm test`, in the container):
  - `addPersonalMatch`: matches 2:0 and 2:1 → matches 2–0–0, games 4–1–0; a mirror match counts;
    a game without a winner stays out; an unknown opponent deck stays out of matchups.
  - `computeStats`: `games` per deck and per matchup, with and without `only`.
- Front: `tsc --noEmit` + eslint; check both tabs in the preview (port 5173) through the DOM, with
  the front pointed at the container's local API (the remote API has no `record` yet).

## Rollout

API first, then the front: the new API works with the old front; the new front needs `record`.

## Out of scope (follow-up)

- Removing what the Ranked page no longer reads from `GET /statistics/players/:id` (`mostUsed`,
  `trends`, the deep-dive fields of `archetypes`) and the `'player'` scope of `buildStatistics`:
  less work per cold read (1–3 s today) and a smaller payload, once confirmed unused.
