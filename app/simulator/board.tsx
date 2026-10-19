'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { Icon } from '@ui/icon'
import { CardTile } from '@app/deck-builder/card-tile'
import type { CardMap } from '@utils/deck/types'
import { isSlot } from '@utils/simulator/board'
import type { Board, Pile, ZoneId } from '@utils/simulator/types'

export type BoardViewProps = {
  board: Board
  cards: CardMap
  selected: number | null
  onCard(id: number, e: React.MouseEvent): void
  onMenu(id: number, e: React.MouseEvent): void
  onPile(pile: Pile): void
}

/** `[zone, column, row]` on the 7 × 3 grid. Banished takes the EMZ row's last column, above the GY. */
const LAYOUT: [Exclude<ZoneId, 'hand'>, number, number][] = [
  ['emz0', 3, 1], ['emz1', 5, 1], ['banished', 7, 1],
  ['field', 1, 2], ['m0', 2, 2], ['m1', 3, 2], ['m2', 4, 2], ['m3', 5, 2], ['m4', 6, 2], ['gy', 7, 2],
  ['extra', 1, 3], ['s0', 2, 3], ['s1', 3, 3], ['s2', 4, 3], ['s3', 5, 3], ['s4', 6, 3], ['deck', 7, 3],
]

const SIZES = '84px'
const BADGE = 'pointer-events-none absolute px-1 font-mono text-[11px] leading-4 font-bold tabular-nums'
const MARK = 'pointer-events-none absolute grid size-4 place-items-center bg-space-000'

const Back = () => <Image src="/back.webp" alt="" fill sizes={SIZES} draggable={false} className="pointer-events-none object-cover" />

/**
 * The player's side: seven columns that fit the width (at most 84px a card, 46px at 375px), the hand
 * under them. Every zone is a `[data-zone]` group, every card on the field or in the hand a `[data-card]` button.
 */
export const BoardView = (p: BoardViewProps) => {
  const t = useTranslations('Simulator')
  return (
    <div className="@container [--card-w:min(84px,calc((100cqw_-_24px)/7))]">
      <div className="mx-auto grid w-fit grid-cols-[repeat(7,var(--card-w))] gap-1">
        {LAYOUT.map(([zone, column, row]) => (
          <div
            key={zone}
            role="group"
            aria-label={t(`zones.${zone}`)}
            data-zone={zone}
            style={{ gridColumn: column, gridRow: row }}
            className="relative aspect-[59/86] bg-surface-100"
          >
            {isSlot(zone) ? <Stack ids={p.board.zones[zone]} p={p} /> : <PileView pile={zone} p={p} />}
          </div>
        ))}
      </div>
      {/* Cards overlap as the hand grows: never a wrap or a scroll, which would fight the drag. */}
      <div
        role="group"
        aria-label={t('zones.hand')}
        data-zone="hand"
        className="mx-auto mt-2 flex min-h-[calc(var(--card-w)*86/59)] w-[calc(var(--card-w)*7_+_24px)] max-w-full justify-center gap-1"
      >
        {p.board.zones.hand.map((id) => (
          <div key={id} className="max-w-(--card-w) min-w-0 flex-1 last:flex-none">
            <CardView id={id} p={p} className="w-(--card-w)" />
          </div>
        ))}
      </div>
    </div>
  )
}

/** A monster or spell slot: the card on top, its Xyz materials peeking out under it. */
const Stack = ({ ids, p }: { ids: number[]; p: BoardViewProps }) => {
  const [top, ...materials] = ids
  if (top === undefined) return null
  return (
    <>
      <CardView id={top} p={p} className="z-1" />
      {materials.map((id) => (
        <CardView key={id} id={id} p={p} className="absolute inset-0 translate-1" />
      ))}
      {materials.length ? <span className={twMerge(BADGE, 'top-0 left-0 z-1 bg-space-000 text-ink')}>×{materials.length}</span> : null}
    </>
  )
}

/** One card: its scan (the back when set), DEF turned sideways, and its negated and counter markers, which stay upright. */
const CardView = ({ id, p, className }: { id: number; p: BoardViewProps; className?: string }) => {
  const t = useTranslations('Simulator')
  const card = p.board.cards[id]!
  return (
    <div className={twMerge('relative', className)}>
      {/* DEF: turned and scaled by 59/86 so the sideways card fits its cell. */}
      <div className={twMerge('relative', card.pos === 'def' && 'scale-[calc(59/86)] rotate-90')}>
        <CardTile
          id={card.code}
          card={p.cards.get(card.code)}
          sizes={SIZES}
          data-card={id}
          onClick={(e) => p.onCard(id, e)}
          onContextMenu={(e) => p.onMenu(id, e)}
          className={twMerge(card.negated && 'grayscale', p.selected === id && 'outline outline-2 outline-cyan')}
        />
        {card.face === 'down' ? <Back /> : null}
      </div>
      {card.negated ? (
        <span className={twMerge(MARK, 'top-0 right-0 text-crimson-lift')}>
          <Icon name="close" size={14} label={t('negated')} />
        </span>
      ) : null}
      {card.counters ? <span className={twMerge(BADGE, 'bottom-0 left-0 bg-gold text-gold-on')}>{card.counters}</span> : null}
    </div>
  )
}

/** Deck, Extra, GY or Banished: the count and the top card (the back for Deck and Extra). A click opens the pile. */
const PileView = ({ pile, p }: { pile: Exclude<Pile, 'hand'>; p: BoardViewProps }) => {
  const t = useTranslations('Simulator')
  const ids = p.board.zones[pile]
  const top = ids[0] === undefined ? null : p.board.cards[ids[0]]!
  const label = t(`zones.${pile}`)
  const open = () => p.onPile(pile)
  const back = pile === 'deck' || pile === 'extra'
  return (
    <>
      {!top ? null : back ? (
        <button type="button" aria-label={label} onClick={open} className="relative block aspect-[59/86] w-full cursor-pointer">
          <Back />
        </button>
      ) : (
        <CardTile id={top.code} card={p.cards.get(top.code)} sizes={SIZES} label={label} onClick={open} />
      )}
      {top?.face === 'down' && !back ? (
        <span className={twMerge(MARK, 'top-0 right-0 text-ink')}>
          <Icon name="down" size={14} label={t('faceDown')} />
        </span>
      ) : null}
      <span className={twMerge(BADGE, 'right-0 bottom-0 bg-space-000 text-ink')}>{ids.length}</span>
    </>
  )
}
