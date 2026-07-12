import { describe, expect, it } from 'vitest'
import { createMatchHistory } from '../../../test/fixtures/deck.fixture'
import { formatMatchDuration } from '../profile.utils'
import { render, screen } from '../../../test/test-utils'
import MatchHistoryCard from './match-history-card.component'

describe('MatchHistoryCard', () => {
  const getCardName = (id: number) => `Card ${id}`

  it('renders victory details for a winning match', () => {
    render(
      <MatchHistoryCard
        match={createMatchHistory()}
        formatMatchDuration={formatMatchDuration}
        getCardName={getCardName}
      />,
    )

    expect(screen.getByText('Victory')).toBeInTheDocument()
    expect(screen.getByText('Test Duelist')).toBeInTheDocument()
    expect(screen.getByText('Opponent Player')).toBeInTheDocument()
    expect(screen.getByText('25m')).toBeInTheDocument()
    expect(screen.getByText('Blue-Eyes')).toBeInTheDocument()
    expect(screen.getByText('Dark Magician')).toBeInTheDocument()
  })

  it('renders defeat details for a losing match', () => {
    render(
      <MatchHistoryCard
        match={createMatchHistory({ isWinner: false, isDraw: false })}
        formatMatchDuration={formatMatchDuration}
        getCardName={getCardName}
      />,
    )

    expect(screen.getByText('Defeat')).toBeInTheDocument()
  })

  it('renders draw details for a drawn match', () => {
    render(
      <MatchHistoryCard
        match={createMatchHistory({ isWinner: false, isDraw: true })}
        formatMatchDuration={formatMatchDuration}
        getCardName={getCardName}
      />,
    )

    expect(screen.getByText('Draw')).toBeInTheDocument()
  })

  it('links to the opponent profile', () => {
    render(
      <MatchHistoryCard
        match={createMatchHistory()}
        formatMatchDuration={formatMatchDuration}
        getCardName={getCardName}
      />,
    )

    expect(screen.getByRole('link', { name: 'Opponent Player' })).toHaveAttribute(
      'href',
      '/profile/user-2',
    )
  })
})
