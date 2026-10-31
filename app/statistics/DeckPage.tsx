'use client'

/** One deck's page: the header and its modes, then the report, or the job that calculates it. */

import { useCallback, useEffect, useState } from 'react'
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
import { archKey, cardHref, deckHref, getArchetypeIndex, getDeepDive, growthDays, matchupStatus, requestDeepDive, statisticsHref, type ArchetypeKey, type DeepDiveMode, type DeepDiveState, type Matchup, type MatchupOthers, type SampleDeck, type StatArchetype, type Statistics, type StatisticsScope } from '@utils/statistics'
import { AgainstTable, Art, CardsTable, faceOf, fixed, GroupsTable, nameOf, NOTE, num, NUM, pct, ROW } from './DeepDive'
import { JobPanel, useStatsJob } from './StatsJob'
import { Zone } from './dashboard/SampleDecks'
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
}

const Block = ({ num: n, title, end, children }: { num: string; title: string; end?: string; children: React.ReactNode }) => (
  <section className="flex flex-col gap-4">
    <SectionHead ruled num={n} end={end}>{title}</SectionHead>
    {children}
  </section>
)

const MATCH_COLS = 'minmax(170px, 1.6fr) 72px minmax(150px, 1.4fr) 72px 72px 72px 80px'

/** One opponent: the win rate, then its 95% interval on a 40–70% scale with a line at 50%. */
const MatchupLine = ({ name, cell, href }: { name: string; cell: Matchup | MatchupOthers; href?: string }) => {
  const status = matchupStatus(cell.ci)
  const tone = status === 'favorable' ? 'text-win' : status === 'unfavorable' ? 'text-loss' : 'text-ink'
  const at = (rate: number) => `${Math.min(100, Math.max(0, ((rate - 0.4) / 0.3) * 100))}%`
  return (
    <div role="row" className={ROW} style={{ gridTemplateColumns: MATCH_COLS }}>
      <span role="cell" className="truncate font-bold text-ink">{href ? <Link href={href} className="hover:text-cyan">{name}</Link> : name}</span>
      <span role="cell" className={twMerge(NUM, 'font-bold', tone)}>{pct(cell.winRate)}</span>
      <span role="cell" className="relative block h-3.5 bg-surface-200" aria-hidden>
        <span className="absolute top-0 bottom-0 w-px bg-line-strong" style={{ left: at(0.5) }} />
        {cell.ci ? <span className={twMerge('absolute top-1 h-1.5', status === 'favorable' ? 'bg-win' : status === 'unfavorable' ? 'bg-loss' : 'bg-series-3')} style={{ left: at(cell.ci.lower), right: `calc(100% - ${at(cell.ci.upper)})` }} /> : null}
      </span>
      <span role="cell" className={twMerge(NUM, 'text-xs')}>{num(cell.games)}</span>
      <span role="cell" className={twMerge(NUM, 'text-xs')}>{pct(cell.turnOrder?.first.winRate)}</span>
      <span role="cell" className={twMerge(NUM, 'text-xs')}>{pct(cell.turnOrder?.second.winRate)}</span>
      <span role="cell" className={twMerge(NUM, 'text-xs')}>{pct(cell.sideboarding?.postSide.winRate)}</span>
    </div>
  )
}

type ListTab = 'cards' | 'staples' | 'groups' | 'against'

/** Everything the API knows about the deck, section by section. */
const DeckReport = ({ row, scope, matchups, names, trend, sampleDeck, seasonStartsAt }: { row: StatArchetype; scope: StatisticsScope; matchups: Matchup[]; names: Record<string, string | null>; trend: Statistics['trends'][number] | null; sampleDeck: SampleDeck | null; seasonStartsAt: string }) => {
  const t = useTranslations('Statistics.deck')
  const locale = useLocale()
  const [list, setList] = useState<ListTab>('cards')
  const hrefOf = (id: number) => cardHref(id, scope)
  const opponents = [...matchups].filter((m) => m.winRate != null).sort((a, b) => b.games - a.games)
  const side = row.sideboarding
  const sideDelta = side.game1.winRate != null && side.postSide.winRate != null ? (side.postSide.winRate - side.game1.winRate) * 100 : null
  const firstEdge = row.turnOrder.first.winRate != null && row.turnOrder.second.winRate != null ? (row.turnOrder.first.winRate - row.turnOrder.second.winRate) * 100 : null
  const labels = trend ? trend.points.map(([d]) => dayLabel(locale, seasonStartsAt, d - 1)) : []
  const tabs: ListTab[] = row.staples?.length ? ['cards', 'staples', 'groups', 'against'] : ['cards', 'groups', 'against']
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
        </div>
      </Block>

      <Block num="02" title={t('pace')}>
        <StatGrid
          columns={4}
          items={[
            { label: t('paceTurns'), value: fixed(row.pace.averageTurns, 2) },
            { label: t('paceActions'), value: fixed(row.pace.actionsPerTurn, 1) },
            { label: t('paceT1'), value: fixed(row.pace.turn1SpecialSummons, 1) },
            { label: t('paceChain'), value: fixed(row.pace.averageLongestChain, 2) },
          ]}
        />
      </Block>

      <Block num="03" title={t('matchups')} end={t('matchupsEnd', { name: nameOf(row) })}>
        {opponents.length || row.matchupOthers ? (
          <>
            <div className="overflow-x-auto">
              <div role="table" aria-label={t('matchups')} className="min-w-[760px] border border-line">
                <div role="row" className="grid min-h-9 items-center gap-x-4 border-b border-line-mid bg-surface-200 px-4 text-ink-muted signal-sm" style={{ gridTemplateColumns: MATCH_COLS }}>
                  <span>{t('cols.opponent')}</span><span className={NUM}>{t('cols.winRate')}</span><span>{t('cols.interval')}</span><span className={NUM}>{t('cols.games')}</span><span className={NUM}>{t('cols.first')}</span><span className={NUM}>{t('cols.second')}</span><span className={NUM}>{t('cols.postSide')}</span>
                </div>
                {opponents.map((m) => {
                  const key = archKey(m.opponent)
                  return <MatchupLine key={key} name={nameOf({ name: names[key] ?? null, archetype: m.opponent })} cell={m} href={deckHref(m.opponent, scope)} />
                })}
                {row.matchupOthers ? <MatchupLine name={t('allOthers')} cell={row.matchupOthers} /> : null}
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
        </Block>
      ) : null}

      <AdBanner id="ad-mid" placement="content" />

      <Block num={trend ? '05' : '04'} title={t('list')}>
        <TabBar tabs={tabs.map((id) => ({ id, label: t(`tabs.${id}`) }))} active={list} onSelect={setList} label={t('list')} idPrefix="deck-list" fit />
        {list === 'cards' ? (
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
          { label: t('wilson'), value: pct(row.wilsonLower), hint: t('wilsonHint') },
          { label: t('deckGamesLabel'), value: num(row.games), hint: t('record', { w: num(row.wins), l: num(row.losses), d: num(row.draws) }) },
          { label: t('duelists'), value: num(row.players), hint: t('duelistsHint') },
          { label: t('mirrors'), value: pct(row.mirrorShare), hint: t('mirrorsHint') },
        ]}
      />
    </div>
  )
}

export const DeckPage = ({ archetype, mode, scope, listed, season, syncedDays, frozenBeforeModes, matchups, names, trend, sampleDeck }: DeckPageProps) => {
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
      <Breadcrumbs items={[{ label: tRoot('header.title'), href: back }, { label: t('crumb'), href: `${back}#stat-section-deck-ranking` }, { label: title }]} />

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
          <DeckReport row={listed} scope={scope} matchups={matchups} names={names} trend={trend} sampleDeck={sampleDeck} seasonStartsAt={season.startsAt} />
        </>
      ) : (
        <DeckJob key={`${code}:${mode}:${archKey(archetype)}`} code={code} mode={mode} archetype={archetype} name={title} back={back}>
          {(ready) => (
            <>
              <Remember row={ready} onRow={setFetched} />
              <KpiHeader row={ready} days={growthDays(syncedDays)} />
              <DeckReport row={ready} scope={scope} matchups={matchups} names={names} trend={trend} sampleDeck={sampleDeck} seasonStartsAt={season.startsAt} />
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
