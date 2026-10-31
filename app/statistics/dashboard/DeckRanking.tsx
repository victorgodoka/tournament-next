'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { Icon } from '@ui/icon'
import { Panel } from '@ui/panel'
import { TabBar } from '@ui/tab-bar'
import { archKey, RANKING_MODES, type RankingMode, type RankingsSummary, type StatArchetype } from '@utils/statistics'
import { Art, Bar, faceOf, nameOf, NOTE, num, NUM, pct, ROW, SortHeads, sortBy, useSort, type Getters } from '../DeepDive'
import { FilterField, matches } from './controls'

type DeckRankingProps = {
  archetypes: StatArchetype[]
  rankings?: RankingsSummary
  onPickArchetype?: (key: string) => void
}

const FOLD = 12
const COLS = '32px minmax(200px, 2fr) minmax(160px, 1.4fr) minmax(80px, 0.8fr) minmax(80px, 0.8fr) minmax(90px, 0.9fr)'
/** Past ±3 pts the deck's rate is flagged: enough to list, not enough to lean on. */
const SMALL_MARGIN = 0.03

const TIER_COLOR = { 1: 'text-tier-diamond', 1.5: 'text-tier-diamond', 2: 'text-tier-platinum', 3: 'text-tier-silver', 4: 'text-tier-gold' } as const

/** The ranking's order for a tab: the API's list first, any deck it leaves out after. */
const ordered = (archetypes: StatArchetype[], keys: number[][] | undefined, mode: RankingMode): StatArchetype[] => {
  if (!keys) return [...archetypes].sort((a, b) => (mode === 'mostPlayed' ? b.games - a.games : (b.wilsonLower ?? -1) - (a.wilsonLower ?? -1)))
  const left = new Map(archetypes.map((a) => [archKey(a.archetype), a]))
  const out: StatArchetype[] = []
  for (const key of keys) {
    const a = left.get(archKey(key))
    if (!a) continue
    out.push(a)
    left.delete(archKey(key))
  }
  return [...out, ...left.values()]
}

const MetricCell = ({ archetype: a, mode }: { archetype: StatArchetype; mode: RankingMode }) => {
  switch (mode) {
    case 'mostPlayed':
      return <Bar value={a.metaShare} max={1} label={pct(a.metaShare)} w={56} />
    case 'highestWinRate':
      return <span className={twMerge(NUM, 'block font-mono text-xs text-win')}>{pct(a.wilsonLower)}</span>
    case 'rising': {
      if (a.growth == null) return <span className={twMerge(NUM, 'block text-ink-muted')}>—</span>
      const up = a.growth >= 0
      return (
        <span className={twMerge(NUM, 'block font-mono text-xs', up ? 'text-win' : 'text-loss')}>
          {up ? '▲ +' : '▼ '}{(a.growth * 100).toFixed(1)} pts
        </span>
      )
    }
    case 'sleeper':
      return <span className={twMerge(NUM, 'block font-mono text-xs text-gold')}>{pct(a.sleeperScore ?? null)}</span>
    case 'consistent':
      return a.consistencyScore == null ? (
        <span className={twMerge(NUM, 'block text-ink-muted')}>—</span>
      ) : (
        <Bar value={a.consistencyScore} max={1} label={pct(a.consistencyScore)} color="series-2" w={56} />
      )
  }
}

type RankSort = 'name' | 'winRate' | 'games' | 'players'
const RANK_GET: Getters<StatArchetype, RankSort> = { name: nameOf, winRate: (a) => a.winRate, games: (a) => a.games, players: (a) => a.players }

/** The tab's order with column sort and the search on top; `#` stays the tab rank whatever the sort. */
const RankingTable = ({ ranked, mode, query, onPickArchetype }: { ranked: StatArchetype[]; mode: RankingMode; query: string; onPickArchetype?: (key: string) => void }) => {
  const t = useTranslations('Statistics.ranking')
  const [sort, onSort] = useSort<RankSort>()
  const [expanded, setExpanded] = useState(false)
  const rankOf = new Map(ranked.map((a, i) => [a, i + 1]))
  const rows = sortBy(query ? ranked.filter((a) => matches(nameOf(a), query)) : ranked, sort, RANK_GET)
  const visible = expanded || query ? rows : rows.slice(0, FOLD)

  return (
    <>
      {/* Its own scroll box, so the header stays on top of a long list. */}
      <div className="max-h-[680px] overflow-auto">
        <div role="table" aria-label={t('title')} className="min-w-[780px] border border-line">
          <SortHeads
            sticky
            cols={COLS}
            labels={['#', t('cols.deck'), t('cols.winRate'), t('cols.games'), t('cols.players'), t(`metric.${mode}`)]}
            keys={[null, 'name', 'winRate', 'games', 'players', null]}
            sort={sort}
            onSort={onSort}
            right={(i) => i >= 2}
          />
          {visible.map((a) => {
            const key = archKey(a.archetype)
            const margin = a.ci?.margin
            return (
              <div key={key} role="row" className={ROW} style={{ gridTemplateColumns: COLS }}>
                <span role="cell" className="font-mono text-xs text-ink-muted tabular-nums">{rankOf.get(a)}</span>
                <span role="cell" className="flex min-w-0 items-center gap-2">
                  <Art card={faceOf(a)} size={32} className="size-8" />
                  {onPickArchetype ? (
                    <button type="button" onClick={() => onPickArchetype(key)} className="cursor-pointer truncate font-bold text-ink hover:text-cyan">{nameOf(a)}</button>
                  ) : (
                    <span className="truncate font-bold text-ink">{nameOf(a)}</span>
                  )}
                  {a.tier ? <span className={twMerge('font-mono text-[10px]', TIER_COLOR[a.tier])}>T{a.tier}</span> : null}
                </span>
                <span role="cell" className={NUM}>
                  <span className="font-bold text-ink">{pct(a.winRate)}</span>
                  {margin != null ? <span className="ml-1 text-xs text-ink-muted">±&thinsp;{(margin * 100).toFixed(1)}</span> : null}
                  {margin != null && margin > SMALL_MARGIN ? (
                    <span title={t('small', { margin: (margin * 100).toFixed(1) })} className="ml-1 inline-flex align-[-2px] text-gold">
                      <Icon name="info" size={12} label={t('smallLabel')} />
                    </span>
                  ) : null}
                </span>
                <span role="cell" className={twMerge(NUM, 'text-xs')}>{num(a.games)}</span>
                <span role="cell" className={twMerge(NUM, 'text-xs')}>{num(a.players)}</span>
                <span role="cell"><MetricCell archetype={a} mode={mode} /></span>
              </div>
            )
          })}
          {!visible.length ? <p className={twMerge(NOTE, 'px-4 py-3')}>{t('empty')}</p> : null}
        </div>
      </div>
      {!query && rows.length > FOLD ? (
        <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-3 cursor-pointer text-[13px] text-azure-lift transition-colors hover:text-ink">
          {expanded ? t('showTop', { count: FOLD }) : t('showAll', { count: rows.length })}
        </button>
      ) : null}
    </>
  )
}

export const DeckRanking = ({ archetypes, rankings, onPickArchetype }: DeckRankingProps) => {
  const t = useTranslations('Statistics.ranking')
  const [mode, setMode] = useState<RankingMode>('mostPlayed')
  const [query, setQuery] = useState('')

  return (
    <Panel
      title={t('title')}
      meta={t('meta', { count: archetypes.length })}
      actions={<FilterField label={t('search')} value={query} onChange={setQuery} className="w-44 min-[720px]:w-64" />}
    >
      <TabBar
        tabs={RANKING_MODES.map((id) => ({ id, label: t(`tabs.${id}`) }))}
        active={mode}
        onSelect={setMode}
        label={t('tabsLabel')}
        idPrefix="deck-ranking"
        fit
        className="mb-4"
      />
      {/* Keyed by tab: a new tab starts in its own order, column sort and fold cleared. */}
      <RankingTable key={mode} ranked={ordered(archetypes, rankings?.[mode], mode)} mode={mode} query={query} onPickArchetype={onPickArchetype} />
      <p className={twMerge(NOTE, 'mt-3')}>{t(`note.${mode}`)}</p>
    </Panel>
  )
}
