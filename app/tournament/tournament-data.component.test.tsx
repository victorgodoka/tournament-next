import { describe, expect, it } from 'vitest'
import { createTopcutData, render, screen, within } from '../../test/test-utils'
import TournamentData from './tournament-data.component'

describe('TournamentData', () => {
  it('summarises the field in the stat tiles', () => {
    render(<TournamentData data={createTopcutData()} />)

    const tile = (label: string) =>
      screen
        .getByText(label, { selector: '.tournament-data__stat-label' })
        .closest('.tournament-data__stat') as HTMLElement

    expect(within(tile('Players')).getByText('8')).toBeInTheDocument()
    expect(within(tile('Unique decks')).getByText('2')).toBeInTheDocument()
    // uniqueDecks / players = 2 / 8 = 25%
    expect(within(tile('Field diversity')).getByText('25%')).toBeInTheDocument()
  })

  it('draws a distribution donut with a labelled legend', () => {
    const { container } = render(<TournamentData data={createTopcutData()} />)

    expect(container.querySelector('.tournament-data__donut')).toBeInTheDocument()

    const legend = container.querySelector('.tournament-data__legend') as HTMLElement
    const names = [...legend.querySelectorAll('.tournament-data__legend-name')].map(
      (node) => node.textContent,
    )
    expect(names).toEqual(['Fiendsmith Phantasm', 'Ryzeal'])
  })

  it('ranks decks in the table and sizes the share bars against the leader', () => {
    const { container } = render(<TournamentData data={createTopcutData()} />)

    const titles = [...container.querySelectorAll('.tournament-data__deck-title')].map(
      (node) => node.textContent,
    )
    expect(titles).toEqual(['Fiendsmith Phantasm', 'Ryzeal'])

    const fills = [
      ...container.querySelectorAll<HTMLElement>('.tournament-data__share-bar > span'),
    ]
    expect(fills[0].style.width).toBe('100%') // leader
    expect(fills[1].style.width).toBe('60%') // 3 of 5
  })

  it('shows each archetype engine with a card-art thumbnail', () => {
    const { container } = render(<TournamentData data={createTopcutData()} />)

    expect(screen.getByText('Sacred Beast')).toBeInTheDocument()
    expect(screen.getByText('Fiendsmith')).toBeInTheDocument()

    // Deck art uses the first card id of the first archetype with ids.
    const deckArt = container.querySelector('.tournament-data__deck-art') as HTMLImageElement
    expect(deckArt.getAttribute('src')).toContain('/1.jpg')

    // Archetype tags carry their own art thumbnail.
    expect(container.querySelectorAll('.tournament-data__tag-art').length).toBeGreaterThan(0)
  })

  it('shows an empty state when there is no metagame data', () => {
    const { rerender } = render(<TournamentData data={undefined} />)
    expect(screen.getByText(/no metagame data/i)).toBeInTheDocument()

    rerender(<TournamentData data={createTopcutData({ decks: [] })} />)
    expect(screen.getByText(/no metagame data/i)).toBeInTheDocument()
  })
})
