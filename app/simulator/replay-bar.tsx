'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@ui/button'
import { Segmented } from '@ui/choice'
import { Icon, type IconName } from '@ui/icon'

export const SPEEDS = [0.5, 1, 2, 3] as const
export type Speed = (typeof SPEEDS)[number]

type ReplayBarProps = {
  cursor: number
  end: number
  start: number
  playing: boolean
  /** Target mode: the replay waits until the pick is confirmed or cancelled. */
  picking: boolean
  speed: Speed
  /** Pauses and shows step `to`. */
  onStep(to: number): void
  onPlay(): void
  onSpeed(speed: Speed): void
}

/** Previous, Play/Pause, Next and Stop, the timeline and the speed. Stop goes back to the last step, where playing by hand goes on. */
export const ReplayBar = ({ cursor, end, start, playing, picking, speed, onStep, onPlay, onSpeed }: ReplayBarProps) => {
  const t = useTranslations('Simulator')
  const control = (icon: IconName, label: string, disabled: boolean, onClick: () => void) => (
    <Button variant="secondary" size="icon-sm" aria-label={t(label)} title={t(label)} disabled={disabled} onClick={onClick} className="max-lg:size-11">
      <Icon name={icon} />
    </Button>
  )
  return (
    <div role="group" aria-label={t('replay.label')} className="flex flex-wrap items-center gap-2">
      {control('left', 'replay.prev', picking || cursor === 0, () => onStep(cursor - 1))}
      {playing ? control('pause', 'replay.pause', false, onPlay) : control('play', 'replay.play', picking || start >= end, onPlay)}
      {control('right', 'replay.next', picking || cursor === end, () => onStep(cursor + 1))}
      {control('stop', 'replay.stop', picking || (!playing && cursor === end), () => onStep(end))}
      <input
        type="range"
        min={0}
        max={end}
        value={cursor}
        disabled={picking || end === 0}
        aria-label={t('replay.timeline')}
        onChange={(e) => onStep(Number(e.target.value))}
        className="min-w-24 flex-1 accent-cyan max-lg:h-11"
      />
      <span className="text-ink-muted signal tabular-nums">{`${cursor} / ${end}`}</span>
      <Segmented size="sm" label={t('replay.speed')} options={SPEEDS.map((s) => ({ value: s, label: `${s}x` }))} value={speed} onChange={onSpeed} />
    </div>
  )
}
