'use client'

import { useTranslations } from 'next-intl'
import { Button } from '@ui/button'
import { Icon } from '@ui/icon'
import { Panel } from '@ui/panel'
import { CardFacts } from '@app/deck-builder/card-facts'
import { CardTile } from '@app/deck-builder/card-tile'
import type { CardData } from '@utils/deck/types'

type CardPanelProps = {
  code: number | null
  card: CardData | null
  /** The panel is locked on this card: hovering others leaves it; the lock in the header lets go. */
  locked?: boolean
  onUnlock?(): void
  className?: string
}

/** The card under the pointer, or the one the panel is locked on: its scan, type line, stats and text. An unknown card shows its passcode, nothing a hint. */
export const CardPanel = ({ code, card, locked = false, onUnlock, className }: CardPanelProps) => {
  const t = useTranslations('Simulator')
  if (code === null) {
    return (
      <Panel tone="framed" label={t('cardPanel.title')} className={className}>
        <p className="text-ink-muted body-sm">{t('cardPanel.empty')}</p>
      </Panel>
    )
  }
  return (
    <Panel
      tone="framed"
      title={card?.name ?? String(code)}
      label={t('cardPanel.title')}
      className={className}
      actions={
        locked ? (
          <Button variant="ghost" size="icon-sm" aria-label={t('cardPanel.unlock')} title={t('cardPanel.unlock')} onClick={onUnlock} className="ml-auto shrink-0 text-gold max-lg:size-11">
            <Icon name="lock" />
          </Button>
        ) : undefined
      }
    >
      <div className="flex gap-3">
        {/* A picture here, not a control. */}
        <div className="w-24 shrink-0">
          <CardTile id={code} card={card ?? undefined} sizes="96px" disabled aria-hidden className="cursor-default" />
        </div>
        {card ? <CardFacts card={card} /> : null}
      </div>
      {card ? <p className="mt-3 whitespace-pre-line text-ink body-sm">{card.description}</p> : null}
    </Panel>
  )
}
