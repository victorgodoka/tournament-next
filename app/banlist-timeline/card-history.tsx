'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useFormatter, useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { twMerge } from 'tailwind-merge'
import { buttonClasses } from '@ui/button'
import { Icon } from '@ui/icon'
import { SectionHead } from '@ui/section-head'
import { BANLIST_CARDS, BANLISTS, cardBySlug, cardId, cardName, cardPath, cardSlug, STATUS_TONE, statusOn, wikiPath, type BanStatus } from '@utils/banlist'
import { CARD_IMAGE_URL } from '@utils/const'
import { cardLoader } from '@utils/image-loader'
import { CardStrip } from './card-strip'

const subscribe = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

/** `#card=<slug>` picks the card, so every card name on the page is a plain link. */
const cardFromHash = (hash: string) => {
  const match = /^#card=(.+)$/.exec(hash)
  return match?.[1] ? cardBySlug(decodeURIComponent(match[1])) : -1
}

const search = (query: string) => {
  const q = query.trim().toLowerCase()
  if (q.length < 2) return null
  const names = BANLIST_CARDS.map((name, card) => ({ card, at: name.toLowerCase().indexOf(q) })).filter(({ at }) => at >= 0)
  return names.sort((a, b) => Number(a.at > 0) - Number(b.at > 0)).slice(0, 12).map(({ card }) => card)
}

/** One card through every list, picked by search or `#card=<slug>`; its name opens the card's own page. */
export const CardHistory = ({ selected, current }: { selected: number; current: number }) => {
  const t = useTranslations('Banlist')
  const format = useFormatter()
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => '')
  const card = useMemo(() => cardFromHash(hash), [hash])
  const [query, setQuery] = useState('')
  const results = useMemo(() => search(query), [query])
  const section = useRef<HTMLElement>(null)

  useEffect(() => {
    if (card < 0) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    section.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }, [card])

  const status = (code: BanStatus) => t(`status.${code}`)
  const listed = BANLISTS.filter((list) => statusOn(card, list.index) !== 'U').length
  const now = statusOn(card, current)

  return (
    <section ref={section} id="history" aria-labelledby="bl-history" className="flex scroll-mt-20 flex-col gap-5">
      <SectionHead ruled num="03" id="bl-history" end={t('history.meta', { count: format.number(BANLIST_CARDS.length) })}>
        {t('history.heading')}
      </SectionHead>
      <div className="cut notch flex flex-col gap-5 p-4 [--cut:var(--cut-lg)] min-[720px]:p-6">
        <div className="flex max-w-130 flex-col gap-2">
          <label htmlFor="bl-search" className="text-ink-muted signal">{t('history.search')}</label>
          <input
            id="bl-search"
            type="search"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t('history.placeholder')}
            className="h-11 border border-line-strong bg-surface-200 px-4 text-ink body placeholder:text-ink-muted"
          />
        </div>

        {results?.length ? (
          <ul className="flex flex-wrap gap-2">
            {results.map((id) => {
              const s = statusOn(id, current)
              return (
                <li key={id}>
                  <a href={`#card=${cardSlug(id)}`} className="flex min-h-9 items-center gap-2 border border-line-mid bg-surface-200 px-3 py-1.5 text-ink body-sm hover:bg-surface-300">
                    <span title={status(s)} className={twMerge('font-bold signal-sm', STATUS_TONE[s].text)}>{s}</span>
                    {cardName(id)}
                  </a>
                </li>
              )
            })}
          </ul>
        ) : results ? (
          <p className="text-ink-muted body-sm">{t('history.noResults')}</p>
        ) : null}

        {card >= 0 ? (
          <div className="flex flex-col gap-5 pt-1">
            <div className="flex flex-wrap items-end gap-4">
              <Link href={wikiPath(card)} prefetch={false} target="_blank" rel="noopener" className="relative aspect-[59/86] w-20 shrink-0 overflow-hidden bg-surface-300">
                <Image loader={cardLoader} src={CARD_IMAGE_URL(cardId(card))} alt={cardName(card)} fill sizes="80px" className="object-cover" />
              </Link>
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <span className="text-ink-muted signal">
                  {t('history.listed', { count: listed, total: BANLISTS.length })}
                </span>
                <h3 className="text-ink display-2">
                  <Link href={cardPath(card)} className="inline-flex items-center gap-2 hover:text-cyan">
                    {cardName(card)} <Icon name="right" />
                  </Link>
                </h3>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <span className={twMerge('px-2.5 py-1.5 font-bold signal', STATUS_TONE[now].fill, STATUS_TONE[now].on)}>
                  {t('history.now', { status: status(now) })}
                </span>
                <Link href={wikiPath(card)} prefetch={false} target="_blank" rel="noopener" className={buttonClasses({ size: 'sm' })}>
                  {t('history.wiki')} <Icon name="right" size={14} />
                </Link>
              </div>
            </div>

            <CardStrip card={card} selected={selected} />
          </div>
        ) : (
          <p className="max-w-[60ch] text-ink-dim body">{t('history.empty')}</p>
        )}
      </div>
    </section>
  )
}
