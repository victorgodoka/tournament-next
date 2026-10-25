// @vitest-environment happy-dom
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDeck, DeckApiError, DeckConflictError, updateDeck, type SavedDeck } from '@utils/decks'
import { initialEditorState, type EditorState } from './deck-editor.reducer'
import { draftKey, readDraft, writeDraft } from './drafts'
import { draftOf, useSave } from './use-save'

const router = { push: vi.fn(), replace: vi.fn() }
const auth: { user: { id: string } | null | undefined; refresh: () => Promise<void> } = { user: { id: 'u1' }, refresh: vi.fn() }

vi.mock('next/navigation', () => ({ useRouter: () => router }))
vi.mock('next-intl', () => ({ useTranslations: () => (key: string, values?: object) => (values ? `${key} ${JSON.stringify(values)}` : key) }))
vi.mock('@hooks/index', () => ({ useAuth: () => auth }))
vi.mock('@utils/decks', async (original) => ({ ...(await original<typeof import('@utils/decks')>()), createDeck: vi.fn(), updateDeck: vi.fn() }))

const deck = { main: [1, 2, 3], extra: [], side: [] }
const NEW_ID = '0123456789abcdef'
const saved = (over: Partial<SavedDeck> = {}): SavedDeck => ({
  id: NEW_ID,
  ownerId: 'u1',
  owner: { id: 'u1', name: 'kaiba', avatarUrl: null },
  generated: false,
  likes: 0,
  name: 'Blue-Eyes',
  notes: '',
  format: 44,
  ...deck,
  tags: {},
  visibility: 'private',
  coverCardId: null,
  description: '',
  links: [],
  deckTags: [],
  revision: 1,
  createdAt: '2026-10-16T12:00:00.000Z',
  updatedAt: '2026-10-16T12:00:00.000Z',
  label: null,
  ...over,
})
const editor = (over: Partial<EditorState> = {}): EditorState => ({ ...initialEditorState(), deck, dirty: true, ...over })

const setup = (state: EditorState, format: number | null = 44, wait: string | null = null) => {
  const dispatch = vi.fn()
  const hook = renderHook(({ s }) => useSave(s, dispatch, format, wait, (id) => `card${id}`), { initialProps: { s: state } })
  return { dispatch, ...hook }
}

/** A request that resolves when the test says so. */
const deferred = () => {
  let resolve!: (d: SavedDeck) => void
  const promise = new Promise<SavedDeck>((r) => (resolve = r))
  return { promise, resolve }
}

// Node's own (flagged) localStorage shadows happy-dom's: stub both storages.
const memoryStorage = () => {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
}

beforeEach(() => {
  auth.user = { id: 'u1' }
  auth.refresh = vi.fn(() => Promise.resolve())
  vi.stubGlobal('localStorage', memoryStorage())
  vi.stubGlobal('sessionStorage', memoryStorage())
  window.history.replaceState(null, '', '/deck-builder')
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
    // The editor takes the name and format as saved, so later drafts compare like for like.
    expect(dispatch).toHaveBeenCalledWith({ type: 'saved', deckId: NEW_ID, revision: 1, name: 'newDeck', format: 44 })
    expect(localStorage.getItem(draftKey(null))).toBeNull()
    expect(window.location.pathname).toBe(`/deck-builder/${NEW_ID}`)
    expect(result.current.saving).toBe(false)
  })

  it('updates with the current revision and content', async () => {
    vi.mocked(updateDeck).mockResolvedValue(saved({ revision: 4 }))
    const { result, dispatch } = setup(editor({ deckId: 'abc', revision: 3, name: ' Blue ', format: 7 }), 7)
    await act(() => result.current.save())
    expect(updateDeck).toHaveBeenCalledWith('abc', { name: 'Blue', format: 7, ...deck }, 3, false)
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'saved', revision: 4 }))
  })

  it('keeps edits made while saving dirty, as a draft on the new revision', async () => {
    const request = deferred()
    vi.mocked(updateDeck).mockReturnValue(request.promise)
    const first = editor({ deckId: 'abc', revision: 3 })
    const { result, dispatch, rerender } = setup(first)
    let pending!: Promise<void>
    act(() => {
      pending = result.current.save()
    })
    rerender({ s: { ...first, name: 'edited' } })
    await act(async () => {
      request.resolve(saved({ id: 'abc', revision: 4 }))
      await pending
    })
    expect(dispatch).toHaveBeenCalledWith({ type: 'saved', deckId: 'abc', revision: 4, dirty: true })
    expect(readDraft(draftKey('abc'))).toMatchObject({ name: 'edited', revision: 4 })
  })

  it('says why when it cannot save yet', async () => {
    const loading = setup(editor({ deckId: 'abc', revision: 3 }), 44, 'save.wait')
    await act(() => loading.result.current.save())
    expect(loading.result.current.error).toBe('save.wait')
    const unloaded = setup(editor({ deckId: 'abc', revision: null }))
    await act(() => unloaded.result.current.save())
    expect(unloaded.result.current.error).toBe('save.notLoaded')
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

  it("a 400 shows a translated message; the server's text only goes to the console", async () => {
    vi.mocked(updateDeck).mockRejectedValue(new DeckApiError(400, 'BAD_REQUEST', 'main: too many copies'))
    const log = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = setup(editor({ deckId: 'abc', revision: 3 }))
    await act(() => result.current.save())
    expect(result.current.error).toBe('save.rejected')
    expect(log).toHaveBeenCalled()
  })

  it.each([
    [12, 'save.rateLimited {"seconds":12}'],
    [undefined, 'save.rateLimited {"seconds":60}'],
  ])('a 429 says when to retry (retry-after %s)', async (retryAfter, message) => {
    vi.mocked(updateDeck).mockRejectedValue(new DeckApiError(429, 'RATE_LIMITED', 'slow down', undefined, retryAfter))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = setup(editor({ deckId: 'abc', revision: 3 }))
    await act(() => result.current.save())
    expect(result.current.error).toBe(message)
  })

  it.each([
    [{ unknown: [7, 8] }, 'save.unknownCards {"cards":"card7, card8"}'],
    [{ overLimit: [9] }, 'save.overLimit {"cards":"card9"}'],
    [{ unknownFormat: 44 }, 'save.unknownFormat'],
  ])('a 400 with details %j says what the server refused', async (details, message) => {
    vi.mocked(updateDeck).mockRejectedValue(new DeckApiError(400, 'BAD_REQUEST', 'refused', details))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const { result } = setup(editor({ deckId: 'abc', revision: 3 }))
    await act(() => result.current.save())
    expect(result.current.error).toBe(message)
  })

  it('a clean saved deck is a no-op: no request, no revision, no message', async () => {
    const { result, dispatch } = setup(editor({ deckId: 'abc', revision: 3, dirty: false }))
    await act(() => result.current.save())
    expect(updateDeck).not.toHaveBeenCalled()
    expect(dispatch).not.toHaveBeenCalled()
    expect(result.current.error).toBeNull()
  })

  describe('storage unavailable', () => {
    const denied = () => {
      throw new Error('denied')
    }
    beforeEach(() => {
      vi.stubGlobal('localStorage', { getItem: denied, setItem: denied, removeItem: denied })
    })

    it('signed out: stays here and offers a sign-in in a new tab; the next Save asks the server', async () => {
      auth.user = null
      const { result } = setup(editor({ name: 'Mine' }))
      await act(() => result.current.save())
      expect(router.push).not.toHaveBeenCalled()
      expect(createDeck).not.toHaveBeenCalled()
      expect(result.current.signInTab).toBe(true)
      // Signed in from the other tab: the cookie is there, so the create goes through.
      vi.mocked(createDeck).mockResolvedValue(saved())
      await act(() => result.current.save())
      expect(createDeck).toHaveBeenCalled()
      expect(result.current.signInTab).toBe(false)
      expect(auth.refresh).toHaveBeenCalled()
      expect(router.push).not.toHaveBeenCalled()
    })

    it('a 401 stays here too', async () => {
      vi.mocked(updateDeck).mockRejectedValue(new DeckApiError(401))
      const { result } = setup(editor({ deckId: 'abc', revision: 3 }))
      await act(() => result.current.save())
      expect(router.push).not.toHaveBeenCalled()
      expect(result.current.signInTab).toBe(true)
    })
  })

  it('signed out: writes the draft, remembers the page and goes to /login', async () => {
    auth.user = null
    window.history.replaceState(null, '', '/deck-builder?x=1')
    const { result } = setup(editor({ name: 'Mine' }))
    await act(() => result.current.save())
    expect(createDeck).not.toHaveBeenCalled()
    expect(readDraft(draftKey(null))).toMatchObject({ deck, name: 'Mine' })
    expect(sessionStorage.getItem('return-to')).toBe('/deck-builder?x=1')
    expect(router.push).toHaveBeenCalledWith('/login')
    expect(auth.refresh).not.toHaveBeenCalled()
  })

  it('a 401 re-reads the session before going to /login, so /login sees the user signed out', async () => {
    let signedOut!: () => void
    auth.refresh = vi.fn(() => new Promise<void>((r) => (signedOut = r)))
    vi.mocked(updateDeck).mockRejectedValue(new DeckApiError(401))
    const { result } = setup(editor({ deckId: 'abc', revision: 3 }))
    let pending!: Promise<void>
    await act(async () => {
      pending = result.current.save()
    })
    expect(auth.refresh).toHaveBeenCalled()
    expect(router.push).not.toHaveBeenCalled()
    expect(readDraft(draftKey('abc'))).toMatchObject({ deck, revision: 3 })
    await act(async () => {
      signedOut()
      await pending
    })
    expect(router.push).toHaveBeenCalledWith('/login')
  })

  describe('a create that resolves after the editor unmounted', () => {
    const start = () => {
      const request = deferred()
      vi.mocked(createDeck).mockReturnValue(request.promise)
      const first = editor({ name: 'A' })
      const hook = setup(first)
      let pending!: Promise<void>
      act(() => {
        pending = hook.result.current.save()
      })
      const edited = { ...first, name: 'A, edited' }
      hook.rerender({ s: edited })
      return { ...hook, edited, finish: () => act(async () => (request.resolve(saved()), await pending)) }
    }

    it("keeps the edits made meanwhile under the new deck's draft and leaves the URL alone", async () => {
      const { unmount, edited, finish } = start()
      writeDraft(draftKey(null), draftOf(edited)) // what the shell's unmount flush stores
      unmount()
      window.history.replaceState(null, '', '/somewhere-else')
      await finish()
      expect(window.location.pathname).toBe('/somewhere-else')
      expect(readDraft(draftKey(NEW_ID))).toMatchObject({ name: 'A, edited', revision: 1 })
      expect(readDraft(draftKey(null))).toBeNull() // moved, not duplicated
    })

    it('leaves a new draft that holds something else alone', async () => {
      const { unmount, finish } = start()
      writeDraft(draftKey(null), { deck: { main: [9], extra: [], side: [] }, name: 'Another', format: null, revision: null, at: 1 })
      unmount()
      await finish()
      expect(readDraft(draftKey(null))).toMatchObject({ name: 'Another' })
    })
  })
})
