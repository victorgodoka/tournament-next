'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { Lookup, type LookupOption } from '@ui/lookup'
import { Panel } from '@ui/panel'
import { TabBar } from '@ui/tab-bar'
import { cardHref, searchCards, type MostUsedCard, type Statistics, type StatisticsScope } from '@utils/statistics'
import { Art, cardName, NOTE, num, NUM, pct, ROW, SortHeads, sortBy, useSort, type Getters } from '../DeepDive'

type Tab = 'main' | 'extra'
const FOLD = 12
const COLS = '32px minmax(200px, 2fr) repeat(6, minmax(72px, 0.7fr)) minmax(170px, 1.3fr)'

type UsedSort = 'name' | 'popularity' | 'usageRate' | 'winRateWhenUsed' | 'winRateWith' | 'winRateWithout' | 'delta'
type UsedRow = MostUsedCard & { rank: number; samples: number; delta: number | null }
const USED_GET: Getters<UsedRow, UsedSort> = {
  name: cardName,
  popularity: (c) => c.popularity,
  usageRate: (c) => c.usageRate,
  winRateWhenUsed: (c) => c.winRateWhenUsed,
  winRateWith: (c) => c.winRateWith,
  winRateWithout: (c) => c.winRateWithout,
  delta: (c) => c.delta,
}

/** `samples` is the popularity back in deck-games: ±1 game or so off, the API sends the rate rounded to 4 places. */
const MostUsed = ({ cards, totalGames, scope }: { cards: MostUsedCard[]; totalGames: number; scope: StatisticsScope }) => {
  const t = useTranslations('Statistics.cards')
  const [sort, onSort] = useSort<UsedSort>()
  const [expanded, setExpanded] = useState(false)
  const rows = sortBy(
    cards.map((c, i): UsedRow => ({
      ...c,
      rank: i + 1,
      samples: Math.round(c.popularity * totalGames),
      delta: c.winRateWith != null && c.winRateWithout != null ? c.winRateWith - c.winRateWithout : null,
    })),
    sort,
    USED_GET,
  )
  const visible = expanded ? rows : rows.slice(0, FOLD)
  return (
    <>
      <div className="max-h-[760px] overflow-auto">
        <div role="table" aria-label={t('title')} className="min-w-[1000px] border border-line">
          <SortHeads
            sticky
            cols={COLS}
            labels={['#', t('cols.card'), t('cols.popularity'), t('cols.usage'), t('cols.wrUsed'), t('cols.inDeck'), t('cols.notIn'), t('cols.delta'), t('cols.topArchetypes')]}
            keys={[null, 'name', 'popularity', 'usageRate', 'winRateWhenUsed', 'winRateWith', 'winRateWithout', 'delta', null]}
            sort={sort}
            onSort={onSort}
            right={(i) => i >= 2 && i < 8}
          />
          {visible.map((c) => (
            <div key={c.id} role="row" className={twMerge(ROW, 'text-xs')} style={{ gridTemplateColumns: COLS }}>
              <span role="cell" className="font-mono text-ink-muted">{c.rank}</span>
              <span role="cell" className="flex min-w-0 items-center gap-2">
                <Art card={c} size={28} className="size-7" />
                <Link href={cardHref(c.id, scope)} title={cardName(c)} className="truncate font-semibold text-ink hover:text-cyan">{cardName(c)}</Link>
                {c.handTrap ? <span className="flex-none font-mono text-[9px] text-gold">{t('handTrap')}</span> : null}
              </span>
              <span role="cell" className={twMerge(NUM, 'font-mono')} title={t('approxGames', { count: num(c.samples) })}>{pct(c.popularity)}</span>
              <span role="cell" className={twMerge(NUM, 'font-mono')}>{pct(c.usageRate)}</span>
              <span role="cell" className={twMerge(NUM, 'font-mono')}>{pct(c.winRateWhenUsed)}</span>
              <span role="cell" className={twMerge(NUM, 'font-mono font-semibold text-ink')}>{pct(c.winRateWith)}</span>
              <span role="cell" className={twMerge(NUM, 'font-mono')}>{pct(c.winRateWithout)}</span>
              <span role="cell" className={twMerge(NUM, 'font-mono font-bold', c.delta == null ? 'text-ink-muted' : c.delta > 0 ? 'text-win' : c.delta < 0 ? 'text-loss' : 'text-ink-muted')}>
                {c.delta == null ? '—' : `${c.delta > 0 ? '+' : ''}${(c.delta * 100).toFixed(1)}`}
              </span>
              <span role="cell" title={c.topArchetypes?.join(' · ')} className="truncate text-ink-muted">{c.topArchetypes?.join(' · ') ?? '—'}</span>
            </div>
          ))}
        </div>
      </div>
      {rows.length > FOLD ? (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-3 cursor-pointer self-start text-[13px] text-azure-lift transition-colors hover:text-ink">
          {expanded ? t('showTop', { count: FOLD }) : t('showAll', { count: rows.length })}
        </button>
      ) : null}
      <p className={twMerge(NOTE, 'mt-3')}>{t('mostUsedNote')}</p>
    </>
  )
}

export const CardsSection = ({ data, scope }: { data: Statistics; scope: StatisticsScope }) => {
  const t = useTranslations('Statistics.cards')
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('main')
  const [searchFailed, setSearchFailed] = useState(false)
  const code = data.season.code

  /* The server matches by name; the field asks from two characters on. */
  const search = useCallback(
    async (text: string, signal: AbortSignal): Promise<LookupOption[]> => {
      if (text.trim().length < 2) return []
      try {
        const cards = await searchCards(code, text, signal)
        setSearchFailed(false)
        return cards.map((c) => ({ key: c.id, label: c.name ?? `#${c.id}`, meta: t('searchMeta', { popularity: pct(c.popularity) }) }))
      } catch {
        if (!signal.aborted) setSearchFailed(true)
        return []
      }
    },
    [code, t],
  )

  return (
    <Panel title={t('title')} meta={t('meta')}>
      <div className="flex flex-col gap-4">
        <Lookup label={t('search')} placeholder={t('search')} search={search} onPick={({ key }) => router.push(cardHref(Number(key), scope))} className="max-w-md" />
        {searchFailed ? <p role="status" className={NOTE}>{t('searchDown')}</p> : null}
        <TabBar tabs={(['main', 'extra'] as const).map((id) => ({ id, label: t(`tabs.${id}`) }))} active={tab} onSelect={setTab} label={t('tabsLabel')} idPrefix="cards-tab" fit />
        {/* Keyed by tab: each list starts in its own order and fold. */}
        <MostUsed key={tab} cards={data.mostUsed?.[tab] ?? []} totalGames={data.totals.games} scope={scope} />
      </div>
    </Panel>
  )
}
