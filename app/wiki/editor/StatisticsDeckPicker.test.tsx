// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { StatisticsDeck } from '@omega/wiki/statistics-deck'
import { StatisticsDeckPicker } from './StatisticsDeckPicker'
import { InfoboxFields } from './HeaderPanel'

vi.mock('@omega/card-art', () => ({ CardImage: ({ alt }: { alt: string }) => <span role="img" aria-label={alt} /> }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('Statistics Deck', () => {
  it('changes only the infobox image source, preserving caption and facts', () => {
    const onChange = vi.fn()
    const infobox = { asset: 'old', caption: 'The leading build', facts: [{ label: 'Games', value: '200' }] }
    render(<InfoboxFields infobox={infobox} assets={[]} onChange={onChange} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Statistics Deck' }))
    expect(onChange).toHaveBeenCalledWith({ caption: infobox.caption, facts: infobox.facts, asset: undefined, statisticsDeck: { key: '', name: '', ladder: 'tcg', faces: [] } })
  })
  it('searches archetypes and saves the chosen hybrid with all component covers', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ decks: [
      { key: '115', name: 'Sky Striker', face: 1 },
      { key: '482', name: 'Angelechy', face: 2 },
      { key: '115>482', name: 'Sky Striker / Angelechy', face: 1 },
    ] }) })))
    const onChange = vi.fn()
    render(<StatisticsDeckPicker onChange={onChange} />)
    const search = await screen.findByRole('searchbox', { name: 'Search statistics decks' })
    fireEvent.change(search, { target: { value: 'Striker /' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Sky Striker / Angelechy Deck build' }))
    expect(onChange).toHaveBeenCalledWith({ key: '115>482', name: 'Sky Striker / Angelechy', ladder: 'tcg', faces: [1, 2] })
    fireEvent.change(screen.getByLabelText('Statistics ladder'), { target: { value: 'genesys' } })
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining('ladder=genesys'), expect.anything()))
    expect(onChange).toHaveBeenLastCalledWith(undefined)
  })

  it('links the deck name and covers to statistics in a new tab and keeps the caption', () => {
    render(<StatisticsDeck deck={{ key: '115>482', name: 'Sky Striker / Angelechy', ladder: 'genesys', faces: [1, 2] }} caption="Two covers, one build." />)
    const link = screen.getByRole('link', { name: /Sky Striker \/ Angelechy/ })
    expect(link.getAttribute('href')).toBe('/statistics/archetypes/115%3E482?ladder=genesys')
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    expect(link.textContent).toContain('Genesys · Statistics')
    expect(screen.getAllByRole('img')).toHaveLength(2)
    expect(screen.getByText('Two covers, one build.')).toBeTruthy()
  })
})
