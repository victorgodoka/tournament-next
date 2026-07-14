import { describe, expect, it } from 'vitest'
import {
  formatTournamentDate,
  formatTournamentRounds,
  getTournamentStatusLabel,
  getTournamentStatusModifier,
  isTournamentCompleted,
} from './history.utils'

describe('history.utils', () => {
  describe('isTournamentCompleted', () => {
    it('is true when endtime is set', () => {
      expect(isTournamentCompleted({ endtime: '2026-07-14T21:00:00Z' })).toBe(true)
    })

    it('is false when endtime is null', () => {
      expect(isTournamentCompleted({ endtime: null })).toBe(false)
    })
  })

  describe('getTournamentStatusLabel', () => {
    it('returns Completed when endtime is set', () => {
      expect(getTournamentStatusLabel({ endtime: '2026-07-14T21:00:00Z' })).toBe(
        'Completed',
      )
    })

    it('returns Live when endtime is null', () => {
      expect(getTournamentStatusLabel({ endtime: null })).toBe('Live')
    })
  })

  describe('getTournamentStatusModifier', () => {
    it('returns the completed modifier class', () => {
      expect(
        getTournamentStatusModifier({ endtime: '2026-07-14T21:00:00Z' }),
      ).toBe('history-card__status--completed')
    })

    it('returns the live modifier class', () => {
      expect(getTournamentStatusModifier({ endtime: null })).toBe(
        'history-card__status--live',
      )
    })
  })

  describe('formatTournamentRounds', () => {
    it('pluralizes multiple rounds', () => {
      expect(formatTournamentRounds(4)).toBe('4 Rounds')
    })

    it('keeps singular for a single round', () => {
      expect(formatTournamentRounds(1)).toBe('1 Round')
    })
  })

  describe('formatTournamentDate', () => {
    it('formats a valid date string', () => {
      expect(formatTournamentDate('2026-07-14T18:00:00Z')).toEqual(
        expect.any(String),
      )
      expect(formatTournamentDate('2026-07-14T18:00:00Z')).not.toBe('Unknown date')
    })

    it('falls back for an invalid date string', () => {
      expect(formatTournamentDate('not-a-date')).toBe('Unknown date')
    })
  })
})
