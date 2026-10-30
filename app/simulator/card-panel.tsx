'use client'

import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { Button } from '@ui/button'
import { Icon } from '@ui/icon'
import { CardFacts } from '@app/deck-builder/card-facts'
import { CardTile } from '@app/deck-builder/card-tile'
import type { CardData } from '@utils/deck/types'

type CardPanelProps = {
  code: number | null
  card: CardData | null
  /** The panel is locked on this card: hovering others leaves it; the lock beside the name lets go. */
  locked?: boolean
  onUnlock?(): void
  className?: string
}

/** The card under the pointer, or the one the panel is locked on: its scan, type line, stats and text. An unknown card shows its passcode, nothing a hint. */
export const CardPanel = ({ code, card, locked = false, onUnlock, className }: CardPanelProps) => {
  const t = useTranslations('Simulator')
  if (code === null) return <p className={twMerge('text-ink-muted body-sm', className)}>{t('cardPanel.empty')}</p>
  return (
    <section aria-label={t('cardPanel.title')} className={className}>
      <div className="flex gap-3">
        {/* A picture here, not a control. */}
        <div className="w-24 shrink-0">
          <CardTile id={code} card={card ?? undefined} sizes="96px" disabled aria-hidden className="cursor-default" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex items-start gap-2">
            <h3 className="min-w-0 flex-1 break-words text-ink display-3">{card?.name ?? code}</h3>
            {locked ? (
              <Button variant="ghost" size="icon-sm" aria-label={t('cardPanel.unlock')} title={t('cardPanel.unlock')} onClick={onUnlock} className="shrink-0 text-gold max-lg:size-11">
                <Icon name="lock" />
              </Button>
            ) : null}
          </div>
          {card ? <CardFacts card={card} /> : null}
        </div>
      </div>
      {card ? <p className="mt-3 whitespace-pre-line text-ink-dim body-sm">{card.description}</p> : null}
    </section>
  )
}
