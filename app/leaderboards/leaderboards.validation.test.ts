import { describe, expect, it } from 'vitest'
import { parseLeaderboardsResponse } from './leaderboards.validation'
import { createPlayerStats } from '../../test/fixtures/player.fixture'

describe('leaderboards.validation', () => {
  it('parses a valid leaderboards response', () => {
    const player = createPlayerStats()

    const result = parseLeaderboardsResponse({
      success: true,
      data: {
        TCG: [player],
        Genesys: [player],
      },
    })

    expect(result).toEqual({
      TCG: [player],
      Genesys: [player],
    })
  })

  it('accepts OCG as a Genesys alias', () => {
    const player = createPlayerStats()

    const result = parseLeaderboardsResponse({
      success: true,
      data: {
        TCG: [player],
        OCG: [player],
      },
    })

    expect(result?.Genesys).toEqual([player])
  })

  it('returns null when success is false', () => {
    expect(parseLeaderboardsResponse({ success: false })).toBeNull()
  })

  it('returns null when leaderboard lists are missing', () => {
    const result = parseLeaderboardsResponse({
      success: true,
      data: {
        TCG: null,
        Genesys: null,
      },
    })

    expect(result).toBeNull()
  })
})
