import { describe, expect, it } from 'vitest'
import {
  formatLeaderboardRating,
  formatLeaderboardRecord,
  formatLeaderboardWinRate,
  getLeaderboardRankIcon,
  getLeaderboardRankModifier,
  getLeaderboardTierInfo,
  getLeaderboardWinRateClass,
  getPlayerDisplayName,
  sliceTopPlayers,
} from './leaderboards.utils'
import { createPlayerStats } from '../../test/fixtures/player.fixture'

describe('leaderboards.utils', () => {
  describe('getLeaderboardTierInfo', () => {
    it('returns mode-specific badge paths', () => {
      const tcg = getLeaderboardTierInfo(2100, 'TCG')
      const genesys = getLeaderboardTierInfo(2100, 'Genesys')

      expect(tcg.image).toContain('/badges/TCG/')
      expect(genesys.image).toContain('/badges/OCG/')
    })
  })

  describe('getPlayerDisplayName', () => {
    it('prefers displayname when present', () => {
      expect(
        getPlayerDisplayName(
          createPlayerStats({ displayname: '  Champion  ', username: 'champ' }),
        ),
      ).toBe('Champion')
    })

    it('falls back to username when displayname is empty', () => {
      expect(
        getPlayerDisplayName(
          createPlayerStats({ displayname: '   ', username: 'champ' }),
        ),
      ).toBe('champ')
    })
  })

  describe('formatLeaderboardRecord', () => {
    it('includes draws when present', () => {
      expect(formatLeaderboardRecord(10, 5, 2)).toBe('10W · 5L · 2D')
    })

    it('omits draws when zero', () => {
      expect(formatLeaderboardRecord(10, 5, 0)).toBe('10W · 5L')
    })
  })

  describe('formatLeaderboardRating', () => {
    it('rounds the rating before formatting', () => {
      expect(formatLeaderboardRating(1234.6)).toMatch(/235$/)
      expect(formatLeaderboardRating(999)).toBe('999')
    })
  })

  describe('formatLeaderboardWinRate', () => {
    it('formats win rate with one decimal', () => {
      expect(formatLeaderboardWinRate(7, 3, 0)).toBe('70.0%')
    })
  })

  describe('getLeaderboardWinRateClass', () => {
    it('returns excellent for high win rates', () => {
      expect(getLeaderboardWinRateClass(8, 2, 0)).toBe(
        'leaderboards__win-rate--excellent',
      )
    })
  })

  describe('getLeaderboardRankModifier', () => {
    it('returns champion modifier for rank 1', () => {
      expect(getLeaderboardRankModifier(1)).toBe('leaderboards__row--champion')
    })

    it('returns podium modifier for ranks 2-4', () => {
      expect(getLeaderboardRankModifier(3)).toBe('leaderboards__row--podium')
    })
  })

  describe('getLeaderboardRankIcon', () => {
    it('returns crown for first place', () => {
      expect(getLeaderboardRankIcon(1)).toBe('mdi:crown')
    })

    it('returns null for lower ranks', () => {
      expect(getLeaderboardRankIcon(10)).toBeNull()
    })
  })

  describe('sliceTopPlayers', () => {
    it('limits players to top count', () => {
      const players = Array.from({ length: 60 }, (_, index) =>
        createPlayerStats({ id: `player-${index}` }),
      )

      expect(sliceTopPlayers(players)).toHaveLength(50)
    })
  })
})
