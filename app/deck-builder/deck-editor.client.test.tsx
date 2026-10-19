// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toYdke } from '@utils/deck/codecs/ydke'
import { createDeck, deleteDeck, getDeck, listMyDecks, updateDeck, type SavedDeck } from '@utils/decks'
import DeckEditor from './deck-editor.client'
import { draftKey, type Draft } from './drafts'

const router = { push: vi.fn(), replace: vi.fn() }
const auth = { user: { id: 'u1' } as { id: string } | null, refresh: vi.fn() }

vi.mock('next/navigation', () => ({ useRouter: () => router }))
vi.mock('next/image', () => ({ default: () => null }))
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
  useFormatter: () => ({ relativeTime: () => 'now' }),
  useNow: () => new Date(),
}))
vi.mock('@hooks/index', () => ({ useAuth: () => auth }))
vi.mock('@utils/wiki', () => ({ getBanlists: () => Promise.resolve([]) }))
const cardsByIds = vi.hoisted(() => vi.fn())
vi.mock('@utils/cards', () => ({ cardsByIds }))
vi.mock('@utils/decks', async (original) => ({
  ...(await original<typeof import('@utils/decks')>()),
  createDeck: vi.fn(),
  updateDeck: vi.fn(),
  getDeck: vi.fn(),
  listMyDecks: vi.fn(),
  deleteDeck: vi.fn(),
}))
vi.mock('./card-pool', () => ({ CardPool: () => null }))

const ID = 'abcdefabcdefabcd'
const NEW_ID = '0123456789abcdef'
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
const draft = (over: Partial<Draft> = {}): Draft => ({ deck: { main: [2], extra: [], side: [] }, name: 'Local', format: null, revision: 5, at: 1, ...over })

let store: Map<string, string>
const stored = (key: string) => {
  const raw = store.get(key)
  return raw ? (JSON.parse(raw) as Draft) : undefined
}
const put = (key: string, d: Draft) => store.set(key, JSON.stringify(d))

beforeEach(() => {
  store = new Map()
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) })
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }))
  auth.user = { id: 'u1' }
  cardsByIds.mockResolvedValue(new Map())
  window.history.replaceState(null, '', '/deck-builder')
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

/** Renders the editor and lets the banlists and the deck read settle. */
const open = async (deckId: string | null) => {
  const view = render(<DeckEditor deckId={deckId} />)
  await act(async () => {})
  return view
}
const nameInput = () => screen.getByLabelText('toolbar.name') as HTMLInputElement
/** Save, then confirm the save dialog as it opens. */
const clickSave = async () => {
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /toolbar\.save/ })))
  const confirm = document.querySelector<HTMLButtonElement>('button[type="submit"][form="deck-save"]')
  if (confirm) await act(async () => fireEvent.click(confirm))
}

it('a save within the autosave debounce leaves no stale draft behind on unmount', async () => {
  vi.mocked(createDeck).mockResolvedValue(server({ id: NEW_ID, revision: 1 }))
  const view = await open(null)
  fireEvent.change(nameInput(), { target: { value: 'Blue-Eyes' } })
  await clickSave()
  expect(createDeck).toHaveBeenCalledWith(expect.objectContaining({ name: 'Blue-Eyes' }))
  view.unmount() // flushes any draft the debounce still holds
  expect(stored(draftKey(null))).toBeUndefined()
  expect(stored(draftKey(NEW_ID))).toBeUndefined()
})

it('a create that resolves after unmount keeps the edits made meanwhile, under the new deck', async () => {
  let finish!: (d: SavedDeck) => void
  vi.mocked(createDeck).mockReturnValue(new Promise((r) => (finish = r)))
  const view = await open(null)
  fireEvent.change(nameInput(), { target: { value: 'A' } })
  await clickSave()
  fireEvent.change(nameInput(), { target: { value: 'A, edited' } })
  view.unmount()
  await act(async () => finish(server({ id: NEW_ID, name: 'A', revision: 1 })))
  expect(stored(draftKey(NEW_ID))).toMatchObject({ name: 'A, edited', revision: 1 })
  expect(stored(draftKey(null))).toBeUndefined()
  expect(window.location.pathname).toBe('/deck-builder') // the page that unmounted doesn't own the URL any more
})

describe('opening a saved deck', () => {
  it("someone else's readable deck opens as an unsaved copy, named like it", async () => {
    vi.mocked(getDeck).mockResolvedValue(server({ ownerId: 'u2' }))
    await open(ID)
    expect(router.replace).toHaveBeenCalledWith(expect.stringMatching(/^\/deck-builder\?d=ydke[^&]+&name=Saved&copy=$/))
  })

  it("a deck the API won't show sends the user back to a new deck with a notice", async () => {
    vi.mocked(getDeck).mockResolvedValue(null)
    await open(ID)
    expect(router.replace).toHaveBeenCalledWith('/deck-builder?missing')
  })

  it.each([
    ['older', 1],
    ['newer', Date.parse('2027-01-01')],
  ])('a dirty %s draft that differs shows the notice and is never cleared on its own', async (_, at) => {
    put(draftKey(ID), draft({ at }))
    vi.mocked(getDeck).mockResolvedValue(server())
    await open(ID)
    expect(screen.getByText('load.draft')).toBeTruthy()
    expect(nameInput().value).toBe('Local') // the draft stays on screen
    expect(stored(draftKey(ID))).toMatchObject({ name: 'Local' })
  })

  it('a draft equal to the saved deck loads quietly', async () => {
    put(draftKey(ID), draft({ deck: { main: [1], extra: [], side: [] }, name: 'Saved' }))
    vi.mocked(getDeck).mockResolvedValue(server())
    await open(ID)
    expect(screen.queryByText('load.draft')).toBeNull()
    expect(stored(draftKey(ID))).toBeUndefined()
  })

  it('Discard opens the saved version and clears the draft', async () => {
    put(draftKey(ID), draft())
    vi.mocked(getDeck).mockResolvedValue(server())
    await open(ID)
    fireEvent.click(screen.getByText('load.discard'))
    expect(nameInput().value).toBe('Saved')
    expect(stored(draftKey(ID))).toBeUndefined()
  })

  it('a draft made while loading (no revision) is kept on the revision just read, and saves', async () => {
    put(draftKey(ID), draft({ revision: null }))
    vi.mocked(getDeck).mockResolvedValue(server())
    vi.mocked(updateDeck).mockResolvedValue(server({ name: 'Local', main: [2], revision: 6 }))
    await open(ID)
    fireEvent.click(screen.getByText('load.keep'))
    await clickSave()
    expect(updateDeck).toHaveBeenCalledWith(ID, expect.objectContaining({ name: 'Local', main: [2] }), 5, false)
  })

  it('deleted elsewhere: the dirty draft is carried into the new deck, with a notice', async () => {
    put(draftKey(ID), draft())
    vi.mocked(getDeck).mockResolvedValue(null)
    const view = await open(ID)
    expect(stored(draftKey(null))).toMatchObject({ name: 'Local', deck: { main: [2] }, revision: null })
    expect(stored(draftKey(ID))).toBeUndefined()
    expect(router.replace).toHaveBeenCalledWith('/deck-builder?missing=carried')
    view.unmount()
    expect(stored(draftKey(ID))).toBeUndefined() // the unmount flush doesn't strand it again
  })

  it('deleted elsewhere with another unsaved new deck: asks before replacing it', async () => {
    put(draftKey(ID), draft())
    put(draftKey(null), draft({ name: 'Other new', revision: null }))
    vi.mocked(getDeck).mockResolvedValue(null)
    await open(ID)
    expect(router.replace).not.toHaveBeenCalled()
    expect(stored(draftKey(null))).toMatchObject({ name: 'Other new' })
    expect(screen.getByText('load.goneTitle')).toBeTruthy()
    fireEvent.click(screen.getByText('load.goneCarry'))
    expect(stored(draftKey(null))).toMatchObject({ name: 'Local' })
    expect(router.replace).toHaveBeenCalledWith('/deck-builder?missing=carried')
  })

  it('signed out: asks to sign in and leaves the draft where it is', async () => {
    auth.user = null
    put(draftKey(ID), draft())
    vi.mocked(getDeck).mockResolvedValue(null)
    await open(ID)
    expect(screen.getByText('load.signIn')).toBeTruthy()
    expect(router.replace).not.toHaveBeenCalled()
    expect(stored(draftKey(ID))).toMatchObject({ name: 'Local' })
  })
})

it('deleting the open deck over another unsaved new deck warns first, then carries the open deck', async () => {
  put(draftKey(null), draft({ name: 'Other new', revision: null }))
  vi.mocked(getDeck).mockResolvedValue(server())
  vi.mocked(listMyDecks).mockResolvedValue({
    decks: [{
      id: ID, owner: { id: 'u1', name: 'kaiba' }, name: 'Saved', format: null, visibility: 'private', revision: 5, updatedAt: '2026-10-16T12:00:00.000Z',
      counts: { main: 1, extra: 0, side: 0 }, coverCardId: null, description: '', links: [], deckTags: [], label: null,
    }],
    nextCursor: null,
  })
  vi.mocked(deleteDeck).mockResolvedValue(undefined)
  window.history.replaceState(null, '', `/deck-builder/${ID}`)
  await open(ID)
  await act(async () => fireEvent.click(screen.getByText('toolbar.myDecks')))
  fireEvent.click(screen.getByLabelText('myDecks.deleteNamed'))
  expect(screen.getByText('myDecks.deleteReplacesNew')).toBeTruthy()
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'myDecks.delete' })))
  expect(stored(draftKey(null))).toMatchObject({ name: 'Saved', deck: { main: [1] } })
  expect(window.location.pathname).toBe('/deck-builder')
})

describe('storage unavailable', () => {
  const denied = () => {
    throw new Error('denied')
  }
  const blockStorage = () => vi.stubGlobal('localStorage', { getItem: denied, setItem: denied, removeItem: denied })
  /** Whether a page leave would ask first. */
  const leaveWarns = () => {
    const e = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(e)
    return e.defaultPrevented
  }

  it('signed out, Save keeps the deck here and offers a sign-in in a new tab', async () => {
    blockStorage()
    auth.user = null
    const opened = vi.fn()
    vi.stubGlobal('open', opened)
    await open(null)
    fireEvent.change(nameInput(), { target: { value: 'Blue-Eyes' } })
    await clickSave()
    expect(router.push).not.toHaveBeenCalled()
    expect(screen.getByText('save.noStorage')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'save.signInTab' }))
    expect(opened).toHaveBeenCalledWith('/login', '_blank', 'noopener')
    expect(nameInput().value).toBe('Blue-Eyes')
  })

  it('a dirty new deck warns before leaving, since no draft survives the reload', async () => {
    await open(null)
    fireEvent.change(nameInput(), { target: { value: 'Stored' } })
    expect(leaveWarns()).toBe(false) // with storage, the draft survives on its own
    cleanup()
    blockStorage()
    await open(null)
    fireEvent.change(nameInput(), { target: { value: 'Unstored' } })
    expect(leaveWarns()).toBe(true)
  })
})

it('an artwork added from the sheet keeps the original card behind its passcode, not the ruleId target', async () => {
  // 100 is always treated as 50 (ruleId) and has an alternate artwork, 101.
  const api = {
    id: 100, name: 'Polymerization', kind: 'spell', monsterTypes: [], level: null, alias: null, ruleId: 50, alternateArts: [101],
    i18n: {}, erratas: [], description: '', humanReadableCardType: 'Normal Spell', banlists: null,
  }
  cardsByIds.mockImplementation(async (ids: number[]) => new Map(ids.filter((id) => id === 100 || id === 101).map((id) => [id, api])))
  put(draftKey(null), draft({ deck: { main: [100], extra: [], side: [] }, revision: null }))
  const { container } = await open(null)
  const tiles = () => [...container.querySelectorAll<HTMLElement>('section[data-zone="main"] li[data-card]')].map((li) => li.dataset.card)
  const info = (id: number) => container.querySelector<HTMLElement>(`section[data-zone="main"] li[data-card="${id}"] [data-info]`)!
  const pickAndAdd = (art: number) => {
    fireEvent.click(screen.getAllByRole('button', { name: 'detail.art', hidden: true })[art]!)
    fireEvent.click(screen.getAllByRole('button', { name: 'detail.addTo', hidden: true })[0]!)
  }

  fireEvent.click(info(100))
  pickAndAdd(1) // the alternate artwork
  await act(async () => {})
  expect(tiles()).toEqual(['100', '101'])

  // Opened from its own tile, the artwork lists the original and itself: never 50, which has no art of its own.
  fireEvent.click(info(101))
  expect(screen.getAllByRole('button', { name: 'detail.art', hidden: true })).toHaveLength(2)
  pickAndAdd(0)
  await act(async () => {})
  expect(tiles()).toEqual(['100', '101', '100'])
})

it('opens the combo calculator with the deck, name and id', async () => {
  const opened = vi.fn()
  vi.stubGlobal('open', opened)
  vi.mocked(getDeck).mockResolvedValue(server({ name: 'Saved', main: [1] }))
  await open(ID)
  fireEvent.click(screen.getByText('io.export'))
  fireEvent.click(screen.getByText('io.as.calculator'))
  const url = new URL(opened.mock.calls[0]![0] as string, 'http://x')
  expect(url.pathname).toBe('/calculator')
  expect(url.searchParams.get('d')).toBe(toYdke({ main: [1], extra: [], side: [] }))
  expect(url.searchParams.get('name')).toBe('Saved')
  expect(url.searchParams.get('deck')).toBe(ID)
  expect(opened.mock.calls[0]![1]).toBe('_blank')
})
