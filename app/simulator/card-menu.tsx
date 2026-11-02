'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Icon } from '@ui/icon'
import { CardTile } from '@app/deck-builder/card-tile'
import type { CardData } from '@utils/deck/types'
import { apply, isMonsterSlot, isSlot, isValid, locate, shuffleAction } from '@utils/simulator/board'
import type { Stance } from '@utils/simulator/drop'
import { LIMITS, PLAIN } from '@utils/simulator/types'
import type { Action, Board, Face, How, MonsterSlot, Pos, ZoneId } from '@utils/simulator/types'

export type CardMenuProps = {
  board: Board
  card: number
  /** Viewport point the menu opens at; the menu slides back inside the viewport when it would overflow. */
  at: { x: number; y: number }
  /** The counter kinds on offer besides the plain one. */
  kinds: string[]
  /** The card is one of the Extra Deck's: "Hand" and "Shuffle into the deck" send it back to the Extra Deck instead. */
  extra: boolean
  onAct(actions: Action[]): void
  onTargets(card: number): void
  /** Asks the name of a new counter kind, then puts one of it on the card. */
  onNewKind(card: number): void
  onTag(card: number): void
  /** Opens the Xyz materials under the monster on top of `zone`: on a phone the ×N badge is too small to be the only way in. */
  onPile(zone: MonsterSlot): void
  onClose(): void
  /** The card's data, when it loaded: the head of the menu, and what it can be played as. An unknown card is offered as a monster. */
  data?: CardData
  /** Brings the card into play: the board then asks for the zone. */
  onPlace(card: number, how: How, stance?: Stance): void
}

/** One item: it opens a submenu (`sub`), runs a callback, or performs actions; the last two close the menu. */
type Entry = { key: string; label: string } & ({ sub: Entry[] } | { run(): void } | { actions: Action[] })
/** The open submenus, outermost first, each with the item that opened it. `focus`: their first item takes the focus. */
type Open = { trail: { key: string; from: HTMLElement }[]; focus: boolean }

/** Space kept between the menu and the viewport edge. */
const MARGIN = 8
/** How long the pointer rests on an item before its submenu swaps: on the way to an open submenu it may cross the items below. */
const HOVER_MS = 120
const ITEM =
  'sim-menu-item flex w-full cursor-pointer items-center gap-2 border-b border-line px-4 py-3 text-left whitespace-nowrap text-ink-dim signal-strong last:border-b-0 hover:bg-surface-300 hover:text-ink focus-visible:bg-surface-300 focus-visible:text-ink focus-visible:-outline-offset-2 aria-expanded:bg-surface-300 aria-expanded:text-ink max-lg:min-h-11'
/** The items a digit key reaches. */
const KEYED = 9

type ListProps = {
  label: string
  entries: Entry[]
  /** The item this list hangs from; the first list opens at `at` instead. */
  from: HTMLElement | null
  at: { x: number; y: number }
  /** The key of the item whose submenu is open. */
  expanded?: string
  onChoose(entry: Entry, item: HTMLElement): void
  onHover(entry: Entry, item: HTMLElement): void
  onKeyDown(e: React.KeyboardEvent<HTMLDivElement>): void
  children?: React.ReactNode
}

/** One level of the menu: beside the item it hangs from, on the other side when it would overflow. */
const MenuList = ({ label, entries, from, at, expanded, onChoose, onHover, onKeyDown, children }: ListProps) => {
  const root = useRef<HTMLDivElement>(null)

  // Measured after layout and written straight to the DOM: a list must not spill off the screen.
  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    const box = from?.getBoundingClientRect()
    const x = !box ? at.x : box.right + width + MARGIN > window.innerWidth ? box.left - width : box.right
    el.style.left = `${Math.max(MARGIN, Math.min(x, window.innerWidth - width - MARGIN))}px`
    el.style.top = `${Math.max(MARGIN, Math.min(box?.top ?? at.y, window.innerHeight - height - MARGIN))}px`
  }, [at.x, at.y, from])

  return (
    <div
      ref={root}
      role="menu"
      aria-label={label}
      onKeyDown={onKeyDown}
      style={{ left: at.x, top: at.y }}
      className="fixed z-(--z-modal) max-h-[calc(100dvh-16px)] max-w-[calc(100vw-16px)] min-w-60 overflow-y-auto border border-line-mid bg-surface-100 shadow-lift motion-safe:animate-fade-in"
    >
      {children}
      {entries.map((entry, i) => (
        <button
          key={entry.key}
          type="button"
          role="menuitem"
          tabIndex={-1}
          aria-haspopup={'sub' in entry ? 'menu' : undefined}
          aria-expanded={'sub' in entry ? entry.key === expanded : undefined}
          data-key={i < KEYED ? i + 1 : undefined}
          onClick={(e) => onChoose(entry, e.currentTarget)}
          onPointerEnter={(e) => e.pointerType !== 'touch' && onHover(entry, e.currentTarget)}
          className={ITEM}
        >
          <span className="mr-auto pr-4">{entry.label}</span>
          {'sub' in entry ? <Icon name="right" size={14} /> : null}
        </button>
      ))}
    </div>
  )
}

/**
 * What a card can do, moves from zone to zone left to dragging. Opens at `at` with the first item focused; the card's name
 * heads the list, and what brings it into play comes first: from the hand a monster's Normal Summon, Special Summon and Set;
 * from a pile a monster's Special Summon; from either a Spell or Trap's Set. Activate leaves the card where it is, wherever
 * that is. Everything ends on Send to, Destroy and Shuffle into Deck.
 *
 * A submenu opens beside its item as the pointer rests on it; a tap or a click opens it too, for a finger and for the keyboard.
 * Arrows move between items, right and left in and out of a submenu; Escape, a pointer down outside or choosing an item closes
 * the menu and the focus goes back to the card; a digit picks that item.
 */
export const CardMenu = ({ board, card, at, kinds, extra, onAct, onTargets, onNewKind, onTag, onPile, onClose, data, onPlace }: CardMenuProps) => {
  const t = useTranslations('SimulatorNew')
  const [open, setOpen] = useState<Open>({ trail: [], focus: true })
  const root = useRef<HTMLDivElement>(null)
  const hovering = useRef<ReturnType<typeof setTimeout>>(undefined)

  /** Where a move chosen here sends the card: its pile has no `[data-card]` on the board, so the pile's own button takes the focus. */
  const landing = useRef<ZoneId | null>(null)

  // Declared first so its cleanup returns the focus after the list is gone, even when the card has moved elsewhere on the board.
  useEffect(() => {
    const active = document.activeElement
    const opener = active instanceof HTMLElement && active.matches(`[data-card="${card}"]`) ? active : null
    return () => {
      const pile = landing.current && document.querySelector<HTMLElement>(`[data-zone="${landing.current}"] button`)
      const target = opener?.isConnected ? opener : (document.querySelector<HTMLElement>(`[data-card="${card}"]`) ?? pile)
      target?.focus()
    }
  }, [card])

  useEffect(() => {
    if (open.focus) [...(root.current?.querySelectorAll<HTMLElement>('[role="menu"]') ?? [])].at(-1)?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
  }, [open])

  useEffect(() => () => clearTimeout(hovering.current), [])

  useEffect(() => {
    const away = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) onClose()
    }
    const escape = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation() // the key closes the menu and nothing else
      onClose()
    }
    document.addEventListener('pointerdown', away)
    document.addEventListener('keydown', escape, true)
    return () => {
      document.removeEventListener('pointerdown', away)
      document.removeEventListener('keydown', escape, true)
    }
  }, [onClose])

  const state = board.cards[card]
  const where = locate(board, card)
  if (!state || !where) return null

  /** Only the card on top of a slot carries a face, a negation and counters; only a monster there has a battle position. */
  const field = isSlot(where.zone) && where.index === 0
  const monster = field && isMonsterSlot(where.zone)
  const slot = where.zone
  const monsterCard = !data || data.kind === 'monster'
  const inHand = where.zone === 'hand'
  const place = (key: How, label: string): Entry => ({ key, label, run: () => onPlace(card, key) })
  const stance = (key: string, label: string, face: Face, pos: Pos): Entry => ({ key, label, run: () => onPlace(card, 'special', { face, pos }) })
  const special: Entry = {
    key: 'special',
    label: t('menu.special'),
    sub: [
      stance('specialAtk', t('menu.specialAtk'), 'up', 'atk'),
      stance('specialDef', t('menu.specialDef'), 'up', 'def'),
      stance('specialDownAtk', t('menu.specialDownAtk'), 'down', 'atk'),
      stance('specialSet', t('menu.specialSet'), 'down', 'def'),
    ],
  }
  /** Wherever the card is, it activates there. */
  const activate: Entry = {
    key: 'activate',
    label: t(monsterCard ? 'menu.activate' : 'menu.play'),
    sub: [
      { key: 'activateNow', label: t('menu.activateNow'), actions: [{ t: 'activate', card, targets: [] }] },
      { key: 'activateTargets', label: t('menu.activateTargets'), run: () => onTargets(card) },
    ],
  }
  const plays: Entry[] =
    isSlot(where.zone) ? [activate]
    : !monsterCard ? [activate, place('set', t('menu.set'))]
    : inHand ? [place('normal', t('menu.normal')), special, activate, place('set', t('menu.set'))]
    : [special, activate]

  /** The plain counter first, then the kinds on offer and any the card already carries. */
  const every = [PLAIN, ...new Set([...kinds, ...Object.keys(state.counters)].filter((kind) => kind !== PLAIN))]
  const nameOf = (kind: string) => kind || t('menu.counterPlain')
  const ofKind = (kind: string): Entry[] => {
    const n = state.counters[kind] ?? 0
    const delta = (d: number): Action => ({ t: 'counter', card, delta: d, ...(kind && { kind }) })
    return [
      ...(n < LIMITS.counters ? [{ key: 'counterUp', label: t('menu.counterUp'), actions: [delta(1)] }] : []),
      ...(n > 0 ? [{ key: 'counterDown', label: t('menu.counterDown'), actions: [delta(-1)] }] : []),
    ]
  }
  const counters: Entry = {
    key: 'counters',
    label: t('menu.counters'),
    sub: [
      ...every.map((kind) => {
        const n = state.counters[kind] ?? 0
        return { key: `kind:${kind}`, label: n ? t('menu.counterKind', { kind: nameOf(kind), n }) : nameOf(kind), sub: ofKind(kind) }
      }),
      { key: 'newKind', label: t('menu.newKind'), run: () => onNewKind(card) },
    ],
  }

  /** A move the board accepts that takes the card somewhere else, or turns it over in its pile. */
  const to = (key: string, label: string, action: Extract<Action, { t: 'move' }>, then: (after: Board) => Action[] = () => []): Entry[] =>
    (action.to !== where.zone || apply(board, action).cards[card]!.face !== state.face) && isValid(board, action) ? [{ key, label, actions: [action, ...then(apply(board, action))] }] : []
  const group = (key: string, label: string, sub: Entry[]): Entry[] => (sub.length ? [{ key, label, sub }] : [])

  const flipTo = (key: string, label: string, face: Face, pos: Pos): Entry => ({ key, label, actions: [{ t: 'flip', card, face, pos }] })
  /** A monster goes face-down in Defense, and comes face-up in the position asked for; a Spell or Trap just turns over. */
  const flip: Entry =
    state.face === 'up' ? flipTo('flip', t('menu.flipDown'), 'down', monster ? 'def' : state.pos)
    : monster ? { key: 'flip', label: t('menu.flipUp'), sub: [flipTo('flipAtk', t('menu.flipAtk'), 'up', 'atk'), flipTo('flipDef', t('menu.flipDef'), 'up', 'def')] }
    : flipTo('flip', t('menu.flipUp'), 'up', state.pos)

  const main: Entry[] = [
    ...plays,
    ...(field
      ? [
          flip,
          ...(monster ? [{ key: 'position', label: t('menu.position'), actions: [{ t: 'flip', card, face: state.face, pos: state.pos === 'atk' ? 'def' : 'atk' } as const] }] : []),
          { key: 'negate', label: t('menu.negate'), actions: [{ t: 'negate', card, on: !state.negated } as const] },
          counters,
        ]
      : []),
    ...(field && isMonsterSlot(slot) && board.zones[slot].length > 1 ? [{ key: 'materials', label: t('menu.materials'), run: () => onPile(slot) }] : []),
    ...group('sendTo', t('menu.sendTo'), [
      ...to('toGy', t('menu.toGy'), { t: 'move', card, to: 'gy' }),
      ...to('banish', t('menu.banish'), { t: 'move', card, to: 'banished' }),
      ...to('banishDown', t('menu.banishDown'), { t: 'move', card, to: 'banished', face: 'down' }),
      ...to('toHand', t(extra ? 'menu.toExtra' : 'menu.toHand'), { t: 'move', card, to: extra ? 'extra' : 'hand' }),
    ]),
    ...group('destroy', t('menu.destroy'), [
      ...to('destroyGy', t('menu.destroyGy'), { t: 'move', card, to: 'gy', destroy: true }),
      ...to('destroyBanish', t('menu.destroyBanish'), { t: 'move', card, to: 'banished', destroy: true }),
    ]),
    // an Extra Deck card has no order to shuffle into: Send to returns it there
    ...(extra ? [] : to('shuffleDeck', t('menu.shuffleDeck'), { t: 'move', card, to: 'deck' }, (after) => [shuffleAction(after)])),
    ...(inHand ? [] : [{ key: 'tag', label: t(state.tag ? 'menu.retag' : 'menu.tag'), run: () => onTag(card) }]),
  ]

  const levels: { label: string; entries: Entry[]; from: HTMLElement | null }[] = [{ label: t('menu.label'), entries: main, from: null }]
  for (const { key, from } of open.trail) {
    const entry = levels.at(-1)!.entries.find((e) => e.key === key)
    if (!entry || !('sub' in entry)) break
    levels.push({ label: entry.label, entries: entry.sub, from })
  }

  const choose = (entry: Entry, item: HTMLElement, depth: number) => {
    clearTimeout(hovering.current)
    if ('sub' in entry) return setOpen({ trail: [...open.trail.slice(0, depth), { key: entry.key, from: item }], focus: true })
    if ('actions' in entry) {
      for (const a of entry.actions) if (a.t === 'move') landing.current = a.to
      onAct(entry.actions)
    } else entry.run()
    onClose()
  }
  const hover = (entry: Entry, item: HTMLElement, depth: number) => {
    clearTimeout(hovering.current)
    hovering.current = setTimeout(() => {
      setOpen(({ trail }) => ({ trail: [...trail.slice(0, depth), ...('sub' in entry ? [{ key: entry.key, from: item }] : [])], focus: false }))
    }, HOVER_MS)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>, depth: number) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      return onClose()
    }
    const { entries } = levels[depth]!
    const items = Array.from(e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]'))
    const focused = items.indexOf(document.activeElement as HTMLElement)
    const digit = Number(e.key)
    if (digit >= 1 && digit <= Math.min(KEYED, entries.length)) {
      e.preventDefault()
      return choose(entries[digit - 1]!, items[digit - 1]!, depth)
    }
    if (e.key === 'ArrowRight' && focused >= 0 && 'sub' in entries[focused]!) {
      e.preventDefault()
      return choose(entries[focused]!, items[focused]!, depth)
    }
    if (e.key === 'ArrowLeft' && depth > 0) {
      e.preventDefault()
      const parent = open.trail[depth - 1]!.from
      setOpen({ trail: open.trail.slice(0, depth - 1), focus: false })
      return parent.focus()
    }
    const next =
      e.key === 'ArrowDown' ? (focused + 1) % items.length
      : e.key === 'ArrowUp' ? (focused <= 0 ? items.length - 1 : focused - 1)
      : e.key === 'Home' ? 0
      : e.key === 'End' ? items.length - 1
      : -1
    if (next < 0) return
    e.preventDefault()
    items[next]?.focus()
  }

  return (
    <div ref={root} className="contents">
      {levels.map(({ label, entries, from }, depth) => (
        <MenuList
          key={`${depth}:${label}`}
          label={label}
          entries={entries}
          from={from}
          at={at}
          expanded={open.trail[depth]?.key}
          onChoose={(entry, item) => choose(entry, item, depth)}
          onHover={(entry, item) => hover(entry, item, depth)}
          onKeyDown={(e) => onKeyDown(e, depth)}
        >
          {depth === 0 ? (
            <div aria-hidden className="flex items-center gap-2 border-b border-line bg-surface-200 px-3 py-2">
              <span className="w-6 shrink-0">
                <CardTile id={state.code} card={data} sizes="24px" disabled tabIndex={-1} className="cursor-default" />
              </span>
              <span className="min-w-0 truncate text-ink body-sm">{data?.name ?? state.code}</span>
            </div>
          ) : null}
        </MenuList>
      ))}
    </div>
  )
}
