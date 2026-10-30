'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useRef } from 'react'
import { twMerge } from 'tailwind-merge'
import { Button } from '@ui/button'
import { Chip } from '@ui/chip'
import { Icon } from '@ui/icon'
import { CardTile } from '@app/deck-builder/card-tile'
import type { CardMap } from '@utils/deck/types'
import { locate } from '@utils/simulator/board'
import type { Action, Board, Session } from '@utils/simulator/types'
import { TOUCH } from './toolbar'

export type HistoryProps = {
  session: Session
  /** `timeline(deck, actions)`: `boards[i]` is the board `actions[i]` was played on. */
  boards: Board[]
  /** For the thumbnail of the card a row names; a card not loaded shows `CardTile`'s plate. */
  cards: CardMap
  nameOf(id: number): string
  /** While a replay plays or targets are being picked: the rows only show. */
  disabled: boolean
  onSeek(cursor: number): void
  onSetStart(start: number): void
  /** The list's own classes: its height, by default 24rem. */
  className?: string
}

/** What a row weighs: the plays read first, a turn's end marks a break, the rest stays back. */
const TONE = { plain: 'text-ink-dim', play: 'text-ink shadow-[inset_2px_0_0_var(--color-azure)]', turn: 'text-ink-muted signal' }
const toneOf = (a: Action): keyof typeof TONE => (a.t === 'endTurn' ? 'turn' : a.t === 'activate' || (a.t === 'move' && a.how) ? 'play' : 'plain')
/** A signed count, with a true minus. */
const signed = (n: number) => (n > 0 ? `+${n}` : `−${-n}`)

/**
 * Every step as a line, the board before the first one on top. A row's button shows that moment; the play button
 * next to it makes the replay start there (the start row carries a mark instead).
 */
export const History = ({ session, boards, cards, nameOf, disabled, onSeek, onSetStart, className }: HistoryProps) => {
  const t = useTranslations('Simulator')

  /** One line for an action, read against the board it was played on (where a move came from, what a flip changed). */
  const describe = (a: Action, before: Board) => {
    switch (a.t) {
      case 'move': {
        const from = locate(before, a.card)?.zone
        if (a.destroy) return t('history.destroy', { card: nameOf(a.card), to: t(`zones.${a.to}`) })
        if (a.how) return t(`history.${a.how}`, { card: nameOf(a.card), from: from ? t(`zones.${from}`) : '' })
        return t('history.move', { card: nameOf(a.card), zone: a.to, from: from ? t(`zones.${from}`) : '', to: t(`zones.${a.to}`) })
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
        return t('history.counter', { card: nameOf(a.card), kind: a.kind ?? t('menu.counterPlain'), delta: a.delta > 0 ? `+${a.delta}` : `−${-a.delta}` })
      case 'tag':
        return t('history.tag', { card: nameOf(a.card), text: a.text, has: a.text ? 'yes' : 'no' })
      case 'endTurn':
        return t('history.endTurn', { turn: before.turn })
      case 'lp':
        return t('history.lp', { side: a.side, delta: signed(a.delta), lp: Math.max(0, before.lp[a.side] + a.delta) })
      case 'phase':
        return t('history.phase', { phase: t(`phases.${a.to}`) })
    }
  }
  /** Each row's line, and the passcode of the card it names (none for a draw, a shuffle or an end of turn). */
  const rows = [
    { line: t('history.start'), code: null, note: undefined, tone: 'plain' as const },
    ...session.actions.map((a, i) => ({ line: describe(a, boards[i]!), code: 'card' in a ? (boards[i]!.cards[a.card]?.code ?? null) : null, note: a.note, tone: toneOf(a) })),
  ]

  // The current step stays in view as a replay or the arrows move it. Only the list scrolls, never the page.
  const list = useRef<HTMLOListElement>(null)
  useEffect(() => {
    const ol = list.current
    const row = ol?.querySelector('[aria-current="step"]')?.closest('li')
    if (!ol || !row) return
    if (row.offsetTop < ol.scrollTop) ol.scrollTop = row.offsetTop
    else if (row.offsetTop + row.offsetHeight > ol.scrollTop + ol.clientHeight) ol.scrollTop = row.offsetTop + row.offsetHeight - ol.clientHeight
  }, [session.cursor])

  return (
    <ol ref={list} aria-label={t('history.title')} className={twMerge('relative max-h-96 overflow-y-auto', className)}>
      {rows.map(({ line, code, note, tone }, i) => (
        <li key={i} className="flex items-center gap-2 border-b border-line last:border-b-0">
          <span data-step-number={i ? '' : undefined} className="w-7 shrink-0 text-right font-mono text-ink-muted body-sm tabular-nums">
            {i ? `#${i}` : null}
          </span>
          {/* A picture, not a control: the line already names the card. The slot stays for rows without one, so the lines align. */}
          <span className="w-6 shrink-0">
            {code === null ? null : <CardTile id={code} card={cards.get(code)} sizes="24px" disabled aria-hidden className="cursor-default" />}
          </span>
          <button
            type="button"
            aria-current={i === session.cursor ? 'step' : undefined}
            disabled={disabled}
            onClick={() => onSeek(i)}
            className={twMerge(
              'min-h-8 min-w-0 flex-1 cursor-pointer px-2 py-1 text-left body-sm hover:bg-surface-300 hover:text-ink disabled:cursor-default disabled:hover:bg-transparent aria-[current=step]:bg-ground-cyan aria-[current=step]:text-ink',
              TONE[tone],
              TOUCH,
            )}
          >
            {line}
            {note ? <span className="block text-ink-muted italic">{note}</span> : null}
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
  )
}
