'use client'

import { useTranslations } from 'next-intl'
import { useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Alert } from '@ui/alert'
import { Button, buttonClasses } from '@ui/button'
import type { Shape } from '@utils/simulator/timing'
import { ComboRender, type RenderHandle } from './combo-render'
import type { Speed } from './replay-bar'

/** What `MediaRecorder` is asked for, best first: H.264 MP4 plays everywhere the video gets posted. */
export const MIME_TYPES = ['video/mp4;codecs=avc1.640028', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'] as const

/** This tab and nothing else: the frame is all the video shows. */
const CAPTURE = {
  video: { frameRate: 30 },
  audio: false,
  preferCurrentTab: true,
  selfBrowserSurface: 'include',
  surfaceSwitching: 'exclude',
  monitorTypeSurfaces: 'exclude',
}
const BITS_PER_SECOND = 8_000_000
/** Chrome's "sharing this tab" bar takes its room out of the viewport once the capture starts: the frame is sized after it. */
const BAR_MS = 500
/** The last frame stays on screen this long, so the capture has it. */
const HOLD_MS = 300

/** Element Capture, Chrome and Edge only: not in lib.dom yet. */
type CaptureTrack = MediaStreamTrack & { restrictTo(target: unknown): Promise<void> }
const restrictionTarget = () =>
  (globalThis as unknown as { RestrictionTarget: { fromElement(el: Element): Promise<unknown> } }).RestrictionTarget

/** The frame's box in px: the shape's ratio, as large as the viewport holds. */
export const frameBox = (shape: Shape, width: number, height: number) => {
  const [a, b] = shape === 'landscape' ? [16, 9] : [9, 16]
  const w = Math.min(Math.floor(width), Math.floor((height * a) / b))
  return { w, h: Math.floor((w * b) / a) }
}

/** The file's name from the combo's title: letters, digits, spaces, `-` and `_`, at most 80 characters. */
export const videoName = (title: string) =>
  title
    .replace(/[^\p{L}\p{M}\p{N} _-]/gu, '')
    .trim()
    .slice(0, 80)
    .trim() || 'combo'

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))

type Message = 'stopped' | 'loadFailed' | 'failed'
type Phase =
  | { kind: 'idle'; message?: Message }
  | { kind: 'starting' }
  | { kind: 'recording' }
  | { kind: 'done'; url: string; name: string; format: 'MP4' | 'WebM' }

/** One recording: what stops it, and whether it is over (finished, cancelled or failed). */
type Take = { over: boolean; stream?: MediaStream; recorder?: MediaRecorder; quit?: () => void }

/**
 * The recording popup (`/simulator/c/<id>/render`): the frame, and over it what to press. Record captures this tab,
 * keeps only the frame (Element Capture), plays the replay in real time and hands back the file.
 */
export const ComboRecorder = ({ id, shape, speed }: { id: string; shape: Shape; speed: Speed }) => {
  const t = useTranslations('Simulator')
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' })
  const [box, setBox] = useState(() => frameBox(shape, innerWidth, innerHeight))
  /** Each take draws a frame of its own: `seek` only goes forward. */
  const [take, setTake] = useState(0)
  const [elapsed, setElapsed] = useState(0)
  const [total, setTotal] = useState(0)
  const frame = useRef<HTMLDivElement>(null)
  /** Set while a take waits for its frame's handle. */
  const waiting = useRef<((handle: RenderHandle) => void) | null>(null)
  const current = useRef<Take | null>(null)
  const file = useRef<string | null>(null)

  const onReady = (handle: RenderHandle) => {
    const resolve = waiting.current
    waiting.current = null
    if (resolve) return resolve(handle)
    // The preview: a combo that does not load says so before anyone records.
    handle.ready.catch(() => setPhase((p) => (p.kind === 'idle' ? { kind: 'idle', message: 'loadFailed' } : p)))
  }

  /** Ends a take early: everything captured is dropped. */
  const end = (run: Take, message?: Message) => {
    if (run.over) return
    run.over = true
    run.quit?.()
    if (run.recorder && run.recorder.state !== 'inactive') run.recorder.stop()
    run.stream?.getTracks().forEach((track) => track.stop())
    setPhase({ kind: 'idle', message })
  }

  const record = async () => {
    if (file.current) URL.revokeObjectURL(file.current)
    file.current = null
    const run: Take = { over: false }
    current.current = run
    setPhase({ kind: 'starting' })

    try {
      run.stream = await navigator.mediaDevices.getDisplayMedia(CAPTURE as DisplayMediaStreamOptions)
    } catch (error) {
      // A cancelled prompt is no failure: back to Record, nothing to say.
      run.over = true
      return setPhase(error instanceof DOMException && error.name === 'NotAllowedError' ? { kind: 'idle' } : { kind: 'idle', message: 'failed' })
    }
    const stream = run.stream
    const track = stream.getVideoTracks()[0] as CaptureTrack
    track.addEventListener('ended', () => end(run, 'stopped'))

    try {
      await sleep(BAR_MS)
      if (run.over) return
      const handed = new Promise<RenderHandle>((resolve) => (waiting.current = resolve))
      setBox(frameBox(shape, innerWidth, innerHeight))
      setTake((n) => n + 1)
      const handle = await handed
      if (run.over) return
      const video = await handle.ready.catch(() => null)
      if (run.over) return
      if (!video) return end(run, 'loadFailed')
      await track.restrictTo(await restrictionTarget().fromElement(frame.current!))
      if (run.over) return

      const mimeType = MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type))!
      const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: BITS_PER_SECOND })
      run.recorder = recorder
      // An encoder that gives up stops the recorder itself: the take ends there, never with a broken file.
      recorder.onerror = () => end(run, 'failed')
      const chunks: Blob[] = []
      recorder.ondataavailable = (event) => chunks.push(event.data)
      const stopped = new Promise((resolve) => (recorder.onstop = resolve))

      // The replay's clock: it stands still while the page is hidden, and so does the recorder.
      let t0 = performance.now()
      let hiddenAt: number | null = null
      const onVisibility = () => {
        if (document.hidden && hiddenAt === null) {
          hiddenAt = performance.now()
          recorder.pause()
        } else if (!document.hidden && hiddenAt !== null) {
          t0 += performance.now() - hiddenAt
          hiddenAt = null
          recorder.resume()
        }
      }
      document.addEventListener('visibilitychange', onVisibility)
      run.quit = () => document.removeEventListener('visibilitychange', onVisibility)

      recorder.start(1000)
      setElapsed(0)
      setTotal(Math.ceil(video.durationMs / 1000))
      setPhase({ kind: 'recording' })
      for (;;) {
        await nextFrame()
        if (run.over) return
        if (hiddenAt !== null) continue
        const ms = Math.min(performance.now() - t0, video.durationMs)
        await handle.seek(ms)
        if (run.over) return
        setElapsed(Math.floor(ms / 1000))
        if (ms >= video.durationMs) break
      }
      await sleep(HOLD_MS)
      if (run.over) return

      run.over = true
      run.quit()
      recorder.stop()
      stream.getTracks().forEach((each) => each.stop())
      await stopped
      const blob = new Blob(chunks, { type: mimeType })
      if (!blob.size) return setPhase({ kind: 'idle', message: 'failed' })
      const mp4 = mimeType.startsWith('video/mp4')
      file.current = URL.createObjectURL(blob)
      setPhase({ kind: 'done', url: file.current, name: `${videoName(video.title)}.${mp4 ? 'mp4' : 'webm'}`, format: mp4 ? 'MP4' : 'WebM' })
    } catch {
      end(run, 'failed')
    }
  }

  const busy = phase.kind === 'starting'
  return (
    <div className="relative flex size-full items-center justify-center">
      {/* Its own stacking context, flat, one fragment: what Element Capture asks of the element it keeps. */}
      <div ref={frame} className="bg-space-000" style={{ width: box.w, height: box.h, isolation: 'isolate' }}>
        <ComboRender key={take} id={id} speed={speed} onReady={onReady} />
      </div>
      {/* Over the frame, never inside it: the video never shows it. */}
      <div className="absolute top-3 left-3 z-10 flex max-w-sm flex-col gap-3 bg-space-100/90 p-4 text-ink">
        {phase.kind === 'idle' && phase.message ? (
          <Alert tone={phase.message === 'stopped' ? 'warn' : 'negative'} edged title={t(`render.${phase.message}`)} />
        ) : null}
        {phase.kind === 'recording' ? (
          <>
            <p className="body tabular-nums">{t('render.recording', { elapsed, total })}</p>
            <Button variant="secondary" onClick={() => current.current && end(current.current)}>
              {t('render.cancel')}
            </Button>
          </>
        ) : phase.kind === 'done' ? (
          <>
            <a href={phase.url} download={phase.name} className={twMerge(buttonClasses())}>
              {t('render.download', { format: phase.format })}
            </a>
            <Button variant="secondary" onClick={record}>
              {t('render.again')}
            </Button>
          </>
        ) : (
          <>
            <p className="text-ink-dim body-sm">{t('render.hint')}</p>
            <Button disabled={busy} onClick={record}>
              {t('render.record')}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
