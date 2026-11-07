import { describe, expect, it } from 'vitest'
import { families, type BuildFilters, type DeckStat, type Meta } from '@utils/statistics'
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
const tcgFilters: BuildFilters = { minPlayerGames: 5, minListGames: 0, minKeyGames: 30, eloCap: 3000, aggregateFloor: 'Gold' }
const genesysFilters: BuildFilters = { minPlayerGames: 3, minListGames: 0, minKeyGames: 15, eloCap: 3000, aggregateFloor: 'Silver' }
/** The panel in the November 7 screenshot. */
const withFilters = (base: Ladder, filters: BuildFilters, floors?: Partial<TierRules>): Ladder => ({
  ...base,
  rules: { ...base.rules, ...floors },
  meta: { ...base.meta, fit: { ...base.meta.fit, filters, aggregateFloor: filters.aggregateFloor, builtAt: '2026-11-07T15:50:00Z' }, classification: { maxNames: 2, stapleShare: 0.1, stapleForeign: 0.5 } },
})
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
    expect(moves && 'md' in moves && moves.md).toContain("don't line up with report dates")
  })

  it('omits comparisons when the sample filters changed, and passes a snapshot from before filters were saved', () => {
    const now = withFilters(ladder(), tcgFilters)
    const snapshot = previous()
    expect(tierChanges(now, snapshot)).not.toBeNull()
    Object.assign(snapshot.ladders.TCG, { filters: { ...tcgFilters, minPlayerGames: 10 } })
    expect(tierChanges(now, snapshot)).toBeNull()
  })
})

describe('methodology article', () => {
  it('meets the wiki contract and explains the current relative tier rules', () => {
    const doc = statisticsMethodology('2026-11-06', [withFilters(ladder(), tcgFilters), withFilters(ladder('Genesys'), genesysFilters, { minShare: 0.005, minPlayers: 1 })])
    expect(validateDoc(doc)).toEqual([])
    const md = (id: string) => {
      const block = doc.blocks.find((b) => b.id === id)
      return block && 'md' in block ? block.md : ''
    }
    expect(md('tiers')).toContain('Tier 1 holds two decks at most')
    expect(doc.seo?.description!.length).toBeLessThanOrEqual(160)
    // Every panel value reaches the settings table.
    for (const cell of ['Gold+', 'Silver+', '3,000', '| 5 |', '| 3 |', 'Off (0)', '| 30 |', '| 15 |', '1%', '0.5%', '| 25 |', 'None', '0.5 pts', '3 pts', '4.5 pts', '2 archetype names', 'at least 10%', '50% or more'])
      expect(md('settings')).toContain(cell)
    expect(md('sample')).toContain('so it removes nothing')
    expect(md('tiers')).toContain('Genesys asks for 0.5% of the meta and no player minimum')
  })

  it('refuses a build without its filters', () => {
    expect(() => statisticsMethodology('2026-11-06', [ladder(), ladder('Genesys')])).toThrow(/no filters/)
  })
})
