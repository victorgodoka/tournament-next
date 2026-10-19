'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@ui/button'
import { isValid } from '@utils/simulator/board'
import type { Action, Board, Session } from '@utils/simulator/types'

/** Tap targets reach 44 px below `lg`. */
export const TOUCH = 'max-lg:min-h-11'
const DRAW: Action = { t: 'draw', n: 1 }
const END_TURN: Action = { t: 'endTurn' }

type ToolbarProps = {
  board: Board
  session: Session
  /** A replay is playing: every button but Pause is off. */
  playing: boolean
  /** Target mode: Undo, Redo and Play are off until the pick is confirmed or cancelled. */
  picking: boolean
  onDeck(): void
  onNewHand(): void
  onAct(actions: Action[]): void
  onUndo(): void
  onRedo(): void
  onPlay(): void
  onReset(): void
}

/** Deck, New hand, Draw 1, End turn, Undo, Redo, Play/Pause and Reset, then the turn. Every decision is the client's: the buttons only ask. */
export const Toolbar = ({ board, session, playing, picking, onDeck, onNewHand, onAct, onUndo, onRedo, onPlay, onReset }: ToolbarProps) => {
  const t = useTranslations('Simulator')
  const still = playing || picking
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" size="sm" disabled={playing} onClick={onDeck} className={TOUCH}>
        {t('toolbar.deck')}
      </Button>
      <Button size="sm" disabled={playing || session.deck.main.length === 0} onClick={onNewHand} className={TOUCH}>
        {t('toolbar.newHand')}
      </Button>
      <Button variant="secondary" size="sm" disabled={playing || !isValid(board, DRAW)} onClick={() => onAct([DRAW])} className={TOUCH}>
        {t('toolbar.draw')}
      </Button>
      <Button variant="secondary" size="sm" disabled={playing || board.cards.length === 0} onClick={() => onAct([END_TURN])} className={TOUCH}>
        {t('toolbar.endTurn')}
      </Button>
      <Button variant="secondary" size="sm" disabled={still || session.cursor === 0} onClick={onUndo} className={TOUCH}>
        {t('toolbar.undo')}
      </Button>
      <Button variant="secondary" size="sm" disabled={still || session.cursor === session.actions.length} onClick={onRedo} className={TOUCH}>
        {t('toolbar.redo')}
      </Button>
      {/* Nothing after the start: nothing to play. */}
      <Button variant="secondary" size="sm" disabled={!playing && (picking || session.start >= session.actions.length)} onClick={onPlay} className={TOUCH}>
        {t(playing ? 'replay.pause' : 'replay.play')}
      </Button>
      <Button variant="ghost" size="sm" disabled={playing || session.actions.length === 0} onClick={onReset} className={TOUCH}>
        {t('toolbar.reset')}
      </Button>
      <span className="ms-auto text-ink-muted signal">{t('turn', { n: board.turn })}</span>
    </div>
  )
}
