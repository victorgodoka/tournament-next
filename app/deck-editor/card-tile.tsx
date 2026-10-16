'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import type { CardType } from '@ui/type-counts'
import type { CardData } from '@utils/deck/types'
import { CARD_IMAGE_URL } from '@utils/const'

const FRAMES = ['ritual', 'fusion', 'synchro', 'xyz', 'link'] as const

/** The card's frame, by the same rule as `sortZone`: Pendulum and Tuner fall to their base frame. */
export const frameOf = (card: CardData): CardType => {
  if (card.kind !== 'monster') return card.kind
  return FRAMES.find((t) => card.monsterTypes.includes(t)) ?? (card.monsterTypes.includes('normal') ? 'normal' : 'effect')
}

type Status = 'forbidden' | 'limited' | 'semi-limited' | { points: number }

type CardTileProps = {
  id: number
  card?: CardData
  sizes: string
  /** Copies collapsed into this tile (×N badge). */
  count?: number
  /** Copies already in the deck, as dots. */
  dots?: number
  status?: Status
  /** Crimson outline: the card is part of a validation problem. */
  problem?: boolean
  /** The button's accessible name when it says more than the card's name ("Remove a copy of …"). */
  label?: string
  onClick?(): void
  onContextMenu?(e: React.MouseEvent<HTMLButtonElement>): void
  draggable?: boolean
  onDragStart?(e: React.DragEvent<HTMLButtonElement>): void
  className?: string
}

/** Light frames take dark text, as in `TypeCounts`. */
const LIGHT_FRAMES: CardType[] = ['normal', 'spell', 'synchro']

const BADGE ='absolute px-1 font-mono text-[11px] leading-4 font-bold tabular-nums'

/** A card scan at 59:86. Without data, or when the scan fails, a frame-coloured plate with the name or passcode. */
export const CardTile = ({ id, card, sizes, count, dots, status, problem, label, onClick, onContextMenu, draggable, onDragStart, className }: CardTileProps) => {
  const t = useTranslations('DeckEditor.tile')
  const [failed, setFailed] = useState(false)
  const name = card?.name ?? String(id)

  const statusText =
    status === undefined ? null
    : typeof status === 'object' ? t('points', { points: status.points })
    : t(status === 'semi-limited' ? 'semiLimited' : status)

  const frame = card && frameOf(card)

  return (
    <button
      type="button"
      title={name}
      onClick={onClick}
      onContextMenu={onContextMenu}
      draggable={draggable}
      onDragStart={onDragStart}
      className={twMerge(
        'relative block aspect-[59/86] w-full cursor-pointer overflow-hidden bg-surface-300 text-left',
        problem && 'outline outline-2 outline-crimson-lift',
        className,
      )}
    >
      <span className="sr-only">{label ?? name}</span>
      {card && !failed ? (
        <Image src={CARD_IMAGE_URL(id)} alt="" fill sizes={sizes} draggable={false} onError={() => setFailed(true)} className="object-cover" />
      ) : (
        <span
          aria-hidden
          style={frame ? { background: `var(--color-type-${frame})` } : undefined}
          className={twMerge(
            'absolute inset-0 flex items-end p-1 font-mono text-[10px] leading-3 break-words',
            frame && LIGHT_FRAMES.includes(frame) ? 'text-space-000' : 'text-ink',
          )}
        >
          {name}
        </span>
      )}
      {count && count > 1 ? <span className={twMerge(BADGE, 'right-0 bottom-0 bg-space-000 text-ink')}>×{count}</span> : null}
      {statusText ? (
        <span
          title={statusText}
          className={twMerge(
            BADGE,
            'top-0 left-0',
            typeof status === 'object' ? 'bg-cyan text-cyan-on' : status === 'forbidden' ? 'bg-crimson text-ink' : 'bg-gold text-gold-on',
          )}
        >
          <span aria-hidden>{typeof status === 'object' ? status.points : status === 'forbidden' ? 0 : status === 'limited' ? 1 : 2}</span>
          <span className="sr-only">{statusText}</span>
        </span>
      ) : null}
      {dots ? (
        <span className="absolute right-1 bottom-1 flex gap-0.5">
          {Array.from({ length: Math.min(dots, 3) }, (_, i) => (
            <i key={i} aria-hidden className="block size-1.5 bg-cyan" />
          ))}
          <span className="sr-only">{t('inDeck', { count: dots })}</span>
        </span>
      ) : null}
    </button>
  )
}
