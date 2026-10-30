'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Button } from '@ui/button'
import { Dialog } from '@ui/dialog'
import { CardTile } from '@app/deck-builder/card-tile'
import type { CardMap } from '@utils/deck/types'
import type { Board } from '@utils/simulator/types'
import { CardPanel } from './card-panel'
import { TOUCH } from './toolbar'

type HandPickerProps = {
  /** The board before anything is played: its deck, in deck order, is what can be picked. */
  board: Board
  cards: CardMap
  /** The cards of a hand. */
  size: number
  onClose(): void
  /** The picked cards, in the order they were picked; `fill`: the rest of the hand comes at random. */
  onPick(ids: number[], fill: boolean): void
}

/** The deck's sections, in deck-list order. A card not loaded has no kind and goes last. */
const GROUPS = ['monster', 'spell', 'trap', 'other'] as const

/**
 * The opening hand: its slots on top, the deck by kind under them, and the card under the pointer beside it. A card is one
 * tile however many copies the deck has: each click takes another copy, and with none left to take the click gives them
 * back. Mounted only while open, so each opening starts with nothing picked.
 */
export const HandPicker = ({ board, cards, size, onClose, onPick }: HandPickerProps) => {
  const t = useTranslations('SimulatorNew')
  const [picked, setPicked] = useState<number[]>([])
  const [fill, setFill] = useState(false)
  const [focus, setFocus] = useState<number | null>(null)
  const codeOf = (id: number) => board.cards[id]!.code

  /** Every copy of each passcode in the deck. */
  const copies = new Map<number, number[]>()
  for (const id of board.zones.deck) copies.set(codeOf(id), [...(copies.get(codeOf(id)) ?? []), id])
  const toggle = (code: number) =>
    setPicked((now) => {
      const free = copies.get(code)!.find((id) => !now.includes(id))
      return free !== undefined && now.length < size ? [...now, free] : now.filter((id) => codeOf(id) !== code)
    })

  const groups = GROUPS.map((group) => ({ group, codes: [...copies.keys()].filter((code) => (cards.get(code)?.kind ?? 'other') === group) })).filter(({ codes }) => codes.length)

  return (
    <Dialog
      open
      onClose={onClose}
      title={t('handPicker.title')}
      description={t('handPicker.hint')}
      footer={
        <>
          <span className="text-ink-muted signal">{t('handPicker.count', { count: picked.length })}</span>
          <div className="ms-auto flex gap-2">
            <Button variant="secondary" onClick={onClose} className={TOUCH}>
              {t('handPicker.cancel')}
            </Button>
            <Button disabled={!picked.length && !fill} onClick={() => onPick(picked, fill)} className={TOUCH}>
              {t('handPicker.confirm')}
            </Button>
          </div>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <ol className="flex gap-2">
            {Array.from({ length: size }, (_, slot) => {
              const id = picked[slot]
              const data = id === undefined ? undefined : cards.get(codeOf(id))
              return (
                <li key={slot} className="w-16">
                  {id === undefined ? (
                    <span aria-hidden className="grid aspect-[59/86] place-items-center border border-line-mid bg-surface-200 text-ink-muted stat">
                      {fill ? '?' : null}
                    </span>
                  ) : (
                    <CardTile
                      id={codeOf(id)}
                      card={data}
                      sizes="64px"
                      label={t('handPicker.remove', { name: data?.name ?? codeOf(id) })}
                      onClick={() => setPicked((now) => now.filter((other) => other !== id))}
                      onPointerEnter={() => setFocus(codeOf(id))}
                    />
                  )}
                </li>
              )
            })}
          </ol>
          <div className="flex flex-col items-start gap-2">
            <label className="flex cursor-pointer items-center gap-2 text-ink-dim body-sm">
              <input type="checkbox" checked={fill} onChange={(e) => setFill(e.target.checked)} className="size-4 accent-cyan" />
              {t('handPicker.fill')}
            </label>
            <Button variant="ghost" size="mono" disabled={!picked.length} onClick={() => setPicked([])} className={TOUCH}>
              {t('handPicker.clear')}
            </Button>
          </div>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
          <div className="flex flex-col gap-4">
            {groups.map(({ group, codes }) => (
              <section key={group} className="flex flex-col gap-2">
                <h3 className="text-ink-muted signal">{t(`handPicker.${group}`)}</h3>
                <ul className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2">
                  {codes.map((code) => {
                    const left = copies.get(code)!.filter((id) => !picked.includes(id)).length
                    const on = left < copies.get(code)!.length
                    return (
                      <li key={code}>
                        <CardTile
                          id={code}
                          card={cards.get(code)}
                          sizes="80px"
                          count={left}
                          aria-pressed={on}
                          onClick={() => toggle(code)}
                          onPointerEnter={() => setFocus(code)}
                          className={twMerge(on && 'outline outline-2 outline-cyan', left === 0 && 'opacity-(--opacity-dim)')}
                        />
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
          <CardPanel code={focus} card={focus === null ? null : (cards.get(focus) ?? null)} className="max-lg:hidden lg:sticky lg:top-0" />
        </div>
      </div>
    </Dialog>
  )
}
