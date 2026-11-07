import { describe, expect, it } from 'vitest'
import { families, type DeckStat, type Meta } from '@utils/statistics'
import { validateDoc } from '@utils/wiki-doc'
import { buildReport, tierChanges, type Snapshot } from './wiki-tier-list'
import { statisticsMethodology } from './statistics-methodology'
import { listed, type Ladder, type TierRules } from './tier-list'

const rules: TierRules = { t1Gap: 0.005, t2Gap: 0.03, t3Gap: 0.045, minShare: 0.01, minPlayers: 25 }
const deck = (key: string, tier: DeckStat['tier']) => ({ key, name: `Deck ${key}`, tier, wrExpected: 0.55, wrLo: 0.53, wrHi: 0.57, share: 0.1, players: 30 }) as DeckStat
const ladder = (label: Ladder['label'] = 'TCG'): Ladder => {
  const decks = [deck('promoted', 3), deck('demoted', 4), deck('stays-fourth', 4), deck('top', 1)]
  const meta = { season: { code: 'test', label: 'Test season', sweptThrough: '2026-11-06' }, fit: { aggregateFloor: 'Gold' }, decks, weeks: [] } as unknown as Meta
  return { label, prefix: label === 'TCG' ? 'tcg' : 'genesys', decks: listed(meta), meta, families: families(decks), rules, answers: new Map() }
}
const previous = (): Snapshot => ({
  issue: '2026-10-30', rebuilt: true,
  ladders: Object.fromEntries(['TCG', 'Genesys'].map((label) => [label, {
    season: 'test', band: 'aggregate', floor: 'Gold', rules,
    decks: { promoted: { name: 'Promoted', tier: 4, wrExpected: 0.51 }, demoted: { name: 'Demoted', tier: 3, wrExpected: 0.54 }, 'stays-fourth': { name: 'Still fourth', tier: 4 }, top: { name: 'Top', tier: 1 } },
  }])) as unknown as Snapshot['ladders'],
})

describe('report comparisons', () => {
  it('includes a T4 promotion and omits current T4 builds, including demotions', () => {
    const rows = tierChanges(ladder(), previous())!
    expect(rows).toHaveLength(1)
    expect(rows[0]).toContain('Promoted')
    expect(rows[0]).toContain('Tier 4')
    expect(rows[0]).toContain('Tier 3')
  })

  it.each(['season', 'band', 'floor', 'rules'] as const)('omits comparisons with incompatible %s', (field) => {
    const snapshot = previous()
    Object.assign(snapshot.ladders.TCG, { [field]: field === 'rules' ? { ...rules, t3Gap: 0.1 } : 'different' })
    expect(tierChanges(ladder(), snapshot)).toBeNull()
  })

  it('does not treat a legacy snapshot or missing snapshot as no tier changes', () => {
    expect(tierChanges(ladder(), null)).toBeNull()
    expect(tierChanges(ladder(), { ...previous(), rebuilt: undefined })).toBeNull()
  })

  it('explains the distinct baselines and remains valid without movers', () => {
    const doc = buildReport(ladder(), ladder('Genesys'), '2026-11-06', previous())
    expect(validateDoc(doc)).toEqual([])
    const moves = doc.blocks.find((b) => b.id === 'moves')
    expect(moves && 'md' in moves && moves.md).toContain('do not compare the two report publication dates')
  })
})

describe('methodology article', () => {
  it('meets the wiki contract and explains the current relative tier rules', () => {
    const doc = statisticsMethodology()
    expect(validateDoc(doc)).toEqual([])
    const tiers = doc.blocks.find((b) => b.id === 'tiers')
    expect(tiers && 'md' in tiers && tiers.md).toContain('Tier 1 holds two decks at most')
    expect(doc.seo?.description!.length).toBeLessThanOrEqual(160)
  })
})
