// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useAuth } from '@contexts/auth/auth.context'
import { getCombo, type SharedCombo } from '@utils/combos'
import { DRAFT_KEY } from '@utils/simulator/draft'
import { ComboPlayer } from './combo-player'

const { push } = vi.hoisted(() => ({ push: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ push, replace: vi.fn() }) }))
vi.mock('next/image', () => ({ default: () => null }))
// The values ride along, so a countdown shows its number.
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => (values ? `${key} ${JSON.stringify(values)}` : key),
}))
vi.mock('@contexts/auth/auth.context', () => ({ useAuth: vi.fn() }))
vi.mock('@utils/cards', () => ({ cardsByIds: vi.fn(async () => new Map()) }))
vi.mock('@utils/combos', async (original) => ({ ...(await original<typeof import('@utils/combos')>()), getCombo: vi.fn() }))

/** Three steps, the replay starting at the third: draw 2, a monster to the field, end of turn. */
const combo = (over: Partial<SharedCombo> = {}): SharedCombo => ({
  id: 'c1',
  title: 'Opening line',
  deckId: null,
  owner: { id: 'u1', name: 'Ana' },
  revision: 3,
  updatedAt: '2026-10-19T00:00:00Z',
  payload: {
    deck: { main: [1, 2, 3, 4, 5, 6], extra: [7], side: [] },
    name: 'Test deck',
    actions: [{ t: 'draw', n: 2, note: 'Open' }, { t: 'move', card: 0, to: 'm0' }, { t: 'endTurn' }],
    start: 2,
  },
  ...over,
})

let store: Map<string, string>

/** Renders the player and lets the combo arrive (fake timers or not: only promises run here). */
const open = async () => {
  render(<ComboPlayer id="c1" />)
  await act(async () => {})
}
const button = (name: string) => screen.getByRole<HTMLButtonElement>('button', { name })
const click = (name: string) => act(async () => void fireEvent.click(button(name)))
const tick = (ms: number) => act(async () => void vi.advanceTimersByTime(ms))
const cursor = () => Number(screen.getByRole<HTMLInputElement>('slider', { name: 'replay.timeline' }).value)
const draft = () => JSON.parse(store.get(DRAFT_KEY)!)

beforeEach(() => {
  store = new Map()
  vi.stubGlobal('localStorage', { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v) })
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
  // `clearAllMocks` keeps implementations: a promise left hanging by one test must not reach the next.
  vi.mocked(getCombo).mockReset()
  vi.mocked(getCombo).mockResolvedValue(combo())
  vi.mocked(useAuth).mockReturnValue({ user: { id: 'u2' } } as ReturnType<typeof useAuth>)
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.clearAllMocks()
  vi.unstubAllGlobals()
})

describe('ComboPlayer', () => {
  it('a combo that does not exist says so', async () => {
    vi.mocked(getCombo).mockResolvedValue(null)
    await open()
    expect(getCombo).toHaveBeenCalledWith('c1')
    expect(screen.getByText('player.notFound')).toBeTruthy()
  })

  it('a combo with a step that cannot be played on its board is damaged', async () => {
    // Shape-valid, but the second draw finds the deck empty.
    vi.mocked(getCombo).mockResolvedValue(combo({ payload: { ...combo().payload, actions: [{ t: 'draw', n: 6 }, { t: 'draw', n: 1 }], start: 0 } }))
    await open()
    expect(screen.getByText('player.damaged')).toBeTruthy()
    expect(screen.queryByRole('slider')).toBeNull()
  })

  it('a network error offers Retry, which reads the combo again', async () => {
    vi.mocked(getCombo).mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await open()
    expect(screen.getByText('player.failed')).toBeTruthy()
    await click('retry')
    await act(async () => {})
    expect(getCombo).toHaveBeenCalledTimes(2)
    expect(screen.getByRole('heading', { name: 'Opening line' })).toBeTruthy()
  })

  it('shows the title, counts down from 3, then plays from start', async () => {
    vi.useFakeTimers()
    await open()
    expect(screen.getByRole('heading', { name: 'Opening line' })).toBeTruthy()
    expect(screen.getByText('player.by {"name":"Ana"}')).toBeTruthy()
    expect(cursor()).toBe(2)
    expect(screen.getByText('player.autoplay {"n":3}')).toBeTruthy()
    await tick(1000)
    expect(screen.getByText('player.autoplay {"n":2}')).toBeTruthy()
    await tick(1000) // a second per act: each one schedules the next once it renders
    expect(screen.getByText('player.autoplay {"n":1}')).toBeTruthy()
    await tick(1000)
    expect(screen.queryByText(/player\.autoplay/)).toBeNull()
    expect(button('replay.pause')).toBeTruthy()
    expect(cursor()).toBe(2)
    await tick(1200) // the move on screen stays 1.2 s
    expect(cursor()).toBe(3)
    expect(button('replay.play')).toBeTruthy() // the last step ends the replay
  })

  it('an owner with no name shows no "by" lead', async () => {
    vi.mocked(getCombo).mockResolvedValue(combo({ owner: { id: 'u1', name: null } }))
    await open()
    expect(screen.getByRole('heading', { name: 'Opening line' })).toBeTruthy()
    expect(screen.queryByText(/player\.by/)).toBeNull()
  })

  it('Play now skips the countdown', async () => {
    vi.useFakeTimers()
    await open()
    await click('player.playNow')
    expect(screen.queryByText(/player\.autoplay/)).toBeNull()
    expect(button('replay.pause')).toBeTruthy()
  })

  it('Cancel stops the countdown', async () => {
    vi.useFakeTimers()
    await open()
    await click('player.cancel')
    expect(screen.queryByText(/player\.autoplay/)).toBeNull()
    await tick(5000)
    expect(button('replay.play')).toBeTruthy()
    expect(cursor()).toBe(2)
  })

  it('the caption of the step on screen shows as text', async () => {
    await open()
    await click('player.cancel')
    expect(screen.queryByText('Open', { selector: 'p' })).toBeNull() // the move on screen has none
    await click('replay.prev')
    expect(cursor()).toBe(1)
    expect(screen.getByText('Open', { selector: 'p' })).toBeTruthy()
    expect(screen.queryByRole('textbox')).toBeNull()
  })

  it('Operate from here writes the line up to the step on screen and opens the simulator', async () => {
    await open()
    await click('player.cancel')
    await click('replay.prev')
    expect(cursor()).toBe(1)
    await click('player.operate')
    expect(screen.queryByText('confirm.title')).toBeNull() // no draft to ask about
    const saved = draft()
    expect(saved.actions).toHaveLength(1)
    expect(saved.cursor).toBe(1)
    expect(saved.start).toBe(1) // min(start 2, k 1)
    expect(saved.combo).toBeNull()
    expect(push).toHaveBeenCalledWith('/simulator')
  })

  it('Operate from here asks first when the stored draft has actions', async () => {
    store.set(DRAFT_KEY, JSON.stringify({ v: 2, ...combo().payload, cursor: 3, deckId: null, combo: null }))
    await open()
    await click('player.cancel')
    await click('player.operate')
    expect(screen.getByText('confirm.title')).toBeTruthy()
    expect(push).not.toHaveBeenCalled()
    await click('confirm.discard')
    expect(draft().actions).toHaveLength(2) // the step on screen: start
    expect(push).toHaveBeenCalledWith('/simulator')
  })

  it('Download video shows for a signed-out viewer, and opens the dialog', async () => {
    vi.mocked(useAuth).mockReturnValue({ user: null } as ReturnType<typeof useAuth>)
    await open()
    await click('player.cancel')
    expect(screen.queryByRole('heading', { name: 'video.title' })).toBeNull()
    await click('video.open')
    expect(screen.getByRole('heading', { name: 'video.title' })).toBeTruthy()
    expect(screen.getByText('video.unsupported')).toBeTruthy() // happy-dom has no screen capture
  })

  it('Edit shows only for the owner, and loads the combo tied to it', async () => {
    await open()
    expect(screen.queryByRole('button', { name: 'player.edit' })).toBeNull()
    cleanup()

    vi.mocked(useAuth).mockReturnValue({ user: { id: 'u1' } } as ReturnType<typeof useAuth>)
    await open()
    await click('player.edit')
    const saved = draft()
    expect(saved.actions).toHaveLength(3)
    expect(saved.combo).toMatchObject({ id: 'c1', title: 'Opening line', revision: 3 })
    expect(push).toHaveBeenCalledWith('/simulator')
  })
})
