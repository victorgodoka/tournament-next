'use client'

/** One deck's page: the header and its modes, then the report, or the job that calculates it. */

import { Fragment, useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { AdBanner } from '@omega/ads/ad-banner'
import { Breadcrumbs } from '@ui/breadcrumbs'
import { Segmented } from '@ui/choice'
import { BarList, LineChart } from '@ui/chart'
import { Lookup, type LookupOption } from '@ui/lookup'
import { Panel } from '@ui/panel'
import { SectionHead } from '@ui/section-head'
import { StatGrid } from '@ui/stat-grid'
import { TabBar } from '@ui/tab-bar'
import { archKey, cardHref, deckHref, getArchetypeIndex, getDeepDive, growthDays, intervalOf, matchupStatus, requestDeepDive, statisticsHref, strengthOf, type ArchetypeKey, type DeepDiveMode, type DeckListCard, type DeepDiveState, type Matchup, type MatchupOthers, type SampleDeck, type StatArchetype, type Statistics, type StatisticsScope } from '@utils/statistics'
import { AgainstTable, Art, cardName, CardsTable, faceOf, fixed, GroupsTable, nameOf, NOTE, num, NUM, pct, ROW } from './DeepDive'
import { JobPanel, useStatsJob } from './StatsJob'
import { Zone } from './dashboard/SampleDecks'
import { TierHistory } from './dashboard/MetaExtras'
import { dayLabel } from './dashboard/MetaOverview'

type Ready = Extract<DeepDiveState, { status: 'ready' }>

type DeckPageProps = {
  archetype: ArchetypeKey
  mode: DeepDiveMode
  scope: StatisticsScope
  /** The row of a deck in the page's list, already on the server. Any other is read here. */
  listed: (StatArchetype & { rank: number }) | null
  season: Statistics['season']
  syncedDays: number
  frozenBeforeModes: boolean
  matchups: Matchup[]
  names: Record<string, string | null>
  trend: Statistics['trends'][number] | null
  sampleDeck: SampleDeck | null
  ratingTiers: NonNullable<Statistics['ratingTiers']>
}

const Block = ({ num: n, title, end, children }: { num: string; title: string; end?: string; children: React.ReactNode }) => (
  <section className="flex flex-col gap-4">
    <SectionHead ruled num={n} end={end}>{title}</SectionHead>
    {children}
  </section>
)

const MATCH_COLS = 'minmax(170px, 1.6fr) 64px minmax(130px, 1.2fr) 64px 60px 60px 72px 52px'
/** Hand traps only show when the sweep tracked any: an empty column says nothing. */
const TRAP_COLS = `${MATCH_COLS} minmax(150px, 1.4fr)`

/** One opponent: the win rate, then its 95% interval on a 40–70% scale with a line at 50%. */
const MatchupLine = ({ name, cell, href, cols }: { name: string; cell: Matchup | MatchupOthers; href?: string; cols: string }) => {
  const ci = intervalOf(cell)
  const status = matchupStatus(ci)
  const tone = status === 'favorable' ? 'text-win' : status === 'unfavorable' ? 'text-loss' : 'text-ink'
  const at = (rate: number) => `${Math.min(100, Math.max(0, ((rate - 0.4) / 0.3) * 100))}%`
  const traps = 'handTraps' in cell ? cell.handTraps?.map((h) => `${h.name ?? h.id} ${pct(h.rate)}`).join(', ') : ''
  return (
    <div role="row" className={ROW} style={{ gridTemplateColumns: cols }}>
      <span role="cell" className="truncate font-bold text-ink">{href ? <Link href={href} className="hover:text-cyan">{name}</Link> : name}</span>
      <span role="cell" className={twMerge(NUM, 'font-bold', tone)}>{pct(cell.winRate)}</span>
      <span role="cell" className="relative block h-3.5 bg-surface-200" aria-hidden>
        <span className="absolute top-0 bottom-0 w-px bg-line-strong" style={{ left: at(0.5) }} />
        {ci ? <span className={twMerge('absolute top-1 h-1.5', status === 'favorable' ? 'bg-win' : status === 'unfavorable' ? 'bg-loss' : 'bg-series-3')} style={{ left: at(ci.lower), right: `calc(100% - ${at(ci.upper)})` }} /> : null}
      </span>
      <span role="cell" className={twMerge(NUM, 'text-xs')}>{num(cell.games)}</span>
      <span role="cell" className={twMerge(NUM, 'text-xs')}>{pct(cell.turnOrder?.first.winRate)}</span>
      <span role="cell" className={twMerge(NUM, 'text-xs')}>{pct(cell.turnOrder?.second.winRate)}</span>
      <span role="cell" className={twMerge(NUM, 'text-xs')}>{pct(cell.sideboarding?.postSide.winRate)}</span>
      <span role="cell" className={twMerge(NUM, 'text-xs')}>{'averageTurns' in cell ? fixed(cell.averageTurns ?? null, 1) : '—'}</span>
      {cols === TRAP_COLS ? <span role="cell" title={traps} className="truncate text-xs">{traps || '—'}</span> : null}
    </div>
  )
}

type ListTab = 'core' | 'flex' | 'sidePlan' | 'cards' | 'staples' | 'groups' | 'against'
/** In this share of the lists or more, a card is the deck's core; under it, a flex slot. */
const CORE_RATE = 0.8
const LIST_COLS = 'minmax(220px, 2fr) repeat(3, minmax(90px, 0.8fr))'

/** Every card of the registered lists, tracked or not. `side`: the side plan, by how often it's sided. */
const ListTable = ({ cards, side, label, hrefOf }: { cards: DeckListCard[]; side?: boolean; label: string; hrefOf: (id: number) => string }) => {
  const t = useTranslations('Statistics.deck')
  return (
    <div className="overflow-x-auto">
      <div role="table" aria-label={label} className="min-w-[560px] border border-line">
        <div role="row" className="grid min-h-9 items-center gap-x-4 border-b border-line-mid bg-surface-200 px-4 text-ink-muted signal-sm" style={{ gridTemplateColumns: LIST_COLS }}>
          <span>{t('cols.card')}</span><span className={NUM}>{side ? t('cols.sided') : t('cols.inLists')}</span><span className={NUM}>{t('cols.copies')}</span><span className={NUM}>{side ? t('cols.inLists') : t('cols.sided')}</span>
        </div>
        {cards.map((c) => (
          <div key={c.id} role="row" className={ROW} style={{ gridTemplateColumns: LIST_COLS }}>
            <span role="cell" className="flex min-w-0 items-center gap-3">
              <Art card={c} size={32} className="size-8" />
              <Link href={hrefOf(c.id)} title={cardName(c)} className="truncate font-bold text-ink hover:text-cyan">{cardName(c)}</Link>
            </span>
            <span role="cell" className={NUM}>{pct(side ? c.side : c.main)}</span>
            <span role="cell" className={NUM}>{fixed(side ? c.sideCopies : c.copies, 2)}</span>
            <span role="cell" className={NUM}>{pct(side ? c.main : c.side)}</span>
          </div>
        ))}
        {!cards.length ? <p className={twMerge(NOTE, 'px-4 py-3')}>{t('listEmpty')}</p> : null}
      </div>
    </div>
  )
}

/** Everything the API knows about the deck, section by section. */
const DeckReport = ({ row, scope, matchups, names, trend, sampleDeck, seasonStartsAt, ratingTiers }: { row: StatArchetype; scope: StatisticsScope; matchups: Matchup[]; names: Record<string, string | null>; trend: Statistics['trends'][number] | null; sampleDeck: SampleDeck | null; seasonStartsAt: string; ratingTiers: NonNullable<Statistics['ratingTiers']> }) => {
  const t = useTranslations('Statistics.deck')
  const locale = useLocale()
  const lists = row.deckList
  const [list, setList] = useState<ListTab>(lists ? 'core' : 'cards')
  const hrefOf = (id: number) => cardHref(id, scope)
  const opponents = [...matchups].filter((m) => m.winRate != null).sort((a, b) => b.games - a.games)
  const side = row.sideboarding
  const sideDelta = side.game1.winRate != null && side.postSide.winRate != null ? (side.postSide.winRate - side.game1.winRate) * 100 : null
  const firstEdge = row.turnOrder.first.winRate != null && row.turnOrder.second.winRate != null ? (row.turnOrder.first.winRate - row.turnOrder.second.winRate) * 100 : null
  const labels = trend ? trend.points.map(([d]) => dayLabel(locale, seasonStartsAt, d - 1)) : []
  const tabs: ListTab[] = [...(lists ? (['core', 'flex', 'sidePlan'] as const) : []), 'cards', ...(row.staples?.length ? (['staples'] as const) : []), 'groups', 'against']
  const matchCols = opponents.some((m) => m.handTraps?.length) ? TRAP_COLS : MATCH_COLS
  const grid = row.turnByGame
  const rowsOfPace = [
    ['paceTurns', 'averageTurns', 2],
    ['paceActions', 'actionsPerTurn', 1],
    ['paceT1', 'turn1SpecialSummons', 1],
    ['paceChain', 'averageLongestChain', 2],
  ] as const
  const shares = row.ratingShares
  const cell = (side: { games: number; winRate: number | null }) => (
    <span className="flex flex-col items-end">
      <span className="font-bold text-ink tabular-nums">{pct(side.winRate)}</span>
      <span className="font-mono text-[11px] text-ink-muted">{num(side.games)}</span>
    </span>
  )
  const nullCardRates = row.cards.some((c) => c.winRateWhenUsed == null || c.winRateInDeck == null)
  const tile = (title: string, value: string, hint: string) => (
    <div className="flex flex-col gap-1.5 bg-surface-100 p-4">
      <span className="text-ink-muted signal-sm">{title}</span>
      <span className="text-ink stat">{value}</span>
      <span className={NOTE}>{hint}</span>
    </div>
  )

  return (
    <div className="flex flex-col gap-12">
      <Block num="01" title={t('performance')} end={t('deckGames', { count: num(row.games) })}>
        {grid ? (
          <Panel title={t('turnByGame')} meta={t('turnByGameMeta')}>
            <div className="grid grid-cols-[minmax(0,1fr)_repeat(2,minmax(80px,1fr))] gap-px border border-line bg-line">
              <span className="bg-surface-200 px-3 py-2" />
              <span className="bg-surface-200 px-3 py-2 text-right text-ink-muted signal-sm">{t('game', { n: 1 })}</span>
              <span className="bg-surface-200 px-3 py-2 text-right text-ink-muted signal-sm">{t('afterSide')}</span>
              <span className="bg-surface-100 px-3 py-2 text-sm font-semibold text-ink">{t('first')}</span>
              <span className="bg-surface-100 px-3 py-2">{cell(grid.first.game1)}</span>
              <span className="bg-surface-100 px-3 py-2">{cell(grid.first.postSide)}</span>
              <span className="bg-surface-100 px-3 py-2 text-sm font-semibold text-ink">{t('second')}</span>
              <span className="bg-surface-100 px-3 py-2">{cell(grid.second.game1)}</span>
              <span className="bg-surface-100 px-3 py-2">{cell(grid.second.postSide)}</span>
            </div>
          </Panel>
        ) : null}
        <div className="grid grid-cols-1 gap-4 min-[980px]:grid-cols-3">
          <div className="flex flex-col gap-2">
            <BarList
              title={t('turnOrder')}
              subtitle={t('gamesPair', { a: num(row.turnOrder.first.games), b: num(row.turnOrder.second.games) })}
              items={[{ label: t('first'), value: row.turnOrder.first.winRate ?? 0 }, { label: t('second'), value: row.turnOrder.second.winRate ?? 0, color: 'series-3' }]}
              format={pct}
              max={1}
            />
            {firstEdge != null ? <p className={NOTE}>{t('firstEdge', { points: `${firstEdge >= 0 ? '+' : '−'}${Math.abs(firstEdge).toFixed(1)}` })}</p> : null}
          </div>
          <div className="flex flex-col gap-2">
            <BarList
              title={t('siding')}
              subtitle={t('gamesPair', { a: num(side.game1.games), b: num(side.postSide.games) })}
              items={[{ label: t('beforeSide'), value: side.game1.winRate ?? 0 }, { label: t('afterSide'), value: side.postSide.winRate ?? 0, color: 'series-3' }]}
              format={pct}
              max={1}
            />
            {sideDelta != null ? <p className={NOTE}>{t('sideDelta', { points: `${sideDelta >= 0 ? '+' : '−'}${Math.abs(sideDelta).toFixed(1)}` })}</p> : null}
          </div>
          {row.byGame ? (
            <BarList
              title={t('byGame')}
              items={[{ label: t('game', { n: 1 }), value: row.byGame.g1.winRate ?? 0 }, { label: t('game', { n: 2 }), value: row.byGame.g2.winRate ?? 0, color: 'series-3' }, { label: t('game', { n: 3 }), value: row.byGame.g3.winRate ?? 0, color: 'series-2' }]}
              format={pct}
              max={1}
            />
          ) : null}
        </div>
        <div className="grid grid-cols-1 gap-px border border-line bg-line min-[720px]:grid-cols-2">
          {tile(t('worstBlock'), pct(row.consistencyScore), row.consistencyScore == null ? t('worstBlockNone') : t('worstBlockHint'))}
          {tile(t('sleeper'), pct(row.sleeperScore), row.sleeperScore == null ? t('sleeperNone') : t('sleeperHint'))}
          {row.pilotShare != null ? tile(t('pilots'), pct(row.pilotShare), t('pilotsHint')) : null}
          {row.unfinishedRate != null ? tile(t('noResult'), pct(row.unfinishedRate), t('noResultHint')) : null}
        </div>
        {shares?.length === ratingTiers.length && shares.length ? (
          <BarList
            title={t('byRating')}
            subtitle={t('byRatingMeta')}
            items={ratingTiers.map((band, i) => ({ label: `${band.tier}${band.plus ? '+' : ''}`, value: shares[i] ?? 0 }))}
            format={pct}
          />
        ) : null}
      </Block>

      <Block num="02" title={t('pace')}>
        <div className="grid grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(64px,1fr))] gap-px border border-line bg-line text-sm">
          <span className="bg-surface-200 px-3 py-2 text-ink-muted signal-sm">{t('paceMetric')}</span>
          <span className="bg-surface-200 px-3 py-2 text-right text-ink-muted signal-sm">{t('paceAll')}</span>
          <span className="bg-surface-200 px-3 py-2 text-right text-ink-muted signal-sm">{t('paceWins')}</span>
          <span className="bg-surface-200 px-3 py-2 text-right text-ink-muted signal-sm">{t('paceLosses')}</span>
          {rowsOfPace.map(([label, key, digits]) => (
            <Fragment key={key}>
              <span className="bg-surface-100 px-3 py-2 text-ink-dim">{t(label)}</span>
              <span className={twMerge(NUM, 'bg-surface-100 px-3 py-2 font-bold text-ink')}>{fixed(row.pace[key], digits)}</span>
              <span className={twMerge(NUM, 'bg-surface-100 px-3 py-2 text-ink-dim')}>{fixed(row.paceByResult?.win[key] ?? null, digits)}</span>
              <span className={twMerge(NUM, 'bg-surface-100 px-3 py-2 text-ink-dim')}>{fixed(row.paceByResult?.loss[key] ?? null, digits)}</span>
            </Fragment>
          ))}
        </div>
        {row.paceByResult?.win.turn1SpecialSummons != null && row.paceByResult.loss.turn1SpecialSummons != null ? (
          <p className={NOTE}>{t('paceNote', { win: row.paceByResult.win.turn1SpecialSummons.toFixed(1), loss: row.paceByResult.loss.turn1SpecialSummons.toFixed(1) })}</p>
        ) : null}
      </Block>

      <Block num="03" title={t('matchups')} end={t('matchupsEnd', { name: nameOf(row) })}>
        {opponents.length || row.matchupOthers ? (
          <>
            <div className="overflow-x-auto">
              <div role="table" aria-label={t('matchups')} className="min-w-[980px] border border-line">
                <div role="row" className="grid min-h-9 items-center gap-x-4 border-b border-line-mid bg-surface-200 px-4 text-ink-muted signal-sm" style={{ gridTemplateColumns: matchCols }}>
                  <span>{t('cols.opponent')}</span><span className={NUM}>{t('cols.winRate')}</span><span>{t('cols.interval')}</span><span className={NUM}>{t('cols.games')}</span><span className={NUM}>{t('cols.first')}</span><span className={NUM}>{t('cols.second')}</span><span className={NUM}>{t('cols.postSide')}</span><span className={NUM}>{t('cols.turns')}</span>{matchCols === TRAP_COLS ? <span>{t('cols.handTraps')}</span> : null}
                </div>
                {opponents.map((m) => {
                  const key = archKey(m.opponent)
                  return <MatchupLine key={key} name={nameOf({ name: names[key] ?? null, archetype: m.opponent })} cell={m} href={deckHref(m.opponent, scope)} cols={matchCols} />
                })}
                {row.matchupOthers ? <MatchupLine name={t('allOthers')} cell={row.matchupOthers} cols={matchCols} /> : null}
              </div>
            </div>
            <p className={NOTE}>{t('matchupsNote')}</p>
          </>
        ) : (
          <p className={NOTE}>{t('noMatchups')}</p>
        )}
      </Block>

      {trend && labels.length > 1 ? (
        <Block num="04" title={t('byDay')}>
          <div className="grid grid-cols-1 gap-4 min-[980px]:grid-cols-2">
            <LineChart title={t('metaShare')} labels={labels} series={[{ name: nameOf(row), data: trend.points.map(([, share]) => share) }]} format={(v) => `${(v * 100).toFixed(1)}%`} height={200} />
            <LineChart title={t('winRate')} labels={labels} series={[{ name: nameOf(row), data: trend.points.map(([, , wr]) => wr ?? 0), color: 'series-3' }]} format={(v) => `${(v * 100).toFixed(0)}%`} height={200} />
          </div>
          {trend.tiers ? <TierHistory trends={[trend]} seasonStartsAt={seasonStartsAt} /> : null}
        </Block>
      ) : null}

      <AdBanner id="ad-mid" placement="content" />

      <Block num={trend ? '05' : '04'} title={t('list')}>
        <TabBar tabs={tabs.map((id) => ({ id, label: t(`tabs.${id}`) }))} active={list} onSelect={setList} label={t('list')} idPrefix="deck-list" fit />
        {lists && (list === 'core' || list === 'flex' || list === 'sidePlan') ? (
          <div className="flex flex-col gap-3">
            <ListTable
              label={t(`tabs.${list}`)}
              side={list === 'sidePlan'}
              hrefOf={hrefOf}
              cards={list === 'core' ? lists.cards.filter((c) => c.main >= CORE_RATE) : list === 'flex' ? lists.cards.filter((c) => c.main < CORE_RATE && c.main > c.side) : [...lists.cards].filter((c) => c.side > 0).sort((a, b) => b.side - a.side)}
            />
            <p className={NOTE}>{t('listNote', { count: num(lists.lists) })}</p>
          </div>
        ) : list === 'cards' ? (
          <div className="flex flex-col gap-3">
            <CardsTable cards={row.cards} label={t('tabs.cards')} hrefOf={hrefOf} />
            <p className={NOTE}>{t('cardsNote')}</p>
            {nullCardRates ? <p className={NOTE}>{t('oldServer')}</p> : null}
          </div>
        ) : list === 'staples' ? (
          <CardsTable cards={row.staples ?? []} label={t('tabs.staples')} hrefOf={hrefOf} />
        ) : list === 'groups' ? (
          <GroupsTable engines={row.engines} techs={row.techs} hrefOf={hrefOf} />
        ) : (
          <AgainstTable cards={row.against} />
        )}
      </Block>

      {sampleDeck ? (
        <Block num={trend ? '06' : '05'} title={t('sampleDeck')} end={t('sampleEnd', { count: num(sampleDeck.lists) })}>
          <Panel>
            <div className="flex flex-col gap-5">
              <Zone title={t('main')} cards={sampleDeck.main} />
              <Zone title={t('extra')} cards={sampleDeck.extra} />
              <Zone title={t('side')} cards={sampleDeck.side} />
              {sampleDeck.deckId ? <Link href={`/deck-builder/${sampleDeck.deckId}`} className="self-start text-[13px] font-semibold text-cyan hover:underline">{t('openDeck')}</Link> : null}
            </div>
          </Panel>
        </Block>
      ) : null}

      <AdBanner id="ad-bottom" placement="content" />
    </div>
  )
}

/** A row outside the page's list: read from the API, calculated on request. */
const DeckJob = ({ code, mode, archetype, name, back, children }: {
  code: string
  mode: DeepDiveMode
  archetype: ArchetypeKey
  name: string
  back: string
  children: (row: Ready['archetype']) => React.ReactNode
}) => {
  const read = useCallback((signal: AbortSignal) => getDeepDive(code, mode, archetype, signal), [code, mode, archetype])
  const request = useCallback(() => requestDeepDive(code, mode, archetype), [code, mode, archetype])
  const { state, failed, retry, calculate } = useStatsJob<Ready>(read, request)

  if (state?.status === 'ready' && failed === null) return <>{children(state.archetype)}</>
  return <JobPanel kind="deck" name={name} state={state?.status === 'ready' ? null : state} failed={failed} onRetry={retry} onCalculate={calculate} back={back} />
}

const KpiHeader = ({ row, days }: { row: StatArchetype & { rank?: number }; days: number }) => {
  const t = useTranslations('Statistics.deck')
  const growth = row.growth
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2.5">
        {row.tier ? <span className="cut px-2.5 py-1 text-cyan signal-strong [--cut:var(--cut-xs)] [--edge:var(--color-cyan)] [--fill:var(--color-ground-cyan)]">{t('tier', { tier: row.tier })}</span> : <span className="text-ink-muted signal">{t('noTier')}</span>}
        {growth != null ? <span className={twMerge('signal', growth > 0 ? 'text-win' : growth < 0 ? 'text-loss' : 'text-ink-muted')}>{growth > 0 ? '▲' : growth < 0 ? '▼' : ''} {t('growth', { points: Math.abs(growth * 100).toFixed(1), days })}</span> : null}
        {row.rank ? <span className="text-ink-muted signal">{t('rank', { rank: row.rank })}</span> : null}
      </div>
      <StatGrid
        columns={3}
        items={[
          { label: t('metaShare'), value: pct(row.metaShare), hint: t('metaShareHint') },
          { label: t('winRate'), value: pct(row.winRate), hint: row.ci ? t('winRateHint', { margin: (row.ci.margin * 100).toFixed(1) }) : undefined },
          { label: t('adjusted'), value: pct(strengthOf(row)), hint: row.overdispersion != null ? t('adjustedHint', { phi: row.overdispersion.toFixed(1) }) : t('wilsonHint') },
          { label: t('deckGamesLabel'), value: num(row.games), hint: t('record', { w: num(row.wins), l: num(row.losses), d: num(row.draws) }) },
          { label: t('duelists'), value: num(row.players), hint: t('duelistsHint') },
          { label: t('mirrors'), value: pct(row.mirrorShare), hint: t('mirrorsHint') },
        ]}
      />
    </div>
  )
}

export const DeckPage = ({ archetype, mode, scope, listed, season, syncedDays, frozenBeforeModes, matchups, names, trend, sampleDeck, ratingTiers }: DeckPageProps) => {
  const t = useTranslations('Statistics.deck')
  const tRoot = useTranslations('Statistics')
  const router = useRouter()
  const [jobName, setJobName] = useState<string | null>(null)
  const [fetched, setFetched] = useState<(StatArchetype & { rank: number }) | null>(null)
  const code = season.code
  const lead = archetype[0]!
  const mixed = archetype.length === 2
  const needsSecond = mode === 'combined' && !mixed
  const back = statisticsHref(scope)
  const row = listed ?? (fetched && archKey(fetched.archetype) === archKey(archetype) ? fetched : null)
  const title = row ? nameOf(row) : (jobName ?? names[archKey(archetype)] ?? nameOf({ name: null, archetype }))
  const closed = !!season.endsAt

  /* A deck outside the page's list comes with no name: the mode's index has it. A lead alone is a `main` key. */
  useEffect(() => {
    if (listed) return
    const controller = new AbortController()
    getArchetypeIndex(code, needsSecond ? 'main' : mode, controller.signal).then(
      (entries) => setJobName(entries.find((e) => archKey(e.archetype) === archKey(archetype))?.name ?? null),
      () => undefined,
    )
    return () => controller.abort()
  }, [code, mode, needsSecond, archetype, listed])

  const search = useCallback(
    async (text: string, signal: AbortSignal): Promise<LookupOption[]> => {
      const q = text.toLowerCase()
      const index = await getArchetypeIndex(code, 'main', signal).catch(() => [])
      return index.filter((e) => nameOf(e).toLowerCase().includes(q)).slice(0, 20).map((e) => ({ key: archKey(e.archetype), label: nameOf(e), meta: num(e.games) }))
    },
    [code],
  )

  /* Second lists the lead's pairs by their second name: "A with B" shows as B. */
  const searchSecond = useCallback(
    async (text: string, signal: AbortSignal): Promise<LookupOption[]> => {
      const q = text.toLowerCase()
      const index = await getArchetypeIndex(code, 'combined', signal).catch(() => [])
      return index
        .filter((e) => e.archetype[0] === lead)
        .map((e) => ({ ...e, name: e.name?.split(' with ').at(-1) ?? e.name }))
        .filter((e) => nameOf(e).toLowerCase().includes(q))
        .slice(0, 20)
        .map((e) => ({ key: archKey(e.archetype), label: nameOf(e), meta: num(e.games) }))
    },
    [code, lead],
  )

  return (
    <div className="flex flex-col gap-10">
      <Breadcrumbs items={[{ label: tRoot('header.title'), href: back }, { label: t('crumb'), href: `${back}&section=deck-ranking` }, { label: title }]} />

      <Panel tone="steel" label={title}>
        <div className="flex flex-wrap items-start gap-6">
          <Art card={row ? faceOf(row) : undefined} size={148} className="size-37 max-[720px]:hidden" />
          <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-5">
            <div className="flex flex-col gap-2">
              <span className="text-ink-dim signal">{season.ladder === 'genesys' ? 'Genesys' : 'TCG'} · {season.label}{closed ? ` · ${t('frozen')}` : ''}</span>
              <h1 className="display-2 text-ink">{title}</h1>
            </div>
            {!mixed || mode === 'combined' ? (
              <div className="flex flex-wrap items-center gap-3">
                <Segmented
                  size="sm"
                  label={t('modeLabel')}
                  options={[
                    { value: 'main', label: t('modes.main') },
                    { value: 'pure', label: t('modes.pure'), disabled: true },
                    { value: 'general', label: t('modes.general'), disabled: frozenBeforeModes },
                    { value: 'combined', label: t('modes.combined'), disabled: frozenBeforeModes },
                  ]}
                  value={mode}
                  onChange={(next) => router.push(deckHref([lead], scope, next as DeepDiveMode))}
                />
                {mode === 'combined' ? <Lookup label={t('secondDeck')} placeholder={t('secondDeck')} search={searchSecond} onPick={({ key }) => router.push(deckHref(String(key).split('-').map(Number), scope, 'combined'))} className="w-full max-w-64" /> : null}
                <Lookup label={t('openAnother')} placeholder={t('openAnother')} search={search} onPick={({ key }) => router.push(deckHref(String(key).split('-').map(Number), scope))} className="ml-auto w-full max-w-64" />
              </div>
            ) : (
              <Lookup label={t('openAnother')} placeholder={t('openAnother')} search={search} onPick={({ key }) => router.push(deckHref(String(key).split('-').map(Number), scope))} className="w-full max-w-64" />
            )}
            <p className={NOTE}>{frozenBeforeModes ? t('modesFrozen') : t(`modeHint.${mode}`, { name: names[String(lead)] ?? title })}</p>
          </div>
        </div>
      </Panel>

      {needsSecond ? (
        <Panel title={t('pickSecond')}><p className="text-ink-dim body">{t('pickSecondBody', { name: title })}</p></Panel>
      ) : listed ? (
        <>
          <KpiHeader row={listed} days={growthDays(syncedDays)} />
          <DeckReport row={listed} scope={scope} matchups={matchups} names={names} trend={trend} sampleDeck={sampleDeck} seasonStartsAt={season.startsAt} ratingTiers={ratingTiers} />
        </>
      ) : (
        <DeckJob key={`${code}:${mode}:${archKey(archetype)}`} code={code} mode={mode} archetype={archetype} name={title} back={back}>
          {(ready) => (
            <>
              <Remember row={ready} onRow={setFetched} />
              <KpiHeader row={ready} days={growthDays(syncedDays)} />
              <DeckReport row={ready} scope={scope} matchups={matchups} names={names} trend={trend} sampleDeck={sampleDeck} seasonStartsAt={season.startsAt} ratingTiers={ratingTiers} />
            </>
          )}
        </DeckJob>
      )}
    </div>
  )
}

/** Hands the row read by the job up to the page's header. */
const Remember = ({ row, onRow }: { row: StatArchetype & { rank: number }; onRow: (row: StatArchetype & { rank: number }) => void }) => {
  useEffect(() => onRow(row), [row, onRow])
  return null
}
