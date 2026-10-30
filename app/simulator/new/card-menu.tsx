'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { CardTile } from '@app/deck-builder/card-tile'
import type { CardData } from '@utils/deck/types'
import { apply, isMonsterSlot, isSlot, isValid, locate, shuffleAction } from '@utils/simulator/board'
import { moveOptions, type Placing } from '@utils/simulator/drop'
import { LIMITS, PLAIN } from '@utils/simulator/types'
import type { Action, Board, MonsterSlot, ZoneId } from '@utils/simulator/types'

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
  /** The card is an Xyz monster: over an occupied monster zone it is offered the top first. */
  xyz?: boolean
  /** The card's data, when it loaded: the head of the menu, and what it can be played as. An unknown card is offered as a monster. */
  data?: CardData
  /** Brings the card into play: the board then asks for the zone. */
  onPlace?(card: number, how: Placing): void
}

/** The list on screen: the main one, a submenu, or the counters of one kind. */
type View = 'main' | 'activate' | 'counters' | 'move' | 'zones' | { kind: string }
/** One item: it swaps the list (`go`), runs a callback, or performs actions; the last two close the menu. */
type Entry = { key: string; label: string } & ({ go: View } | { run(): void } | { actions: Action[] })

/** Space kept between the menu and the viewport edge. */
const MARGIN = 8
const ITEM =
  'sim-menu-item flex w-full cursor-pointer items-center justify-between gap-6 border-b border-line px-4 py-3 text-left whitespace-nowrap text-ink-dim signal-strong last:border-b-0 hover:bg-surface-300 hover:text-ink focus-visible:bg-surface-300 focus-visible:text-ink focus-visible:-outline-offset-2 max-lg:min-h-11'
/** The items a digit key reaches. */
const KEYED = 9

/**
 * The keyboard path for every move, and for the rest of what a card can do. Opens at `at` with the first item
 * focused; arrows move between items; Escape, a pointer down outside or choosing an item closes it and the focus
 * goes back to the card; a digit picks that item. Submenus swap the list: Activate, Manage counters (one list per kind),
 * Move card and its "Move to a different zone" with every zone the card can go to. The card's name heads the list, and
 * what brings it into play comes first: Normal Summon and Set from the hand, Special Summon from anywhere off the field.
 */
export const CardMenu = ({ board, card, at, kinds, extra, onAct, onTargets, onNewKind, onTag, onPile, onClose, xyz = false, data, onPlace }: CardMenuProps) => {
  const t = useTranslations('SimulatorNew')
  const [view, setView] = useState<View>('main')
  const root = useRef<HTMLDivElement>(null)

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
    root.current?.querySelector<HTMLElement>('[role="menuitem"]')?.focus()
  }, [view])

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

  // Measured after layout and written straight to the DOM: a long "Move to…" list must not spill off the screen.
  useLayoutEffect(() => {
    const el = root.current
    if (!el) return
    const { width, height } = el.getBoundingClientRect()
    el.style.left = `${Math.max(MARGIN, Math.min(at.x, window.innerWidth - width - MARGIN))}px`
    el.style.top = `${Math.max(MARGIN, Math.min(at.y, window.innerHeight - height - MARGIN))}px`
  }, [at.x, at.y, view])

  const state = board.cards[card]
  const where = locate(board, card)
  if (!state || !where) return null

  const choose = (entry: Entry) => {
    if ('go' in entry) return setView(entry.go)
    if ('actions' in entry) {
      for (const a of entry.actions) if (a.t === 'move') landing.current = a.to
      onAct(entry.actions)
    } else entry.run()
    onClose()
  }
  /** Only the card on top of a slot carries a face, a negation and counters; only a monster there has a battle position. */
  const field = isSlot(where.zone) && where.index === 0
  const monster = field && isMonsterSlot(where.zone)
  const slot = where.zone
  const back: Entry = { key: 'back', label: t('menu.back'), go: 'main' }
  const monsterCard = !data || data.kind === 'monster'
  const place = (key: Placing, label: string): Entry => ({ key, label, run: () => onPlace?.(card, key) })
  const plays: Entry[] = !onPlace ? []
    : where.zone === 'hand' && !monsterCard ? [place('activate', t('menu.play')), place('set', t('menu.set'))]
    : monsterCard && !isSlot(where.zone) ? [...(where.zone === 'hand' ? [place('normal', t('menu.normal')), place('set', t('menu.set'))] : []), place('special', t('menu.special'))]
    : []

  const main: Entry[] = [
    ...plays,
    { key: 'activate', label: t('menu.activate'), go: 'activate' },
    ...(field
      ? [
          { key: 'flip', label: t(state.face === 'up' ? 'menu.flipDown' : 'menu.flipUp'), actions: [{ t: 'flip', card, face: state.face === 'up' ? 'down' : 'up', pos: state.pos } as const] },
          ...(monster ? [{ key: 'position', label: t('menu.position'), actions: [{ t: 'flip', card, face: state.face, pos: state.pos === 'atk' ? 'def' : 'atk' } as const] }] : []),
          { key: 'negate', label: t('menu.negate'), actions: [{ t: 'negate', card, on: !state.negated } as const] },
          { key: 'counters', label: t('menu.counters'), go: 'counters' as const },
        ]
      : []),
    ...(field && isMonsterSlot(slot) && board.zones[slot].length > 1 ? [{ key: 'materials', label: t('menu.materials'), run: () => onPile(slot) }] : []),
    { key: 'moveTo', label: t('menu.moveTo'), go: 'move' },
    { key: 'tag', label: t(state.tag ? 'menu.retag' : 'menu.tag'), run: () => onTag(card) },
  ]

  const activate: Entry[] = [
    back,
    { key: 'activateNow', label: t('menu.activateNow'), actions: [{ t: 'activate', card, targets: [] }] },
    { key: 'activateTargets', label: t('menu.activateTargets'), run: () => onTargets(card) },
  ]

  /** The plain counter first, then the kinds on offer and any the card already carries. */
  const every = [PLAIN, ...new Set([...kinds, ...Object.keys(state.counters)].filter((kind) => kind !== PLAIN))]
  const nameOf = (kind: string) => kind || t('menu.counterPlain')
  const counters: Entry[] = [
    back,
    ...every.map((kind) => {
      const n = state.counters[kind] ?? 0
      return { key: `kind:${kind}`, label: n ? t('menu.counterKind', { kind: nameOf(kind), n }) : nameOf(kind), go: { kind } }
    }),
    { key: 'newKind', label: t('menu.newKind'), run: () => onNewKind(card) },
  ]
  const ofKind = (kind: string): Entry[] => {
    const n = state.counters[kind] ?? 0
    const delta = (d: number): Action => ({ t: 'counter', card, delta: d, ...(kind && { kind }) })
    return [
      { key: 'back', label: t('menu.back'), go: 'counters' },
      ...(n < LIMITS.counters ? [{ key: 'counterUp', label: t('menu.counterUp'), actions: [delta(1)] }] : []),
      ...(n > 0 ? [{ key: 'counterDown', label: t('menu.counterDown'), actions: [delta(-1)] }] : []),
    ]
  }

  /** A move that lands somewhere else than where the card is, and that the board accepts. */
  const to = (key: string, label: string, action: Extract<Action, { t: 'move' }>, then: (after: Board) => Action[] = () => []): Entry[] =>
    action.to !== where.zone && isValid(board, action) ? [{ key, label, actions: [action, ...then(apply(board, action))] }] : []
  const home: ZoneId = extra ? 'extra' : 'hand'
  const move: Entry[] = [
    back,
    { key: 'moveZone', label: t('menu.moveZone'), go: 'zones' },
    ...to('toGy', t('menu.toGy'), { t: 'move', card, to: 'gy' }),
    ...to('banish', t('menu.banish'), { t: 'move', card, to: 'banished' }),
    ...to('destroy', t('menu.destroy'), { t: 'move', card, to: 'gy', destroy: true }),
    ...to('destroyBanish', t('menu.destroyBanish'), { t: 'move', card, to: 'banished', destroy: true }),
    ...to('toHand', t(extra ? 'menu.toExtra' : 'menu.toHand'), { t: 'move', card, to: home }),
    // an Extra Deck card has no order to shuffle into: its "Hand" entry already returns it there
    ...(extra ? [] : to('shuffleDeck', t('menu.shuffleDeck'), { t: 'move', card, to: 'deck' }, (after) => [shuffleAction(after)])),
  ]

  const zones: Entry[] = [
    { key: 'back', label: t('menu.back'), go: 'move' },
    ...moveOptions(board, card, xyz)
      // A plain move to the card's own pile moves nothing; the deck's top and bottom, and the other variants, reposition it.
      .filter(({ zone, variant }) => variant !== 'plain' || zone !== where.zone)
      .map(({ zone, variant, action }) => ({
        key: `${zone}:${variant}`,
        label: variant === 'plain' ? t(`zones.${zone}`) : `${t(`zones.${zone}`)} — ${t(`move.${variant}`)}`,
        actions: [action],
      })),
  ]

  const list =
    view === 'main' ? main
    : view === 'activate' ? activate
    : view === 'counters' ? counters
    : view === 'move' ? move
    : view === 'zones' ? zones
    : ofKind(view.kind)

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      return onClose()
    }
    const digit = Number(e.key)
    if (digit >= 1 && digit <= Math.min(KEYED, list.length)) {
      e.preventDefault()
      return choose(list[digit - 1]!)
    }
    const items = Array.from(root.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])
    const focused = items.indexOf(document.activeElement as HTMLElement)
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
    <div
      ref={root}
      role="menu"
      aria-label={t('menu.label')}
      onKeyDown={onKeyDown}
      style={{ left: at.x, top: at.y }}
      className="fixed z-(--z-modal) max-h-[calc(100dvh-16px)] max-w-[calc(100vw-16px)] min-w-60 overflow-y-auto border border-line-mid bg-surface-100 shadow-lift motion-safe:animate-fade-in"
    >
      <div aria-hidden className="flex items-center gap-2 border-b border-line bg-surface-200 px-3 py-2">
        <span className="w-6 shrink-0">
          <CardTile id={state.code} card={data} sizes="24px" disabled tabIndex={-1} className="cursor-default" />
        </span>
        <span className="min-w-0 truncate text-ink body-sm">{data?.name ?? state.code}</span>
      </div>
      {list.map((entry, i) => (
        <button key={entry.key} type="button" role="menuitem" tabIndex={-1} data-key={i < KEYED ? i + 1 : undefined} onClick={() => choose(entry)} className={ITEM}>
          {entry.label}
        </button>
      ))}
    </div>
  )
}
