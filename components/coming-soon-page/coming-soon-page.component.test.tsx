import { describe, expect, it } from 'vitest'
import { render, screen } from '../../test/test-utils'
import ComingSoonPage from './coming-soon-page.component'

describe('ComingSoonPage', () => {
  it('renders the title and description', () => {
    render(
      <ComingSoonPage
        title="Deck Editor"
        description="Build and customize your decks."
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Deck Editor' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Build and customize your decks.'),
    ).toBeInTheDocument()
  })
})
