import { describe, expect, it, vi } from 'vitest'
import { settingsBody } from './Settings'

vi.mock('@utils/format', () => ({ timeLabel: () => '' }))

describe('settingsBody', () => {
  it('sends only the fields edited, percents back as rates', () => {
    expect(settingsBody({ t1: '56', stapleShare: '12.5' })).toEqual({ 'analytics.tiers': { t1: 0.56 }, 'analytics.classification': { stapleShare: 0.125 } })
  })

  it('sends the tier floors with the anchors: the share as a rate, the duelists as a count', () => {
    expect(settingsBody({ minShare: '0.5', minPlayers: '12' })).toEqual({ 'analytics.tiers': { minShare: 0.005, minPlayers: 12 } })
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
})
