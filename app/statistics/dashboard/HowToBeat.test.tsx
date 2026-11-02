// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NextIntlClientProvider } from 'next-intl'
import messages from '../../../messages/en.json'
import type { DeckStat, Meta } from '@utils/statistics'
import { HowToBeat } from './HowToBeat'

vi.mock('@omega/card-art', () => ({ CardArt: () => null }))

const deck = (key: string, name: string, share: number) => ({ key, name, share, games: 500 }) as DeckStat
const meta = { decks: [deck('1', 'Snake-Eye', 0.2), deck('2', 'Labrynth', 0.1)], weeks: [] } as unknown as Meta
const cell = (opponent: string, opponentName: string | null, games: number) => ({ key: '1', opponent, opponentName, games, wrExpected: 0.5, wrAdjusted: 0.55, wrLo: 0.52, wrHi: 0.58, firstWr: null, secondWr: null })
const answer = { deck: { ...meta.decks[0], firstG1Wr: 0.6, secondG1Wr: 0.45 }, matchups: [cell('2', 'Labrynth', 400), cell('3', 'Tenpai', 40)], cards: [], weeks: [], byBand: [], against: [], sampleDeck: null }

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
  it('asks for nothing until a deck is picked', () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    show()
    expect(screen.getByText(messages.Statistics.beat.pick)).toBeTruthy()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reads the picked deck and hides matchups under 100 games until asked', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(answer))))
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Snake-Eye' }))
    await waitFor(() => screen.getByRole('link', { name: 'Labrynth' }))
    expect(screen.queryByRole('link', { name: 'Tenpai' })).toBeNull()
    fireEvent.click(screen.getByRole('switch'))
    expect(screen.getByRole('link', { name: 'Tenpai' })).toBeTruthy()
  })

  it('says so when the deck can not be read', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 500 })))
    show()
    fireEvent.click(screen.getByRole('button', { name: 'Labrynth' }))
    await waitFor(() => screen.getByText(messages.Statistics.beat.failed))
  })
})
