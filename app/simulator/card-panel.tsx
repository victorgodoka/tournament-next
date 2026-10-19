'use client'

import { useTranslations } from 'next-intl'
import { Panel } from '@ui/panel'
import { CardFacts } from '@app/deck-builder/card-facts'
import { CardTile } from '@app/deck-builder/card-tile'
import type { CardData } from '@utils/deck/types'

/** The last card touched: its scan, type line, stats and text. An unknown card shows its passcode, nothing selected a hint. */
export const CardPanel = ({ code, card }: { code: number | null; card: CardData | null }) => {
  const t = useTranslations('Simulator')
  if (code === null) {
    return (
      <Panel tone="framed" label={t('cardPanel.title')}>
        <p className="text-ink-muted body-sm">{t('cardPanel.empty')}</p>
      </Panel>
    )
  }
  return (
    <Panel tone="framed" title={card?.name ?? String(code)} label={t('cardPanel.title')}>
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
