// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ComboApiError, getRender, renderFileUrl, startRender, type RenderInfo } from '@utils/combos'
import type { Action } from '@utils/simulator/types'
import { VideoDialog } from './video-dialog'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => (values ? `${key} ${JSON.stringify(values)}` : key),
}))
vi.mock('@iconify/react', () => ({ Icon: () => null }))
vi.mock('@utils/combos', async (original) => ({
  ...(await original<typeof import('@utils/combos')>()),
  startRender: vi.fn(),
  getRender: vi.fn(),
  renderFileUrl: vi.fn((id: string, format: string) => `https://api.test/combos/renders/${id}/${format}`),
}))

const move: Action = { t: 'move', card: 0, to: 'm0' }
const draw: Action = { t: 'draw', n: 1 }
const endTurn: Action = { t: 'endTurn' }
/** `moves` steps of 1200 ms at 1x and `ends` of 700 ms. */
const line = (moves: number, ends = 0): Action[] => [...Array<Action>(moves).fill(move), ...Array<Action>(ends).fill(endTurn)]

const info = (over: Partial<RenderInfo> = {}): RenderInfo => ({
  id: 'r1',
  status: 'queued',
  shape: 'landscape',
  speed: 1,
  framesDone: 0,
  framesTotal: null,
  position: 0,
  expiresAt: null,
  ...over,
})

const onClose = vi.fn()
type Props = Partial<React.ComponentProps<typeof VideoDialog>>
const element = (props: Props = {}) => <VideoDialog open onClose={onClose} comboId="c1" actions={line(35)} start={0} {...props} />
const mount = async (props: Props = {}) => {
  const view = render(element(props))
  await act(async () => {})
  return { ...view, again: (next: Props) => view.rerender(element({ ...props, ...next })) }
}
const button = (name: string) => screen.getByRole<HTMLButtonElement>('button', { name })
const click = (name: string) => act(async () => void fireEvent.click(button(name)))
const tick = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)))
const pressed = (name: string) => screen.getByRole('button', { name }).getAttribute('aria-pressed')
/** A promise settled by hand, for a request that has not answered yet. */
const deferred = <T,>() => {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => (resolve = r))
  return { promise, resolve }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.mocked(startRender).mockReset()
  vi.mocked(getRender).mockReset()
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('VideoDialog choices', () => {
  it('opens on 16:9 at 1x', async () => {
    await mount()
    expect(pressed('16:9')).toBe('true')
    expect(pressed('9:16')).toBe('false')
    expect(pressed('1x')).toBe('true')
    expect(pressed('0.5x')).toBe('false')
    expect(button('video.generate')).toBeTruthy()
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

describe('VideoDialog render', () => {
  it('Generate posts the shape and the speed chosen', async () => {
    vi.mocked(startRender).mockResolvedValue(info())
    await mount()
    fireEvent.click(button('9:16'))
    fireEvent.click(button('2x'))
    await click('video.generate')
    expect(startRender).toHaveBeenCalledExactlyOnceWith('c1', { shape: 'portrait', speed: 2 })
  })

  it('goes from the queue to rendering to the two links, polling every 2 s', async () => {
    vi.mocked(startRender).mockResolvedValue(info({ position: 2 }))
    vi.mocked(getRender)
      .mockResolvedValueOnce(info({ status: 'running', framesDone: 34, framesTotal: 100 }))
      .mockResolvedValueOnce(info({ status: 'ready', framesDone: 100, framesTotal: 100, expiresAt: '2026-10-19T01:00:00Z' }))
    await mount()
    await click('video.generate')
    expect(screen.getByText('video.queued {"position":2}')).toBeTruthy()
    expect(screen.queryByRole('button', { name: 'video.generate' })).toBeNull()
    await tick(1999)
    expect(getRender).not.toHaveBeenCalled()
    await tick(1)
    expect(getRender).toHaveBeenCalledExactlyOnceWith('r1')
    expect(screen.getByText('video.running {"percent":34}')).toBeTruthy()
    await tick(2000)
    expect(getRender).toHaveBeenCalledTimes(2)
    const mp4 = screen.getByRole('link', { name: 'video.downloadMp4' })
    const webp = screen.getByRole('link', { name: 'video.downloadWebp' })
    expect(mp4.getAttribute('href')).toBe(renderFileUrl('r1', 'mp4'))
    expect(webp.getAttribute('href')).toBe(renderFileUrl('r1', 'webp'))
    expect(screen.queryByText(/video\.running/)).toBeNull()
    await tick(10_000)
    expect(getRender).toHaveBeenCalledTimes(2) // ready is the end of the polling
  })

  it('a render without a total yet shows 0%', async () => {
    vi.mocked(startRender).mockResolvedValue(info({ status: 'running' }))
    await mount()
    await click('video.generate')
    expect(screen.getByText('video.running {"percent":0}')).toBeTruthy()
  })

  it('the next poll waits for the answer to the last one: never an interval', async () => {
    vi.mocked(startRender).mockResolvedValue(info())
    const slow = deferred<RenderInfo | null>()
    vi.mocked(getRender).mockReturnValueOnce(slow.promise).mockResolvedValue(info({ status: 'running', framesDone: 1, framesTotal: 10 }))
    await mount()
    await click('video.generate')
    await tick(10_000)
    expect(getRender).toHaveBeenCalledTimes(1)
    await act(async () => slow.resolve(info({ position: 1 })))
    await tick(1999)
    expect(getRender).toHaveBeenCalledTimes(1)
    await tick(1)
    expect(getRender).toHaveBeenCalledTimes(2)
  })

  it('a render that is ready as the POST answers (made before) shows the links and never polls', async () => {
    vi.mocked(startRender).mockResolvedValue(info({ status: 'ready', framesDone: 90, framesTotal: 90, expiresAt: '2026-10-19T01:00:00Z' }))
    await mount()
    await click('video.generate')
    expect(screen.getByRole('link', { name: 'video.downloadMp4' }).getAttribute('href')).toBe(renderFileUrl('r1', 'mp4'))
    expect(screen.getByRole('link', { name: 'video.downloadWebp' }).getAttribute('href')).toBe(renderFileUrl('r1', 'webp'))
    await tick(10_000)
    expect(getRender).not.toHaveBeenCalled()
  })

  it('an answer for the choice that was dropped does not bring its render back', async () => {
    vi.mocked(startRender).mockResolvedValue(info())
    const slow = deferred<RenderInfo | null>()
    vi.mocked(getRender).mockReturnValue(slow.promise)
    await mount()
    await click('video.generate')
    await tick(2000)
    fireEvent.click(button('3x')) // the poll has not answered
    await act(async () => slow.resolve(info({ status: 'ready' })))
    await tick(10_000)
    expect(screen.queryByRole('link')).toBeNull()
    expect(button('video.generate')).toBeTruthy()
    expect(getRender).toHaveBeenCalledTimes(1)
  })

  it('changing a choice drops the render shown and offers Generate again', async () => {
    vi.mocked(startRender).mockResolvedValue(info({ status: 'ready' }))
    await mount()
    await click('video.generate')
    expect(screen.getByRole('link', { name: 'video.downloadMp4' })).toBeTruthy()
    fireEvent.click(button('3x'))
    expect(screen.queryByRole('link')).toBeNull()
    expect(button('video.generate')).toBeTruthy()
  })
})

describe('VideoDialog errors', () => {
  it('a full queue (503 QUEUE_FULL) says so', async () => {
    vi.mocked(startRender).mockRejectedValue(new ComboApiError(503, 'QUEUE_FULL'))
    await mount()
    await click('video.generate')
    expect(screen.getByText('video.queueFull')).toBeTruthy()
    expect(getRender).not.toHaveBeenCalled()
  })

  it('two renders already going (429 RENDER_BUSY) says so, and so does the rate limit (429 RATE_LIMITED)', async () => {
    vi.mocked(startRender).mockRejectedValue(new ComboApiError(429, 'RENDER_BUSY'))
    await mount()
    await click('video.generate')
    expect(screen.getByText('video.busy')).toBeTruthy()
    vi.mocked(startRender).mockRejectedValue(new ComboApiError(429, 'RATE_LIMITED'))
    await click('video.tryAgain')
    expect(screen.getByText('video.busy')).toBeTruthy()
  })

  it('any other failure of the POST is the generic one, and Try again posts again', async () => {
    vi.mocked(startRender).mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValue(info({ position: 1 }))
    await mount()
    await click('video.generate')
    expect(screen.getByText('video.failed')).toBeTruthy()
    await click('video.tryAgain')
    expect(startRender).toHaveBeenCalledTimes(2)
    expect(screen.getByText('video.queued {"position":1}')).toBeTruthy()
    expect(screen.queryByText('video.failed')).toBeNull()
  })

  it('a render that failed says so, and Try again posts again', async () => {
    vi.mocked(startRender).mockResolvedValueOnce(info()).mockResolvedValue(info({ id: 'r2', position: 0 }))
    vi.mocked(getRender).mockResolvedValueOnce(info({ status: 'failed' }))
    await mount()
    await click('video.generate')
    await tick(2000)
    expect(screen.getByText('video.failed')).toBeTruthy()
    await tick(10_000)
    expect(getRender).toHaveBeenCalledTimes(1) // failed is the end of the polling
    await click('video.tryAgain')
    expect(startRender).toHaveBeenCalledTimes(2)
    expect(startRender).toHaveBeenLastCalledWith('c1', { shape: 'landscape', speed: 1 })
    expect(screen.getByText('video.queued {"position":0}')).toBeTruthy()
  })

  it('a poll that cannot reach the API ends in the generic failure', async () => {
    vi.mocked(startRender).mockResolvedValue(info())
    vi.mocked(getRender).mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await mount()
    await click('video.generate')
    await tick(2000)
    expect(screen.getByText('video.failed')).toBeTruthy()
    await tick(10_000)
    expect(getRender).toHaveBeenCalledTimes(1)
  })

  it('a render that expired (404 on the poll) goes back to Generate', async () => {
    vi.mocked(startRender).mockResolvedValue(info())
    vi.mocked(getRender).mockResolvedValue(null)
    await mount()
    await click('video.generate')
    await tick(2000)
    expect(button('video.generate')).toBeTruthy()
    expect(screen.queryByText(/video\.(queued|running|failed)/)).toBeNull()
    await tick(10_000)
    expect(getRender).toHaveBeenCalledTimes(1)
  })
})

describe('VideoDialog closing', () => {
  it('stops the polling: no request after the dialog closes', async () => {
    vi.mocked(startRender).mockResolvedValue(info())
    vi.mocked(getRender).mockResolvedValue(info({ status: 'running', framesDone: 1, framesTotal: 10 }))
    const { again } = await mount()
    await click('video.generate')
    await tick(2000)
    expect(getRender).toHaveBeenCalledTimes(1)
    again({ open: false })
    await tick(10_000)
    expect(getRender).toHaveBeenCalledTimes(1)
  })

  it('stops the polling when the dialog goes away with the page', async () => {
    vi.mocked(startRender).mockResolvedValue(info())
    vi.mocked(getRender).mockResolvedValue(info({ status: 'running', framesDone: 1, framesTotal: 10 }))
    const { unmount } = await mount()
    await click('video.generate')
    unmount()
    await tick(10_000)
    expect(getRender).not.toHaveBeenCalled()
  })

  it('an answer that arrives after the close starts nothing', async () => {
    const post = deferred<RenderInfo>()
    const poll = deferred<RenderInfo | null>()
    vi.mocked(startRender).mockReturnValue(post.promise)
    vi.mocked(getRender).mockReturnValue(poll.promise)
    const { again } = await mount()
    await click('video.generate') // the POST has not answered
    again({ open: false })
    await act(async () => post.resolve(info()))
    await tick(10_000)
    expect(getRender).not.toHaveBeenCalled()

    // And a poll that has not answered when it closes.
    vi.mocked(startRender).mockResolvedValue(info())
    again({ open: true })
    await click('video.generate')
    await tick(2000)
    expect(getRender).toHaveBeenCalledTimes(1)
    again({ open: false })
    await act(async () => poll.resolve(info({ position: 1 })))
    await tick(10_000)
    expect(getRender).toHaveBeenCalledTimes(1)
  })

  it('opens again on the defaults and Generate: the POST hands back the render of the same choices', async () => {
    vi.mocked(startRender).mockResolvedValue(info({ status: 'ready' }))
    const { again } = await mount()
    fireEvent.click(button('9:16'))
    await click('video.generate')
    again({ open: false })
    again({ open: true })
    expect(pressed('16:9')).toBe('true')
    expect(screen.queryByRole('link')).toBeNull()
    expect(button('video.generate')).toBeTruthy()
  })

  it('the close button asks the page to close', async () => {
    await mount()
    fireEvent.click(button('Close'))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
