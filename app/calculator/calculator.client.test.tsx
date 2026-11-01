// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextSeed } from '@utils/combo/rng'
import { decodeShare, encodeShare } from '@utils/combo/share'
import { cardsByIds } from '@utils/cards'
import { DEFAULT_DRAW, DEFAULT_EFFECTS, DRAW_EFFECTS } from '@utils/combo/types'
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
vi.mock('@contexts/auth/auth.context', () => ({ useAuth: () => auth }))
vi.mock('@utils/wiki', () => ({ getBanlists: () => Promise.resolve([]) }))
vi.mock('@utils/cards', () => ({ cardsByIds: vi.fn(async () => new Map()) }))
vi.mock('@utils/decks', async (original) => ({ ...(await original<typeof import('@utils/decks')>()), getDeck: vi.fn(), updateDeck: vi.fn(), listMyDecks: vi.fn() }))

const ID = 'abcdefabcdefabcd'
const server = (over: Partial<SavedDeck> = {}): SavedDeck => ({
  id: ID,
  ownerId: 'u1',
  owner: { id: 'u1', name: 'kaiba', avatarUrl: null },
  generated: false,
  likes: 0,
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
  season: null,
  ...over,
})

const summary = (id: string, name: string): DeckSummary => ({
  id,
  owner: { id: 'u1', name: 'kaiba', avatarUrl: null },
  generated: false,
  likes: 0,
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
  season: null,
})

/** Opens the first tile's card menu (no brush picked: a click opens it). */
const openMenu = () => act(async () => fireEvent.click(screen.getAllByRole('button', { name: /tags\.tile/ })[0]!))
/** The first tag in the open menu: Starter. */
const toggleFirstTag = () => act(async () => fireEvent.click(screen.getAllByRole('checkbox', { name: 'tags.toggle' })[0]!))

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
  // Node's own (flagged) localStorage shadows happy-dom's. The first-visit tour would cover the board; its own tests clear the flag.
  const store = new Map<string, string>([['calc-tour', 'done']])
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  })
  auth.user = { id: 'u1' }
  vi.mocked(getDeck).mockResolvedValue(null)
  vi.mocked(listMyDecks).mockResolvedValue({ decks: [], nextCursor: null })
  vi.mocked(updateDeck).mockResolvedValue(server({ revision: 9 }))
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
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
    await openMenu()
    await toggleFirstTag()
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
      seed: 1,
      effects: DEFAULT_EFFECTS,
    })
    await open(`/calculator?c=${code}`)
    await openMenu()
    const boxes = screen.getAllByRole('checkbox', { name: 'tags.toggle' }) as HTMLInputElement[]
    expect(boxes[0]!.checked).toBe(true) // Starter, from the link
    expect(boxes[4]!.checked).toBe(false) // Brick, from the saved deck: not adopted
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
      seed: 1,
      effects: DEFAULT_EFFECTS,
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
    await openMenu()
    await toggleFirstTag()
    await act(async () => fireEvent.click(screen.getByText('save.roles')))
    expect(updateDeck).toHaveBeenCalledWith(OTHER, { tags: { '2': ['Starter'] } }, 1)
    await act(async () => fireEvent.click(screen.getByText('save.reload')))
    expect(vi.mocked(getDeck).mock.calls.at(-1)![0]).toBe(OTHER)
  })
  it('saving roles writes the saved deck, not the what-if deck: a card cut to 0 keeps its tag', async () => {
    vi.mocked(getDeck).mockResolvedValue(server({ id: ID, main: [1, 2], tags: {}, revision: 2, ownerId: 'u1' }))
    vi.mocked(updateDeck).mockResolvedValue(server({ id: ID, main: [1, 2], tags: { '1': ['Starter'] }, revision: 3 }))
    await open(`/calculator?d=${encodeURIComponent(toYdke({ main: [1, 2], extra: [], side: [] }))}&deck=${ID}`)
    await openMenu() // card 1
    await toggleFirstTag() // Starter on card 1
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'deck.fewer' }))) // card 1 to 0 copies
    await act(async () => fireEvent.click(screen.getByText('save.roles')))
    expect(updateDeck).toHaveBeenCalledWith(ID, { tags: { '1': ['Starter'] } }, 2)
    expect(screen.getByText('save.saved')).toBeTruthy()
  })
  it('Use in hands starts a hand with the rule, then adds the next rule to it', async () => {
    const code = await encodeShare({
      builds: [{ name: 'Shared', deck: { main: [1], extra: [], side: [] }, roles: new Map(), format: null, deckId: null }],
      analysis: { hands: [] },
      draw: DEFAULT_DRAW,
      focus: null,
      seed: 1,
      effects: DEFAULT_EFFECTS,
    })
    await open(`/calculator?c=${code}`)
    const suggestions = () => screen.queryAllByRole('button', { name: 'tags.useInHands' })
    expect(suggestions()).toHaveLength(2) // Starter, Brick
    await act(async () => fireEvent.click(suggestions()[1]!)) // Brick: no hands yet, so a new one
    expect(suggestions()).toHaveLength(1) // Brick moved to In your hands
    await act(async () => fireEvent.click(suggestions()[0]!)) // Starter joins that hand
    expect(suggestions()).toHaveLength(0)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400))
    })
    const { analysis } = await decodeShare(new URLSearchParams(location.search).get('c')!)
    expect(analysis.hands).toEqual([
      {
        name: '',
        rules: [
          { subject: { kind: 'role', role: 'Brick' }, min: 0, max: 0 },
          { subject: { kind: 'role', role: 'Starter' }, min: 1, max: null },
        ],
      },
    ])
  })
  it('painting Starter on a card raises the odds: the headline shows the arrow for 4 s, then drops it', async () => {
    const code = await encodeShare({
      builds: [{ name: 'Shared', deck: { main: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], extra: [], side: [] }, roles: new Map(), format: null, deckId: null }],
      analysis: { hands: [{ name: '', rules: [{ subject: { kind: 'role', role: 'Starter' }, min: 1, max: null }] }] },
      draw: DEFAULT_DRAW,
      focus: null,
      seed: 1,
      effects: DEFAULT_EFFECTS,
    })
    await open(`/calculator?c=${code}`)
    expect(screen.getAllByText('0%').length).toBeGreaterThan(0)
    expect(screen.queryByText(/▲/)).toBeNull()
    vi.useFakeTimers()
    fireEvent.click(screen.getAllByRole('button', { name: 'tags.brush' })[0]!) // Starter: in the hand, so first
    act(() => {
      fireEvent.pointerDown(screen.getAllByRole('button', { name: /tags\.tile/ })[0]!, { button: 0, buttons: 1, pointerType: 'mouse' })
      fireEvent.pointerUp(window)
    })
    expect(screen.getByText(/▲/)).toBeTruthy()
    act(() => {
      vi.advanceTimersByTime(4000)
    })
    expect(screen.queryByText(/▲/)).toBeNull()
  })
  it("switching build tabs drops the arrow: the baseline was measured on the other build's odds", async () => {
    const main = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    const code = await encodeShare({
      builds: [
        { name: 'A', deck: { main, extra: [], side: [] }, roles: new Map(), format: null, deckId: null },
        { name: 'B', deck: { main, extra: [], side: [] }, roles: new Map([[1, ['Starter']]]), format: null, deckId: null },
      ],
      analysis: { hands: [{ name: '', rules: [{ subject: { kind: 'role', role: 'Starter' }, min: 1, max: null }] }] },
      draw: DEFAULT_DRAW,
      focus: null,
      seed: 1,
      effects: DEFAULT_EFFECTS,
    })
    await open(`/calculator?c=${code}`)
    fireEvent.click(screen.getAllByRole('button', { name: 'tags.brush' })[0]!) // Starter
    // A has no Starter: painting card 2 raises it from 0%, so the arrow shows.
    await act(async () => {
      fireEvent.pointerDown(screen.getAllByRole('button', { name: /tags\.tile/ })[1]!, { button: 0, buttons: 1, pointerType: 'mouse' })
      fireEvent.pointerUp(window)
    })
    expect(screen.getByText(/▲/)).toBeTruthy()
    fireEvent.click(screen.getAllByRole('tab')[1]!) // B's odds are not A's odds plus the paint
    expect(screen.queryByText(/[▲▼]/)).toBeNull()
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
    await openMenu()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'deck.fewer' })))
    const copies = () => within(screen.getByRole('group', { name: 'deck.copiesOf' })).getByText(/^\d$/).textContent
    expect(copies()).toBe('1') // the copy's row: 1 copy
    fireEvent.click(screen.getAllByRole('tab')[0]!)
    expect(copies()).toBe('2') // the source still has 2
    fireEvent.click(screen.getAllByRole('tab')[1]!)
    await act(async () => fireEvent.click(screen.getByText('builds.remove')))
    expect(screen.getAllByRole('tab')).toHaveLength(1)
    expect(screen.queryByText('builds.remove')).toBeNull()
  })
  it('mounts the simulator; Deal again changes the seed the link carries', async () => {
    await open(`/calculator?d=${encodeURIComponent(toYdke({ main: Array.from({ length: 40 }, (_, i) => 100 + i), extra: [], side: [] }))}&name=Sim`)
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400))
    })
    const seed = (await decodeShare(new URLSearchParams(location.search).get('c')!)).seed
    await act(async () => fireEvent.click(screen.getByText('simulator.dealAgain')))
    await act(async () => {
      await new Promise((r) => setTimeout(r, 400))
    })
    expect((await decodeShare(new URLSearchParams(location.search).get('c')!)).seed).toBe(nextSeed(seed))
  })
  it('looks the five draw-effect cards up, so the simulator names them even when the deck has none', async () => {
    vi.mocked(cardsByIds).mockClear()
    await open(`/calculator?d=${encodeURIComponent(toYdke({ main: [7], extra: [], side: [] }))}&name=Plain`)
    const asked = vi.mocked(cardsByIds).mock.calls.flatMap(([ids]) => ids)
    for (const id of Object.values(DRAW_EFFECTS)) expect(asked).toContain(id)
  })
  it('the tour opens on a first visit with a deck and advances as the board is used', async () => {
    localStorage.removeItem('calc-tour')
    await open(`/calculator?d=${encodeURIComponent(toYdke({ main: [1, 2], extra: [], side: [] }))}`)
    // Fixed on screen, but first in the DOM: Skip and Next come before the board's controls in the tab order.
    const dialog = screen.getByText('tour.s1Title').closest('[role="dialog"]')!
    expect(dialog.compareDocumentPosition(screen.getByLabelText('deckName')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await act(async () => fireEvent.click(screen.getAllByRole('button', { name: 'tags.brush' })[0]!))
    expect(screen.getByText('tour.s2Title')).toBeTruthy()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'tour.skip' })))
    expect(screen.queryByText('tour.s2Title')).toBeNull()
    expect(localStorage.getItem('calc-tour')).toBe('done')
  })
  it('the tour waits for a deck: the picker starts it, and the ? button brings it back after Skip', async () => {
    localStorage.removeItem('calc-tour')
    vi.mocked(listMyDecks).mockResolvedValue({ decks: [summary(ID, 'Blue-Eyes')], nextCursor: null })
    vi.mocked(getDeck).mockResolvedValue(server({ id: ID, name: 'Blue-Eyes', main: [8, 8] }))
    await open('/calculator')
    expect(screen.queryByText('tour.s1Title')).toBeNull()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'picker.openNamed' })))
    expect(screen.getByText('tour.s1Title')).toBeTruthy()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'tour.skip' })))
    expect(screen.queryByText('tour.s1Title')).toBeNull()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'tags.help' })))
    expect(screen.getByText('tour.s1Title')).toBeTruthy()
  })
})
