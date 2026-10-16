'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Icon } from '@ui/icon'
import type { CardType } from '@ui/type-counts'
import { frameOf } from '@utils/deck/model'
import type { CardData } from '@utils/deck/types'
import { CARD_IMAGE_URL } from '@utils/const'

export type TileStatus = 'forbidden' | 'limited' | 'semi-limited' | { points: number }

/** Every tile of a card, in the pool and the deck, shakes once: an add that was refused. */
export const shakeTiles = (id: number) => {
  for (const tile of document.querySelectorAll<HTMLElement>(`[data-card="${id}"] [data-tile]`)) {
    tile.classList.remove('animate-shake')
    void tile.offsetWidth // restart the animation when it is already running
    tile.classList.add('animate-shake')
    tile.addEventListener('animationend', () => tile.classList.remove('animate-shake'), { once: true })
  }
}

type CardTileProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'id' | 'children'> & {
  id: number
  card?: CardData
  sizes: string
  /** Copies collapsed into this tile (×N badge). */
  count?: number
  /** Copies already in the deck, as dots. */
  dots?: number
  status?: TileStatus
  /** Crimson outline: the card is part of a validation problem. */
  problem?: boolean
  /** The button's accessible name when it says more than the card's name ("Remove a copy of …"). */
  label?: string
  /** Adds an info button over the top-right corner that opens the card's detail sheet. */
  onInfo?(): void
}

/** Light frames take dark text, as in `TypeCounts`. */
const LIGHT_FRAMES: CardType[] = ['normal', 'spell', 'synchro']

const BADGE ='absolute px-1 font-mono text-[11px] leading-4 font-bold tabular-nums'

/** A card scan at 59:86. Without data, or when the scan fails, a frame-coloured plate with the name or passcode. */
export const CardTile = ({ id, card, sizes, count, dots, status, problem, label, onInfo, className, ...button }: CardTileProps) => {
  const t = useTranslations('DeckEditor.tile')
  const [failed, setFailed] = useState(false)
  const name = card?.name ?? String(id)

  const statusText =
    status === undefined ? null
    : typeof status === 'object' ? t('points', { points: status.points })
    : t(status === 'semi-limited' ? 'semiLimited' : status)

  const frame = card && frameOf(card)

  const tile = (
    <button
      type="button"
      title={name}
      data-tile
      {...button}
      className={twMerge(
        // No selection or iOS callout under a long press.
        'relative block aspect-[59/86] w-full cursor-pointer overflow-hidden bg-surface-300 text-left select-none [-webkit-touch-callout:none]',
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
  if (!onInfo) return tile

  // A sibling, not a child: a click here never reaches the tile's add/remove. Out of the tab order,
  // since Enter on the tile opens the same sheet; always shown where there is no hover. On coarse
  // pointers an invisible ::after grows the 28px glyph to a 44px target, into the tile. The pool
  // hides it there via `data-info`: a tap on a pool tile already opens the sheet.
  return (
    <div className="group relative">
      {tile}
      <button
        type="button"
        tabIndex={-1}
        data-info
        aria-label={t('info', { name })}
        onClick={onInfo}
        className="absolute top-0 right-0 grid size-7 cursor-pointer place-items-center bg-space-000 text-ink opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:text-cyan pointer-coarse:opacity-100 pointer-coarse:after:absolute pointer-coarse:after:top-0 pointer-coarse:after:right-0 pointer-coarse:after:size-11 [@media(hover:none)]:opacity-100"
      >
        <Icon name="info" size={14} />
      </button>
    </div>
  )
}
