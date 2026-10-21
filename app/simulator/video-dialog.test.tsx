// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest'
import type { Action } from '@utils/simulator/types'
import { popupFeatures, VideoDialog } from './video-dialog'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => (values ? `${key} ${JSON.stringify(values)}` : key),
}))
vi.mock('@iconify/react', () => ({ Icon: () => null }))

const move: Action = { t: 'move', card: 0, to: 'm0' }
const draw: Action = { t: 'draw', n: 1 }
const endTurn: Action = { t: 'endTurn' }
/** `moves` steps of 1200 ms at 1x and `ends` of 700 ms. */
const line = (moves: number, ends = 0): Action[] => [...Array<Action>(moves).fill(move), ...Array<Action>(ends).fill(endTurn)]

const onClose = vi.fn()
type Props = Partial<React.ComponentProps<typeof VideoDialog>>
const mount = async (props: Props = {}) => {
  render(<VideoDialog open onClose={onClose} comboId="c1" actions={line(35)} start={0} {...props} />)
  await act(async () => {})
}
const button = (name: string) => screen.getByRole<HTMLButtonElement>('button', { name })
const pressed = (name: string) => screen.getByRole('button', { name }).getAttribute('aria-pressed')

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('VideoDialog choices', () => {
  it('opens on 16:9 at 1x', async () => {
    await mount()
    expect(pressed('16:9')).toBe('true')
    expect(pressed('9:16')).toBe('false')
    expect(pressed('1x')).toBe('true')
    expect(pressed('0.5x')).toBe('false')
  })

  it('shows the length of the timeline from the start of the replay, in seconds', async () => {
    // Two steps before `start` are not in the video: 1000 + 35 × 1200 + 2000 ms.
    await mount({ actions: [draw, draw, ...line(35)], start: 2 })
    expect(screen.getByText('video.length {"length":"~45 s"}')).toBeTruthy()
  })

  it('follows the speed, in minutes and seconds past a minute and rounding the fractions of 3x', async () => {
    await mount({ actions: line(28, 7) })
    expect(screen.getByText('video.length {"length":"~42 s"}')).toBeTruthy() // 41.5 s
    fireEvent.click(button('0.5x'))
    expect(screen.getByText('video.length {"length":"~1 min 20 s"}')).toBeTruthy()
    fireEvent.click(button('2x'))
    expect(screen.getByText('video.length {"length":"~22 s"}')).toBeTruthy()
    fireEvent.click(button('3x'))
    expect(screen.getByText('video.length {"length":"~16 s"}')).toBeTruthy() // 15 833.3 ms
  })

  it('whole minutes leave the seconds out', async () => {
    await mount({ actions: line(94, 6) }) // 3000 + 112 800 + 4200 ms
    expect(screen.getByText('video.length {"length":"~2 min"}')).toBeTruthy()
  })
})

describe('VideoDialog recording', () => {
  let open: MockInstance<typeof window.open>

  beforeEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getDisplayMedia: vi.fn() } })
    vi.stubGlobal('RestrictionTarget', { fromElement: vi.fn() })
    open = vi.spyOn(window, 'open').mockImplementation(() => ({}) as Window)
  })
  afterEach(() => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined })
    vi.restoreAllMocks()
  })

  it('popupFeatures sizes the popup to the shape', () => {
    expect(popupFeatures('landscape', 1040)).toBe('popup,width=1280,height=768')
    expect(popupFeatures('portrait', 1040)).toBe('popup,width=513,height=960')
    expect(popupFeatures('portrait', 1440)).toBe('popup,width=720,height=1328')
  })

  it('Record opens the render page in the combo-video popup', async () => {
    await mount()
    fireEvent.click(button('9:16'))
    fireEvent.click(button('2x'))
    fireEvent.click(button('video.record'))
    expect(open).toHaveBeenCalledExactlyOnceWith(
      '/simulator/c/c1/render?shape=portrait&speed=2',
      'combo-video-portrait',
      popupFeatures('portrait', window.screen.availHeight),
    )
    expect(screen.getByText('video.opened')).toBeTruthy()
  })

  it("each shape gets its own popup, so a second Record never inherits the other shape's size", async () => {
    await mount()
    fireEvent.click(button('video.record'))
    fireEvent.click(button('9:16'))
    fireEvent.click(button('video.record'))
    expect(open.mock.calls.map(([, name]) => name)).toEqual(['combo-video-landscape', 'combo-video-portrait'])
  })

  it('another choice after opening drops the note', async () => {
    await mount()
    fireEvent.click(button('video.record'))
    fireEvent.click(button('3x'))
    expect(screen.queryByText('video.opened')).toBeNull()
  })

  it('a blocked popup asks to allow pop-ups', async () => {
    open.mockReturnValueOnce(null)
    await mount()
    fireEvent.click(button('video.record'))
    expect(screen.getByText('video.popupBlocked')).toBeTruthy()
  })

  it('a browser without Element Capture gets the message instead of the button', async () => {
    vi.stubGlobal('RestrictionTarget', undefined)
    delete (globalThis as { RestrictionTarget?: unknown }).RestrictionTarget
    await mount()
    expect(screen.getByText('video.unsupported')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'video.record' })).toBeNull()
  })

  it('a browser without screen capture gets the message too', async () => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined })
    await mount()
    expect(screen.getByText('video.unsupported')).toBeTruthy()
  })
})
