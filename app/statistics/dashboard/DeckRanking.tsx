'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { Lookup, type LookupOption } from '@ui/lookup'
import { Panel } from '@ui/panel'
import { TabBar } from '@ui/tab-bar'
import { archKey, deckHref, getArchetypeIndex, growthDays, RANKING_MODES, type RankingMode, type StatArchetype, type Statistics, type StatisticsScope } from '@utils/statistics'
import { Art, faceOf, nameOf, NOTE, num, NUM, pct, ROW, SortHeads, sortBy, useSort, type Getters } from '../DeepDive'

type DeckRankingProps = {
  data: Statistics
  scope: StatisticsScope
}

const FOLD = 14
const COLS = '32px minmax(190px, 1.8fr) repeat(9, minmax(68px, 0.8fr))'
const TIER_COLOR = { 1: 'text-cyan', 1.5: 'text-azure-lift', 2: 'text-ink', 3: 'text-ink-dim', 4: 'text-ink-muted' } as const

/** The tab's order. Sleeper and Most consistent only hold the decks with that score; the others keep every deck. */
const ordered = (archetypes: StatArchetype[], keys: number[][] | undefined, mode: RankingMode): StatArchetype[] => {
  if (!keys) return [...archetypes].sort((a, b) => (mode === 'mostPlayed' ? b.games - a.games : (b.wilsonLower ?? -1) - (a.wilsonLower ?? -1)))
  const left = new Map(archetypes.map((a) => [archKey(a.archetype), a]))
  const out = keys.flatMap((key) => {
    const a = left.get(archKey(key))
    left.delete(archKey(key))
    return a ?? []
  })
  return mode === 'sleeper' || mode === 'consistent' ? out : [...out, ...left.values()]
}

/** The deck's meta share, day by day. `null` while it has under two points. */
const Spark = ({ points }: { points?: [number, number, number | null][] }) => {
  if (!points || points.length < 2) return null
  const shares = points.map(([, share]) => share)
  const lo = Math.min(...shares), hi = Math.max(...shares)
  const line = shares.map((v, i) => `${(i / (shares.length - 1)) * 100},${24 - ((v - lo) / (hi - lo || 1)) * 22}`).join(' ')
  return (
    <svg aria-hidden viewBox="0 0 100 26" preserveAspectRatio="none" className="h-6 w-full">
      <polyline points={line} fill="none" stroke="var(--color-series-1)" strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

const Growth = ({ value }: { value?: number }) =>
  value == null ? (
    <span className="text-ink-muted">—</span>
  ) : (
    <span className={value > 0 ? 'text-win' : value < 0 ? 'text-loss' : 'text-ink-dim'}>
      {value > 0 ? '▲ ' : value < 0 ? '▼ ' : ''}{Math.abs(value * 100).toFixed(1)}
    </span>
  )

const TierMark = ({ tier }: { tier?: StatArchetype['tier'] }) => (tier ? <span className={twMerge('flex-none font-mono text-[11px] font-bold', TIER_COLOR[tier])}>T{tier}</span> : null)

type RankSort = 'name' | 'share' | 'winRate' | 'wilson' | 'games' | 'players' | 'growth' | 'worst' | 'mirror'
const RANK_GET: Getters<StatArchetype, RankSort> = {
  name: nameOf,
  share: (a) => a.metaShare,
  winRate: (a) => a.winRate,
  wilson: (a) => a.wilsonLower,
  games: (a) => a.games,
  players: (a) => a.players,
  growth: (a) => a.growth,
  worst: (a) => a.consistencyScore,
  mirror: (a) => a.mirrorShare,
}

/** The tab's order with column sort on top; `#` stays the tab rank whatever the sort. Below 720px each deck is a row of two lines. */
const RankingTable = ({ ranked, trends, days, scope }: { ranked: StatArchetype[]; trends: Statistics['trends']; days: number; scope: StatisticsScope }) => {
  const t = useTranslations('Statistics.ranking')
  const [sort, onSort] = useSort<RankSort>()
  const [expanded, setExpanded] = useState(false)
  const rankOf = new Map(ranked.map((a, i) => [a, i + 1]))
  const points = new Map(trends.map((d) => [archKey(d.archetype), d.points]))
  const rows = sortBy(ranked, sort, RANK_GET)
  const visible = expanded ? rows : rows.slice(0, FOLD)

  return (
    <>
      <div className="max-h-[760px] overflow-auto max-[719px]:hidden">
        <div role="table" aria-label={t('title')} className="min-w-[1040px] border border-line">
          <SortHeads
            sticky
            cols={COLS}
            labels={['#', t('cols.deck'), t('cols.share'), t('cols.winRate'), t('cols.wilson'), t('cols.games'), t('cols.players'), t('cols.growth', { days }), t('cols.worst'), t('cols.mirror'), t('cols.trend')]}
            keys={[null, 'name', 'share', 'winRate', 'wilson', 'games', 'players', 'growth', 'worst', 'mirror', null]}
            sort={sort}
            onSort={onSort}
            right={(i) => i >= 2}
          />
          {visible.map((a) => {
            const key = archKey(a.archetype)
            return (
              <div key={key} role="row" className={ROW} style={{ gridTemplateColumns: COLS }}>
                <span role="cell" className="font-mono text-xs text-ink-muted tabular-nums">{rankOf.get(a)}</span>
                <span role="cell" className="flex min-w-0 items-center gap-2">
                  <Art card={faceOf(a)} size={32} className="size-8" />
                  <Link href={deckHref(a.archetype, scope)} title={nameOf(a)} className="truncate font-bold text-ink hover:text-cyan">{nameOf(a)}</Link>
                  <TierMark tier={a.tier} />
                </span>
                <span role="cell" className={twMerge(NUM, 'text-xs')}>{pct(a.metaShare)}</span>
                <span role="cell" className={NUM}>
                  <span className="font-bold text-ink">{pct(a.winRate)}</span>
                  {a.ci ? <span className="ml-1 text-[11px] text-ink-muted">±{(a.ci.margin * 100).toFixed(1)}</span> : null}
                </span>
                <span role="cell" className={twMerge(NUM, 'text-xs')}>{pct(a.wilsonLower)}</span>
                <span role="cell" className={twMerge(NUM, 'text-xs')}>{num(a.games)}</span>
                <span role="cell" className={twMerge(NUM, 'text-xs')}>{num(a.players)}</span>
                <span role="cell" className={twMerge(NUM, 'font-mono text-xs')}><Growth value={a.growth} /></span>
                <span role="cell" className={twMerge(NUM, 'text-xs')}>{pct(a.consistencyScore)}</span>
                <span role="cell" className={twMerge(NUM, 'text-xs')}>{pct(a.mirrorShare)}</span>
                <span role="cell"><Spark points={points.get(key)} /></span>
              </div>
            )
          })}
          {!visible.length ? <p className={twMerge(NOTE, 'px-4 py-3')}>{t('empty')}</p> : null}
        </div>
      </div>

      <ol className="flex flex-col gap-px border border-line bg-line min-[720px]:hidden">
        {visible.map((a) => (
          <li key={archKey(a.archetype)}>
            <Link href={deckHref(a.archetype, scope)} className="grid min-h-16 grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-2.5 bg-surface-100 p-3">
              <span className="font-mono text-xs text-ink-muted tabular-nums">{rankOf.get(a)}</span>
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-bold text-ink">{nameOf(a)}</span>
                  <TierMark tier={a.tier} />
                </span>
                <span className="text-xs text-ink-muted">{t('rowSub', { rate: pct(a.winRate), games: num(a.games) })}</span>
              </span>
              <span className="flex flex-col items-end gap-0.5">
                <span className="font-mono text-sm font-bold text-ink tabular-nums">{pct(a.metaShare)}</span>
                <span className="text-ink-muted signal-sm">{t('cols.share')}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>

      {rows.length > FOLD ? (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-3 cursor-pointer text-[13px] text-azure-lift transition-colors hover:text-ink">
          {expanded ? t('showTop', { count: FOLD }) : t('showAll', { count: rows.length })}
        </button>
      ) : null}
    </>
  )
}

export const DeckRanking = ({ data, scope }: DeckRankingProps) => {
  const t = useTranslations('Statistics.ranking')
  const router = useRouter()
  const [mode, setMode] = useState<RankingMode>('mostPlayed')
  const [searchFailed, setSearchFailed] = useState(false)
  const code = data.season.code
  const days = growthDays(data.syncedDays.count)

  const search = useCallback(
    async (text: string, signal: AbortSignal): Promise<LookupOption[]> => {
      const q = text.toLowerCase()
      try {
        const index = await getArchetypeIndex(code, 'main', signal)
        setSearchFailed(false)
        return index
          .filter((e) => nameOf(e).toLowerCase().includes(q))
          .slice(0, 20)
          .map((e) => ({ key: archKey(e.archetype), label: nameOf(e), meta: t('searchMeta', { games: num(e.games) }) }))
      } catch {
        if (!signal.aborted) setSearchFailed(true)
        return []
      }
    },
    [code, t],
  )

  return (
    <Panel title={t('title')} meta={t('meta', { count: data.archetypes.length })}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <Lookup label={t('search')} placeholder={t('search')} search={search} onPick={({ key }) => router.push(deckHref(String(key).split('-').map(Number), scope))} className="w-full max-w-md" />
        <span className="text-ink-muted signal-sm">
          {t('counts', { decks: num(data.totals.archetypes) })}
          {data.views ? ` · ${t('generalCount', { count: num(data.views.generalCount) })}` : ''}
        </span>
      </div>
      {searchFailed ? <p role="status" className={twMerge(NOTE, 'mb-3')}>{t('searchDown')}</p> : null}
      <TabBar tabs={RANKING_MODES.map((id) => ({ id, label: t(`tabs.${id}`) }))} active={mode} onSelect={setMode} label={t('tabsLabel')} idPrefix="deck-ranking" fit className="mb-4" />
      {/* Keyed by tab: a new tab starts in its own order, column sort and fold cleared. */}
      <RankingTable key={mode} ranked={ordered(data.archetypes, data.rankings?.[mode], mode)} trends={data.trends} days={days} scope={scope} />
      <p className={twMerge(NOTE, 'mt-3')}>{t(`note.${mode}`, { days })}</p>
      <p className="mt-1 text-ink-muted signal-sm">{t('legend', { days })}</p>
    </Panel>
  )
}
