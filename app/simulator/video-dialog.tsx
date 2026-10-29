'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Alert } from '@ui/alert'
import { Button } from '@ui/button'
import { Segmented } from '@ui/choice'
import { Dialog } from '@ui/dialog'
import { FIELD_LABEL } from '@ui/field'
import { renderTimeline, type Shape } from '@utils/simulator/timing'
import type { Action } from '@utils/simulator/types'
import { SPEEDS, type Speed } from './replay-bar'
import { TOUCH } from './toolbar'

/**
 * One popup per shape: a second Record of the same shape loads the new choices into it. The other shape gets its own,
 * since a browser reusing a window by name keeps its size.
 */
const popupName = (shape: Shape) => `combo-video-${shape}`
/** Room above the frame for Chrome's "sharing this tab" bar, which shows once the capture starts. */
const BAR = 48

/** The popup's size for the shape: 1280 × 720 frames, or 9:16 as tall as the screen allows up to 720 × 1280. */
export const popupFeatures = (shape: Shape, availHeight: number) => {
  if (shape === 'landscape') return `popup,width=1280,height=${720 + BAR}`
  const height = Math.min(1280 + BAR, availHeight - 80)
  return `popup,width=${Math.round(((height - BAR) * 9) / 16)},height=${height}`
}

/** Screen capture, and Element Capture to keep only the frame: desktop Chrome and Edge. */
const canRecord = () => !!navigator.mediaDevices?.getDisplayMedia && 'RestrictionTarget' in globalThis

/** `~45 s`, `~1 min 20 s`: the length is fractional at 3x, so it rounds. */
const lengthOf = (ms: number) => {
  const s = Math.round(ms / 1000)
  return s < 60 ? `~${s} s` : `~${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ''}`
}

const SHAPES: ReadonlyArray<{ value: Shape; label: string }> = [
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

/** Shape and speed, then Record, which opens the recording popup on the render page. */
export const VideoDialog = ({ open, onClose, comboId, actions, start }: VideoDialogProps) => {
  const t = useTranslations('Simulator')
  return (
    <Dialog size="sm" open={open} onClose={onClose} title={t('video.title')}>
      {/* The dialog mounts its content only while open: closing unmounts `Body`, which forgets the choices. */}
      <Body comboId={comboId} actions={actions} start={start} />
    </Dialog>
  )
}

const Body = ({ comboId, actions, start }: Pick<VideoDialogProps, 'comboId' | 'actions' | 'start'>) => {
  const t = useTranslations('Simulator')
  const [shape, setShape] = useState<Shape>('landscape')
  const [speed, setSpeed] = useState<Speed>(1)
  /** What became of the last Record: the popup opened, or the browser blocked it. */
  const [note, setNote] = useState<'opened' | 'popupBlocked' | null>(null)
  const supported = canRecord()

  /** Another choice is another video: the note about the last popup goes. */
  const choose =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value)
      setNote(null)
    }
  // Opened right in the click, or the popup blocker steps in.
  const record = () => {
    const query = new URLSearchParams({ shape, speed: String(speed) })
    const popup = window.open(`/simulator/c/${encodeURIComponent(comboId)}/render?${query}`, popupName(shape), popupFeatures(shape, window.screen.availHeight))
    setNote(popup ? 'opened' : 'popupBlocked')
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <span aria-hidden className={FIELD_LABEL}>
          {t('video.aspect')}
        </span>
        <Segmented label={t('video.aspect')} options={SHAPES} value={shape} onChange={choose(setShape)} />
      </div>
      <div>
        <span aria-hidden className={FIELD_LABEL}>
          {t('video.speed')}
        </span>
        <Segmented label={t('video.speed')} options={SPEEDS.map((s) => ({ value: s, label: `${s}x` }))} value={speed} onChange={choose(setSpeed)} />
      </div>
      <p className="text-ink-dim body">{t('video.length', { length: lengthOf(renderTimeline(actions, start, speed).durationMs) })}</p>

      {supported ? null : <Alert tone="info" edged title={t('video.unsupported')} />}
      {note ? <Alert tone={note === 'opened' ? 'info' : 'warn'} edged title={t(`video.${note}`)} /> : null}

      {supported ? (
        <div className="flex justify-end">
          <Button onClick={record} className={TOUCH}>
            {t('video.record')}
          </Button>
        </div>
      ) : null}
    </div>
  )
}
