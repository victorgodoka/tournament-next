'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { Button } from '@ui/button'
import { Icon } from '@ui/icon'
import type { CardMap } from '@utils/deck/types'
import { CARD_SCAN_URL } from '@utils/const'
import { imageOf } from '@utils/deck/model'
import { CardFacts } from './card-facts'

type CardPanelProps = {
  cards: CardMap
  /** The pinned card's passcode; the panel then ignores the pointer until it is unpinned. */
  locked: number | null
  onLock(id: number | null): void
}

/**
 * The column beside the pool: scan, type line, stats and text of the card under the pointer (or focus),
 * kept after the pointer leaves. Listens on the document for any `[data-card]` item, so the pool and the
 * deck share it. A pin (the tiles' corner button, or the one here) holds it on one card.
 */
export const CardPanel = ({ cards, locked, onLock }: CardPanelProps) => {
  const t = useTranslations('DeckEditor')
  const [hovered, setHovered] = useState<number | null>(null)

  useEffect(() => {
    const pick = (e: Event) => {
      const item = (e.target as Element).closest?.('[data-card]') as HTMLElement | null
      if (item) setHovered(Number(item.dataset.card))
    }
    document.addEventListener('pointermove', pick)
    document.addEventListener('focusin', pick)
    return () => {
      document.removeEventListener('pointermove', pick)
      document.removeEventListener('focusin', pick)
    }
  }, [])

  const id = locked ?? hovered
  const card = id !== null ? cards.get(id) : undefined

  return (
    <section aria-label={t('panel.title')} className="flex flex-col gap-3">
      <div className="flex min-h-8 items-center justify-between gap-2">
        <h2 className="text-ink-muted signal-sm">{locked !== null ? t('panel.locked') : t('panel.title')}</h2>
        {card ? (
          <Button
            variant="ghost"
            size="icon-sm"
            aria-pressed={locked !== null}
            aria-label={t(locked !== null ? 'tile.unlock' : 'tile.lock', { name: card.name })}
            onClick={() => onLock(locked !== null ? null : id)}
          >
            <Icon name={locked !== null ? 'lock' : 'unlock'} size={14} />
          </Button>
        ) : null}
      </div>
      {card ? (
        <>
          {/* Keyed: a new card shows the plate, never the previous card's scan under its name. The 421px
              original, one URL shared with the detail sheet and the browser cache. */}
          <div key={id} className="relative aspect-[59/86] w-full bg-surface-300">
            {/* eslint-disable-next-line @next/next/no-img-element -- same-origin, already sized: nothing to optimise */}
            <img src={CARD_SCAN_URL(imageOf(id!, card))} alt="" decoding="async" className="absolute inset-0 size-full object-cover" />
          </div>
          <p className="text-ink body-strong">{card.name}</p>
          <CardFacts card={card} />
          <p className="whitespace-pre-line text-ink-dim body-sm">{card.description}</p>
        </>
      ) : (
        <p className="text-ink-muted body-sm">{t('panel.empty')}</p>
      )}
    </section>
  )
}
