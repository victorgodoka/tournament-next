'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Button } from '@ui/button'
import { Icon } from '@ui/icon'
import { isValid } from '@utils/simulator/board'
import type { Action, Board, Session } from '@utils/simulator/types'

/** Tap targets reach 44 px below `lg`. */
export const TOUCH = 'max-lg:min-h-11'
const DRAW: Action = { t: 'draw', n: 1 }
const END_TURN: Action = { t: 'endTurn' }

type ToolbarProps = {
  board: Board
  session: Session
  /** A replay is playing: every button is off (the replay bar pauses it). */
  playing: boolean
  /** Target mode: Undo and Redo are off until the pick is confirmed or cancelled. */
  picking: boolean
  onDeck(): void
  onNewHand(): void
  onChooseHand(): void
  onAct(actions: Action[]): void
  onUndo(): void
  onRedo(): void
  onReset(): void
  /** Nothing saved yet, or changed since: Save shows a dot. */
  unsaved: boolean
  onSave(): void
  /** Shown only for a session tied to a saved combo. */
  onSaveAs(): void
  onMyCombos(): void
  onShare(): void
  /** The replay as a video (MP4 or WebP): saves the line first when it is not. */
  onVideo(): void
  /** The history drawer is open. */
  historyOpen: boolean
  onHistory(): void
}

const MENU_ITEM =
  'block w-full cursor-pointer px-4 py-2.5 text-left whitespace-nowrap text-ink-dim signal-strong hover:bg-surface-300 hover:text-ink focus-visible:bg-surface-300 focus-visible:text-ink focus-visible:-outline-offset-2 disabled:cursor-not-allowed disabled:text-ink-muted disabled:hover:bg-transparent max-lg:min-h-11'

type MoreProps = {
  label: string
  disabled: boolean
  /** `[key, label, onPick, disabled]` per item; a null entry is left out. */
  items: ([string, string, () => void, boolean] | null)[]
}

/** The combo actions that are not Save, behind one button: closes on a pick, on a focus that leaves it and on Escape. */
const More = ({ label, disabled, items }: MoreProps) => {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)} onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
      <Button variant="secondary" size="sm" aria-haspopup="menu" aria-expanded={open} disabled={disabled} onClick={() => setOpen((o) => !o)} className={TOUCH}>
        {label}
        <Icon name="down" size={14} className={twMerge(open && 'rotate-180')} />
      </Button>
      {open ? (
        <div role="menu" className="absolute top-full right-0 z-(--z-dropdown) mt-1 min-w-44 border border-line-mid bg-surface-100 py-1 shadow-lift">
          {items.map((item) =>
            item ? (
              <button
                key={item[0]}
                type="button"
                role="menuitem"
                disabled={item[3]}
                onClick={() => {
                  setOpen(false)
                  item[2]()
                }}
                className={MENU_ITEM}
              >
                {item[1]}
              </button>
            ) : null,
          )}
        </div>
      ) : null}
    </div>
  )
}

/**
 * Two groups and the turn. Playing: Deck, New hand, Choose hand, Draw 1, End turn, then Undo, Redo and Reset as icons.
 * The line: Save, the rest of the combo actions behind "More" (Save as, My combos, Share), and the history drawer.
 * Every decision is the client's: the buttons only ask.
 */
export const Toolbar = (p: ToolbarProps) => {
  const t = useTranslations('Simulator')
  const { board, session, playing, picking } = p
  const still = playing || picking
  const noDeck = session.deck.main.length === 0
  const icon = (name: 'undo' | 'redo' | 'history', label: string, disabled: boolean, onClick: () => void, pressed?: boolean) => (
    <Button
      variant="secondary"
      size="icon-sm"
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={onClick}
      className={twMerge('max-lg:size-11', pressed && '[--fill:var(--color-surface-300)]')}
    >
      <Icon name={name} />
    </Button>
  )
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="secondary" size="sm" disabled={playing} onClick={p.onDeck} className={TOUCH}>
          {t('toolbar.deck')}
        </Button>
        <Button size="sm" disabled={playing || noDeck} onClick={p.onNewHand} className={TOUCH}>
          {t('toolbar.newHand')}
        </Button>
        <Button variant="secondary" size="sm" disabled={playing || noDeck} onClick={p.onChooseHand} className={TOUCH}>
          {t('toolbar.chooseHand')}
        </Button>
        <Button variant="secondary" size="sm" disabled={playing || !isValid(board, DRAW)} onClick={() => p.onAct([DRAW])} className={TOUCH}>
          {t('toolbar.draw')}
        </Button>
        <Button variant="secondary" size="sm" disabled={playing || board.cards.length === 0} onClick={() => p.onAct([END_TURN])} className={TOUCH}>
          {t('toolbar.endTurn')}
        </Button>
      </div>
      <div className="flex items-center gap-2">
        {icon('undo', t('toolbar.undo'), still || session.cursor === 0, p.onUndo)}
        {icon('redo', t('toolbar.redo'), still || session.cursor === session.actions.length, p.onRedo)}
        <Button variant="ghost" size="sm" disabled={playing || session.actions.length === 0} onClick={p.onReset} className={TOUCH}>
          {t('toolbar.reset')}
        </Button>
      </div>
      <div className="ms-auto flex items-center gap-2">
        <Button variant="secondary" size="sm" disabled={playing || noDeck} onClick={p.onSave} title={p.unsaved ? t('toolbar.unsaved') : undefined} className={TOUCH}>
          {t('toolbar.save')}
          {p.unsaved ? <span aria-hidden className="size-1.5 bg-gold" /> : null}
        </Button>
        <More
          label={t('toolbar.more')}
          disabled={playing}
          items={[
            session.combo ? ['saveAs', t('toolbar.saveAs'), p.onSaveAs, false] : null,
            ['myCombos', t('toolbar.myCombos'), p.onMyCombos, false],
            ['share', t('toolbar.share'), p.onShare, noDeck],
            ['video', t('video.open'), p.onVideo, noDeck || session.actions.length === 0],
          ]}
        />
        {icon('history', t('toolbar.history'), false, p.onHistory, p.historyOpen)}
        <span className="text-ink-muted signal">{t('turn', { n: board.turn })}</span>
      </div>
    </div>
  )
}
