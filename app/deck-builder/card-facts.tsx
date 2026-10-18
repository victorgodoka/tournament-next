'use client'

import { useTranslations } from 'next-intl'
import type { CardData } from '@utils/deck/types'
import { statLabel, titleCase } from '@utils/wiki'

/** The type line as the card prints it: `Spellcaster / Effect`, `Quick-Play Spell`. */
const typeLine = (card: CardData) =>
  card.kind === 'monster' ? [card.race, ...card.monsterTypes].filter((part): part is string => !!part).map(titleCase).join(' / ') : card.humanReadableCardType

/** Type line, then attribute · level · ATK / DEF · scale. A Link monster never shows DEF; `-2` reads `?`. */
export const CardFacts = ({ card }: { card: CardData }) => {
  const t = useTranslations('DeckEditor')
  const link = card.monsterTypes.includes('link')
  const levelKey = card.monsterTypes.includes('xyz') ? 'rank' : link ? 'link' : 'level'
  const stats =
    card.kind === 'monster'
      ? [
          card.attribute && titleCase(card.attribute),
          card.level !== null && t(`zones.${levelKey}`, { level: card.level }),
          `${t('facts.atk', { value: statLabel(card.atk) })}${link ? '' : ` / ${t('facts.def', { value: statLabel(card.def) })}`}`,
          card.scale !== null && t('facts.scale', { scale: card.scale }),
        ].filter(Boolean)
      : []

  return (
    <div className="flex flex-col gap-1">
      <p className="text-ink-dim signal-sm">{typeLine(card)}</p>
      {stats.length ? <p className="text-ink mono-data">{stats.join(' · ')}</p> : null}
    </div>
  )
}
