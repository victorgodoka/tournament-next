import { describe, expect, it } from 'vitest'
import { createDuel, createRound, createTournamentUser } from '../../test/test-utils'
import {
  buildUserMap,
  formatTournamentDateTime,
  getDuelOutcome,
  getOverflowPlayerCount,
  getUserDisplayName,
  getVisiblePlayers,
  isTournamentFinished,
  parseTournamentSettings,
  sortRoundsDescending,
} from './tournament-page.utils'

describe('tournament-page.utils', () => {
  describe('buildUserMap', () => {
    it('indexes users by user_id', () => {
      const users = [
        createTournamentUser({ user_id: 'a' }),
        createTournamentUser({ user_id: 'b' }),
      ]

      const map = buildUserMap(users)

      expect(map.get('a')).toBe(users[0])
      expect(map.get('b')).toBe(users[1])
    })
  })

  describe('getUserDisplayName', () => {
    it('prefers displayname over username', () => {
      const user = createTournamentUser({ displayname: 'Duelist One', username: 'd1' })
      expect(getUserDisplayName(user)).toBe('Duelist One')
    })

    it('falls back to username when displayname is missing', () => {
      const user = createTournamentUser({ displayname: '', username: 'd1' })
      expect(getUserDisplayName(user)).toBe('d1')
    })

    it('falls back to a placeholder when the user is unknown', () => {
      expect(getUserDisplayName(undefined)).toBe('Unknown Duelist')
    })
  })

  describe('sortRoundsDescending', () => {
    it('orders rounds by phase, most recent first, without mutating the input', () => {
      const rounds = [createRound({ phase: 1 }), createRound({ phase: 3 }), createRound({ phase: 2 })]

      const sorted = sortRoundsDescending(rounds)

      expect(sorted.map((round) => round.phase)).toEqual([3, 2, 1])
      expect(rounds.map((round) => round.phase)).toEqual([1, 3, 2])
    })
  })

  describe('getVisiblePlayers / getOverflowPlayerCount', () => {
    const users = Array.from({ length: 10 }, (_, index) =>
      createTournamentUser({ user_id: `user-${index}` }),
    )

    it('caps visible players at the max', () => {
      expect(getVisiblePlayers(users, 7)).toHaveLength(7)
    })

    it('computes the remaining overflow count', () => {
      expect(getOverflowPlayerCount(users, 7)).toBe(3)
    })

    it('returns zero overflow when under the max', () => {
      expect(getOverflowPlayerCount(users.slice(0, 3), 7)).toBe(0)
    })
  })

  describe('isTournamentFinished', () => {
    it('is finished when endtime is a valid date', () => {
      expect(isTournamentFinished({ endtime: '2026-07-14T21:00:00Z' })).toBe(true)
    })

    it('is not finished when endtime is null or empty', () => {
      expect(isTournamentFinished({ endtime: null })).toBe(false)
      expect(isTournamentFinished({ endtime: '' })).toBe(false)
    })

    it('is not finished when endtime is not a valid date', () => {
      expect(isTournamentFinished({ endtime: 'not-a-date' })).toBe(false)
    })
  })

  describe('parseTournamentSettings', () => {
    it('decodes settings into mode, master rule, and region', () => {
      expect(parseTournamentSettings(53)).toMatchObject({
        mode: 'Match',
        mr: 5,
        region: 'TCG',
      })
    })

    it('returns null for non-finite settings', () => {
      expect(parseTournamentSettings(Number.NaN)).toBeNull()
      expect(parseTournamentSettings(Number.POSITIVE_INFINITY)).toBeNull()
    })
  })

  describe('formatTournamentDateTime', () => {
    it('formats a valid timestamp with date and time', () => {
      expect(formatTournamentDateTime('2026-07-14T18:00:00Z')).toContain('2026')
    })

    it('falls back to TBD for missing or invalid values', () => {
      expect(formatTournamentDateTime(null)).toBe('TBD')
      expect(formatTournamentDateTime('not-a-date')).toBe('TBD')
    })
  })

  describe('getDuelOutcome', () => {
    it('reports ongoing when there is no winner', () => {
      const duel = createDuel({ winner: null })
      expect(getDuelOutcome(duel)).toEqual({ status: 'ongoing' })
    })

    it('reports the winner and loser when the duel is decided', () => {
      const duel = createDuel({ duelist1: 'a', duelist2: 'b', winner: 'b' })
      expect(getDuelOutcome(duel)).toEqual({
        status: 'completed',
        winnerId: 'b',
        loserId: 'a',
      })
    })
  })
})
