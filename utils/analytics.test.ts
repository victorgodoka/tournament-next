import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { GameStatsView } from '@omega/analytics/game-stats'
import { groupGame } from '@omega/analytics/match-timeline'
import { analyticsMatchId, pct, type GameStats, type MatchStats, type TimelineEvent } from '@utils/analytics'

vi.mock('@omega/card-art', () => ({ CardArt: () => null }))

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

describe('GameStatsView staples', () => {
  const side = { archetype: null, actions: 0, comboLength: null, cards: [], mostUsed: [], deckCoverage: { main: { used: 0, total: 0, rate: null }, extra: { used: 0, total: 0, rate: null } }, sideCardsUsed: [] }
  const players = { player1: { id: '1', displayName: 'Ann', username: null, avatar: null, archetype: null, deckName: null }, player2: { id: '2', displayName: 'Bob', username: null, avatar: null, archetype: null, deckName: null } } as MatchStats['players']
  const render = (staples: GameStats['staples']) =>
    renderToStaticMarkup(
      createElement(GameStatsView, { game: { gameNumber: 1, firstPlayer: 'player1', winner: 'player1', endReasonCode: null, turns: 1, totalActions: 1, longestChain: 1, turn1SpecialSummons: 0, perTurn: [], staples, players: { player1: side, player2: side } }, players }),
    )
  const section = (html: string) => html.slice(html.indexOf('Staples'))

  it('renders a staple with no attributed player without a side stripe', () => {
    const html = section(render([{ seq: 1, turn: 2, player: null, cardId: 14558127, name: 'Ash Blossom', link: 1, chainedTo: null }]))
    expect(html).toContain('Ash Blossom')
    expect(html).toContain('unknown')
    expect(html).toContain('started the chain')
    expect(html).not.toContain('inset_2px_0_0')
  })

  it('says so when no staple was activated', () => {
    expect(section(render([]))).toContain('No enabled staple was activated this game.')
  })
})
