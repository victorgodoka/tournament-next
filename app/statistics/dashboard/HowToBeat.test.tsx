// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import messages from '../../../messages/en.json'
import type { DeckStat, Meta } from '@utils/statistics'
import { HowToBeat } from './HowToBeat'

vi.mock('@omega/card-art', () => ({ CardArt: () => null }))

const deck = (key: string, name: string, share: number) => ({ key, name, share, games: 500, wrExpected: 0.52, tier: 3 }) as DeckStat
const meta = { decks: [deck('1', 'Snake-Eye', 0.2), deck('2', 'Labrynth', 0.1)], weeks: [], fit: { firstEffect: 0.1 } } as unknown as Meta
const cell = (opponent: string, opponentName: string | null, games: number) => ({ key: '1', opponent, opponentName, games, wrExpected: 0.5, wrAdjusted: 0.55, wrLo: 0.52, wrHi: 0.58, firstWr: null, secondWr: null })
const answer = {
  deck: { ...meta.decks[0], firstG1Wr: 0.6, secondG1Wr: 0.45, g1Games: 300 },
  matchups: [cell('2', 'Labrynth', 400), cell('3', 'Tenpai', 40)],
  cards: [],
  weeks: [],
  byBand: [],
  against: [{ id: 14558127, name: 'Ash Blossom', games: 100, rate: 0.5, winRate: 0.45, winRateWithout: 0.52 }],
  sampleDeck: null,
}
const respond = (decks: unknown, status = 200) =>
  vi.fn(async (url: string) => (url.includes('/cards') ? new Response(JSON.stringify({ cards: [] })) : new Response(JSON.stringify(decks), { status })))

const show = () =>
  render(
    <NextIntlClientProvider locale="en" messages={messages} timeZone="UTC">
      <HowToBeat meta={meta} scope={{ ladder: 'tcg', window: 'season', band: 'all' }} />
    </NextIntlClientProvider>,
  )

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('HowToBeat', () => {
  it('opens on the most played deck and hides matchups under 100 games until asked', async () => {
    const fetchMock = respond(answer)
    vi.stubGlobal('fetch', fetchMock)
    show()
    await waitFor(() => screen.getAllByRole('link', { name: 'Labrynth' }))
    expect(String((fetchMock.mock.calls as unknown[][])[0]![0])).toContain('/statistics/decks/1?')
    expect(screen.queryAllByRole('link', { name: 'Tenpai' })).toHaveLength(0)
    fireEvent.click(screen.getAllByRole('button', { name: 'Show 1 matchups under 100 games' })[0]!)
    expect(screen.getAllByRole('link', { name: 'Tenpai' }).length).toBeGreaterThan(0)
  })

  it('says how much less the deck wins when a card shows up, and what going first is worth', async () => {
    vi.stubGlobal('fetch', respond(answer))
    show()
    await waitFor(() => screen.getAllByText('−7.0 pts'))
    expect(screen.getAllByText(/Going first gives Snake-Eye/)[0]!.textContent).toContain('+15.0 pts')
  })

  it('reads the picked deck, and says so when it can not be read', async () => {
    vi.stubGlobal('fetch', respond({}, 500))
    show()
    fireEvent.change(screen.getAllByRole('combobox')[0]!, { target: { value: '2' } })
    await waitFor(() => screen.getByText(messages.Statistics.beat.failed))
  })
})
