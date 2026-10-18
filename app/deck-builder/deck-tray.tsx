'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useId, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { TabBar, tabPanelProps } from '@ui/tab-bar'
import type { Problem } from '@utils/deck/rules'
import type { CardMap, Zone } from '@utils/deck/types'
import type { Banlist } from '@utils/wiki'
import { CARD_IMAGE_URL } from '@utils/const'
import type { EditorState } from './deck-editor.reducer'
import { DeckZone, type DragPayload } from './deck-zone'
import { MOVE_SLOP, trayAfterDrag } from './gestures'
import { PROBLEMS_POPOVER, type Validity } from './toolbar'

const ZONES: Zone[] = ['main', 'extra', 'side']
/** The peek row, clear of the home indicator. The pool pads its bottom by the same amount. */
const PEEK = '4rem + env(safe-area-inset-bottom)'

type DeckTrayProps = {
  state: EditorState
  cards: CardMap
  banlist: Banlist | null
  problems: Problem[]
  validity: Validity
  /** Passcodes in a validation problem: their rows get the crimson edge. */
  flagged: ReadonlySet<number>
  /** The open tab; the shell switches it when the problems list jumps to a card. */
  tab: Zone
  onTab(zone: Zone): void
  onRemove(zone: Zone, id: number): void
  /** The list rows' +. */
  onDropCard(zone: Zone): (payload: DragPayload, index?: number) => void
  onOpen(id: number): void
  /** The editor's toolbar, behind the ⋯ button. */
  toolbar: React.ReactNode
}

/**
 * The deck below lg: a 64px peek row pinned to the bottom (counts, validity, last 5 added) that opens
 * to 85dvh on a tap or a drag up past 48px, and closes on a drag down, a tap, Escape or the scrim.
 * Open, it lists one zone at a time; the toolbar sits under ⋯.
 */
export const DeckTray = (p: DeckTrayProps) => {
  const t = useTranslations('DeckEditor')
  const [open, setOpen] = useState(false)
  const [menu, setMenu] = useState(false)
  /** Handle travel while a drag is under way (up is negative). */
  const [drag, setDrag] = useState<number | null>(null)
  const start = useRef<number | null>(null)
  const dragged = useRef(false)
  const handle = useRef<HTMLButtonElement>(null)
  const bodyId = useId()
  const menuId = useId()
  const { deck, lastAdded } = p.state

  const section = useRef<HTMLElement>(null)
  /** Focus was in the tray when the scrim was pressed: by its click, the press has moved it to body. */
  const focusIn = useRef(false)
  const hasFocus = () => !!section.current?.contains(document.activeElement)

  const show = (next: boolean, refocus = hasFocus()) => {
    setOpen(next)
    if (next) return
    setMenu(false)
    // The body goes inert: focus inside it would be lost, so it returns to the handle.
    if (refocus) handle.current?.focus()
  }

  const [flag, flagClass] =
    p.validity === 'checking' ? [t('checking'), 'text-ink-muted']
    : p.problems.length ? [t('problems', { count: p.problems.length }), 'text-crimson-lift']
    : p.validity === 'unavailable' ? [t('rulesUnavailable'), 'text-ink-muted']
    : [t('legal'), 'text-win']

  const rest = open ? '0px' : `100% - (${PEEK})`

  return (
    <>
      {open ? <div aria-hidden onPointerDown={() => (focusIn.current = hasFocus())} onClick={() => show(false, focusIn.current)} className="fixed inset-0 z-(--z-dock) bg-scrim motion-safe:animate-fade-in" /> : null}
      <section
        ref={section}
        id="deck-tray"
        data-open={open || undefined}
        aria-label={t('tray.label')}
        onKeyDown={(e) => {
          // The problems list (a popover) takes the first Escape for itself.
          if (e.key !== 'Escape' || !open) return
          if (document.getElementById(PROBLEMS_POPOVER)?.matches(':popover-open') || (e.target as Element).closest('[popover]')) return
          show(false)
          handle.current?.focus()
        }}
        style={{ transform: `translateY(clamp(0px, calc(${rest} + ${drag ?? 0}px), calc(100% - (${PEEK}))))` }}
        className={twMerge(
          // `fixed` beats `.cut`'s position: relative.
          'cut notch fixed inset-x-0 bottom-0 z-(--z-dock) flex h-[85dvh] flex-col [--cut:var(--cut-lg)] [--edge:var(--color-line)] [--fill:var(--color-surface-200)]',
          'motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-out',
          drag !== null && 'motion-safe:transition-none',
        )}
      >
        <button
          ref={handle}
          type="button"
          aria-expanded={open}
          aria-controls={bodyId}
          onPointerDown={(e) => {
            start.current = e.clientY
            dragged.current = false
            e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            if (start.current === null) return
            const dy = e.clientY - start.current
            if (Math.abs(dy) > MOVE_SLOP) dragged.current = true
            if (dragged.current) setDrag(dy)
          }}
          onPointerUp={(e) => {
            if (start.current === null) return
            const dy = e.clientY - start.current
            start.current = null
            setDrag(null)
            if (dragged.current) show(trayAfterDrag(open, dy))
          }}
          onPointerCancel={() => {
            start.current = null
            setDrag(null)
          }}
          onClick={(e) => {
            // A drag already decided; a tap, Enter or Space (detail 0) toggles.
            const afterDrag = dragged.current && e.detail !== 0
            dragged.current = false
            if (!afterDrag) show(!open)
          }}
          className="relative flex h-16 w-full shrink-0 cursor-pointer touch-none items-center gap-3 px-4 pt-1.5 text-left select-none"
        >
          <span aria-hidden className="absolute top-1.5 left-1/2 h-1 w-8 -translate-x-1/2 bg-line-strong" />
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="truncate text-ink signal-strong">
              {t('tray.counts', { main: deck.main.length, extra: deck.extra.length, side: deck.side.length })}
            </span>
            <span className={twMerge('truncate signal-sm', flagClass)}>{flag}</span>
          </span>
          {lastAdded.length ? (
            <span aria-hidden className="flex shrink-0 gap-1">
              {lastAdded.map((id, i) => (
                <span key={`${id}-${i}`} className="relative aspect-[59/86] h-8 bg-surface-300">
                  <Image src={CARD_IMAGE_URL(id)} alt="" fill sizes="22px" draggable={false} className="object-cover" />
                </span>
              ))}
            </span>
          ) : null}
        </button>

        <div id={bodyId} inert={!open} className="flex min-h-0 flex-1 flex-col">
          <div className="flex items-stretch border-b border-line px-2">
            <TabBar
              tabs={ZONES.map((zone) => ({ id: zone, label: `${t(`tray.${zone}`)} ${deck[zone].length}` }))}
              active={p.tab}
              onSelect={p.onTab}
              label={t('tray.zones')}
              idPrefix="tray"
              className="min-w-0 flex-1 border-b-0"
            />
            <button
              type="button"
              aria-expanded={menu}
              aria-controls={menuId}
              aria-label={t('tray.actions')}
              onClick={() => setMenu((m) => !m)}
              className={twMerge('grid size-11 shrink-0 cursor-pointer place-items-center text-lg text-ink-dim hover:text-ink', menu && 'text-ink shadow-tab-active')}
            >
              <span aria-hidden>⋯</span>
            </button>
          </div>
          <div id={menuId} hidden={!menu} className="border-b border-line px-4 py-3">
            {p.toolbar}
          </div>
          <div {...tabPanelProps('tray', p.tab)} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 pb-[env(safe-area-inset-bottom)]">
            <DeckZone
              zone={p.tab}
              ids={deck[p.tab]}
              cards={p.cards}
              banlist={p.banlist}
              view="list"
              problems={p.flagged}
              onRemove={(id) => p.onRemove(p.tab, id)}
              onDropCard={p.onDropCard(p.tab)}
              onOpen={p.onOpen}
            />
          </div>
        </div>
      </section>
    </>
  )
}
