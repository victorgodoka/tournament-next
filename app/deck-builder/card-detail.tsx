'use client'

import Image from 'next/image'
import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Button } from '@ui/button'
import { Dialog } from '@ui/dialog'
import { copiesOf, imageOf, isExtraDeckCard, printOf } from '@utils/deck/model'
import { cardStatus } from '@utils/deck/rules'
import type { CardData, CardMap, Deck, Zone } from '@utils/deck/types'
import type { Banlist } from '@utils/wiki'
import { CARD_IMAGE_URL, CARD_SCAN_URL } from '@utils/const'
import { CardFacts } from './card-facts'

type CardDetailProps = {
  /** The API's card, never a `printOf` copy: a copy's `alias` can be a ruleId target, which has no artwork of its own. */
  card: CardData | null
  /** The artwork to start on (a deck tile's passcode); the card's own by default. */
  art?: number
  deck: Deck
  cards: CardMap
  banlists: Banlist[]
  onClose(): void
  onAdd(card: CardData, zone: Zone): void
  onRemove(id: number, zone: Zone): void
}

const COPY_KEY = ['forbidden', 'limited', 'semiLimited'] as const

/**
 * Full card text, every banlist, the artworks and − / + per zone. Stays mounted, so closing the native
 * dialog hands focus back to the tile that opened it.
 */
export const CardDetail = ({ card, art, deck, cards, banlists, onClose, onAdd, onRemove }: CardDetailProps) => {
  const t = useTranslations('DeckEditor')
  const opened = card && `${card.id}:${art ?? card.id}`
  const [selected, setSelected] = useState(art ?? card?.id ?? 0)
  const [seen, setSeen] = useState(opened)
  if (opened !== seen) {
    setSeen(opened)
    setSelected(art ?? card?.id ?? 0)
  }

  if (!card) return <Dialog open={false} onClose={onClose} title="">{null}</Dialog>

  const arts = [...new Set([card.alias ?? card.id, ...card.alternateArts])]
  const zones: Zone[] = [isExtraDeckCard(card) ? 'extra' : 'main', 'side']
  const names = [
    ['pt', card.i18n.pt?.name],
    ['jp', card.i18n.jp?.name],
  ] as const

  const status = (list: Banlist) => {
    if (card.monsterTypes.some((type) => list.bannedTypes.includes(type))) return t('detail.bannedType')
    const s = cardStatus(card, list)
    if ('points' in s) return t('tile.points', { points: s.points })
    return s.copies === 3 ? t('detail.unlimited') : t(`tile.${COPY_KEY[s.copies]}`)
  }

  return (
    <Dialog open onClose={onClose} title={card.name} eyebrow={card.humanReadableCardType}>
      <div className="grid gap-6 min-[720px]:grid-cols-[minmax(0,280px)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          <div className="relative aspect-[59/86] w-full max-w-80 bg-surface-300">
            {/* The 421px original, the URL the hover preview already loaded: no 640px variant to mint on open. */}
            {/* eslint-disable-next-line @next/next/no-img-element -- same-origin, already sized: nothing to optimise */}
            <img src={CARD_SCAN_URL(imageOf(selected, card))} alt={card.name} decoding="async" className="absolute inset-0 size-full object-cover" />
          </div>

          {arts.length > 1 ? (
            <div role="group" aria-label={t('detail.arts')} className="flex flex-wrap gap-1">
              {arts.map((id, i) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={id === selected}
                  aria-label={t('detail.art', { n: i + 1 })}
                  onClick={() => setSelected(id)}
                  className={twMerge('relative aspect-[59/86] w-12 cursor-pointer bg-surface-300', id === selected && 'outline outline-2 outline-cyan')}
                >
                  <Image src={CARD_IMAGE_URL(imageOf(id, card))} alt="" fill sizes="64px" className="object-cover" />
                </button>
              ))}
            </div>
          ) : null}

          {/* Every artwork counts towards the copy limit. */}
          <p className="text-ink-muted signal-sm">{t('tile.inDeck', { count: copiesOf(deck, card, cards) })}</p>
          <ul className="flex flex-col divide-y divide-line border-y border-line">
            {zones.map((zone) => {
              const count = deck[zone].filter((id) => id === selected).length
              return (
                <li key={zone} className="flex items-center gap-2 py-1.5">
                  <span className="flex-1 text-ink-dim signal-sm">{t(`zones.${zone}`)}</span>
                  <Button variant="secondary" size="icon-sm" aria-label={t('detail.removeFrom', { zone: t(`zones.${zone}`) })} aria-disabled={!count || undefined} onClick={() => count && onRemove(selected, zone)} className="max-lg:size-11">
                    −
                  </Button>
                  <output aria-label={t('detail.inZone', { count, zone: t(`zones.${zone}`) })} className="w-6 text-center text-ink mono-data">
                    {count}
                  </output>
                  <Button variant="secondary" size="icon-sm" aria-label={t('detail.addTo', { zone: t(`zones.${zone}`) })} onClick={() => onAdd(printOf(card, selected), zone)} className="max-lg:size-11">
                    +
                  </Button>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <CardFacts card={card} />

          {names.some(([, name]) => name) ? (
            <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 body-sm">
              {names.map(([lang, name]) =>
                name ? (
                  <div key={lang} className="contents">
                    <dt className="text-ink-muted signal-sm">{t(`detail.${lang}`)}</dt>
                    <dd className="text-ink">{name}</dd>
                  </div>
                ) : null,
              )}
            </dl>
          ) : null}

          <p className="whitespace-pre-line text-ink body">{card.description}</p>

          {card.erratas.length ? (
            <details className="border-t border-line pt-3">
              <summary className="cursor-pointer text-ink-dim signal-sm">{t('detail.erratas', { count: card.erratas.length })}</summary>
              <ul className="mt-3 flex flex-col gap-3">
                {card.erratas.map((errata) => (
                  <li key={errata.id} className="flex flex-col gap-1">
                    <span className="text-ink-muted signal-sm">{errata.date ?? t('detail.undated')}</span>
                    <p className="whitespace-pre-line text-ink-dim body-sm">{errata.description}</p>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          {banlists.length ? (
            <table className="w-full body-sm">
              <caption className="mb-2 text-left text-ink-muted signal-sm">{t('detail.banlists')}</caption>
              <tbody className="divide-y divide-line border-y border-line">
                {banlists.map((list) => (
                  <tr key={list.id}>
                    <th scope="row" className="py-1.5 pr-4 text-left font-normal text-ink-dim">{list.name}</th>
                    <td className="py-1.5 text-right text-ink">{status(list)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </div>
      </div>
    </Dialog>
  )
}
