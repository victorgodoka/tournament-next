import { describe, expect, it } from 'vitest'
import {
  createDuel,
  createRound,
  createTournamentDetail,
  createTournamentUser,
} from '../../test/test-utils'
import { calculateTiebreakers, detectDropouts } from './tournament.utils'

// A: plays both rounds. B: plays round 1, byes round 2. C: plays both rounds.
// D: plays round 1 then drops. E: registered but never paired.
const createDropScenario = () =>
  createTournamentDetail({
    users: [
      createTournamentUser({ user_id: 'A', username: 'a' }),
      createTournamentUser({ user_id: 'B', username: 'b' }),
      createTournamentUser({ user_id: 'C', username: 'c' }),
      createTournamentUser({
        user_id: 'D',
        username: 'd',
        stats: { wins: 1, loses: 1, draws: 0, rating: 1000 },
      }),
      createTournamentUser({ user_id: 'E', username: 'e' }),
    ],
    rounds: [
      createRound({
        id: 1,
        phase: 1,
        duels: [
          createDuel({ duelist1: 'A', duelist2: 'B', result: 0 }),
          createDuel({ duelist1: 'C', duelist2: 'D', result: 0 }),
        ],
      }),
      createRound({
        id: 2,
        phase: 2,
        bye: 'B',
        duels: [createDuel({ duelist1: 'A', duelist2: 'C', result: 0 })],
      }),
    ],
  })

describe('detectDropouts', () => {
  it('counts rounds missed per player, treating a bye as an appearance', () => {
    const missed = detectDropouts(createDropScenario())

    expect(missed.get('A')).toBe(0)
    expect(missed.get('B')).toBe(0) // bye still counts as present
    expect(missed.get('C')).toBe(0)
    expect(missed.get('D')).toBe(1) // dropped after round 1
    expect(missed.get('E')).toBe(2) // never paired
  })

  it('flags nobody when there are no rounds yet', () => {
    const detail = createTournamentDetail({
      users: [createTournamentUser({ user_id: 'A' })],
      rounds: [],
    })

    expect(detectDropouts(detail).get('A')).toBe(0)
  })
})

describe('calculateTiebreakers drop handling', () => {
  it('adds missed rounds to a dropped player as losses and flags them', () => {
    const standings = calculateTiebreakers(createDropScenario())
    const byId = new Map(standings.map((player) => [player.id, player]))

    const dropped = byId.get('D')!
    expect(dropped.dropped).toBe(true)
    expect(dropped.droppedRounds).toBe(1)
    expect(dropped.losses).toBe(2) // original 1 + 1 missed round
    // Win rate reflects the added loss: 1 / (1 + 2 + 0) = 33.33%
    expect(dropped.winPercentage).toBe('33.33')

    const active = byId.get('A')!
    expect(active.dropped).toBe(false)
    expect(active.droppedRounds).toBe(0)
  })

  it('does not flag a player who only received a bye', () => {
    const standings = calculateTiebreakers(createDropScenario())
    const bye = standings.find((player) => player.id === 'B')!

    expect(bye.dropped).toBe(false)
    expect(bye.droppedRounds).toBe(0)
  })
})
