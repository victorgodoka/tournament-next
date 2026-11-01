import { describe, expect, it } from 'vitest'
import { accepts, blocker, dimReason, removeFrom, type Catalog, type ExplorationConfig, type Metric, type PivotResult } from './explorer'

const GAME = ['archetype', 'opponentArchetype', 'opponent', 'turnOrder', 'gameNumber', 'result', 'match', 'seasonDay']
const metric = (id: string, source: Metric['source'], format: Metric['format'], splitBy: string[]): Metric => ({ id, label: id, source, format, splitBy, from: '', description: '' })
const cat: Catalog = {
  techniques: ['table', 'heatmap', 'bars', 'line'],
  limits: { segments: 4, rows: 2, columns: 1, values: 4, filters: 3, explorations: 20, name: 60, rowLimit: 100 },
  dimensions: new Map([...GAME, 'card'].map((id) => [id, { id, label: id, values: id, description: '' }])),
  metrics: new Map([
    metric('winRate', 'games', 'rate', GAME),
    metric('deckInclusion', 'cards', 'rate', ['card', 'archetype']),
  ].map((m) => [m.id, m])),
}

const cfg = (c: Partial<ExplorationConfig>): ExplorationConfig => ({ v: 1, technique: 'table', segments: ['current:tcg'], rows: [], columns: null, values: [], filters: [], sort: null, limit: 12, runningTotal: false, ...c })

describe('explorer builder', () => {
  it('forgets the thresholds of a removed metric', () => {
    const t = cfg({ values: ['games', 'winRate'], thresholds: [{ value: 0, op: 'gt', target: 1 }, { value: 1, op: 'gt', target: 0.5 }] })
    removeFrom(t, 'values', 0)
    expect(t.thresholds).toEqual([{ value: 0, op: 'gt', target: 0.5 }])
  })

  it('refuses splits the catalog does not allow', () => {
    const inclusion = cfg({ values: ['deckInclusion'] })
    expect(dimReason(cat, 'turnOrder', inclusion)).toMatch(/not split/)
    expect(accepts(cat, 'values', { kind: 'metric', id: 'winRate' }, inclusion)).toBe(false)
    expect(blocker(cfg({ technique: 'line', values: ['winRate'] }), { totalGroups: 1 } as PivotResult)?.title).toBe('Line needs Season day')
  })
})
