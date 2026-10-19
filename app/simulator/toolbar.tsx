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
  onDeck(): void
  onNewHand(): void
  onAct(actions: Action[]): void
  onUndo(): void
  onRedo(): void
  onReset(): void
}

/** Deck, New hand, Draw 1, End turn, Undo, Redo and Reset, then the turn. Every decision is the client's: the buttons only ask. */
export const Toolbar = ({ board, session, onDeck, onNewHand, onAct, onUndo, onRedo, onReset }: ToolbarProps) => {
  const t = useTranslations('Simulator')
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button variant="secondary" size="sm" onClick={onDeck} className={TOUCH}>
        {t('toolbar.deck')}
      </Button>
      <Button size="sm" disabled={session.deck.main.length === 0} onClick={onNewHand} className={TOUCH}>
        {t('toolbar.newHand')}
      </Button>
      <Button variant="secondary" size="sm" disabled={!isValid(board, DRAW)} onClick={() => onAct([DRAW])} className={TOUCH}>
        {t('toolbar.draw')}
      </Button>
      <Button variant="secondary" size="sm" disabled={board.cards.length === 0} onClick={() => onAct([END_TURN])} className={TOUCH}>
        {t('toolbar.endTurn')}
      </Button>
      <Button variant="secondary" size="sm" disabled={session.cursor === 0} onClick={onUndo} className={TOUCH}>
        {t('toolbar.undo')}
      </Button>
      <Button variant="secondary" size="sm" disabled={session.cursor === session.actions.length} onClick={onRedo} className={TOUCH}>
        {t('toolbar.redo')}
      </Button>
      <Button variant="ghost" size="sm" disabled={session.actions.length === 0} onClick={onReset} className={TOUCH}>
        {t('toolbar.reset')}
      </Button>
      <span className="ms-auto text-ink-muted signal">{t('turn', { n: board.turn })}</span>
    </div>
  )
}
