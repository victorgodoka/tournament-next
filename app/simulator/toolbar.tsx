'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { Button } from '@ui/button'
import { Icon, type IconName } from '@ui/icon'
import { isValid, shuffleAction } from '@utils/simulator/board'
import type { Action, Board, Session } from '@utils/simulator/types'

/** Tap targets reach 44 px below `lg`. */
export const TOUCH = 'max-lg:min-h-11'
const DRAW: Action = { t: 'draw', n: 1 }

const MENU_ITEM =
  'block w-full cursor-pointer px-4 py-2.5 text-left whitespace-nowrap text-ink-dim signal-strong hover:bg-surface-300 hover:text-ink focus-visible:bg-surface-300 focus-visible:text-ink focus-visible:-outline-offset-2 disabled:cursor-not-allowed disabled:text-ink-muted disabled:hover:bg-transparent max-lg:min-h-11'

type MoreProps = {
  label: string
  disabled: boolean
  /** `[key, label, onPick, disabled]` per item; a null entry is left out. */
  items: ([string, string, () => void, boolean] | null)[]
}

/** What does not earn a place in the rail's top row, behind one button: closes on a pick, on a focus that leaves it and on Escape. */
const More = ({ label, disabled, items }: MoreProps) => {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)} onKeyDown={(e) => e.key === 'Escape' && setOpen(false)}>
      <Button variant="ghost" size="icon-sm" aria-label={label} title={label} aria-haspopup="menu" aria-expanded={open} disabled={disabled} onClick={() => setOpen((o) => !o)} className="max-lg:size-11">
        <Icon name="more" />
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

type CommandsProps = {
  session: Session
  /** A replay is playing, or a save is on its way: every button is off (the replay bar pauses it). */
  playing: boolean
  onNewHand(): void
  onChooseHand(): void
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
  onHelp(): void
}

/** The rail's top row: a hand to start from and the line to keep. Every decision is the client's: the buttons only ask. */
export const Commands = (p: CommandsProps) => {
  const t = useTranslations('Simulator')
  const { session, playing } = p
  const noDeck = session.deck.main.length === 0
  return (
    <div className="flex items-center gap-1 border-b border-line p-3">
      <Button variant="secondary" size="mono" disabled={playing || noDeck} onClick={p.onNewHand} className={TOUCH}>
        {t('toolbar.newHand')}
      </Button>
      <Button variant="secondary" size="mono" disabled={playing || noDeck} onClick={p.onChooseHand} className={TOUCH}>
        {t('toolbar.chooseHand')}
      </Button>
      <Button variant="secondary" size="mono" disabled={playing || noDeck} onClick={p.onSave} title={p.unsaved ? t('toolbar.unsaved') : undefined} className={`ms-auto ${TOUCH}`}>
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
          ['reset', t('toolbar.reset'), p.onReset, session.actions.length === 0],
          ['help', t('help.title'), p.onHelp, false],
        ]}
      />
    </div>
  )
}

type DockProps = {
  board: Board
  session: Session
  /** A replay is playing: every button is off. */
  playing: boolean
  /** Target mode: Undo and Redo are off until the pick is confirmed or cancelled. */
  picking: boolean
  onAct(actions: Action[]): void
  onUndo(): void
  onRedo(): void
}

/** Beside the Deck: what touches it, then Undo and Redo. */
export const Dock = ({ board, session, playing, picking, onAct, onUndo, onRedo }: DockProps) => {
  const t = useTranslations('Simulator')
  const still = playing || picking
  const shuffle = shuffleAction(board)
  const icon = (name: IconName, label: string, disabled: boolean, onClick: () => void) => (
    <Button variant="secondary" size="icon-sm" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="max-lg:size-11">
      <Icon name={name} />
    </Button>
  )
  return (
    <div role="group" aria-label={t('rail.dock')} className="sim-dock">
      {icon('cards', t('toolbar.draw'), playing || !isValid(board, DRAW), () => onAct([DRAW]))}
      {icon('shuffle', t('toolbar.shuffle'), playing || !isValid(board, shuffle), () => onAct([shuffleAction(board)]))}
      {icon('undo', t('toolbar.undo'), still || session.cursor === 0, onUndo)}
      {icon('redo', t('toolbar.redo'), still || session.cursor === session.actions.length, onRedo)}
    </div>
  )
}
