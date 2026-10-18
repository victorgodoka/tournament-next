import { describe, expect, it } from 'vitest'
import type { ExplorationConfig, Metric, Variables } from './explorer'
import { buildGlobalSegment, globalCatalogOf, globalNamesOf, runGlobal, type GlobalSeason } from './global-explorer'

const GAME = ['archetype', 'opponentArchetype', 'archetypePart', 'opponentArchetypePart', 'turnOrder', 'gameNumber', 'result']
const TRAP = ['handTrap', 'activatedBy', 'archetype', 'opponentArchetype']
const metric = (id: string, source: Metric['source'], splitBy: string[]): Metric => ({ id, label: id, source, format: 'rate', splitBy, from: '', description: '' })
const variables: Variables = {
  version: 1,
  techniques: ['table', 'heatmap', 'bars', 'line'],
  limits: { segments: 4, rows: 2, columns: 1, values: 4, filters: 3, explorations: 20, name: 60, rowLimit: 100 },
  dimensions: [...GAME, ...TRAP, 'seasonDay', 'card', 'engine', 'tech'].map((id) => ({ id, label: id, values: id, description: '' })),
  metrics: [
    metric('samples', 'games', GAME),
    metric('metaShare', 'games', GAME),
    metric('winRate', 'games', GAME),
    metric('inclusion', 'cards', ['card', 'archetype']),
    metric('winRateInDeck', 'cards', ['card', 'archetype']),
    metric('winRateWhenUsed', 'cards', ['card', 'archetype']),
    metric('activations', 'handTraps', TRAP),
    metric('ashedOrPurged', 'handTraps', TRAP),
    metric('ashedOrPurgedRate', 'handTraps', TRAP),
    metric('groupSamples', 'groups', ['engine', 'tech', 'archetype']),
  ],
}
const cat = globalCatalogOf(variables)

const B = [349]
const Y = [7]
// Branded (349) vs Yubel (7): 10 deck-games each side, Branded won 6. Plus 4 Branded mirror deck-games.
const season: GlobalSeason = {
  season: { id: 3, code: 'tcg-2', label: '09.2026', ladder: 'tcg', startsAt: '2026-09-01T00:00:00.000Z', endsAt: null },
  syncedDays: { count: 2, first: '2026-09-01', last: '2026-09-02' },
  minSamples: 0,
  games: [
    [B, Y, 1, 1, 1, 6, 0, 0, 0, 0, 0],
    [B, Y, 0, 1, -1, 4, 0, 0, 0, 0, 0],
    [Y, B, 0, 1, -1, 6, 0, 0, 0, 0, 0],
    [Y, B, 1, 1, 1, 4, 0, 0, 0, 0, 0],
    [B, [349], 1, 1, 1, 2, 0, 0, 0, 0, 0],
    [B, [349], 0, 1, -1, 2, 0, 0, 0, 0, 0],
  ],
  days: [],
  // Ash in 7 Branded deck-games: 4-2 overall, used in 5 of them and 3-1 there.
  cards: [[14558127, B, 7, 21, 5, 3, 1, 0, 4, 2, 0]],
  groups: [[1, B, 3, 1, 2, 0], [2, B, 9, 5, 4, 0]],
  // Ash: Branded activated it 3 times vs Yubel; once in a mirror.
  // The one response (Branded's Ash vs Yubel) was Ash'd or Purged, counted while the counter existed.
  handTraps: [[14558127, B, Y, 3, 1, 0, 0, 1, 1], [14558127, B, [349], 1, 0, 0, 0, 0, 0]],
  names: { archetypes: { 349: 'Branded', 7: 'Yubel' }, cards: { 14558127: 'Ash' }, groups: { 1: { name: 'Albaz', kind: 'engine', handTrap: false }, 2: { name: 'Hand traps', kind: 'tech', handTrap: true } } },
}
const seg = buildGlobalSegment('current:tcg', season)
const names = globalNamesOf([seg])
const cfg = (c: Partial<ExplorationConfig>): ExplorationConfig => ({ v: 1, technique: 'table', segments: ['current:tcg'], rows: [], columns: null, values: [], filters: [], sort: null, limit: 12, runningTotal: false, ...c })
const byLabel = (c: Partial<ExplorationConfig>, s = seg) =>
  Object.fromEntries(runGlobal(cat, [s], cfg(c), names).groups.map((g) => [g.labels.join(' / '), g.seg[0]!.vals]))

describe('global pivot', () => {
  it('counts mirrors in meta share but not in win rate', () => {
    expect(byLabel({ rows: ['archetype'], values: ['samples', 'metaShare', 'winRate'] })).toEqual({
      Branded: [14, 14 / 24, 0.6],
      Yubel: [10, 10 / 24, 0.4],
    })
  })

  it('divides meta share by the filtered deck-games', () => {
    // Going first: Branded 6 + 2 mirror, Yubel 4 = 12.
    expect(byLabel({ rows: ['archetype'], values: ['metaShare'], filters: [{ dimension: 'turnOrder', value: 'first' }] })).toEqual({
      Branded: [8 / 12],
      Yubel: [4 / 12],
    })
  })

  it('caps and orders columns', () => {
    const res = (c: Partial<ExplorationConfig>) =>
      runGlobal(cat, [seg], cfg({ technique: 'heatmap', rows: ['archetype'], columns: 'opponentArchetype', values: ['samples'], ...c }), names)
    expect(res({}).colList.map((c) => c.label)).toEqual(['Branded', 'Yubel'])
    expect(res({ columnSort: 'label', columnLimit: 1 }).colList.map((c) => c.label)).toEqual(['Branded'])
    expect(res({ columnSort: 'label', columnLimit: 1 }).hiddenCols).toBe(1)
  })

  it('divides inclusion by the archetype deck-games', () => {
    expect(byLabel({ rows: ['card'], values: ['inclusion', 'winRateInDeck', 'winRateWhenUsed'], filters: [{ dimension: 'archetype', value: [349] }] })).toEqual({ Ash: [7 / 14, 4 / 6, 3 / 4] })
  })

  it('counts a hand-trap row once unless the cut picks a side', () => {
    expect(byLabel({ values: ['activations'] })).toEqual({ 'All hand traps': [4] })
    expect(byLabel({ rows: ['archetype', 'activatedBy'], values: ['activations'] })).toEqual({
      'Branded / By the deck': [4],
      'Branded / Against the deck': [1],
      'Yubel / Against the deck': [3],
    })
  })

  it("rates Ash'd or Purged only when every response was counted", () => {
    expect(byLabel({ values: ['ashedOrPurged', 'ashedOrPurgedRate'] })).toEqual({ 'All hand traps': [1, 1] })
    // A day recorded before the counter: 2 more responses, none counted. The count stays, the rate goes.
    const older = buildGlobalSegment('current:tcg', { ...season, handTraps: [...season.handTraps, [14558127, Y, B, 2, 2, 0, 0, 0, 0]] })
    expect(byLabel({ values: ['ashedOrPurged', 'ashedOrPurgedRate'] }, older)).toEqual({ 'All hand traps': [1, null] })
  })

  it('hides cuts under minSamples and splits groups by kind', () => {
    const strict = buildGlobalSegment('current:tcg', { ...season, minSamples: 5 })
    const engines = runGlobal(cat, [strict], cfg({ rows: ['engine'], values: ['groupSamples'] }), names)
    expect(engines.groups).toEqual([])
    expect(engines.note).toMatch(/1 row under 5/)
    const techs = runGlobal(cat, [strict], cfg({ rows: ['tech'], values: ['groupSamples'] }), names)
    expect(techs.groups.map((g) => [g.labels[0], g.seg[0]!.vals[0]])).toEqual([['Hand traps', 9]])
  })

  it('keeps a mixed deck apart, and counts it under each setcode by part', () => {
    // Branded / Yubel mixed (2 deck-games) beats Yubel twice; a mixed-vs-same-mix pair is a mirror.
    const mixed = buildGlobalSegment('current:tcg', {
      ...season,
      games: [...season.games, [[7, 349], Y, 1, 1, 1, 2, 0, 0, 0, 0, 0], [[7, 349], [7, 349], 1, 1, 1, 2, 0, 0, 0, 0, 0]],
    })
    expect(byLabel({ rows: ['archetype'], values: ['samples', 'winRate'] }, mixed)).toEqual({
      Branded: [14, 0.6],
      Yubel: [10, 0.4],
      'Yubel / Branded': [4, 1],
    })
    expect(byLabel({ rows: ['archetypePart'], values: ['samples'] }, mixed)).toEqual({ Branded: [18], Yubel: [14] })
    expect(byLabel({ rows: ['archetype'], values: ['samples'], filters: [{ dimension: 'archetypePart', value: 7 }] }, mixed)).toEqual({ Yubel: [10], 'Yubel / Branded': [4] })
  })

  it('drops rows that miss a threshold before the limit', () => {
    expect(byLabel({ rows: ['archetype'], values: ['winRate', 'samples'], thresholds: [{ value: 0, op: 'gt', target: 0.5 }] })).toEqual({ Branded: [0.6, 14] })
    expect(byLabel({ rows: ['archetype'], values: ['winRate', 'samples'], thresholds: [{ value: 1, op: 'lt', target: 12 }] })).toEqual({ Yubel: [0.4, 10] })
  })
})
