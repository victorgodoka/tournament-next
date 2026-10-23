'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { Panel } from '@ui/panel'
import { archKey, type SampleCard, type SampleDeck } from '@utils/statistics'
import { Art, NOTE, num } from '../DeepDive'
import { FilterField, matches } from './controls'

const total = (cards: SampleCard[]) => cards.reduce((n, c) => n + c.count, 0)

const Zone = ({ title, cards }: { title: string; cards: SampleCard[] }) =>
  cards.length ? (
    <div className="flex flex-col gap-2">
      <span className="text-ink-muted signal-sm">{title} · {total(cards)}</span>
      <ul className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-2">
        {cards.map((c) => (
          <li key={c.id} title={c.name ?? undefined} className="relative">
            <Art card={c} size={64} className="aspect-square w-full" />
            <span className="absolute right-0.5 bottom-0.5 bg-space-000/85 px-1 font-mono text-[11px] font-bold text-ink">×{c.count}</span>
          </li>
        ))}
      </ul>
    </div>
  ) : null

/** The last section: one automatic deck per listed archetype, built from the statistics, not from a played list. */
export const SampleDecks = ({ decks }: { decks: SampleDeck[] }) => {
  const t = useTranslations('Statistics.sampleDecks')
  const locale = useLocale()
  const [open, setOpen] = useState<string | null>(decks[0] ? archKey(decks[0].archetype) : null)
  const [query, setQuery] = useState('')
  const shown = query ? decks.filter((d) => matches(d.name ?? '', query)) : decks
  const date = (iso: string) => new Date(iso).toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <Panel
      title={t('title')}
      meta={t('meta', { count: decks.length })}
      actions={decks.length ? <FilterField label={t('search')} value={query} onChange={setQuery} className="w-44 min-[720px]:w-64" /> : undefined}
    >
      {decks.length ? (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-2 min-[720px]:grid-cols-2 min-[1200px]:grid-cols-3">
            {shown.map((d) => {
              const key = archKey(d.archetype)
              const cover = d.coverCardId ? { id: d.coverCardId, name: d.name } : d.main[0]
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={open === key}
                  onClick={() => setOpen(open === key ? null : key)}
                  className="flex cursor-pointer items-center gap-3 border border-line bg-surface-200 p-2.5 text-left transition-colors hover:bg-surface-300 aria-pressed:border-cyan aria-pressed:bg-ground-cyan"
                >
                  <Art card={cover} size={44} className="size-11" />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-bold text-ink">{d.name ?? key}</span>
                    <span className="font-mono text-[11px] text-ink-muted">
                      {total(d.main)} / {total(d.extra)} / {total(d.side)} · {t('lists', { count: num(d.lists) })}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>
          {(() => {
            const d = shown.find((x) => archKey(x.archetype) === open)
            if (!d) return null
            return (
              <div className={twMerge('flex flex-col gap-5 border-t border-line pt-4')}>
                <div className="flex flex-wrap items-baseline justify-between gap-3">
                  <h3 className="display-3">{d.name}</h3>
                  <span className="text-ink-muted signal-sm">{t('updated', { date: date(d.updatedAt), created: date(d.createdAt) })}</span>
                </div>
                <Zone title={t('main')} cards={d.main} />
                <Zone title={t('extra')} cards={d.extra} />
                <Zone title={t('side')} cards={d.side} />
                {d.deckId ? (
                  <Link href={`/deck-builder/${d.deckId}`} className="self-start text-[13px] font-semibold text-cyan hover:underline">{t('open')}</Link>
                ) : null}
              </div>
            )
          })()}
          <p className={NOTE}>{t('note')}</p>
        </div>
      ) : (
        <p className={NOTE}>{t('empty')}</p>
      )}
    </Panel>
  )
}
