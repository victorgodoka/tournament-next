// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toYdke } from '@utils/deck/codecs/ydke'
import { listMyDecks } from '@utils/decks'
import Simulator from './simulator.client'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn() }) }))
vi.mock('next/image', () => ({ default: () => null }))
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
  useFormatter: () => ({ relativeTime: () => 'now' }),
  useNow: () => new Date(),
}))
vi.mock('@hooks/index', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }))
vi.mock('@utils/cards', () => ({ cardsByIds: vi.fn(async () => new Map()) }))
vi.mock('@utils/decks', async (original) => ({ ...(await original<typeof import('@utils/decks')>()), listMyDecks: vi.fn() }))

const DECK = `/simulator?d=${encodeURIComponent(toYdke({ main: [1, 2, 3, 4, 5, 6], extra: [7], side: [] }))}`

const wait = (ms: number) =>
  act(async () => {
    await new Promise((r) => setTimeout(r, ms))
  })

/** Renders the simulator at `url` and lets the boot and card lookups settle. */
const open = async (url: string) => {
  window.history.replaceState(null, '', url)
  render(<Simulator />)
  await wait(50)
}

const zone = (key: string) => screen.getByRole('group', { name: `zones.${key}` })
const hand = () => within(zone('hand')).queryAllByRole('button')
const button = (name: string) => screen.getByRole<HTMLButtonElement>('button', { name })
const click = (name: string) => act(async () => fireEvent.click(button(name)))

beforeEach(() => {
  // Node's own (flagged) localStorage shadows happy-dom's: each test gets a fresh one in memory.
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) })
  vi.mocked(listMyDecks).mockResolvedValue({ decks: [], nextCursor: null })
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('Simulator', () => {
  it('New hand draws 5 from the deck in the URL', async () => {
    await open(DECK)
    expect(hand()).toHaveLength(0)
    await click('toolbar.newHand')
    expect(hand()).toHaveLength(5)
    expect(within(zone('deck')).getByText('1')).toBeTruthy()
  })

  it('Draw 1 adds a card and Undo takes it back', async () => {
    await open(DECK)
    expect(button('toolbar.undo').disabled).toBe(true)
    await click('toolbar.newHand')
    await click('toolbar.draw')
    expect(hand()).toHaveLength(6)
    await click('toolbar.undo')
    expect(hand()).toHaveLength(5)
    await click('toolbar.undo') // the draw of 5
    await click('toolbar.undo') // the shuffle: back at cursor 0
    expect(hand()).toHaveLength(0)
    expect(button('toolbar.undo').disabled).toBe(true)
  })

  it('New hand asks to confirm once the session has more than draws', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await click('toolbar.newHand') // only shuffles and draws so far: no question
    expect(screen.queryByText('confirm.title')).toBeNull()
    await click('toolbar.endTurn')
    await click('toolbar.newHand')
    expect(screen.getByText('confirm.title')).toBeTruthy()
    await click('confirm.cancel')
    expect(screen.queryByText('confirm.title')).toBeNull()
    await click('toolbar.newHand') // the end of turn is still there, so it asks again
    expect(screen.getByText('confirm.title')).toBeTruthy()
    await click('confirm.discard')
    expect(screen.queryByText('confirm.title')).toBeNull()
    expect(hand()).toHaveLength(5)
    await click('toolbar.newHand') // a fresh hand holds only a shuffle and a draw
    expect(screen.queryByText('confirm.title')).toBeNull()
  })

  it('the draft survives a reload without ?d=', async () => {
    await open(DECK)
    await click('toolbar.newHand')
    await wait(350) // the draft is written 300 ms after the change
    cleanup()
    await open('/simulator')
    expect(hand()).toHaveLength(5)
  })

  it('a damaged ?d= shows damagedLink', async () => {
    await open('/simulator?d=garbage!!')
    expect(screen.getByText('damagedLink')).toBeTruthy()
  })
})
