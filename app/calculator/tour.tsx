'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useId, useRef } from 'react'
import { Button } from '@ui/button'
import { Icon } from '@ui/icon'
import type { TourEvent } from './tag-board'

const TOUCH = 'max-lg:min-h-11'
const KEY = 'calc-tour'
/** The spotlight's room around its anchor, the card's gap to the spotlight, and the gap kept to the viewport's edge, in px. */
const PAD = 8
const GAP = 12
const EDGE = 8
/** Paints that step 2 waits for. */
const PAINTS = 2

/** `step` is 1..5; `paints` counts the paints since step 2 began. `null`: no tour. */
export type TourState = { step: number; paints: number } | null

export const TOUR_STEPS: readonly { anchor: 'strip' | 'grid' | 'odds' | 'hands'; key: 's1' | 's2' | 's3' | 's4' | 's5'; waits: TourEvent | null }[] = [
  { anchor: 'strip', key: 's1', waits: 'brush' },
  { anchor: 'grid', key: 's2', waits: 'paint' },
  { anchor: 'grid', key: 's3', waits: 'menu' },
  { anchor: 'odds', key: 's4', waits: null },
  { anchor: 'hands', key: 's5', waits: null },
]

/** 1 + brush → 2; 2 + paint → paints + 1, at 2 paints → 3; 3 + menu → 4; anything else: the same state back. */
export const tourAfter = (state: TourState, event: TourEvent): TourState => {
  if (!state || TOUR_STEPS[state.step - 1]!.waits !== event) return state
  const paints = state.paints + 1
  return event === 'paint' && paints < PAINTS ? { step: state.step, paints } : { step: state.step + 1, paints: 0 }
}

/** `localStorage['calc-tour'] === 'done'`; false when storage throws. */
export const tourSeen = () => {
  try {
    return localStorage.getItem(KEY) === 'done'
  } catch {
    return false
  }
}

/** Writes 'done'; swallows storage errors. */
export const markTourSeen = () => {
  try {
    localStorage.setItem(KEY, 'done')
  } catch {
    // Private mode or a full quota: the tour simply shows again next visit.
  }
}

/** The spotlight over `anchor` and the card below it (above when it would run off the bottom), both inside the viewport. No anchor: no spotlight, the card centred. */
const place = (spot: HTMLElement, card: HTMLElement, anchor: HTMLElement | null) => {
  const { offsetWidth: w, offsetHeight: h } = card
  const { innerWidth: vw, innerHeight: vh } = window
  const rect = anchor?.getBoundingClientRect()
  spot.style.display = rect ? '' : 'none'
  let top = (vh - h) / 2
  let left = (vw - w) / 2
  if (rect) {
    spot.style.top = `${rect.top - PAD}px`
    spot.style.left = `${rect.left - PAD}px`
    spot.style.width = `${rect.width + 2 * PAD}px`
    spot.style.height = `${rect.height + 2 * PAD}px`
    const below = rect.bottom + PAD + GAP
    top = below + h > vh - EDGE ? rect.top - PAD - GAP - h : below
    left = rect.left
  }
  // The top wins when the card is taller than the viewport.
  card.style.top = `${Math.max(EDGE, Math.min(top, vh - h - EDGE))}px`
  card.style.left = `${Math.max(EDGE, Math.min(left, vw - w - EDGE))}px`
}

type TourProps = {
  state: NonNullable<TourState>
  onBack(): void
  onNext(): void
  /** Skip (✕) and Done. */
  onClose(): void
}

/** A spotlight over the step's anchor and a card that explains it. The page stays usable under both: the steps wait for the player to use the board. */
export const Tour = ({ state, onBack, onNext, onClose }: TourProps) => {
  const t = useTranslations('Calculator')
  const titleId = useId()
  const spot = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const { step } = state
  const { anchor: name, key, waits } = TOUR_STEPS[step - 1]!
  const title = t(`tour.${key}Title`)
  const progress = t('tour.progress', { n: step, total: TOUR_STEPS.length })
  // A touch screen has no Esc or right-click, its hold opens the menu and its drag scrolls: steps 2 and 3 say so.
  const touch = (key === 's2' || key === 's3') && typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches

  // One frame loop follows the anchor through the scroll it causes, later scrolls and resizes; it writes styles on refs, never state.
  // Keyed on the anchor, not the step: steps 2 and 3 share the grid, and a second scroll under a held drag would paint tiles the player did not mean to.
  useEffect(() => {
    const anchor = document.querySelector<HTMLElement>(`[data-tour="${name}"]`)
    const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    // Only an anchor not fully on screen: a needless scroll carries the page out from under the card menu step 3 leaves open.
    const rect = anchor?.getBoundingClientRect()
    if (rect && (rect.top < 0 || rect.bottom > window.innerHeight)) anchor?.scrollIntoView({ block: 'center', behavior: reduced ? 'auto' : 'smooth' })
    let frame = 0
    const follow = () => {
      if (spot.current && card.current) place(spot.current, card.current, anchor)
      frame = requestAnimationFrame(follow)
    }
    follow()
    return () => cancelAnimationFrame(frame)
  }, [name])

  return (
    <>
      <div
        ref={spot}
        aria-hidden="true"
        className="pointer-events-none fixed z-(--z-scrim) rounded-[6px] shadow-[0_0_0_100vmax_var(--color-scrim-soft)] motion-safe:transition-[top,left,width,height] motion-safe:duration-150"
      />
      <div
        ref={card}
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        // Below `sm` the card sits above the tag strip, which is fixed to the bottom there; the `!` beats the inline top/left.
        className="cut notch fixed top-0 left-0 z-(--z-modal) flex w-80 flex-col gap-2 p-3 text-ink drop-shadow-[0_16px_40px_rgba(0,0,0,0.5)] [--cut:var(--cut-md)] [--edge:var(--color-cyan)] [--fill:var(--color-surface-200)] max-sm:inset-x-3! max-sm:top-auto! max-sm:bottom-[calc(6rem+env(safe-area-inset-bottom))]! max-sm:w-auto"
      >
        <p aria-live="polite" className="sr-only">
          {progress} {title}
        </p>
        <div className="flex items-start gap-2">
          <h2 id={titleId} className="min-w-0 flex-1 text-ink body-strong">
            {title}
          </h2>
          <Button variant="ghost" size="icon-sm" aria-label={t('tour.skip')} onClick={onClose} className={TOUCH}>
            <Icon name="close" />
          </Button>
        </div>
        <p className="text-ink-muted body-sm">{t(touch ? `tour.${key}Touch` : `tour.${key}`)}</p>
        <div className="flex items-center gap-2">
          <span className="text-ink-muted signal-sm">{progress}</span>
          <span className="ml-auto flex items-center gap-2">
            {step > 1 ? (
              <Button variant="ghost" size="sm" onClick={onBack} className={TOUCH}>
                {t('tour.back')}
              </Button>
            ) : null}
            {waits ? (
              <span className="text-cyan signal-sm">{t('tour.doIt')}</span>
            ) : (
              <Button size="sm" onClick={step === TOUR_STEPS.length ? onClose : onNext} className={TOUCH}>
                {t(step === TOUR_STEPS.length ? 'tour.done' : 'tour.next')}
              </Button>
            )}
          </span>
        </div>
      </div>
    </>
  )
}
