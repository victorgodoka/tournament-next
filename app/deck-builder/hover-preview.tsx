'use client'

import { useEffect, useState } from 'react'
import type { CardMap } from '@utils/deck/types'
import { CARD_SCAN_URL } from '@utils/const'
import { CardFacts } from './card-facts'

export const DELAY_MS = 300
const WIDTH = 320
const GAP = 12
const FINE_POINTER = '(hover: hover) and (pointer: fine)'

type Shown = { id: number; left: number; top?: number; bottom?: number; maxHeight: number }

/**
 * Beside the card on whichever side has room; anchored to its top, or its bottom in the lower half.
 * It grows away from the anchor and stops a gap short of the viewport's far edge.
 */
const place = (id: number, rect: DOMRect): Shown => {
  const right = rect.right + GAP + WIDTH <= window.innerWidth
  const left = right ? rect.right + GAP : Math.max(GAP, rect.left - GAP - WIDTH)
  const low = rect.top > window.innerHeight / 2
  const edge = Math.max(GAP, low ? window.innerHeight - rect.bottom : rect.top) // distance from the anchored edge
  return { id, left, ...(low ? { bottom: edge } : { top: edge }), maxHeight: window.innerHeight - edge - GAP }
}

/**
 * The card under a mouse pointer, after 300 ms: scan, type line, stats and text. Listens on the
 * document for any `[data-card]` item, so the pool and the deck share it. Touch and coarse pointers
 * never see it; they open the detail sheet instead. Visual only: the sheet carries the same text.
 *
 * Driven by `pointermove`, not `pointerover`: a click, a scroll or a tile re-rendered under the pointer hides
 * it, and the next movement arms it again on whatever card is there. `pointerover` only fires on crossing an
 * element's edge, so after a click the preview stayed gone until the pointer happened to cross a badge.
 */
export const HoverPreview = ({ cards }: { cards: CardMap }) => {
  const [shown, setShown] = useState<Shown | null>(null)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    let host: Element | null = null
    const hide = () => {
      clearTimeout(timer)
      host = null
      setShown(null)
    }
    const move = (e: PointerEvent) => {
      const item = (e.target as Element).closest?.('[data-card]') ?? null
      if (item === host) return
      hide()
      if (!item || e.pointerType !== 'mouse' || !matchMedia(FINE_POINTER).matches) return
      host = item
      timer = setTimeout(() => setShown(place(Number((item as HTMLElement).dataset.card), item.getBoundingClientRect())), DELAY_MS)
    }
    const out = (e: PointerEvent) => {
      // Left the window (no related target), or the card for somewhere a move may not follow.
      if (host && !host.contains(e.relatedTarget as Node | null)) hide()
    }
    document.addEventListener('pointermove', move)
    document.addEventListener('pointerout', out)
    document.addEventListener('pointerdown', hide)
    document.addEventListener('dragstart', hide)
    window.addEventListener('scroll', hide, true)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('pointermove', move)
      document.removeEventListener('pointerout', out)
      document.removeEventListener('pointerdown', hide)
      document.removeEventListener('dragstart', hide)
      window.removeEventListener('scroll', hide, true)
    }
  }, [])

  const card = shown && cards.get(shown.id)
  if (!shown || !card) return null

  return (
    <div
      aria-hidden
      style={{ left: shown.left, top: shown.top, bottom: shown.bottom, maxHeight: shown.maxHeight, width: WIDTH }}
      className="pointer-events-none fixed z-(--z-overlay) flex flex-col gap-3 overflow-hidden bg-surface-200 p-3 shadow-lift"
    >
      {/* Keyed: a new card shows the plate, never the previous card's scan under its name. The 421px original,
          one URL shared with the detail sheet and the browser cache, not a 640px variant minted per hover. */}
      <div key={shown.id} className="relative aspect-[59/86] w-full shrink-0 bg-surface-300">
        {/* eslint-disable-next-line @next/next/no-img-element -- same-origin, already sized: nothing to optimise */}
        <img src={CARD_SCAN_URL(shown.id)} alt="" decoding="async" className="absolute inset-0 size-full object-cover" />
      </div>
      <p className="text-ink body-strong">{card.name}</p>
      <CardFacts card={card} />
      <p className="line-clamp-8 whitespace-pre-line text-ink-dim body-sm">{card.description}</p>
    </div>
  )
}
