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

  it('sends nothing for an untouched form', () => {
    expect(settingsBody({})).toEqual({})
  })
})
