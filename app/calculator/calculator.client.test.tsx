// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toYdke } from '@utils/deck/codecs/ydke'
import { DeckConflictError, getDeck, listMyDecks, updateDeck, type SavedDeck } from '@utils/decks'
import Calculator from './calculator.client'

const router = { push: vi.fn(), replace: vi.fn() }
const auth: { user: { id: string } | null } = { user: { id: 'u1' } }

vi.mock('next/navigation', () => ({ useRouter: () => router }))
vi.mock('next/image', () => ({ default: () => null }))
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
  useFormatter: () => ({ number: (n: number, o?: { style?: string }) => (o?.style === 'percent' ? `${Math.round(n * 100)}%` : String(n)), relativeTime: () => 'now' }),
  useNow: () => new Date(),
}))
vi.mock('@hooks/index', () => ({ useAuth: () => auth }))
vi.mock('@utils/wiki', () => ({ getBanlists: () => Promise.resolve([]) }))
vi.mock('@utils/cards', () => ({ cardsByIds: vi.fn(async () => new Map()) }))
vi.mock('@utils/decks', async (original) => ({ ...(await original<typeof import('@utils/decks')>()), getDeck: vi.fn(), updateDeck: vi.fn(), listMyDecks: vi.fn() }))

const ID = 'abcdefabcdefabcd'
const server = (over: Partial<SavedDeck> = {}): SavedDeck => ({
  id: ID,
  ownerId: 'u1',
  owner: { id: 'u1', name: 'kaiba' },
  name: 'Saved',
  notes: '',
  format: null,
  main: [1],
  extra: [],
  side: [],
  tags: {},
  visibility: 'private',
  coverCardId: null,
  description: '',
  links: [],
  deckTags: [],
  revision: 5,
  createdAt: '2026-10-16T12:00:00.000Z',
  updatedAt: '2026-10-16T12:00:00.000Z',
  label: null,
  ...over,
})

/** Renders the calculator at `url` and lets the async boot, card lookups and deck read settle. */
const open = async (url: string) => {
  window.history.replaceState(null, '', url)
  render(<Calculator />)
  await act(async () => {
    await new Promise((r) => setTimeout(r, 50))
  })
}

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }))
  auth.user = { id: 'u1' }
  vi.mocked(getDeck).mockResolvedValue(null)
  vi.mocked(listMyDecks).mockResolvedValue({ decks: [], nextCursor: null })
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('Calculator', () => {
  it('a damaged ?c= opens empty with the notice', async () => {
    await open('/calculator?c=garbage!!')
    expect(screen.getByText('damagedLink')).toBeTruthy()
  })
  it("a builder link loads the deck, its name, and the saved deck's roles", async () => {
    vi.mocked(getDeck).mockResolvedValue(server({ id: ID, tags: { '14558127': ['Hand Trap'] }, format: 2 }))
    await open(`/calculator?d=${encodeURIComponent(toYdke({ main: [14558127, 14558127, 46986414], extra: [], side: [] }))}&name=Snake-Eye&deck=${ID}`)
    expect((screen.getByLabelText('deckName') as HTMLInputElement).value).toBe('Snake-Eye')
    expect(getDeck).toHaveBeenCalledWith(ID)
    expect(screen.getByText('draw.total')).toBeTruthy()
  })
  it("saves roles to the owner's deck and surfaces a conflict", async () => {
    vi.mocked(getDeck).mockResolvedValue(server({ id: ID, main: [1], tags: {}, revision: 2, ownerId: 'u1' }))
    vi.mocked(updateDeck).mockRejectedValueOnce(new DeckConflictError(server({ revision: 3 })))
    await open(`/calculator?d=${encodeURIComponent(toYdke({ main: [1], extra: [], side: [] }))}&deck=${ID}`)
    await act(async () => fireEvent.click(screen.getAllByRole('button', { name: 'deck.roleOf' })[0]!)) // Starter, first in the palette
    await act(async () => fireEvent.click(screen.getByText('save.roles')))
    expect(updateDeck).toHaveBeenCalledWith(ID, { tags: { '1': ['Starter'] } }, 2) // three arguments: no explicit `force`
    expect(screen.getByText('save.changed')).toBeTruthy()
    expect(screen.getByText('openBuilder').closest('a')?.getAttribute('href')).toBe(`/deck-builder/${ID}`)
  })
  it('hides Save roles for a deck the user does not own', async () => {
    vi.mocked(getDeck).mockResolvedValue(server({ id: ID, ownerId: 'u2' }))
    await open(`/calculator?d=${encodeURIComponent(toYdke({ main: [1], extra: [], side: [] }))}&deck=${ID}`)
    expect(screen.queryByText('save.roles')).toBeNull()
    expect(screen.getByText('openBuilder').closest('a')?.getAttribute('href')).toMatch(/^\/deck-builder\?d=/)
  })
  it('a hand size above the deck shows tooFewCards and the URL carries ?c=', async () => {
    await open(`/calculator?d=${encodeURIComponent(toYdke({ main: [1, 2, 3], extra: [], side: [] }))}`)
    await act(async () => fireEvent.change(screen.getByLabelText('draw.handSize'), { target: { value: '20' } }))
    expect(screen.getAllByText('results.tooFewCards').length).toBeGreaterThan(0)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400))
    })
    expect(location.search.startsWith('?c=')).toBe(true)
  })
})
