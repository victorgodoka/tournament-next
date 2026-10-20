'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Alert } from '@ui/alert'
import { Button, buttonClasses } from '@ui/button'
import { Segmented } from '@ui/choice'
import { Dialog } from '@ui/dialog'
import { FIELD_LABEL } from '@ui/field'
import { ComboApiError, getRender, renderFileUrl, startRender, type RenderInfo, type RenderShape } from '@utils/combos'
import { renderTimeline } from '@utils/simulator/timing'
import type { Action } from '@utils/simulator/types'
import { SPEEDS, type Speed } from './replay-bar'
import { TOUCH } from './toolbar'

/** How long after an answer the next status request goes out. */
const POLL_MS = 2000

type Reason = 'queueFull' | 'busy' | 'failed'
/** Choosing, a POST on its way, a render to follow (`failed` is an error instead) or a message to read. */
type Phase = { kind: 'idle' } | { kind: 'posting' } | { kind: 'render'; info: RenderInfo } | { kind: 'error'; reason: Reason }

const IDLE: Phase = { kind: 'idle' }
const FAILED: Phase = { kind: 'error', reason: 'failed' }
const REASONS: Record<string, Reason> = { QUEUE_FULL: 'queueFull', RENDER_BUSY: 'busy', RATE_LIMITED: 'busy' }

const reasonOf = (error: unknown): Reason => (error instanceof ComboApiError && error.code && REASONS[error.code]) || 'failed'
const show = (info: RenderInfo): Phase => (info.status === 'failed' ? FAILED : { kind: 'render', info })
const percentOf = ({ framesDone, framesTotal }: RenderInfo) => (framesTotal ? Math.floor((100 * framesDone) / framesTotal) : 0)

/** `~45 s`, `~1 min 20 s`: the length is fractional at 3x, so it rounds. */
const lengthOf = (ms: number) => {
  const s = Math.round(ms / 1000)
  return s < 60 ? `~${s} s` : `~${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ''}`
}

const SHAPES: ReadonlyArray<{ value: RenderShape; label: string }> = [
  { value: 'landscape', label: '16:9' },
  { value: 'portrait', label: '9:16' },
]

type VideoDialogProps = {
  open: boolean
  onClose(): void
  comboId: string
  /** The line and the step it replays from: the estimated length comes from the same timeline the video is cut from. */
  actions: Action[]
  start: number
}

/** Shape and speed, Generate, then the queue and the progress of the render, then the two files. */
export const VideoDialog = ({ open, onClose, comboId, actions, start }: VideoDialogProps) => {
  const t = useTranslations('Simulator')
  return (
    <Dialog size="sm" open={open} onClose={onClose} title={t('video.title')}>
      {/* The dialog mounts its content only while open: closing unmounts `Body`, which ends the polling and forgets the choices. */}
      <Body comboId={comboId} actions={actions} start={start} />
    </Dialog>
  )
}

const Body = ({ comboId, actions, start }: Pick<VideoDialogProps, 'comboId' | 'actions' | 'start'>) => {
  const t = useTranslations('Simulator')
  const [shape, setShape] = useState<RenderShape>('landscape')
  const [speed, setSpeed] = useState<Speed>(1)
  const [phase, setPhase] = useState<Phase>(IDLE)

  // A queued or running render is asked about once, and again `POLL_MS` after the answer: never an interval. A ready
  // one goes back to Generate when its files expire, so no link outlives them. Each answer is a new `phase`, so this
  // runs again for the next one; the cleanup is what stops it on close or on another choice.
  useEffect(() => {
    if (phase.kind !== 'render') return
    const { info } = phase
    let live = true
    const timer =
      info.status !== 'ready'
        ? setTimeout(() => {
            getRender(info.id).then(
              (next) => live && setPhase(next ? show(next) : IDLE),
              () => live && setPhase(FAILED),
            )
          }, POLL_MS)
        : info.expiresAt
          ? setTimeout(() => setPhase(IDLE), Date.parse(info.expiresAt) - Date.now())
          : undefined
    return () => {
      live = false
      clearTimeout(timer)
    }
  }, [phase])

  const generate = () => {
    setPhase({ kind: 'posting' })
    startRender(comboId, { shape, speed }).then(
      (info) => setPhase(show(info)),
      (error) => setPhase({ kind: 'error', reason: reasonOf(error) }),
    )
  }
  const busy = phase.kind === 'posting'
  const ready = phase.kind === 'render' && phase.info.status === 'ready' ? phase.info : null
  const waiting = phase.kind === 'render' && !ready
  /** Another choice is another video: what the dialog shows of the last one goes. The server keeps it for the same choices. */
  const choose =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value)
      setPhase(IDLE)
    }

  /** What the Alert says about where the video is; the files themselves are the links below. */
  const note = (): { tone: 'info' | 'positive' | 'warn' | 'negative'; text: string } | null => {
    if (phase.kind === 'error') return { tone: phase.reason === 'failed' ? 'negative' : 'warn', text: t(`video.${phase.reason}`) }
    if (phase.kind !== 'render') return null
    const { info } = phase
    if (info.status === 'queued') return { tone: 'info', text: t('video.queued', { position: info.position }) }
    if (info.status === 'running') return { tone: 'info', text: t('video.running', { percent: percentOf(info) }) }
    return { tone: 'positive', text: t('video.ready') }
  }
  const message = note()

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span aria-hidden className={FIELD_LABEL}>
          {t('video.aspect')}
        </span>
        <Segmented label={t('video.aspect')} options={SHAPES.map((s) => ({ ...s, disabled: busy }))} value={shape} onChange={choose(setShape)} />
      </div>
      <div>
        <span aria-hidden className={FIELD_LABEL}>
          {t('video.speed')}
        </span>
        <Segmented
          label={t('video.speed')}
          options={SPEEDS.map((s) => ({ value: s, label: `${s}x`, disabled: busy }))}
          value={speed}
          onChange={choose(setSpeed)}
        />
      </div>
      <p className="text-ink-dim body">{t('video.length', { length: lengthOf(renderTimeline(actions, start, speed).durationMs) })}</p>

      {message ? <Alert tone={message.tone} edged title={message.text} /> : null}

      {/* Queued or running: nothing to press, the Alert is the whole answer. */}
      {waiting ? null : (
        <div className="flex flex-wrap justify-end gap-4">
          {ready ? (
            <>
              {/* The API answers these with `content-disposition: attachment`: a link is a download. */}
              <a href={renderFileUrl(ready.id, 'webp')} className={twMerge(buttonClasses({ variant: 'secondary' }), TOUCH)}>
                {t('video.downloadWebp')}
              </a>
              <a href={renderFileUrl(ready.id, 'mp4')} className={twMerge(buttonClasses(), TOUCH)}>
                {t('video.downloadMp4')}
              </a>
            </>
          ) : (
            <Button disabled={busy} onClick={generate} className={TOUCH}>
              {t(phase.kind === 'error' ? 'video.tryAgain' : 'video.generate')}
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
