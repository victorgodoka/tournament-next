'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { isMonsterSlot, isSlot, locate } from '@utils/simulator/board'
import { moveOptions } from '@utils/simulator/drop'
import { LIMITS } from '@utils/simulator/types'
import type { Action, Board, ZoneId } from '@utils/simulator/types'

export type CardMenuProps = {
  board: Board
  card: number
  /** Viewport point the menu opens at; the menu slides back inside the viewport when it would overflow. */
  at: { x: number; y: number }
  onAct(actions: Action[]): void
  onTargets(card: number): void
  onDetails(card: number): void
  onClose(): void
}

/** One item: it swaps the list (`go`), runs a callback, or performs actions; the last two close the menu. */
type Entry = { key: string; label: string } & ({ go: 'main' | 'move' } | { run(): void } | { actions: Action[] })

/** Space kept between the menu and the viewport edge. */
const MARGIN = 8
const ITEM =
  'block w-full cursor-pointer border-b border-line px-4 py-3 text-left whitespace-nowrap text-ink-dim signal-strong last:border-b-0 hover:bg-surface-300 hover:text-ink focus-visible:bg-surface-300 focus-visible:text-ink focus-visible:-outline-offset-2 max-lg:min-h-11'

/**
 * The keyboard path for every move, and for the rest of what a card can do. Opens at `at` with the first item
 * focused; arrows move between items; Escape, a pointer down outside or choosing an item closes it and the focus
 * goes back to the card. "Move to…" swaps the list for every zone the card can go to.
 */
export const CardMenu = ({ board, card, at, onAct, onTargets, onDetails, onClose }: CardMenuProps) => {
  const t = useTranslations('Simulator')
  const [view, setView] = useState<'main' | 'move'>('main')
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

  const main: Entry[] = [
    { key: 'activate', label: t('menu.activate'), actions: [{ t: 'activate', card, targets: [] }] },
    { key: 'activateTargets', label: t('menu.activateTargets'), run: () => onTargets(card) },
    ...(field
      ? [
          { key: 'flip', label: t('menu.flip'), actions: [{ t: 'flip', card, face: state.face === 'up' ? 'down' : 'up', pos: state.pos } as const] },
          ...(monster ? [{ key: 'position', label: t('menu.position'), actions: [{ t: 'flip', card, face: state.face, pos: state.pos === 'atk' ? 'def' : 'atk' } as const] }] : []),
          { key: 'negate', label: t('menu.negate'), actions: [{ t: 'negate', card, on: !state.negated } as const] },
          ...(state.counters < LIMITS.counters ? [{ key: 'counterUp', label: t('menu.counterUp'), actions: [{ t: 'counter', card, delta: 1 } as const] }] : []),
          ...(state.counters > 0 ? [{ key: 'counterDown', label: t('menu.counterDown'), actions: [{ t: 'counter', card, delta: -1 } as const] }] : []),
        ]
      : []),
    { key: 'moveTo', label: t('menu.moveTo'), go: 'move' },
    { key: 'details', label: t('menu.details'), run: () => onDetails(card) },
  ]

  const move: Entry[] = [
    { key: 'back', label: t('menu.back'), go: 'main' },
    ...moveOptions(board, card)
      // A plain move to the card's own pile moves nothing; the deck's top and bottom, and the other variants, reposition it.
      .filter(({ zone, variant }) => variant !== 'plain' || zone !== where.zone)
      .map(({ zone, variant, action }) => ({
        key: `${zone}:${variant}`,
        label: variant === 'plain' ? t(`zones.${zone}`) : `${t(`zones.${zone}`)} — ${t(`move.${variant}`)}`,
        actions: [action],
      })),
  ]

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault()
      return onClose()
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
      className="fixed z-(--z-modal) max-h-[calc(100dvh-16px)] max-w-[calc(100vw-16px)] min-w-52 overflow-y-auto border border-line-mid bg-surface-100 shadow-lift"
    >
      {(view === 'main' ? main : move).map((entry) => (
        <button key={entry.key} type="button" role="menuitem" tabIndex={-1} onClick={() => choose(entry)} className={ITEM}>
          {entry.label}
        </button>
      ))}
    </div>
  )
}
