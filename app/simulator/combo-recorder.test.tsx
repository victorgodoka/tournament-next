// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { RenderHandle } from './combo-render'
import { ComboRecorder, frameBox, videoName } from './combo-recorder'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) => (values ? `${key} ${JSON.stringify(values)}` : key),
}))
vi.mock('@iconify/react', () => ({ Icon: () => null }))

/** Every frame the recorder mounted, in order: the preview first, then one per take. */
const state = vi.hoisted(() => ({
  handles: [] as { ready: Promise<{ title: string; durationMs: number }>; seek: ReturnType<typeof import('vitest').vi.fn> }[],
  /** Frames from this index on fail to load. */
  failFrom: Infinity,
}))

// The frame itself is `ComboRender`'s business (its own tests): here it only hands a handle the test watches.
vi.mock('./combo-render', async () => {
  const { useEffect } = await import('react')
  return {
    ComboRender: ({ onReady }: { onReady(handle: RenderHandle): void }) => {
      useEffect(() => {
        const index = state.handles.length
        const ready = index >= state.failFrom ? Promise.reject(new Error('combo not found')) : Promise.resolve({ title: 'Opening line', durationMs: 3000 })
        ready.catch(() => {})
        const handle = { ready, seek: vi.fn(async () => {}) }
        state.handles.push(handle)
        onReady(handle)
        // Once per mount, as the real one (its `onReady` is an effect event).
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [])
      return <div data-testid="render" />
    },
  }
})

type Track = EventTarget & { stop: ReturnType<typeof vi.fn>; restrictTo: ReturnType<typeof vi.fn> }
let track: Track
let getDisplayMedia: ReturnType<typeof vi.fn>
let fromElement: ReturnType<typeof vi.fn>
let supported: string[]
let hidden: boolean
let urls: number
/** What the recorder hands over when it stops. */
let recorded: BlobPart[]

class FakeRecorder {
  static instances: FakeRecorder[] = []
  static isTypeSupported = (type: string) => supported.includes(type)
  state: RecordingState = 'inactive'
  ondataavailable: ((event: { data: Blob }) => void) | null = null
  onstop: (() => void) | null = null
  onerror: ((event: Event) => void) | null = null
  constructor(
    public stream: unknown,
    public options: MediaRecorderOptions,
  ) {
    FakeRecorder.instances.push(this)
  }
  start = vi.fn(() => void (this.state = 'recording'))
  pause = vi.fn(() => void (this.state = 'paused'))
  resume = vi.fn(() => void (this.state = 'recording'))
  stop = vi.fn(() => {
    this.state = 'inactive'
    this.ondataavailable?.({ data: new Blob(recorded) })
    this.onstop?.()
  })
}

const OPTIONS = {
  video: { frameRate: 30 },
  audio: false,
  preferCurrentTab: true,
  selfBrowserSurface: 'include',
  surfaceSwitching: 'exclude',
  monitorTypeSurfaces: 'exclude',
}

const mount = async () => {
  render(<ComboRecorder id="c1" shape="landscape" speed={1} />)
  await act(async () => {})
}
const button = (name: string) => screen.getByRole<HTMLButtonElement>('button', { name })
const click = (name: string) => act(async () => void fireEvent.click(button(name)))
const tick = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)))
/** The `seek` times of the frame mounted `index`-th. */
const seeks = (index: number) => state.handles[index]!.seek.mock.calls.map(([ms]) => ms as number)
const setHidden = (value: boolean) =>
  act(async () => {
    hidden = value
    document.dispatchEvent(new Event('visibilitychange'))
  })
/** A take to its end: the 500 ms for the sharing bar, the 3 s replay, the 300 ms hold and a few frames to spare. */
const recordToTheEnd = async () => {
  await click('render.record')
  await tick(500)
  await tick(3400)
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance', 'Date'] })
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(performance.now()), 16))
  state.handles = []
  state.failFrom = Infinity
  FakeRecorder.instances = []
  recorded = ['frames']
  supported =['video/mp4;codecs=avc1.640028', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm']
  track = Object.assign(new EventTarget(), { stop: vi.fn(), restrictTo: vi.fn(async () => {}) })
  getDisplayMedia = vi.fn(async () => ({ getVideoTracks: () => [track], getTracks: () => [track] }))
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getDisplayMedia } })
  fromElement = vi.fn(async (el: Element) => ({ el }))
  vi.stubGlobal('RestrictionTarget', { fromElement })
  vi.stubGlobal('MediaRecorder', FakeRecorder)
  urls = 0
  Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn(() => `blob:${++urls}`) })
  Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() })
  hidden = false
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden })
})
afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('frameBox and videoName', () => {
  it('frameBox fits the shape inside the viewport', () => {
    expect(frameBox('landscape', 1280, 720)).toEqual({ w: 1280, h: 720 })
    expect(frameBox('landscape', 1280, 680)).toEqual({ w: 1208, h: 679 })
    expect(frameBox('portrait', 720, 1240)).toEqual({ w: 697, h: 1239 })
  })

  it('videoName keeps letters, digits, spaces, - and _', () => {
    expect(videoName('Opening line')).toBe('Opening line')
    expect(videoName('Ação Rápida!')).toBe('Ação Rápida')
    expect(videoName('Ação Rápida!'.normalize('NFD'))).toBe('Ação Rápida'.normalize('NFD'))
    expect(videoName('../a/b?')).toBe('ab')
    expect(videoName('???')).toBe('combo')
    expect(videoName('x'.repeat(100))).toHaveLength(80)
  })
})

describe('ComboRecorder', () => {
  it('idle shows the hint and Record over a preview of the frame', async () => {
    await mount()
    expect(screen.getByText('render.hint')).toBeTruthy()
    expect(button('render.record').disabled).toBe(false)
    expect(screen.getByTestId('render')).toBeTruthy()
    expect(getDisplayMedia).not.toHaveBeenCalled()
  })

  it("Record captures this tab with the spec's options, restricts it to the frame and records MP4 at 8 Mbps", async () => {
    await mount()
    await click('render.record')
    await tick(500)
    expect(getDisplayMedia).toHaveBeenCalledTimes(1)
    expect(getDisplayMedia).toHaveBeenCalledWith(OPTIONS)
    const frame = screen.getByTestId('render').parentElement!
    expect(frame.style.isolation).toBe('isolate')
    expect(fromElement).toHaveBeenCalledWith(frame)
    expect(track.restrictTo).toHaveBeenCalledWith({ el: frame })
    const [recorder] = FakeRecorder.instances
    expect(recorder!.options).toEqual({ mimeType: 'video/mp4;codecs=avc1.640028', videoBitsPerSecond: 8_000_000 })
    expect(recorder!.start).toHaveBeenCalledWith(1000)
    expect(screen.getByText(/render\.recording/)).toBeTruthy()
  })

  it('plays the timeline to the end, then offers the file', async () => {
    await mount()
    await recordToTheEnd()
    const times = seeks(1) // the take's frame, not the preview's
    expect(times.at(-1)).toBe(3000)
    expect(times).toEqual([...times].sort((a, b) => a - b))
    expect(FakeRecorder.instances[0]!.stop).toHaveBeenCalled()
    expect(track.stop).toHaveBeenCalled()
    const link = screen.getByRole('link', { name: 'render.download {"format":"MP4"}' })
    expect(link.getAttribute('download')).toBe('Opening line.mp4')
    expect(link.getAttribute('href')).toBe('blob:1')
  })

  it('falls back to WebM where MP4 recording is missing', async () => {
    supported = ['video/webm;codecs=vp9']
    await mount()
    await recordToTheEnd()
    expect(FakeRecorder.instances[0]!.options.mimeType).toBe('video/webm;codecs=vp9')
    const link = screen.getByRole('link', { name: 'render.download {"format":"WebM"}' })
    expect(link.getAttribute('download')).toBe('Opening line.webm')
  })

  it('a cancelled prompt goes back to idle without a message', async () => {
    getDisplayMedia.mockRejectedValueOnce(new DOMException('', 'NotAllowedError'))
    await mount()
    await click('render.record')
    expect(button('render.record').disabled).toBe(false)
    expect(screen.queryByText(/render\.(failed|stopped|loadFailed)/)).toBeNull()
  })

  it('sharing stopped mid-recording says it was interrupted and offers no file', async () => {
    await mount()
    await click('render.record')
    await tick(1500)
    await act(async () => void track.dispatchEvent(new Event('ended')))
    await tick(3000)
    expect(screen.getByText('render.stopped')).toBeTruthy()
    expect(FakeRecorder.instances[0]!.stop).toHaveBeenCalled()
    expect(screen.queryByRole('link')).toBeNull()
    expect(button('render.record').disabled).toBe(false)
  })

  it('sharing stopped before the recording starts builds no recorder', async () => {
    await mount()
    await click('render.record')
    await tick(200) // still waiting for the sharing bar
    await act(async () => void track.dispatchEvent(new Event('ended')))
    await tick(1000)
    expect(FakeRecorder.instances).toHaveLength(0)
    expect(screen.getByText('render.stopped')).toBeTruthy()
  })

  it('a combo that does not load says so, in the preview and in a take', async () => {
    state.failFrom = 1 // the preview loads, the take does not
    await mount()
    expect(screen.queryByText('render.loadFailed')).toBeNull()
    await click('render.record')
    await tick(500)
    expect(screen.getByText('render.loadFailed')).toBeTruthy()
    expect(track.stop).toHaveBeenCalled()
    expect(FakeRecorder.instances).toHaveLength(0)

    cleanup()
    state.handles = []
    state.failFrom = 0
    await mount()
    expect(screen.getByText('render.loadFailed')).toBeTruthy()
  })

  it('restrictTo failing says the video could not be recorded and stops the capture', async () => {
    track.restrictTo.mockRejectedValueOnce(new Error('not a stacking context'))
    await mount()
    await click('render.record')
    await tick(500)
    expect(screen.getByText('render.failed')).toBeTruthy()
    expect(track.stop).toHaveBeenCalled()
    expect(FakeRecorder.instances).toHaveLength(0)
  })

  it('an encoder error mid-take says the video could not be recorded and offers no file', async () => {
    await mount()
    await click('render.record')
    await tick(1500)
    const recorder = FakeRecorder.instances[0]!
    // Chrome stops the recorder itself, then reports the error.
    await act(async () => {
      recorder.state = 'inactive'
      recorder.onerror?.(new Event('error'))
    })
    await tick(3000)
    expect(screen.getByText('render.failed')).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
    expect(track.stop).toHaveBeenCalled()
  })

  it('a recording that comes back empty says the video could not be recorded', async () => {
    recorded = []
    await mount()
    await recordToTheEnd()
    expect(screen.getByText('render.failed')).toBeTruthy()
    expect(screen.queryByRole('link')).toBeNull()
    expect(URL.createObjectURL).not.toHaveBeenCalled()
  })

  it('hidden pauses the recorder and the clock, visible resumes both', async () => {
    await mount()
    await click('render.record')
    await tick(500)
    await tick(1000)
    const recorder = FakeRecorder.instances[0]!
    await setHidden(true)
    const before = seeks(1).at(-1)!
    await tick(5000)
    expect(recorder.pause).toHaveBeenCalledTimes(1)
    expect(seeks(1).at(-1)).toBe(before) // the clock stood still
    await setHidden(false)
    await tick(20)
    expect(recorder.resume).toHaveBeenCalledTimes(1)
    const after = seeks(1).find((ms) => ms > before)!
    expect(after - before).toBeLessThanOrEqual(32)
  })

  it('hidden before recording starts pauses nothing', async () => {
    await mount()
    await click('render.record')
    await setHidden(true)
    await tick(100)
    await setHidden(false)
    await tick(400)
    await tick(20)
    expect(FakeRecorder.instances[0]!.pause).not.toHaveBeenCalled()
    expect(seeks(1)[0]).toBeLessThan(100)
  })

  it('Record is disabled while the prompt is open', async () => {
    let answer!: (stream: unknown) => void
    getDisplayMedia.mockReturnValueOnce(new Promise((resolve) => (answer = resolve)))
    await mount()
    await click('render.record')
    expect(button('render.record').disabled).toBe(true)
    fireEvent.click(button('render.record'))
    expect(getDisplayMedia).toHaveBeenCalledTimes(1)
    await act(async () => answer({ getVideoTracks: () => [track], getTracks: () => [track] }))
  })

  it('Record again records from the start with a fresh render and revokes the last file', async () => {
    await mount()
    await recordToTheEnd()
    expect(screen.getByRole('link').getAttribute('href')).toBe('blob:1')
    await click('render.again')
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:1')
    await tick(500)
    await tick(20)
    expect(state.handles).toHaveLength(3) // preview, first take, second take
    expect(seeks(2)[0]).toBeLessThan(100)
  })

  it('Cancel stops the take and returns to idle', async () => {
    await mount()
    await click('render.record')
    await tick(1500)
    const count = seeks(1).length
    await click('render.cancel')
    await tick(3000)
    expect(FakeRecorder.instances[0]!.stop).toHaveBeenCalled()
    expect(track.stop).toHaveBeenCalled()
    expect(seeks(1).length).toBeLessThanOrEqual(count + 1)
    expect(screen.queryByRole('link')).toBeNull()
    expect(button('render.record').disabled).toBe(false)
    expect(screen.queryByText(/render\.(failed|stopped|loadFailed)/)).toBeNull()
  })
})
