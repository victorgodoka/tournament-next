// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { decodeShare, encodeShare } from '@utils/combo/share'
import { DEFAULT_DRAW } from '@utils/combo/types'
import { toYdke } from '@utils/deck/codecs/ydke'
import { DeckApiError, DeckConflictError, getDeck, listMyDecks, updateDeck, type DeckSummary, type SavedDeck } from '@utils/decks'
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

const summary = (id: string, name: string): DeckSummary => ({
  id,
  owner: { id: 'u1', name: 'kaiba' },
  name,
  format: null,
  visibility: 'private',
  revision: 1,
  updatedAt: '2026-10-16T12:00:00.000Z',
  counts: { main: 1, extra: 0, side: 0 },
  coverCardId: null,
  description: '',
  links: [],
  deckTags: [],
  label: null,
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
  // The sweep chart measures its width.
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  auth.user = { id: 'u1' }
  vi.mocked(getDeck).mockResolvedValue(null)
  vi.mocked(listMyDecks).mockResolvedValue({ decks: [], nextCursor: null })
  vi.mocked(updateDeck).mockResolvedValue(server({ revision: 9 }))
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
  it("a share link naming a saved deck keeps the link's roles and format, learns only the revision", async () => {
    vi.mocked(getDeck).mockResolvedValue(server({ id: ID, format: 2, tags: { '1': ['Brick'] }, revision: 7, ownerId: 'u1' }))
    const code = await encodeShare({
      builds: [{ name: 'Shared', deck: { main: [1], extra: [], side: [] }, roles: new Map([[1, ['Starter']]]), format: 4, deckId: ID }],
      analysis: { hands: [] },
      draw: DEFAULT_DRAW,
      focus: null,
    })
    await open(`/calculator?c=${code}`)
    const chips = screen.getAllByRole('button', { name: 'deck.roleOf' })
    expect(chips[0]!.getAttribute('aria-pressed')).toBe('true') // Starter, from the link
    expect(chips[3]!.getAttribute('aria-pressed')).toBe('false') // Brick, from the saved deck: not adopted
    expect(screen.getByText('save.roles')).toBeTruthy() // the owner's revision was learned
    await act(async () => fireEvent.click(screen.getByText('save.roles')))
    expect(updateDeck).toHaveBeenCalledWith(ID, { tags: { '1': ['Starter'] } }, 7)
  })
  it('a share link to a deck the viewer cannot read shows no error', async () => {
    vi.mocked(getDeck).mockRejectedValue(new DeckApiError(403))
    const code = await encodeShare({
      builds: [{ name: 'Shared', deck: { main: [1], extra: [], side: [] }, roles: new Map(), format: null, deckId: ID }],
      analysis: { hands: [] },
      draw: DEFAULT_DRAW,
      focus: null,
    })
    await open(`/calculator?c=${code}`)
    expect(screen.queryByText('deckRolesUnavailable')).toBeNull()
    expect(screen.queryByText('save.roles')).toBeNull()
  })
  it('Reload after a conflict re-reads the deck the build came from, not the boot deck', async () => {
    const OTHER = 'bbbbbbbbbbbbbbbb'
    vi.mocked(getDeck).mockImplementation(async (id) => (id === OTHER ? server({ id: OTHER, name: 'Other', main: [2], revision: 1 }) : server({ id: ID, main: [1], revision: 2 })))
    vi.mocked(listMyDecks).mockResolvedValue({ decks: [{ ...summary(OTHER, 'Other') }], nextCursor: null })
    vi.mocked(updateDeck).mockRejectedValueOnce(new DeckConflictError(server({ id: OTHER, revision: 3 })))
    await open(`/calculator?d=${encodeURIComponent(toYdke({ main: [1], extra: [], side: [] }))}&deck=${ID}`)
    await act(async () => fireEvent.click(screen.getByText('pickDeck')))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'picker.openNamed' })))
    await act(async () => fireEvent.click(screen.getAllByRole('button', { name: 'deck.roleOf' })[0]!))
    await act(async () => fireEvent.click(screen.getByText('save.roles')))
    expect(updateDeck).toHaveBeenCalledWith(OTHER, { tags: { '2': ['Starter'] } }, 1)
    await act(async () => fireEvent.click(screen.getByText('save.reload')))
    expect(vi.mocked(getDeck).mock.calls.at(-1)![0]).toBe(OTHER)
  })
  it('saving roles writes the saved deck, not the what-if deck: a card cut to 0 keeps its tag', async () => {
    vi.mocked(getDeck).mockResolvedValue(server({ id: ID, main: [1, 2], tags: {}, revision: 2, ownerId: 'u1' }))
    vi.mocked(updateDeck).mockResolvedValue(server({ id: ID, main: [1, 2], tags: { '1': ['Starter'] }, revision: 3 }))
    await open(`/calculator?d=${encodeURIComponent(toYdke({ main: [1, 2], extra: [], side: [] }))}&deck=${ID}`)
    await act(async () => fireEvent.click(screen.getAllByRole('button', { name: 'deck.roleOf' })[0]!)) // Starter on card 1
    await act(async () => fireEvent.click(screen.getAllByRole('button', { name: 'deck.fewer' })[0]!)) // card 1 to 0 copies
    await act(async () => fireEvent.click(screen.getByText('save.roles')))
    expect(updateDeck).toHaveBeenCalledWith(ID, { tags: { '1': ['Starter'] } }, 2)
    expect(screen.getByText('save.saved')).toBeTruthy()
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
  it('adds a second build from the picker, tabs switch the deck being edited, the link carries both', async () => {
    vi.mocked(listMyDecks).mockResolvedValue({ decks: [summary(ID, 'Blue-Eyes')], nextCursor: null })
    vi.mocked(getDeck).mockResolvedValue(server({ id: ID, name: 'Blue-Eyes', main: [8, 8] }))
    await open(`/calculator?d=${encodeURIComponent(toYdke({ main: [7], extra: [], side: [] }))}&name=First`)
    await act(async () => fireEvent.click(screen.getByText('builds.add')))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'picker.openNamed' })))
    const tabs = screen.getAllByRole('tab')
    expect(tabs.map((t) => t.textContent)).toEqual(['A · First', 'B · Blue-Eyes'])
    expect(tabs[1]!.getAttribute('aria-selected')).toBe('true')
    expect((screen.getByLabelText('deckName') as HTMLInputElement).value).toBe('Blue-Eyes')
    fireEvent.click(tabs[0]!)
    expect((screen.getByLabelText('deckName') as HTMLInputElement).value).toBe('First')
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400))
    })
    const shared = await decodeShare(new URLSearchParams(location.search).get('c')!)
    expect(shared.builds.map((b) => b.name)).toEqual(['First', 'Blue-Eyes'])
  })
  it('duplicates the active build as a what-if copy with no saved deck behind it, and removes it again', async () => {
    vi.mocked(getDeck).mockResolvedValue(server({ id: ID, main: [7, 7], revision: 2, ownerId: 'u1' }))
    await open(`/calculator?d=${encodeURIComponent(toYdke({ main: [7, 7], extra: [], side: [] }))}&name=First&deck=${ID}`)
    expect(screen.getByText('save.roles')).toBeTruthy()
    await act(async () => fireEvent.click(screen.getByText('builds.duplicate')))
    expect(screen.getAllByRole('tab').map((t) => t.textContent)).toEqual(['A · First', 'B · builds.copyOf'])
    expect(screen.queryByText('save.roles')).toBeNull() // the copy is not the saved deck
    await act(async () => fireEvent.click(screen.getAllByRole('button', { name: 'deck.fewer' })[0]!))
    const copies = () => within(screen.getByRole('group', { name: 'deck.copiesOf' })).getByText(/^\d$/).textContent
    expect(copies()).toBe('1') // the copy's row: 1 copy
    fireEvent.click(screen.getAllByRole('tab')[0]!)
    expect(copies()).toBe('2') // the source still has 2
    fireEvent.click(screen.getAllByRole('tab')[1]!)
    await act(async () => fireEvent.click(screen.getByText('builds.remove')))
    expect(screen.getAllByRole('tab')).toHaveLength(1)
    expect(screen.queryByText('builds.remove')).toBeNull()
  })
})
