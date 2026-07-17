import { describe, expect, it } from 'vitest'
import { createConvertedDeck } from '../../test/fixtures/deck.fixture'
import { fireEvent, render, screen, userEvent, within } from '../../test/test-utils'
import DeckListComponent from './deck-list.component'

const renderDeck = () => render(<DeckListComponent {...createConvertedDeck()} />)

describe('DeckListComponent', () => {
  it('splits cards into Main, Extra and Side sections', () => {
    renderDeck()

    expect(screen.getByRole('region', { name: 'Main Deck' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Extra Deck' })).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Side Deck' })).toBeInTheDocument()
  })

  it('shows card images in gallery mode by default', () => {
    renderDeck()

    const main = within(screen.getByRole('region', { name: 'Main Deck' }))
    // One image per unique card, not one per copy.
    expect(
      main.getByRole('img', { name: 'Ash Blossom & Joyous Spring' }),
    ).toHaveAttribute(
      'src',
      'https://ygopro.online/assets/card-images/common//14558127.jpg',
    )
    // Ash appears three times in the main deck -> collapsed with a count badge.
    expect(main.getByText('×3')).toBeInTheDocument()
  })

  it('puts extra-deck monsters in the Extra section only', () => {
    renderDeck()

    const extra = within(screen.getByRole('region', { name: 'Extra Deck' }))
    const main = within(screen.getByRole('region', { name: 'Main Deck' }))

    expect(extra.getByRole('img', { name: 'Accesscode Talker' })).toBeInTheDocument()
    expect(main.queryByRole('img', { name: 'Accesscode Talker' })).toBeNull()
  })

  it('groups duplicates as "count + name" in text mode', async () => {
    const user = userEvent.setup()
    renderDeck()

    await user.click(screen.getByRole('radio', { name: 'Text' }))

    const main = within(screen.getByRole('region', { name: 'Main Deck' }))
    // A single grouped row, not three separate lines.
    const ashRows = main.getAllByText('Ash Blossom & Joyous Spring')
    expect(ashRows).toHaveLength(1)
    const ashRow = within(ashRows[0].closest('li') as HTMLElement)
    expect(ashRow.getByText('3')).toBeInTheDocument()

    const side = within(screen.getByRole('region', { name: 'Side Deck' }))
    const sideRow = within(side.getByRole('listitem'))
    expect(sideRow.getByText('Ash Blossom & Joyous Spring')).toBeInTheDocument()
    expect(sideRow.getByText('1')).toBeInTheDocument()
  })

  it('falls back to a placeholder when a card image fails to load', () => {
    renderDeck()

    const main = within(screen.getByRole('region', { name: 'Main Deck' }))
    const image = main.getByRole('img', {
      name: 'Ash Blossom & Joyous Spring',
    }) as HTMLImageElement
    fireEvent.error(image)

    expect(image.src).toContain('data:image/svg+xml')
  })
})
