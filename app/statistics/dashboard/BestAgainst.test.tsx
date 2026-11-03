import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DeckStat, Meta } from '@utils/statistics'
import { BestAgainst, BestCard } from './BestAgainst'

vi.mock('@omega/card-art', () => ({ CardArt: () => null }))
vi.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }))

const deck = (key: string, wrExpected: number, tier: DeckStat['tier'], share: number) => ({ key, name: `Deck ${key}`, wrExpected, tier, share }) as DeckStat
const meta = { decks: [deck('1', 0.56, 1, 0.3), deck('2', 0.55, 1, 0.2), deck('3', 0.49, null, 0.1)] } as Meta
const scope = { ladder: 'tcg', window: 'season', band: 'all' } as const
const cell = (key: string, opponent: string, wrAdjusted: number, games = 100) => ({ key, opponent, wrAdjusted, games })

afterEach(() => vi.unstubAllGlobals())

describe('BestAgainst', () => {
  it('reads only the tiered decks, and names the best of them with its rate against each', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const matchups = url.includes('/decks/1') ? [cell('1', '2', 0.51), cell('1', '3', 0.5)] : [cell('2', '1', 0.6, 300), cell('2', '3', 0.6, 50)]
      return new Response(JSON.stringify({ matchups }))
    })
    vi.stubGlobal('fetch', fetchMock)
    const out = await BestAgainst({ meta, scope })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(out?.type).toBe(BestCard)
    expect(out?.props).toMatchObject({ best: { key: '2', games: 350, opponents: [{ key: '1', wr: 0.6 }, { key: '3', wr: 0.6 }] }, scope })
  })

  it('shows nothing when the API refuses: the rest of the page stands', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 429 })))
    expect(await BestAgainst({ meta, scope })).toBeNull()
  })
})
