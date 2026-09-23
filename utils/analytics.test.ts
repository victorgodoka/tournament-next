import { describe, expect, it } from 'vitest'
import { groupGame } from '@omega/analytics/match-timeline'
import { analyticsMatchId, pct, type TimelineEvent } from '@utils/analytics'

const event = (seq: number, turn: number, phaseCode: number, turnPlayer: TimelineEvent['turnPlayer'] = 'player1'): TimelineEvent => ({
  seq,
  turn,
  turnPlayer,
  phase: null,
  phaseCode,
  kind: 'card_activated',
  kindCode: 3,
  card: { id: seq, canonicalId: seq, name: null, token: false },
  controller: turnPlayer,
  owner: turnPlayer,
  ownership: 'deck',
  chain: null,
})

describe('groupGame', () => {
  it('splits by turn, then by runs of the same phase, keeping log order', () => {
    const turns = groupGame([event(0, 1, 1), event(1, 1, 4), event(2, 1, 4), event(3, 1, 1), event(4, 2, 4, 'player2')])

    expect(turns.map((turn) => [turn.turn, turn.turnPlayer])).toEqual([[1, 'player1'], [2, 'player2']])
    // A phase that comes back later in the turn is a new run, not merged into the first one.
    expect(turns[0]?.phases.map((run) => run.events.map((e) => e.seq))).toEqual([[0], [1, 2], [3]])
    expect(turns[1]?.phases).toHaveLength(1)
  })

  it('returns nothing for an empty log', () => {
    expect(groupGame([])).toEqual([])
  })
})

describe('analytics helpers', () => {
  it('strips the ranked prefix from profile match ids', () => {
    expect(analyticsMatchId('ranked:3284243')).toBe('3284243')
    expect(analyticsMatchId('3284243')).toBe('3284243')
  })

  it('shows a dash for a rate without a denominator, never 0%', () => {
    expect(pct(null)).toBe('—')
    expect(pct(0)).toBe('0%')
    expect(pct(0.5263)).toBe('53%')
  })
})
