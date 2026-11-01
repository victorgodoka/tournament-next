// @vitest-environment happy-dom
import { act, cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cardsByIds } from '@utils/cards'
import { getCombo, type SharedCombo } from '@utils/combos'
import type { CardData } from '@utils/deck/types'
import { renderTimeline } from '@utils/simulator/timing'
import { ComboRender, type RenderHandle } from './combo-render'

// A real <img>, so the page has images to decode.
// eslint-disable-next-line @next/next/no-img-element
vi.mock('next/image', () => ({ default: ({ src, sizes }: { src: string; sizes: string }) => <img src={src} sizes={sizes} alt="" /> }))
vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => (values ? `${key} ${JSON.stringify(values)}` : key),
}))
vi.mock('@utils/cards', () => ({ cardsByIds: vi.fn(async () => new Map()) }))
vi.mock('@utils/combos', async (original) => ({ ...(await original<typeof import('@utils/combos')>()), getCombo: vi.fn() }))

/** Four steps, the replay starting at the third (as Task 5's timeline): two draws, a monster to the field, end of turn. */
const actions = [{ t: 'draw', n: 1 }, { t: 'draw', n: 1, note: 'Open' }, { t: 'move', card: 0, to: 'm0' }, { t: 'endTurn' }] as const
const combo = (over: Partial<SharedCombo> = {}): SharedCombo => ({
  id: 'c1',
  title: 'Opening line',
  deckId: null,
  owner: { id: 'u1', name: 'Ana' },
  revision: 3,
  updatedAt: '2026-10-19T00:00:00Z',
  payload: { deck: { main: [1, 2, 3, 4, 5, 6], extra: [7], side: [] }, name: 'Test deck', actions: [...actions], start: 2 },
  ...over,
})

type Stub = { pause: ReturnType<typeof vi.fn>; currentTime: number | null }
const stub = (): Stub => ({ pause: vi.fn(), currentTime: null })
/** What `document.getAnimations()` returns: a glow and a slide already running, and whatever `animate` starts. */
let animations: Stub[]
/** What the page handed to `onReady`. */
let handle: RenderHandle | undefined

const open = async (speed: 0.5 | 1 | 2 | 3 = 1) => {
  render(<ComboRender id="c1" speed={speed} onReady={(h) => (handle = h)} />)
  await act(async () => {})
}
const page = () => handle!
const seek = (ms: number) => act(() => page().seek(ms))
const inM0 = () => within(screen.getByRole('group', { name: 'zones.m0' })).queryByRole('button')
/**
 * A layout for `getBoundingClientRect`, happy-dom having none. Every zone spans the whole board at the probe width,
 * 724 × 640, the caption (a 16 px gap, then 48 px) under it, and the room around both is 1200 × 624: the board has
 * 560 px of it, so it fits at 87px (97px if the caption were left out). A card button is one card wide at the board's
 * `--card-w`, in the hand row (4 widths down) or in m0, so where it is shows the width it was measured at.
 */
function layout(this: Element) {
  if (this.hasAttribute('data-card')) {
    const w = parseFloat((this.closest('[style*="--card-w"]') as HTMLElement).style.getPropertyValue('--card-w'))
    const hand = this.closest('[data-zone]')!.getAttribute('data-zone') === 'hand'
    return hand ? new DOMRect(0, 4 * w, w, w) : new DOMRect(w, w, w, w)
  }
  if (this.hasAttribute('data-zone')) return new DOMRect(0, 0, 724, 640)
  return this.tagName === 'P' ? new DOMRect(0, 656, 1200, 48) : new DOMRect(0, 0, 1200, 624)
}
/** Whether `p` has settled by the time pending work has run. */
const settled = async (p: Promise<unknown>) => {
  let done = false
  p.then(
    () => (done = true),
    () => (done = true),
  )
  await act(async () => {})
  return done
}

beforeEach(() => {
  animations = [stub(), stub()]
  handle = undefined
  Object.defineProperty(document, 'getAnimations', { configurable: true, value: () => animations })
  Object.defineProperty(document, 'fonts', { configurable: true, value: { ready: Promise.resolve() } })
  Element.prototype.animate = vi.fn(() => {
    const a = stub()
    animations.push(a)
    return a as unknown as Animation
  })
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }))
  vi.mocked(getCombo).mockReset()
  vi.mocked(getCombo).mockResolvedValue(combo())
})
afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('ComboRender', () => {
  it('shows the title strip, the board, the caption and the step counter, and nothing to operate', async () => {
    await open()
    expect(getCombo).toHaveBeenCalledWith('c1')
    expect(screen.getByRole('heading', { name: 'Opening line' })).toBeTruthy()
    expect(screen.getByText('player.by {"name":"Ana"}')).toBeTruthy()
    expect(screen.getByText('render.brand')).toBeTruthy()
    expect(screen.getByText('Open')).toBeTruthy() // the caption of the step on screen, the second draw
    expect(screen.getByText('2/4')).toBeTruthy()
    expect(screen.getByRole('group', { name: 'zones.hand' })).toBeTruthy()
    expect(screen.queryByRole('group', { name: 'replay.label' })).toBeNull()
    expect(screen.queryByRole('slider')).toBeNull()
    expect(screen.queryByRole('button', { name: 'player.operate' })).toBeNull()
    expect(screen.queryByText(/player\.autoplay/)).toBeNull()
  })

  it('an owner with no name shows no "by"', async () => {
    vi.mocked(getCombo).mockResolvedValue(combo({ owner: { id: 'u1', name: null } }))
    await open()
    expect(screen.getByRole('heading', { name: 'Opening line' })).toBeTruthy()
    expect(screen.queryByText(/player\.by/)).toBeNull()
  })

  it('fits the board to the room the caption leaves it and asks for its images at that width', async () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(layout)
    await open()
    const root = screen.getByRole('group', { name: 'zones.hand' }).parentElement!
    expect(root.style.getPropertyValue('--card-w')).toBe('87px')
    expect(root.nextElementSibling).toBe(screen.getByText('Open')) // the caption, right under the board
    expect(document.querySelector('[data-zone="deck"] img[src="/back.webp"]')!.getAttribute('sizes')).toBe('87px')
  })

  it('the first slide starts where the card was at the fitted width, not the probe', async () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(layout)
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener() {}, removeEventListener() {} }))
    await open()
    await page().ready
    await seek(1000) // the move: card 0 slides from the hand to m0
    // At 87px the hand's centre is (43.5, 391.5); the probe's 100px would put it at (50, 450).
    const flights = vi.mocked(Element.prototype.animate).mock.calls.map(([keyframes]) => (keyframes as Keyframe[])[0]!.transform)
    expect(flights).toContainEqual(expect.stringContaining('translate(43.5px, 391.5px)'))
  })

  it('ready gives the title and the length of the video at its speed', async () => {
    await open(2)
    await expect(page().ready).resolves.toEqual({ title: 'Opening line', durationMs: renderTimeline([...actions], 2, 2).durationMs })
  })

  it('calls onReady once, however often the parent re-renders with a new callback', async () => {
    const onReady = vi.fn()
    const view = render(<ComboRender id="c1" speed={1} onReady={onReady} />)
    await act(async () => {})
    view.rerender(<ComboRender id="c1" speed={1} onReady={(h) => onReady(h)} />)
    await act(async () => {})
    expect(onReady).toHaveBeenCalledTimes(1)
  })

  it('ready waits for every image to decode', async () => {
    const decoding = Promise.withResolvers<void>()
    vi.spyOn(HTMLImageElement.prototype, 'decode').mockReturnValue(decoding.promise)
    await open()
    expect(document.querySelectorAll('img').length).toBeGreaterThan(0)
    expect(await settled(page().ready)).toBe(false)
    decoding.resolve()
    expect(await settled(page().ready)).toBe(true)
  })

  it('an image that fails to decode does not hold ready back', async () => {
    vi.spyOn(HTMLImageElement.prototype, 'decode').mockRejectedValueOnce(new Error('404')).mockResolvedValue(undefined)
    await open()
    await expect(page().ready).resolves.toMatchObject({ title: 'Opening line' })
  })

  it('ready rejects for a combo that does not exist', async () => {
    vi.mocked(getCombo).mockResolvedValue(null)
    await open()
    await expect(page().ready).rejects.toThrow()
  })

  it('ready rejects for a damaged combo', async () => {
    // Shape-valid, but the second draw finds the deck empty.
    vi.mocked(getCombo).mockResolvedValue(combo({ payload: { ...combo().payload, actions: [{ t: 'draw', n: 6 }, { t: 'draw', n: 1 }], start: 0 } }))
    await open()
    await expect(page().ready).rejects.toThrow()
  })

  it('seek jumps to the step at that time and holds every animation at the time inside it', async () => {
    await open()
    await page().ready
    const counter = screen.getByText('2/4')
    /** Every count the counter showed before its last: the observer runs late, so it reads what each change replaced. */
    const shown: (string | null)[] = []
    new MutationObserver((changes) => shown.push(...changes.map((c) => c.oldValue))).observe(counter, {
      characterData: true,
      characterDataOldValue: true,
      subtree: true,
    })

    await seek(500) // the opening hold
    expect(counter.textContent).toBe('2/4')
    expect(inM0()).toBeNull()
    for (const a of animations) expect(a.currentTime).toBe(0)

    await seek(2900) // 700 ms into the end of turn: past the whole move
    expect(counter.textContent).toBe('4/4')
    expect(shown).toEqual(['2/4']) // one change, straight from 2 to 4
    expect(inM0()).toBeTruthy()
    expect(screen.queryByText('Open')).toBeNull()
    for (const a of animations) {
      expect(a.pause).toHaveBeenCalled()
      expect(a.currentTime).toBe(700)
    }
  })

  it('a seek that changes the step waits for the images the step mounts', async () => {
    // Card 0 (passcode 1) has its scan: moved from the hand to m0, it mounts a new <img> there.
    vi.mocked(cardsByIds).mockResolvedValueOnce(new Map([[1, { id: 1, kind: 'spell', name: 'Pot', monsterTypes: [] } as unknown as CardData]]))
    await open()
    await page().ready
    const before = new Set(document.querySelectorAll('img'))
    const decoding = Promise.withResolvers<void>()
    let asked = false
    vi.spyOn(HTMLImageElement.prototype, 'decode').mockImplementation(function (this: HTMLImageElement) {
      if (before.has(this)) return Promise.resolve()
      asked = true
      return decoding.promise
    })
    let seeking!: Promise<void>
    await act(async () => {
      seeking = page().seek(2900)
    })
    await vi.waitFor(() => expect(asked).toBe(true)) // past the two frames, at the new scan
    expect(inM0()!.querySelector('img')).toBeTruthy()
    expect(await settled(seeking)).toBe(false)
    expect(animations[0]!.pause).not.toHaveBeenCalled()
    decoding.resolve()
    expect(await settled(seeking)).toBe(true)
    for (const a of animations) expect(a.currentTime).toBe(700)
  })

  it('seek never goes back', async () => {
    await open()
    await page().ready
    await seek(1000)
    await expect(page().seek(999)).rejects.toThrow()
    await seek(1000) // the same time again is not back
  })
})
