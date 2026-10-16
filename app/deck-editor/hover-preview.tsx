'use client'

import Image from 'next/image'
import { useEffect, useState } from 'react'
import type { CardMap } from '@utils/deck/types'
import { CARD_IMAGE_URL } from '@utils/const'
import { CardFacts } from './card-facts'

const DELAY_MS = 300
const WIDTH = 320
const GAP = 12
const FINE_POINTER = '(hover: hover) and (pointer: fine)'

type Shown = { id: number; left: number; top?: number; bottom?: number }

/** Beside the card on whichever side has room; anchored to its top, or its bottom in the lower half. */
const place = (id: number, rect: DOMRect): Shown => {
  const right = rect.right + GAP + WIDTH <= window.innerWidth
  const left = right ? rect.right + GAP : Math.max(GAP, rect.left - GAP - WIDTH)
  return rect.top > window.innerHeight / 2 ? { id, left, bottom: Math.max(GAP, window.innerHeight - rect.bottom) } : { id, left, top: Math.max(GAP, rect.top) }
}

/**
 * The card under a mouse pointer, after 300 ms: scan, type line, stats and text. Listens on the
 * document for any `[data-card]` item, so the pool and the deck share it. Touch and coarse pointers
 * never see it; they open the detail sheet instead. Visual only: the sheet carries the same text.
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
    const over = (e: PointerEvent) => {
      const item = (e.target as Element).closest?.('[data-card]') ?? null
      if (item === host) return
      hide()
      if (!item || e.pointerType !== 'mouse' || !matchMedia(FINE_POINTER).matches) return
      host = item
      timer = setTimeout(() => setShown(place(Number((item as HTMLElement).dataset.card), item.getBoundingClientRect())), DELAY_MS)
    }
    const out = (e: PointerEvent) => {
      if (host && !host.contains(e.relatedTarget as Node | null)) hide()
    }
    document.addEventListener('pointerover', over)
    document.addEventListener('pointerout', out)
    document.addEventListener('pointerdown', hide)
    document.addEventListener('dragstart', hide)
    window.addEventListener('scroll', hide, true)
    return () => {
      clearTimeout(timer)
      document.removeEventListener('pointerover', over)
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
      style={{ left: shown.left, top: shown.top, bottom: shown.bottom, width: WIDTH }}
      className="pointer-events-none fixed z-(--z-overlay) flex max-h-[calc(100dvh-24px)] flex-col gap-3 overflow-hidden bg-surface-200 p-3 shadow-lift"
    >
      <div className="relative aspect-[59/86] w-full shrink-0 bg-surface-300">
        {/* 320 CSS px resolves to the 640 scan at 1x and 2x alike. */}
        <Image src={CARD_IMAGE_URL(shown.id)} alt="" fill sizes={`${WIDTH}px`} className="object-cover" />
      </div>
      <p className="text-ink body-strong">{card.name}</p>
      <CardFacts card={card} />
      <p className="line-clamp-8 whitespace-pre-line text-ink-dim body-sm">{card.description}</p>
    </div>
  )
}
