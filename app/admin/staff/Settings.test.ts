import { describe, expect, it, vi } from 'vitest'
import { settingsBody } from './Settings'

vi.mock('@utils/format', () => ({ timeLabel: () => '' }))

describe('settingsBody', () => {
  it('sends only the fields edited, percents back as rates', () => {
    expect(settingsBody({ t1: '56', stapleShare: '12.5' })).toEqual({ 'analytics.tiers': { t1: 0.56 }, 'analytics.classification': { stapleShare: 0.125 } })
  })

  it('keeps maxNames an integer, not a rate', () => {
    expect(settingsBody({ maxNames: '4' })).toEqual({ 'analytics.classification': { maxNames: 4 } })
  })

  it('sends a filter set to 0 as the only change', () => {
    expect(settingsBody({ minListGames: '0' })).toEqual({ 'analytics.filters': { minListGames: 0 } })
  })

  it('sends the aggregate floor as the tier name', () => {
    expect(settingsBody({ aggregateFloor: 'Master', eloCap: '2500' })).toEqual({ 'analytics.filters': { eloCap: 2500, aggregateFloor: 'Master' } })
  })

  it('sends nothing for an untouched form', () => {
    expect(settingsBody({})).toEqual({})
  })
})
