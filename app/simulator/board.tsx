'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useLayoutEffect, useRef } from 'react'
import { twMerge } from 'tailwind-merge'
import { Icon, type IconName } from '@ui/icon'
import { CardTile } from '@app/deck-builder/card-tile'
import { useLongPress } from '@app/deck-builder/gestures'
import type { CardMap } from '@utils/deck/types'
import { isMonsterSlot, isSlot, locate, stepCards } from '@utils/simulator/board'
import type { Action, Board, Card, MonsterSlot, Pile, Slot, ZoneId } from '@utils/simulator/types'
import { fly, lookOf, poseOf, sink, sizeOf, type Pose } from './fx'
import type { Drag } from './use-drag'

/** The card that was activated and the cards it targets. */
export type Activation = { card: number; targets: number[] }

export type BoardViewProps = {
  board: Board
  cards: CardMap
  selected: number | null
  /** What to show of an activation: the glow on its card, a mark and an arrow for each target. */
  activation: Activation | null
  /** The cards the step on screen played: corner brackets on each. */
  marked: number[]
  /** Where the session stands: a move of one step slides the cards of that step, and only those. */
  step: { cursor: number; actions: readonly Action[] }
  /** A card a drag just dropped: it is already where the pointer let go, so it does not slide. Read once, then cleared. */
  droppedRef: React.RefObject<number | null>
  /** How long a card takes to slide into its new place. */
  flipMs: number
  onCard(id: number, e: React.MouseEvent): void
  onMenu(id: number, e: React.MouseEvent): void
  /** A long press: the menu opens at the finger, which no click event carries. */
  onLongPress(id: number, at: { x: number; y: number }): void
  /** A double-click (or double-tap) on a card. */
  onActivate(id: number): void
  drag: Drag
  /** A pile, or a monster slot whose Xyz materials the player wants to see. */
  onPile(zone: Pile | MonsterSlot): void
  /** The pointer came over a card, or left it: the card panel follows. */
  onHover?(id: number | null): void
  /** The card the panel is locked on; its lock button is lit. Without `onLock` no card shows one. */
  locked?: number | null
  onLock?(id: number): void
  /** The card the step on screen destroyed and where it was: cracks over both places. */
  destroyed?: { card: number; from: ZoneId } | null
  /** Show the tags: on the last frame, where the line ends. */
  tags?: boolean
  /** A card width in px, in place of the one that fits the box: the render page sizes the board itself. */
  cardW?: number
  /** What card faces and backs ask `next/image` for; by default the widest the board draws them, 150px. */
  imageSizes?: string
  /** The board fills a box of known height, the stage's, its hand in a fan along the bottom edge; else it flows, the hand under it. */
  fill?: boolean
}

/** `[zone, column, row]` on the 7 × 5 grid. Banished takes the EMZ row's last column, above the GY. */
const LAYOUT: [Exclude<ZoneId, 'hand'>, number, number][] = [
  ['emz0', 3, 3], ['emz1', 5, 3], ['banished', 7, 3],
  ['field', 1, 4], ['m0', 2, 4], ['m1', 3, 4], ['m2', 4, 4], ['m3', 5, 4], ['m4', 6, 4], ['gy', 7, 4],
  ['extra', 1, 5], ['s0', 2, 5], ['s1', 3, 5], ['s2', 4, 5], ['s3', 5, 5], ['s4', 6, 5], ['deck', 7, 5],
]

/** The rival's cells, scenery with no `data-zone`: `[column, row, what stands there]`, the player's side turned round. */
const RIVAL: [number, number, 'pile' | 'monster' | 'empty'][] = [
  [1, 1, 'pile'], [2, 1, 'empty'], [3, 1, 'empty'], [4, 1, 'empty'], [5, 1, 'empty'], [6, 1, 'empty'], [7, 1, 'pile'],
  [1, 2, 'empty'], [2, 2, 'monster'], [3, 2, 'monster'], [4, 2, 'monster'], [5, 2, 'monster'], [6, 2, 'monster'], [7, 2, 'empty'],
  [1, 3, 'empty'],
]

/** The circuits under the player's half, in a 70 × 50 box of the mat; the rival's half mirrors them. */
const VEINS = [
  'M35 30V33L33 35V40L35 42V50',
  'M31 27L28 30V34L25 37V43L22 46V50',
  'M39 27L42 30V34L45 37V43L48 46V50',
  'M28 25H14L11 28V38L8 41V50',
  'M42 25H56L59 28V38L62 41V50',
]

const SIZES = '150px'
const RIVAL_HAND = [0, 1, 2, 3, 4]
const BADGE = 'pointer-events-none absolute px-1 font-mono text-[11px] leading-4 font-bold tabular-nums'
/** A small marker over a card's corner (negated, face-down). */
export const MARK = 'pointer-events-none absolute grid size-4 place-items-center bg-space-000'

const Back = ({ sizes = SIZES }: { sizes?: string }) => (
  <Image src="/back.webp" alt="" fill sizes={sizes} draggable={false} className="pointer-events-none object-cover" />
)

/**
 * Over a card, never in the way of a click: the glow of the card that was activated (a gold halo that pulses three
 * times when motion is welcome, then stays lit, as it always is when motion is not) and a dashed ring on each of its targets.
 */
export const ActivationMarks = ({ active, targeted }: { active: boolean; targeted: boolean }) => (
  <>
    {active ? (
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 z-1 bg-ground-gold shadow-[0_0_18px_6px_var(--color-gold)] outline outline-2 outline-gold motion-safe:animate-pulse motion-safe:[animation-iteration-count:3]"
      />
    ) : null}
    {targeted ? <span aria-hidden className="pointer-events-none absolute inset-0 outline outline-2 -outline-offset-2 outline-dashed outline-crimson-lift" /> : null}
  </>
)


/**
 * What an empty zone shows, faint: a gravestone in the GY, an X in Banished, a gem lying on its side in each Pendulum
 * Zone (blue on the left, red on the right, each pointing out), the Field Spell mark in the Field Zone.
 */
const ZoneMark = ({ zone }: { zone: ZoneId }) => {
  const icon = (name: IconName, className: string) => <Icon name={name} className={twMerge('size-1/2', className)} />
  const mark =
    zone === 'gy' ? icon('grave', 'text-ink-muted')
    : zone === 'banished' ? icon('xmark', 'text-ink-muted')
    : zone === 's0' ? icon('gem', 'rotate-90 text-azure')
    : zone === 's4' ? icon('gem', '-rotate-90 text-crimson')
    : zone === 'field' ? <Image src="/icons/field.png" alt="" fill sizes="42px" className="object-contain p-[22%]" />
    : /^m\d$/.test(zone) ? <span className="sim-arrow" />
    : null
  return mark ? <span aria-hidden className="pointer-events-none absolute inset-0 grid place-items-center opacity-40">{mark}</span> : null
}

/** The circuits under the glass: the player's half, then the same turned over for the rival's. */
const Veins = () => (
  <svg aria-hidden className="sim-veins" viewBox="0 0 70 50" preserveAspectRatio="none">
    {[undefined, 'matrix(1 0 0 -1 0 50)'].map((transform) => (
      <g key={transform ?? 'near'} transform={transform}>
        {VEINS.map((d) => (
          <path key={d} d={d} />
        ))}
        {VEINS.map((d, i) => (
          <path key={d} className="sim-vein-pulse" d={d} pathLength={100} style={{ '--d': `${-i * 1.7 - (transform ? 0.9 : 0)}s` } as React.CSSProperties} />
        ))}
      </g>
    ))}
  </svg>
)

/** The hexagon at the heart of the table: the turn, the phase under it. */
const Core = ({ turn }: { turn: number }) => {
  const t = useTranslations('Simulator')
  return (
    <div className="sim-core">
      <span className="sim-core-turn text-ink dock-title">{t('turn', { n: turn })}</span>
    </div>
  )
}

/** Cracks and a crimson glow: the card was destroyed in the step on screen. Over the cell it left and the pile it went to. */
const DestroyMark = () => (
  <span aria-hidden data-destroyed className="pointer-events-none absolute inset-0 z-2 motion-safe:animate-pulse">
    <span className="absolute inset-0 bg-crimson/30 shadow-[0_0_16px_4px_var(--color-crimson)] outline outline-2 outline-crimson-lift" />
    <svg viewBox="0 0 59 86" preserveAspectRatio="none" className="absolute inset-0 size-full fill-none stroke-crimson-lift stroke-[2.5] [stroke-linecap:round] [stroke-linejoin:round]">
      <path d="M31 1 27 24 36 43 24 60 33 85M27 24 8 16M36 43 52 33M24 60 6 68M36 43 40 56M27 24 32 8" />
    </svg>
  </span>
)

/** The tag of a card, in a box over it with a point down at it: what the card is, in a few words. */
const Tag = ({ text }: { text: string }) => (
  <span
    data-tag
    className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 w-max max-w-[calc(var(--card-w)*2.2)] -translate-x-1/2 bg-ink px-1.5 py-0.5 text-center font-mono text-[10px] leading-3 font-bold break-words text-space-000 shadow-lift after:absolute after:top-full after:left-1/2 after:-translate-x-1/2 after:border-4 after:border-transparent after:border-t-ink"
  >
    {text}
  </span>
)

/** The counters on a card, one badge per kind from the bottom-left corner up: the count alone for the plain kind, the kind's first letters before it otherwise. */
const Counters = ({ counters, plain }: { counters: Record<string, number>; plain: string }) => (
  <span className="pointer-events-none absolute bottom-0 left-0 flex flex-col-reverse items-start gap-px">
    {Object.entries(counters).map(([kind, n]) => (
      <span key={kind} title={kind || plain} className="bg-gold px-1 font-mono text-[11px] leading-4 font-bold text-gold-on tabular-nums">
        {kind ? `${kind.slice(0, 3).toUpperCase()} ${n}` : n}
      </span>
    ))}
  </span>
)

/** Corner brackets around a card the step on screen played. */
const StepMark = () => (
  <span aria-hidden className="pointer-events-none absolute -inset-1 z-1">
    <span className="absolute top-0 left-0 size-2.5 border-t-2 border-l-2 border-cyan" />
    <span className="absolute top-0 right-0 size-2.5 border-t-2 border-r-2 border-cyan" />
    <span className="absolute bottom-0 left-0 size-2.5 border-b-2 border-l-2 border-cyan" />
    <span className="absolute right-0 bottom-0 size-2.5 border-r-2 border-b-2 border-cyan" />
  </span>
)

/** An arrowhead's barbs, in px, and how far they spread from the line. */
const HEAD = 10
const SPREAD = 0.5
/** How long a card takes to fly to its new place at 1x: slow enough to follow. */
export const FLIP_MS = 450
/** What a flight is drawn through where the field lies flat and there is no camera to read: far enough to change nothing. */
const NO_CAMERA = 4000

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
  const { board, activation, droppedRef, flipMs } = p
  const { cursor, actions } = p.step
  const root = useRef<HTMLDivElement>(null)
  const arrows = useRef<SVGSVGElement>(null)
  const fx = useRef<HTMLDivElement>(null)

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

  // The flights, after the arrows so they measure where the cards land. Each card's pose and look are kept; on the next
  // board the cards of the step between the two fly from there: one step on, the step just played; one step back, the step
  // undone. Everything else jumps to its place (the hand closing a gap, a seek, a new hand), so the eye has one card to
  // follow. A card that was in a pile had no button there, so it leaves from the pile's cell; one a drag just dropped is
  // already there. The button is measured, since in DEF its box is the turned card; its wrapper is what hides.
  // ponytail: poses are only taken on a board change, so a resize in between flies a card from the old spot; re-measure from the ResizeObserver if that shows.
  const seen = useRef<{ board: Board; cursor: number; actions: readonly Action[]; at: Map<number, Pose>; looks: Map<number, HTMLElement> } | null>(null)
  useLayoutEffect(() => {
    const el = root.current
    const layer = fx.current
    if (!el || !layer) return
    layer.replaceChildren()
    const origin = el.getBoundingClientRect()
    const before = seen.current
    const motion = matchMedia('(prefers-reduced-motion: no-preference)').matches
    const played = before && cursor === before.cursor + 1 ? actions[cursor - 1] : undefined
    const undone = before && cursor === before.cursor - 1 ? before.actions[cursor] : undefined
    const moving = played ? stepCards(played, before!.board) : undone ? stepCards(undone, board) : []
    const landed = droppedRef.current
    droppedRef.current = null
    const tilt = parseFloat(getComputedStyle(el).getPropertyValue('--tilt')) || 0
    const camera = parseFloat(getComputedStyle(el.querySelector('.sim-tilt')!).perspective) || NO_CAMERA
    const pose = (box: HTMLElement) => poseOf(box, origin, box.closest('[data-mat]') ? tilt : 0)
    const cell = (zone: ZoneId) => el.querySelector<HTMLElement>(`[data-zone="${zone}"]`)!

    const now = new Map<number, Pose>()
    const looks = new Map<number, HTMLElement>()
    for (const card of el.querySelectorAll<HTMLElement>('[data-card]')) {
      const id = Number(card.dataset.card)
      const at = pose(card)
      now.set(id, at)
      looks.set(id, lookOf(card))
      if (!motion || !before || !moving.includes(id) || id === landed) continue
      const pile = before.at.has(id) ? null : locate(before.board, id)?.zone
      const from = before.at.get(id) ?? (pile ? pose(cell(pile)) : null)
      if (!from || (from.x === at.x && from.y === at.y)) continue
      fly(layer, before.looks.get(id) ?? lookOf(card), from, at, sizeOf(card), camera, flipMs)
      sink(card.parentElement, flipMs)
    }
    // A card that went into a pile has no button there: its copy lands on the pile, whose top shows once it has, when that top is this card.
    for (const id of moving) {
      if (!motion || !before || now.has(id) || id === landed) continue
      const to = locate(board, id)
      if (!to || isSlot(to.zone) || to.index !== 0) continue
      const from = before.at.get(id)
      const look = before.looks.get(id)
      if (!from || !look) continue
      fly(layer, look, from, pose(cell(to.zone)), sizeOf(cell(to.zone)), camera, flipMs)
      sink(cell(to.zone).querySelector('[data-pile] > *'), flipMs)
    }
    seen.current = { board, cursor, actions, at: now, looks }
  }, [board, cursor, actions, flipMs, droppedRef])

  return (
    <div
      ref={root}
      data-fill={p.fill || undefined}
      style={p.cardW === undefined ? undefined : ({ '--card-w': `${p.cardW}px` } as React.CSSProperties)}
      className="sim-board"
    >
      <div aria-hidden className="sim-rival-hand">
        {RIVAL_HAND.map((n) => (
          <span key={n}>
            <Back sizes="96px" />
          </span>
        ))}
      </div>
      <div className="sim-tilt">
        <div data-mat className="sim-mat">
          <span aria-hidden className="sim-table cut notch" />
          <span aria-hidden className="sim-table-front" />
          <Veins />
          <div className="sim-grid">
            {RIVAL.map(([column, row, kind]) => (
              <span key={`${column}:${row}`} aria-hidden style={{ gridColumn: column, gridRow: row }} className="sim-rival">
                <span className="sim-plate cut notch" />
                {kind === 'monster' ? <span className="sim-arrow" /> : null}
                {kind === 'pile' ? <Back /> : null}
              </span>
            ))}
            {LAYOUT.map(([zone, column, row]) => (
              <div key={zone} role="group" aria-label={t(`zones.${zone}`)} data-zone={zone} style={{ gridColumn: column, gridRow: row }} className="sim-zone">
                <span aria-hidden className="sim-plate cut notch" />
                {p.board.zones[zone].length ? null : <ZoneMark zone={zone} />}
                {isSlot(zone) ? <Stack zone={zone} p={p} /> : <PileView pile={zone} p={p} />}
                {p.destroyed?.from === zone ? <DestroyMark /> : null}
              </div>
            ))}
            <Core turn={board.turn} />
          </div>
        </div>
      </div>
      {/* Centred; when a card leaves, the others jump to their new place (only the card of the step slides). */}
      <div role="group" aria-label={t('zones.hand')} data-zone="hand" className="sim-hand">
        {p.board.zones.hand.map((id) => (
          <div key={id} className="sim-hand-slot">
            <CardView id={id} p={p} className="sim-hand-card" />
          </div>
        ))}
      </div>
      <svg
        ref={arrows}
        aria-hidden
        data-arrows
        className="pointer-events-none absolute inset-0 z-10 size-full overflow-visible fill-none stroke-gold stroke-3 [stroke-linecap:round] [stroke-linejoin:round]"
      />
      <div ref={fx} aria-hidden className="sim-fx" />
    </div>
  )
}

/**
 * A monster or spell slot: the card on top, its Xyz materials peeking out under it. Only a few pixels of them
 * show, so the materials button over the top card (or Materials in its menu) is the way in: it opens the list of
 * materials. A focused material comes up over the top card.
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
          title={t('pile.materials', { count: materials.length })}
          onClick={() => p.onPile(zone)}
          className="absolute top-0 left-0 z-3 flex min-h-5 cursor-pointer items-center gap-0.5 bg-space-000 px-1 font-mono text-[11px] leading-4 font-bold text-ink tabular-nums hover:text-cyan focus-visible:text-cyan"
        >
          <Icon name="cards" size={11} />
          {materials.length}
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
  // Not in the hand: there the brackets of a draw would cover every card.
  const marked = p.marked.includes(id) && !p.board.zones.hand.includes(id)
  const locked = p.locked === id
  const name = p.cards.get(card.code)?.name ?? String(card.code)
  return (
    <div className={twMerge('group relative', className)} onPointerEnter={() => p.onHover?.(id)} onPointerLeave={() => p.onHover?.(null)}>
      {/* DEF: turned and scaled by 59/86 so the sideways card fits its cell. */}
      <div className={twMerge('relative', card.pos === 'def' && 'scale-[calc(59/86)] rotate-90')}>
        <CardTile
          id={card.code}
          card={p.cards.get(card.code)}
          sizes={p.imageSizes ?? SIZES}
          data-card={id}
          data-pos={card.pos}
          data-active={active || undefined}
          data-targeted={targeted || undefined}
          data-step={marked || undefined}
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
        {card.face === 'down' ? <Back sizes={p.imageSizes} /> : null}
        <ActivationMarks active={active} targeted={targeted} />
        {marked ? <StepMark /> : null}
      </div>
      {card.negated ? (
        <span className={twMerge(MARK, 'top-0 right-0 text-crimson-lift')}>
          <Icon name="close" size={14} label={t('negated')} />
        </span>
      ) : null}
      <Counters counters={card.counters} plain={t('menu.counterPlain')} />
      {p.tags && card.tag ? <Tag text={card.tag} /> : null}
      {/* A sibling of the tile, not a child: a click here never selects, drags or opens the menu. Shown on hover or
          focus, on the selected card where there is no hover, and always once lit. */}
      {p.onLock ? (
        <button
          type="button"
          aria-label={t(locked ? 'lock.unlock' : 'lock.lock', { name })}
          title={t(locked ? 'lock.unlock' : 'lock.lock', { name })}
          aria-pressed={locked}
          onClick={() => p.onLock!(id)}
          className={twMerge(
            'absolute right-0 bottom-0 z-3 grid size-6 cursor-pointer place-items-center bg-space-000 text-ink opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:text-cyan pointer-coarse:after:absolute pointer-coarse:after:right-0 pointer-coarse:after:bottom-0 pointer-coarse:after:size-10',
            (locked || p.selected === id) && 'opacity-100',
            locked && 'text-gold',
          )}
        >
          <Icon name={locked ? 'lock' : 'unlock'} size={13} />
        </button>
      ) : null}
    </div>
  )
}

/**
 * Deck, Extra, GY or Banished: the count and the top card (the back for Deck and Extra). A click opens the pile. A card
 * of the pile being activated shows on top, face-up and glowing, while its step is on screen; the pile's real order
 * stays as it is (a Deck card activated there is not the next draw).
 */
const PileView = ({ pile, p }: { pile: Exclude<Pile, 'hand'>; p: BoardViewProps }) => {
  const t = useTranslations('Simulator')
  const ids = p.board.zones[pile]
  const activated = p.activation && ids.includes(p.activation.card) ? p.activation.card : null
  const topId = activated ?? ids[0]
  const top = topId === undefined ? null : p.board.cards[topId]!
  const label = t(`zones.${pile}`)
  const open = () => p.onPile(pile)
  const back = (pile === 'deck' || pile === 'extra') && activated === null
  return (
    <div data-pile className="absolute inset-0" onPointerEnter={() => top && p.onHover?.(top.id)} onPointerLeave={() => p.onHover?.(null)}>
      {!top ? null : back ? (
        <button type="button" aria-label={label} onClick={open} className="relative block aspect-[59/86] w-full cursor-pointer">
          <Back sizes={p.imageSizes} />
        </button>
      ) : (
        <CardTile id={top.code} card={p.cards.get(top.code)} sizes={p.imageSizes ?? SIZES} label={label} onClick={open} data-active={activated !== null || undefined} />
      )}
      {top ? <ActivationMarks active={activated !== null} targeted={!!p.activation?.targets.includes(top.id)} /> : null}
      {top?.face === 'down' && !back && activated === null ? (
        <span className={twMerge(MARK, 'top-0 right-0 text-ink')}>
          <Icon name="down" size={14} label={t('faceDown')} />
        </span>
      ) : null}
      <span className={twMerge(BADGE, 'right-0 bottom-0 bg-space-000 text-ink')}>{ids.length}</span>
      {/* The card the step just put on top of the pile (a send to the GY, a banish). */}
      {top && p.marked.includes(top.id) ? <StepMark /> : null}
      {top && p.destroyed?.card === top.id ? <DestroyMark /> : null}
      {top && p.tags && top.tag && !back ? <Tag text={top.tag} /> : null}
    </div>
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
