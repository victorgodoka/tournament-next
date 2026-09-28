import { describe, expect, it } from 'vitest'
import type { PlayerSeason } from './analytics'
import { accepts, blocker, buildSegment, catalogOf, dimReason, lineSeries, namesOf, periodDays, removeFrom, run, type ExplorationConfig, type Metric, type Variables } from './explorer'

describe('periodDays', () => {
  it('reads the exclusive end back as the last day included', () => {
    expect(periodDays({ startsAt: '2026-07-01T00:00:00.000Z', endsAt: '2026-08-01T00:00:00.000Z' })).toEqual(['2026-07-01', '2026-07-31'])
  })
})

const GAME = ['archetype', 'opponentArchetype', 'opponent', 'turnOrder', 'gameNumber', 'result', 'match', 'seasonDay']
const metric = (id: string, source: Metric['source'], format: Metric['format'], splitBy: string[]): Metric => ({ id, label: id, source, format, splitBy, from: '', description: '' })
const variables: Variables = {
  version: 1,
  techniques: ['table', 'heatmap', 'bars', 'line'],
  limits: { segments: 4, rows: 2, columns: 1, values: 4, filters: 3, explorations: 20, name: 60, rowLimit: 100 },
  currentSegments: ['current:tcg', 'current:genesys'],
  dimensions: [...GAME, 'card', 'handTrap', 'activatedBy'].map((id) => ({ id, label: id, values: id, description: '' })),
  metrics: [
    metric('games', 'games', 'count', GAME),
    metric('winRate', 'games', 'rate', GAME),
    metric('usage', 'cards', 'rate', ['card', ...GAME]),
    metric('deckInclusion', 'cards', 'rate', ['card', 'archetype']),
    metric('winRateInDeck', 'cards', 'rate', ['card', 'archetype']),
    metric('winRateWhenUsed', 'cards', 'rate', ['card', ...GAME]),
    metric('respondedRate', 'handTraps', 'rate', ['handTrap', 'activatedBy']),
    metric('elo', 'rating', 'last', ['seasonDay']),
  ],
}
const cat = catalogOf(variables)

const game = (n: number, wentFirst: boolean, result: 'win' | 'loss', used: number[]): PlayerSeason['games'][number] => ({
  matchId: String(100 + n), gameNumber: 1, start: `2026-09-0${n}T12:00:00.000Z`, archetype: 'Gem-', opponentId: '1', opponentArchetype: 'Yubel',
  wentFirst, result, turns: 4, actions: 30, combo: { turns: 2, actions: 20, average: 10 }, deckCoverage: { main: 0.3, extra: 0.1 },
  turn1SpecialSummons: 3, longestChain: 2, cards: { used: used.map((cardId) => ({ cardId, uses: 1 })), activated: used }, handTraps: { player: [14558127], opponent: [] },
})

const season = {
  season: { id: 13, code: 'tcg-2', label: '09.2026', ladder: 'tcg', startsAt: '2026-09-01T00:00:00.000Z', endsAt: null },
  record: { games: 4, wins: 2, losses: 2, draws: 0, winRate: 0.5 },
  matchCount: 4, gameCount: 4, gamesWithoutDetail: 0, archetypeDistribution: [], opponents: {},
  games: [game(1, true, 'win', [1]), game(2, true, 'win', [1, 2]), game(3, false, 'loss', [2]), game(4, false, 'loss', [])],
  eloHistory: [{ day: '2026-09-01', seasonDay: 1, elo: 100 }, { day: '2026-09-02', seasonDay: 2, elo: 130 }, { day: '2026-09-04', seasonDay: 4, elo: 120 }],
  cardUsage: [
    {
      cardId: 1, name: 'One', deckInclusion: { games: 4, rate: 1 }, usage: { games: 2, rate: 0.5 },
      whenInDeck: { games: 4, wins: 2, losses: 2, draws: 0, winRate: 0.5 }, whenUsed: { games: 2, wins: 2, losses: 0, draws: 0, winRate: 1 }, byArchetype: [],
    },
    {
      cardId: 3, name: 'Never used', deckInclusion: { games: 2, rate: 0.5 }, usage: { games: 0, rate: 0 },
      whenInDeck: { games: 2, wins: 0, losses: 2, draws: 0, winRate: 0 }, whenUsed: { games: 0, wins: 0, losses: 0, draws: 0, winRate: null }, byArchetype: [],
    },
  ],
  responses: [{ cardId: 14558127, name: 'Ash', byPlayer: { activations: 4, responded: 1 }, byOpponent: { activations: 0, responded: 0 } }],
} as unknown as PlayerSeason

const seg = buildSegment('current:tcg', season)
const names = namesOf([seg])
const cfg = (c: Partial<ExplorationConfig>): ExplorationConfig => ({ v: 1, technique: 'table', segments: ['current:tcg'], rows: [], columns: null, values: [], filters: [], sort: null, limit: 12, runningTotal: false, ...c })

describe('explorer pivot', () => {
  it('splits win rate by turn order, in natural order', () => {
    const res = run(cat, [seg], cfg({ rows: ['turnOrder'], values: ['games', 'winRate'] }), names)
    expect(res.groups.map((g) => [g.labels[0], ...g.seg[0]!.vals])).toEqual([['Going first', 2, 1], ['Going second', 2, 0]])
  })

  it('divides card usage by the games in the cut, not by the games the card was in', () => {
    const res = run(cat, [seg], cfg({ rows: ['card'], values: ['usage'], filters: [{ dimension: 'turnOrder', value: 'first' }] }), names)
    const byName = Object.fromEntries(res.groups.map((g) => [g.labels[0], g.seg[0]!.vals[0]]))
    expect(byName).toEqual({ One: 1, '#2': 0.5 })
  })

  it('names deck-inclusion rows from the aggregate, even a card never used', () => {
    const res = run(cat, [seg], cfg({ rows: ['card'], values: ['deckInclusion'] }), names)
    expect(res.groups.map((g) => [g.labels[0], g.seg[0]!.vals[0]])).toContainEqual(['Never used', 0.5])
  })

  it('reads win rate in deck from the aggregate and when used from the games', () => {
    const res = run(cat, [seg], cfg({ rows: ['card'], values: ['winRateInDeck'] }), names)
    expect(Object.fromEntries(res.groups.map((g) => [g.labels[0], g.seg[0]!.vals[0]]))).toMatchObject({ One: 0.5 })
    const used = run(cat, [seg], cfg({ rows: ['card'], values: ['winRateWhenUsed'] }), names)
    expect(Object.fromEntries(used.groups.map((g) => [g.labels[0], g.seg[0]!.vals[0]]))).toEqual({ One: 1, '#2': 0.5 })
  })

  it('drops rows that miss a threshold, and forgets thresholds of a removed metric', () => {
    const res = run(cat, [seg], cfg({ rows: ['card'], values: ['usage'], thresholds: [{ value: 0, op: 'gte', target: 0.5 }] }), names)
    expect(res.groups.map((g) => g.labels[0])).toEqual(['One', '#2'])
    const t = cfg({ values: ['games', 'winRate'], thresholds: [{ value: 0, op: 'gt', target: 1 }, { value: 1, op: 'gt', target: 0.5 }] })
    removeFrom(t, 'values', 0)
    expect(t.thresholds).toEqual([{ value: 0, op: 'gt', target: 0.5 }])
  })

  it('reads responses from the aggregate', () => {
    const res = run(cat, [seg], cfg({ rows: ['handTrap'], values: ['respondedRate'] }), names)
    expect(res.groups[0]!.seg[0]!.vals[0]).toBe(0.25)
  })

  it('takes the latest elo in the cut, and leaves unsynced days empty', () => {
    expect(seg.label).toBe('Current TCG · 09.2026')
    expect(run(cat, [seg], cfg({ values: ['elo'] }), names).totals![0]!.vals[0]).toBe(120)
    const line = cfg({ technique: 'line', rows: ['seasonDay'], values: ['elo'] })
    const { series } = lineSeries(cat, [seg], run(cat, [seg], line, names), line)
    expect(series[0]!.points.slice(0, 4).map((p) => p.value)).toEqual([100, 130, null, 120])
  })

  it('refuses splits the catalog does not allow', () => {
    const inclusion = cfg({ values: ['deckInclusion'] })
    expect(dimReason(cat, 'turnOrder', inclusion)).toMatch(/not split/)
    expect(accepts(cat, 'values', { kind: 'metric', id: 'winRate' }, inclusion)).toBe(false)
    const line = cfg({ technique: 'line', values: ['winRate'] })
    expect(blocker(line, run(cat, [seg], line, names))?.title).toBe('Line needs Season day')
  })
})
