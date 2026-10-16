// @vitest-environment happy-dom
import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, expect, it, vi } from 'vitest'
import { createDeck, type SavedDeck } from '@utils/decks'
import DeckEditor from './deck-editor.client'
import { draftKey } from './drafts'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))
vi.mock('next/image', () => ({ default: () => null }))
vi.mock('next-intl', () => ({ useTranslations: () => (key: string) => key, useFormatter: () => ({ relativeTime: () => 'now' }) }))
vi.mock('@hooks/index', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('@utils/wiki', () => ({ getBanlists: () => Promise.resolve([]) }))
vi.mock('@utils/decks', async (original) => ({ ...(await original<typeof import('@utils/decks')>()), createDeck: vi.fn() }))
vi.mock('./card-pool', () => ({ CardPool: () => null }))

afterEach(() => vi.unstubAllGlobals())

it('a save within the autosave debounce leaves no stale draft behind on unmount', async () => {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) })
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }))
  vi.mocked(createDeck).mockResolvedValue({ id: '0123456789abcdef', revision: 1 } as SavedDeck)
  window.history.replaceState(null, '', '/deck-editor')

  const view = render(<DeckEditor deckId={null} />)
  await act(async () => {}) // the banlists answer; save waits for them
  fireEvent.change(screen.getByLabelText('toolbar.name'), { target: { value: 'Blue-Eyes' } })
  await act(async () => fireEvent.click(screen.getByRole('button', { name: /toolbar\.save/ })))
  expect(createDeck).toHaveBeenCalledWith(expect.objectContaining({ name: 'Blue-Eyes' }))
  view.unmount() // flushes any draft the debounce still holds
  expect(store.get(draftKey(null))).toBeUndefined()
  expect(store.get(draftKey('0123456789abcdef'))).toBeUndefined()
})
