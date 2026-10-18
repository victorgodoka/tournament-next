// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toYdke } from '@utils/deck/codecs/ydke'
import { getDeck, listMyDecks, type DeckSummary, type SavedDeck } from '@utils/decks'
import { DeckPicker } from './deck-picker'

const auth: { user: { id: string } | null } = { user: { id: 'u1' } }

vi.mock('next/image', () => ({ default: () => null }))
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useFormatter: () => ({ relativeTime: () => 'now' }),
  useNow: () => new Date(),
}))
vi.mock('@hooks/index', () => ({ useAuth: () => auth }))
vi.mock('@utils/decks', async (original) => ({ ...(await original<typeof import('@utils/decks')>()), getDeck: vi.fn(), listMyDecks: vi.fn() }))

const ID = 'abcdefabcdefabcd'
const summary = (id: string, name: string): DeckSummary => ({
  id,
  owner: { id: 'u1', name: 'kaiba' },
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
})
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
const lookup = async () => new Map()

beforeEach(() => {
  auth.user = { id: 'u1' }
  vi.mocked(listMyDecks).mockResolvedValue({ decks: [], nextCursor: null })
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('DeckPicker', () => {
  it('imports a pasted ydke into a build', async () => {
    const onPick = vi.fn()
    render(<DeckPicker open onClose={() => {}} lookup={lookup} onPick={onPick} />)
    fireEvent.click(screen.getByText('picker.paste'))
    fireEvent.change(screen.getByPlaceholderText('picker.placeholder'), { target: { value: toYdke({ main: [1, 2], extra: [], side: [] }) } })
    await act(async () => fireEvent.click(screen.getByText('picker.import')))
    expect(onPick).toHaveBeenCalledWith({ name: '', deck: { main: [1, 2], extra: [], side: [] }, roles: new Map(), format: null, deckId: null }, null)
  })
  it('rejects garbage inline', async () => {
    const onPick = vi.fn()
    render(<DeckPicker open onClose={() => {}} lookup={lookup} onPick={onPick} />)
    fireEvent.click(screen.getByText('picker.paste'))
    fireEvent.change(screen.getByPlaceholderText('picker.placeholder'), { target: { value: 'hello' } })
    await act(async () => fireEvent.click(screen.getByText('picker.import')))
    expect(screen.getByText('picker.invalid')).toBeTruthy()
    expect(onPick).not.toHaveBeenCalled()
  })
  it('opens a saved deck with its roles and revision', async () => {
    vi.mocked(listMyDecks).mockResolvedValue({ decks: [summary(ID, 'Blue-Eyes')], nextCursor: null })
    vi.mocked(getDeck).mockResolvedValue(server({ id: ID, name: 'Blue-Eyes', main: [1, 1], tags: { '1': ['Starter'] }, revision: 4, ownerId: 'u1', format: 2 }))
    const onPick = vi.fn()
    await act(async () => {
      render(<DeckPicker open onClose={() => {}} lookup={lookup} onPick={onPick} />)
    })
    expect(screen.getByText('Blue-Eyes')).toBeTruthy()
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'picker.openNamed' })))
    expect(getDeck).toHaveBeenCalledWith(ID)
    expect(onPick).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Blue-Eyes', deck: { main: [1, 1], extra: [], side: [] }, deckId: ID, format: 2, roles: new Map([[1, ['Starter']]]) }),
      { revision: 4, ownerId: 'u1' },
    )
  })
  it('signed out, My decks offers to sign in', async () => {
    auth.user = null
    render(<DeckPicker open onClose={() => {}} lookup={lookup} onPick={() => {}} />)
    expect(screen.getByText('picker.signedOut')).toBeTruthy()
    expect(screen.getByText('picker.signIn').closest('a')?.getAttribute('href')).toBe('/login')
    expect(listMyDecks).not.toHaveBeenCalled()
  })
})
