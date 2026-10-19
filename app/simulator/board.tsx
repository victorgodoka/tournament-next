'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useLayoutEffect, useRef } from 'react'
import { twMerge } from 'tailwind-merge'
import { Icon } from '@ui/icon'
import { CardTile } from '@app/deck-builder/card-tile'
import { useLongPress } from '@app/deck-builder/gestures'
import type { CardMap } from '@utils/deck/types'
import { isMonsterSlot, isSlot, locate } from '@utils/simulator/board'
import type { Board, Card, MonsterSlot, Pile, Slot, ZoneId } from '@utils/simulator/types'
import type { Drag } from './use-drag'

/** The card that was activated and the cards it targets. */
export type Activation = { card: number; targets: number[] }

export type BoardViewProps = {
  board: Board
  cards: CardMap
  selected: number | null
  /** What to show of an activation: the glow on its card, a mark and an arrow for each target. */
  activation: Activation | null
  onCard(id: number, e: React.MouseEvent): void
  onMenu(id: number, e: React.MouseEvent): void
  /** A long press: the menu opens at the finger, which no click event carries. */
  onLongPress(id: number, at: { x: number; y: number }): void
  /** A double-click (or double-tap) on a card. */
  onActivate(id: number): void
  drag: Drag
  /** A pile, or a monster slot whose Xyz materials the player wants to see. */
  onPile(zone: Pile | MonsterSlot): void
}

/** `[zone, column, row]` on the 7 × 3 grid. Banished takes the EMZ row's last column, above the GY. */
const LAYOUT: [Exclude<ZoneId, 'hand'>, number, number][] = [
  ['emz0', 3, 1], ['emz1', 5, 1], ['banished', 7, 1],
  ['field', 1, 2], ['m0', 2, 2], ['m1', 3, 2], ['m2', 4, 2], ['m3', 5, 2], ['m4', 6, 2], ['gy', 7, 2],
  ['extra', 1, 3], ['s0', 2, 3], ['s1', 3, 3], ['s2', 4, 3], ['s3', 5, 3], ['s4', 6, 3], ['deck', 7, 3],
]

const SIZES = '84px'
const BADGE = 'pointer-events-none absolute px-1 font-mono text-[11px] leading-4 font-bold tabular-nums'
/** A small marker over a card's corner (negated, face-down). */
export const MARK = 'pointer-events-none absolute grid size-4 place-items-center bg-space-000'

const Back = () => <Image src="/back.webp" alt="" fill sizes={SIZES} draggable={false} className="pointer-events-none object-cover" />

/**
 * Over a card, never in the way of a click: the glow of the card that was activated (an outline that pulses when
 * motion is welcome, a still one when it is not) and a dashed ring on each of its targets.
 */
export const ActivationMarks = ({ active, targeted }: { active: boolean; targeted: boolean }) => (
  <>
    {active ? <span aria-hidden className="pointer-events-none absolute inset-0 bg-ground-gold outline outline-2 outline-gold motion-safe:animate-pulse" /> : null}
    {targeted ? <span aria-hidden className="pointer-events-none absolute inset-0 outline outline-2 -outline-offset-2 outline-dashed outline-crimson-lift" /> : null}
  </>
)

/** An arrowhead's barbs, in px, and how far they spread from the line. */
const HEAD = 10
const SPREAD = 0.5

type Point = { x: number; y: number }
const centre = (r: DOMRect): Point => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 })

/** Where the line from the centre of `r` towards `to` leaves `r`; `to` itself when it lies inside. */
const leave = (r: DOMRect, to: Point): Point => {
  const c = centre(r)
  const dx = to.x - c.x
  const dy = to.y - c.y
  const k = Math.min(1, r.width / 2 / Math.abs(dx), r.height / 2 / Math.abs(dy))
  return { x: c.x + dx * k, y: c.y + dy * k }
}

/**
 * Where a card is on the board: its button, or the cell of its pile when it sits in one (a pile shows only its top
 * card, with no `[data-card]`). Looked up inside the board, because the pile panel lists the same ids.
 */
const boxOf = (root: HTMLElement, board: Board, id: number) => {
  const at = locate(board, id)
  return (root.querySelector(`[data-card="${id}"]`) ?? (at && root.querySelector(`[data-zone="${at.zone}"]`)))?.getBoundingClientRect()
}

/** One path per target: a line from the edge of the activated card to the edge of the target, and a head at the target. */
const arrowsFor = (root: HTMLElement, board: Board, activation: Activation | null): SVGPathElement[] => {
  if (!activation) return []
  const from = boxOf(root, board, activation.card)
  if (!from) return []
  const origin = root.getBoundingClientRect()
  const pt = (p: Point) => `${+(p.x - origin.left).toFixed(1)} ${+(p.y - origin.top).toFixed(1)}`
  const paths: SVGPathElement[] = []
  for (const id of activation.targets) {
    const box = boxOf(root, board, id)
    if (!box) continue
    const start = leave(from, centre(box))
    const end = leave(box, centre(from))
    // Cards that overlap, or sit unmeasured (no layout), leave nothing to draw; NaN fails the comparison too.
    if (!(Math.hypot(end.x - start.x, end.y - start.y) > 1)) continue
    const angle = Math.atan2(end.y - start.y, end.x - start.x)
    const barb = (side: number) => pt({ x: end.x - HEAD * Math.cos(angle + side), y: end.y - HEAD * Math.sin(angle + side) })
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path')
    path.setAttribute('d', `M${pt(start)}L${pt(end)}M${barb(SPREAD)}L${pt(end)}L${barb(-SPREAD)}`)
    paths.push(path)
  }
  return paths
}

/**
 * The player's side: seven columns that fit the width (at most 84px a card, 46px at 375px), the hand
 * under them. Every zone is a `[data-zone]` group, every card on the field or in the hand a `[data-card]` button.
 */
export const BoardView = (p: BoardViewProps) => {
  const t = useTranslations('Simulator')
  const { board, activation } = p
  const root = useRef<HTMLDivElement>(null)
  const arrows = useRef<SVGSVGElement>(null)

  // Measured after layout and written straight to the DOM, as the menu is: the arrows follow the cards, and a state update
  // per resize would render the whole board. They are redrawn whenever the board resizes, which moves every card.
  useLayoutEffect(() => {
    const el = root.current
    const svg = arrows.current
    if (!el || !svg) return
    const draw = () => svg.replaceChildren(...arrowsFor(el, board, activation))
    draw()
    if (!activation?.targets.length) return
    const observer = new ResizeObserver(draw)
    observer.observe(el)
    return () => observer.disconnect()
  }, [board, activation])

  return (
    <div ref={root} className="@container relative [--card-w:min(84px,calc((100cqw_-_24px)/7))]">
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
            {isSlot(zone) ? <Stack zone={zone} p={p} /> : <PileView pile={zone} p={p} />}
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
      <svg
        ref={arrows}
        aria-hidden
        data-arrows
        className="pointer-events-none absolute inset-0 z-10 size-full overflow-visible fill-none stroke-gold stroke-3 [stroke-linecap:round] [stroke-linejoin:round]"
      />
    </div>
  )
}

/**
 * A monster or spell slot: the card on top, its Xyz materials peeking out under it. Only a few pixels of them
 * show, so the ×N badge is the way in: it opens the list of materials. A focused material comes up over the top card.
 */
const Stack = ({ zone, p }: { zone: Slot; p: BoardViewProps }) => {
  const t = useTranslations('Simulator')
  const [top, ...materials] = p.board.zones[zone]
  if (top === undefined) return null
  return (
    <>
      <CardView id={top} p={p} className="z-1" />
      {materials.map((id) => (
        <CardView key={id} id={id} p={p} className="absolute inset-0 translate-1 focus-within:z-2" />
      ))}
      {materials.length && isMonsterSlot(zone) ? (
        <button
          type="button"
          aria-label={t('pile.materials', { count: materials.length })}
          onClick={() => p.onPile(zone)}
          className={twMerge(BADGE, 'top-0 left-0 z-1 cursor-pointer bg-space-000 text-ink pointer-events-auto')}
        >
          ×{materials.length}
        </button>
      ) : null}
    </>
  )
}

/**
 * One card: its scan (the back when set), DEF turned sideways, and its negated and counter markers, which stay upright.
 * Mouse: click selects, double-click activates, right-click opens the menu, a drag moves it. Touch: tap selects,
 * double-tap activates, long press opens the menu, a drag moves it (`touch-none`: the card, not the page, takes the swipe).
 */
const CardView = ({ id, p, className }: { id: number; p: BoardViewProps; className?: string }) => {
  const t = useTranslations('Simulator')
  const press = useLongPress()
  /** Move, up and cancel only drop the press; what a long press does is bound on pointer down, where the finger is known. */
  const hold = press.bind(() => {})
  const drag = p.drag.bind(id, true)
  const card = p.board.cards[id]!
  const active = p.activation?.card === id
  const targeted = !!p.activation?.targets.includes(id)
  return (
    <div className={twMerge('relative', className)}>
      {/* DEF: turned and scaled by 59/86 so the sideways card fits its cell. */}
      <div className={twMerge('relative', card.pos === 'def' && 'scale-[calc(59/86)] rotate-90')}>
        <CardTile
          id={card.code}
          card={p.cards.get(card.code)}
          sizes={SIZES}
          data-card={id}
          data-active={active || undefined}
          data-targeted={targeted || undefined}
          onPointerDown={(e) => {
            const at = { x: e.clientX, y: e.clientY }
            press.bind(() => p.onLongPress(id, at)).onPointerDown(e)
            drag.onPointerDown(e)
          }}
          onPointerMove={(e) => {
            hold.onPointerMove(e)
            drag.onPointerMove(e)
          }}
          onPointerUp={(e) => {
            hold.onPointerUp()
            drag.onPointerUp(e)
          }}
          onPointerCancel={(e) => {
            hold.onPointerCancel()
            drag.onPointerCancel(e)
          }}
          onClickCapture={drag.onClickCapture}
          // The release after a long press has nothing left to do: the menu is already open.
          onClick={(e) => press.kind(e) !== 'long' && p.onCard(id, e)}
          onDoubleClick={() => p.onActivate(id)}
          onContextMenu={(e) => (press.kind(e) === 'long' ? e.preventDefault() : p.onMenu(id, e))}
          className={twMerge('touch-none', card.negated && 'grayscale', p.selected === id && 'outline outline-2 outline-cyan')}
        />
        {card.face === 'down' ? <Back /> : null}
        <ActivationMarks active={active} targeted={targeted} />
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

/**
 * The card under the pointer while it is dragged; `useDrag` moves it. Rendered by the page, not the board: the
 * board's container query box would be the containing block of anything fixed inside it.
 */
export const DragGhost = ({ card, cards, ghostRef }: { card: Card | undefined; cards: CardMap; ghostRef: React.RefObject<HTMLDivElement | null> }) => {
  if (!card) return null
  return (
    <div ref={ghostRef} inert className="pointer-events-none fixed top-0 left-0 z-(--z-overlay)">
      <div className="relative w-16 -translate-1/2 opacity-80 shadow-lift">
        <CardTile id={card.code} card={cards.get(card.code)} sizes="64px" tabIndex={-1} />
        {card.face === 'down' ? <Back /> : null}
      </div>
    </div>
  )
}
