// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { deleteDeck, listMyDecks, type DeckSummary } from '@utils/decks'
import { MyDecks } from './my-decks'

const router = { push: vi.fn(), replace: vi.fn() }
const auth: { user: { id: string } | null } = { user: { id: 'u1' } }

vi.mock('next/navigation', () => ({ useRouter: () => router }))
vi.mock('next/image', () => ({ default: () => null }))
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: { name?: string }) => (values?.name ? `${key}:${values.name}` : key),
  useFormatter: () => ({ relativeTime: () => 'now' }),
  useNow: () => new Date(),
}))
vi.mock('@contexts/auth/auth.context', () => ({ useAuth: () => auth }))
vi.mock('@utils/decks', () => ({ listMyDecks: vi.fn(), deleteDeck: vi.fn() }))

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
  counts: { main: 40, extra: 15, side: 0 },
  coverCardId: null,
  description: '',
  links: [],
  deckTags: [],
  label: null,
  season: null,
})

const setup = async (replacesNew = false) => {
  const onDeleted = vi.fn()
  await act(async () => {
    render(<MyDecks open onClose={() => {}} currentId="a" onNew={() => {}} newDiscards={() => false} onDeleted={onDeleted} deleteReplacesNew={() => replacesNew} />)
  })
  return { onDeleted }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  auth.user = { id: 'u1' }
})

describe('MyDecks', () => {
  it('lists the decks and loads the next page with the cursor', async () => {
    vi.mocked(listMyDecks)
      .mockResolvedValueOnce({ decks: [summary('a', 'Blue-Eyes'), summary('b', 'Snake-Eye')], nextCursor: 'c1' })
      .mockResolvedValueOnce({ decks: [summary('c', 'Tenpai')], nextCursor: null })
    await setup()
    expect(screen.getByText('Blue-Eyes')).toBeTruthy()
    expect(screen.getByText('Snake-Eye')).toBeTruthy()
    await act(async () => fireEvent.click(screen.getByText('myDecks.more')))
    expect(listMyDecks).toHaveBeenLastCalledWith('c1')
    expect(screen.getByText('Tenpai')).toBeTruthy()
    expect(screen.getByText('Blue-Eyes')).toBeTruthy()
    expect(screen.queryByText('myDecks.more')).toBeNull() // last page
  })

  it('opens a deck by its URL', async () => {
    vi.mocked(listMyDecks).mockResolvedValue({ decks: [summary('b', 'Snake-Eye')], nextCursor: null })
    await setup()
    fireEvent.click(screen.getByLabelText('myDecks.openNamed:Snake-Eye'))
    expect(router.push).toHaveBeenCalledWith('/deck-builder/b')
  })

  it('warns in the confirm when deleting the open deck replaces another unsaved new deck', async () => {
    vi.mocked(listMyDecks).mockResolvedValue({ decks: [summary('a', 'Blue-Eyes')], nextCursor: null })
    await setup(true)
    fireEvent.click(screen.getByLabelText('myDecks.deleteNamed:Blue-Eyes'))
    expect(screen.getByText('myDecks.deleteReplacesNew')).toBeTruthy()
  })

  it('deletes a deck after the confirm, removing its row', async () => {
    vi.mocked(listMyDecks).mockResolvedValue({ decks: [summary('a', 'Blue-Eyes'), summary('b', 'Snake-Eye')], nextCursor: null })
    vi.mocked(deleteDeck).mockResolvedValue(undefined)
    const { onDeleted } = await setup()
    fireEvent.click(screen.getByLabelText('myDecks.deleteNamed:Blue-Eyes'))
    expect(deleteDeck).not.toHaveBeenCalled()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'myDecks.delete' })))
    expect(deleteDeck).toHaveBeenCalledWith('a')
    expect(screen.queryByText('Blue-Eyes')).toBeNull()
    expect(screen.getByText('Snake-Eye')).toBeTruthy()
    expect(onDeleted).toHaveBeenCalledWith('a')
  })

  it('signed out, asks to sign in instead of listing', async () => {
    auth.user = null
    await setup()
    expect(listMyDecks).not.toHaveBeenCalled()
    expect(screen.getByRole('link', { name: 'myDecks.signIn' }).getAttribute('href')).toBe('/login')
  })
})
