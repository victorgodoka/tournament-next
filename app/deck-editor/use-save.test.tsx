// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDeck, DeckApiError, DeckConflictError, updateDeck, type SavedDeck } from '@utils/decks'
import { initialEditorState, type EditorState } from './deck-editor.reducer'
import { draftKey, readDraft } from './drafts'
import { useSave } from './use-save'

const router = { push: vi.fn(), replace: vi.fn() }
const auth: { user: { id: string } | null | undefined } = { user: { id: 'u1' } }

vi.mock('next/navigation', () => ({ useRouter: () => router }))
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
vi.mock('@hooks/index', () => ({ useAuth: () => auth }))
vi.mock('@utils/decks', async (original) => ({ ...(await original<typeof import('@utils/decks')>()), createDeck: vi.fn(), updateDeck: vi.fn() }))

const deck = { main: [1, 2, 3], extra: [], side: [] }
const saved = (over: Partial<SavedDeck> = {}): SavedDeck => ({
  id: '0123456789abcdef',
  ownerId: 'u1',
  owner: { id: 'u1', name: 'kaiba' },
  name: 'Blue-Eyes',
  notes: '',
  format: 44,
  ...deck,
  tags: {},
  visibility: 'private',
  coverCardId: null,
  revision: 1,
  createdAt: '2026-10-16T12:00:00.000Z',
  updatedAt: '2026-10-16T12:00:00.000Z',
  label: null,
  ...over,
})
const editor = (over: Partial<EditorState> = {}): EditorState => ({ ...initialEditorState(), deck, dirty: true, ...over })

const setup = (state: EditorState, format: number | null = 44) => {
  const dispatch = vi.fn()
  const hook = renderHook(({ s }) => useSave(s, dispatch, format), { initialProps: { s: state } })
  return { dispatch, ...hook }
}

// Node's own (flagged) localStorage shadows happy-dom's: stub both storages.
const memoryStorage = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
}

beforeEach(() => {
  auth.user = { id: 'u1' }
  vi.stubGlobal('localStorage', memoryStorage())
  vi.stubGlobal('sessionStorage', memoryStorage())
  window.history.replaceState(null, '', '/deck-editor')
})
afterEach(() => {
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('useSave', () => {
  it('creates a new deck, then clears the new draft and moves to its URL', async () => {
    localStorage.setItem(draftKey(null), '{}')
    vi.mocked(createDeck).mockResolvedValue(saved())
    const { result, dispatch } = setup(editor({ name: '  ' }))
    await act(() => result.current.save())
    // An empty name goes out as the placeholder; the effective format, never null.
    expect(createDeck).toHaveBeenCalledWith({ name: 'newDeck', format: 44, ...deck })
    expect(dispatch).toHaveBeenCalledWith({ type: 'saved', deckId: '0123456789abcdef', revision: 1, dirty: false })
    expect(localStorage.getItem(draftKey(null))).toBeNull()
    expect(window.location.pathname).toBe('/deck-editor/0123456789abcdef')
    expect(result.current.saving).toBe(false)
  })

  it('updates with the current revision and content', async () => {
    vi.mocked(updateDeck).mockResolvedValue(saved({ revision: 4 }))
    const { result, dispatch } = setup(editor({ deckId: 'abc', revision: 3, name: ' Blue ', format: 7 }), 7)
    await act(() => result.current.save())
    expect(updateDeck).toHaveBeenCalledWith('abc', { name: 'Blue', format: 7, ...deck }, 3, false)
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'saved', revision: 4 }))
  })

  it('keeps the deck dirty when it changed while saving', async () => {
    let finish!: (d: SavedDeck) => void
    vi.mocked(updateDeck).mockReturnValue(new Promise((r) => (finish = r)))
    const first = editor({ deckId: 'abc', revision: 3 })
    const { result, dispatch, rerender } = setup(first)
    let pending!: Promise<void>
    act(() => {
      pending = result.current.save()
    })
    rerender({ s: { ...first, name: 'edited' } })
    await act(async () => {
      finish(saved({ revision: 4 }))
      await pending
    })
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'saved', dirty: true }))
  })

  it('does nothing for a saved deck that has not loaded yet', async () => {
    const { result } = setup(editor({ deckId: 'abc', revision: null }))
    await act(() => result.current.save())
    expect(updateDeck).not.toHaveBeenCalled()
  })

  it('holds the latest deck on a conflict; Load latest loads it', async () => {
    const latest = saved({ name: 'Other tab', revision: 5 })
    vi.mocked(updateDeck).mockRejectedValue(new DeckConflictError(latest))
    const { result, dispatch } = setup(editor({ deckId: latest.id, revision: 3 }))
    await act(() => result.current.save())
    expect(result.current.conflict).toBe(latest)
    act(() => result.current.resolveConflict('load'))
    expect(dispatch).toHaveBeenCalledWith({ type: 'load', deck, name: 'Other tab', format: 44, deckId: latest.id, revision: 5 })
    expect(result.current.conflict).toBeNull()
  })

  it('Save mine anyway re-saves with force', async () => {
    vi.mocked(updateDeck).mockRejectedValueOnce(new DeckConflictError(saved({ revision: 5 }))).mockResolvedValueOnce(saved({ revision: 6 }))
    const { result, dispatch } = setup(editor({ deckId: 'abc', revision: 3 }))
    await act(() => result.current.save())
    await act(async () => result.current.resolveConflict('overwrite'))
    expect(updateDeck).toHaveBeenLastCalledWith('abc', expect.objectContaining({ main: deck.main }), 3, true)
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'saved', revision: 6 }))
  })

  it('sets an error and keeps the draft on any other failure', async () => {
    localStorage.setItem(draftKey('abc'), 'draft')
    vi.mocked(updateDeck).mockRejectedValue(new DeckApiError(500))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result, dispatch } = setup(editor({ deckId: 'abc', revision: 3 }))
    await act(() => result.current.save())
    expect(result.current.error).toBe('save.failed')
    expect(dispatch).not.toHaveBeenCalled()
    expect(localStorage.getItem(draftKey('abc'))).toBe('draft')
    act(() => result.current.dismissError())
    expect(result.current.error).toBeNull()
  })

  it('signed out: writes the draft, remembers the page and goes to /login', async () => {
    auth.user = null
    window.history.replaceState(null, '', '/deck-editor?x=1')
    const { result } = setup(editor({ name: 'Mine' }))
    await act(() => result.current.save())
    expect(createDeck).not.toHaveBeenCalled()
    expect(readDraft(draftKey(null))).toMatchObject({ deck, name: 'Mine' })
    expect(sessionStorage.getItem('return-to')).toBe('/deck-editor?x=1')
    expect(router.push).toHaveBeenCalledWith('/login')
  })

  it('a 401 takes the same way to /login', async () => {
    vi.mocked(updateDeck).mockRejectedValue(new DeckApiError(401))
    const { result } = setup(editor({ deckId: 'abc', revision: 3 }))
    await act(() => result.current.save())
    expect(readDraft(draftKey('abc'))).toMatchObject({ deck, revision: 3 })
    expect(router.push).toHaveBeenCalledWith('/login')
  })
})
