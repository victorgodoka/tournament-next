'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Button } from '@ui/button'
import { Dialog } from '@ui/dialog'
import { CardTile } from '@app/deck-builder/card-tile'
import type { CardMap } from '@utils/deck/types'
import type { Board } from '@utils/simulator/types'
import { TOUCH } from './toolbar'

type HandPickerProps = {
  /** The board before anything is played: its deck, in deck order, is what can be picked. */
  board: Board
  cards: CardMap
  onClose(): void
  /** The picked cards, in the order they were picked. */
  onPick(ids: number[]): void
}

/** The main deck to pick an opening hand from. Mounted only while open, so each opening starts with nothing picked. */
export const HandPicker = ({ board, cards, onClose, onPick }: HandPickerProps) => {
  const t = useTranslations('Simulator')
  const [picked, setPicked] = useState<number[]>([])
  const toggle = (id: number) => setPicked((now) => (now.includes(id) ? now.filter((other) => other !== id) : [...now, id]))
  return (
    <Dialog
      open
      onClose={onClose}
      title={t('handPicker.title')}
      description={t('handPicker.hint')}
      footer={
        <>
          <span className="text-ink-muted signal">{t('handPicker.count', { count: picked.length })}</span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={onClose} className={TOUCH}>
              {t('handPicker.cancel')}
            </Button>
            <Button disabled={!picked.length} onClick={() => onPick(picked)} className={TOUCH}>
              {t('handPicker.confirm')}
            </Button>
          </div>
        </>
      }
    >
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2">
        {board.zones.deck.map((id) => {
          const code = board.cards[id]!.code
          const on = picked.includes(id)
          return (
            <li key={id}>
              <CardTile
                id={code}
                card={cards.get(code)}
                sizes="80px"
                aria-pressed={on}
                onClick={() => toggle(id)}
                className={twMerge(on && 'outline outline-2 outline-cyan')}
              />
            </li>
          )
        })}
      </ul>
    </Dialog>
  )
}
