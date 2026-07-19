import { describe, expect, it } from 'vitest'
import { createSavedDeck } from '../../../test/fixtures/deck.fixture'
import { render, screen } from '../../../test/test-utils'
import ProfileSavedDeckCard from './profile-saved-deck-card.component'

describe('ProfileSavedDeckCard', () => {
  it('renders deck name and archetypes', () => {
    render(<ProfileSavedDeckCard deck={createSavedDeck()} />)

    expect(screen.getByText('Blue-Eyes Control')).toBeInTheDocument()
    expect(screen.getAllByRole('link', { name: 'Blue-Eyes Control' })[0]).toHaveAttribute(
      'href',
      '/decks/42',
    )
    expect(screen.getByText('Blue-Eyes · Dragon')).toBeInTheDocument()
  })

  it('shows a private badge for private decks', () => {
    render(
      <ProfileSavedDeckCard
        deck={createSavedDeck({ private: true })}
      />,
    )

    expect(screen.getByText('Private')).toBeInTheDocument()
  })

  it('hides the private badge for public decks', () => {
    render(
      <ProfileSavedDeckCard
        deck={createSavedDeck({ private: false })}
      />,
    )

    expect(screen.queryByText('Private')).not.toBeInTheDocument()
  })
})
