import { describe, expect, it, vi } from 'vitest'
import { settingsBody } from './Settings'

vi.mock('@utils/format', () => ({ timeLabel: () => '' }))

describe('settingsBody', () => {
  it('sends only the fields edited, percents back as rates', () => {
    expect(settingsBody({ t1Gap: '0.5', stapleShare: '12.5' })).toEqual({ 'analytics.tiers': { t1Gap: 0.005 }, 'analytics.classification': { stapleShare: 0.125 } })
  })

  it('sends the tier floors under their format: the share as a rate, the duelists as a count', () => {
    expect(settingsBody({ 'Genesys.tierShare': '1', 'TCG.tierPlayers': '12' })).toEqual({
      'analytics.filters': { TCG: { tierPlayers: 12 }, Genesys: { tierShare: 0.01 } },
    })
  })

  it('keeps maxNames an integer, not a rate', () => {
    expect(settingsBody({ maxNames: '4' })).toEqual({ 'analytics.classification': { maxNames: 4 } })
  })

  it('sends a filter set to 0 as the only change, under its format', () => {
    expect(settingsBody({ 'Genesys.minListGames': '0' })).toEqual({ 'analytics.filters': { Genesys: { minListGames: 0 } } })
  })

  it('sends the aggregate floor as the tier name and keeps the formats apart', () => {
    expect(settingsBody({ 'TCG.aggregateFloor': 'Master', 'TCG.eloCap': '2500', 'Genesys.minPlayerGames': '5' })).toEqual({
      'analytics.filters': { TCG: { eloCap: 2500, aggregateFloor: 'Master' }, Genesys: { minPlayerGames: 5 } },
    })
  })

  it('sends nothing for an untouched form', () => {
    expect(settingsBody({})).toEqual({})
  })

  it('keeps what is stored under a key it sends: the PATCH replaces the whole value', () => {
    const stored = {
      'analytics.tiers': { t1Gap: 0.005, t3Gap: 0.03 },
      'analytics.filters': { TCG: { aggregateFloor: 'Gold' as const, eloCap: 2800 }, Genesys: { aggregateFloor: 'Silver' as const } },
    }
    expect(settingsBody({ 'TCG.aggregateFloor': 'Platinum' }, stored)).toEqual({
      'analytics.filters': { TCG: { aggregateFloor: 'Platinum', eloCap: 2800 }, Genesys: { aggregateFloor: 'Silver' } },
    })
    expect(settingsBody({ t2Gap: '1.5' }, stored)).toEqual({ 'analytics.tiers': { t1Gap: 0.005, t3Gap: 0.03, t2Gap: 0.015 } })
  })

  it('drops the old absolute marks still stored: the server refuses them', () => {
    const stored = { 'analytics.tiers': { t1: 0.56, t15: 0.54, t1Gap: 0.005 } } as never
    expect(settingsBody({ t2Gap: '1' }, stored)).toEqual({ 'analytics.tiers': { t1Gap: 0.005, t2Gap: 0.01 } })
  })
})
