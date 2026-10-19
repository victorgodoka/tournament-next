'use client'

import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { Button } from '@ui/button'
import { Chip } from '@ui/chip'
import { Icon } from '@ui/icon'
import { Panel } from '@ui/panel'
import { locate } from '@utils/simulator/board'
import type { Action, Board, Session } from '@utils/simulator/types'
import { TOUCH } from './toolbar'

export type HistoryProps = {
  session: Session
  /** `timeline(deck, actions)`: `boards[i]` is the board `actions[i]` was played on. */
  boards: Board[]
  nameOf(id: number): string
  /** While a replay plays or targets are being picked: the rows only show. */
  disabled: boolean
  onSeek(cursor: number): void
  onSetStart(start: number): void
}

/**
 * Every step as a line, the board before the first one on top. A row's button shows that moment; the play button
 * next to it makes the replay start there (the start row carries a mark instead).
 */
export const History = ({ session, boards, nameOf, disabled, onSeek, onSetStart }: HistoryProps) => {
  const t = useTranslations('Simulator')

  /** One line for an action, read against the board it was played on (where a move came from, what a flip changed). */
  const describe = (a: Action, before: Board) => {
    switch (a.t) {
      case 'move': {
        const from = locate(before, a.card)?.zone
        return t('history.move', { card: nameOf(a.card), from: from ? t(`zones.${from}`) : '', to: t(`zones.${a.to}`) })
      }
      case 'draw':
        return t('history.draw', { n: a.n })
      case 'shuffle':
        return t('history.shuffle')
      case 'activate':
        return t('history.activate', { card: nameOf(a.card), n: a.targets.length, targets: a.targets.map(nameOf).join(', ') })
      case 'flip':
        return t('history.flip', { card: nameOf(a.card), to: before.cards[a.card]?.face === a.face ? a.pos : a.face })
      case 'negate':
        return t('history.negate', { card: nameOf(a.card), to: a.on ? 'on' : 'off' })
      case 'counter':
        return t('history.counter', { card: nameOf(a.card), delta: a.delta > 0 ? `+${a.delta}` : `−${-a.delta}` })
      case 'endTurn':
        return t('history.endTurn', { turn: before.turn })
    }
  }
  const lines = [t('history.start'), ...session.actions.map((a, i) => describe(a, boards[i]!))]

  return (
    <Panel tone="framed" title={t('history.title')} className="p-4 min-[720px]:p-4">
      <ol aria-label={t('history.title')} className="max-h-96 overflow-y-auto">
        {lines.map((line, i) => (
          <li key={i} className="flex items-center gap-2 border-b border-line last:border-b-0">
            <button
              type="button"
              aria-current={i === session.cursor ? 'step' : undefined}
              disabled={disabled}
              onClick={() => onSeek(i)}
              className={twMerge(
                'min-h-8 min-w-0 flex-1 cursor-pointer px-2 py-1 text-left text-ink-dim body-sm hover:bg-surface-300 hover:text-ink disabled:cursor-default disabled:hover:bg-transparent aria-[current=step]:bg-ground-cyan aria-[current=step]:text-ink',
                TOUCH,
              )}
            >
              {line}
            </button>
            {i === session.start ? (
              <Chip tone="cyan">{t('history.startMark')}</Chip>
            ) : (
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={t('history.replayFromHere')}
                title={t('history.replayFromHere')}
                disabled={disabled}
                onClick={() => onSetStart(i)}
                className="max-lg:size-11"
              >
                <Icon name="play" />
              </Button>
            )}
          </li>
        ))}
      </ol>
    </Panel>
  )
}
