'use client'

/**
 * The public meta report, ported from the Omega Hub canvas
 * (https://claude.ai/artifact/74YyyyuWBQUfZuduKW2BtE, "Statistics page" and "Statistics states")
 * and wired to GET /statistics. Ladder and season live in the URL; everything else is view state.
 */

import { Fragment, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Icon } from '@iconify/react'
import { twMerge } from 'tailwind-merge'
import { Button } from '@ui/button'
import { BarList, LineChart } from '@ui/chart'
import { Chip } from '@ui/chip'
import { Segmented } from '@ui/choice'
import { DataTable, type Column } from '@ui/data-table'
import { Select } from '@ui/field'
import { ModeTabs } from '@ui/mode-tabs'
import { Notice } from '@ui/notice'
import { PageHeader } from '@ui/page-header'
import { Panel } from '@ui/panel'
import { RailHead } from '@ui/rail-head'
import { StatGrid } from '@ui/stat-grid'
import { TabBar } from '@ui/tab-bar'
import { archKey, type HandTrap, type StatArchetype, type Statistics, type StatisticsResult, type Staple, type TurnSplit } from '@utils/statistics'
import type { PastSeason, RankedLadderId } from '@utils/types'
import {
  Art, ariaSort, Bar, cardName, DeepDive, faceOf, type Getters, nameOf, Named, NOTE, num, NUM, pct, ROW, SortButton, type SortState, SortHeads,
  sortBy, SPLIT, THIRDS, useSort,
} from './DeepDive'
import { DeepDiveSearch } from './DeepDiveSearch'

const FORMAT: Record<RankedLadderId, string> = { tcg: 'TCG', genesys: 'Genesys' }
/** Rows the archetype table shows before "Show all". */
const FOLD = 12
const TREND_DECKS = 5
const PICKS = 8
const PALETTE = [1, 2, 3, 4, 5, 6].map((n) => `var(--color-series-${n})`)

/** "14 Aug" of a `YYYY-MM-DD` or ISO date, `plus` days later. UTC, so server and client agree. */
const day = (iso: string, plus = 0) => {
  const d = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : iso)
  d.setUTCDate(d.getUTCDate() + plus)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}
/** The 95% Wilson interval reaches more than 1.2 points under the rate. */
const isSmall = (a: { winRate: number | null; wilsonLower: number | null }) =>
  a.winRate != null && a.wilsonLower != null && a.winRate - a.wilsonLower > 0.012

const Section = ({ num: n, label, stamp, id, children }: { num: string; label: string; stamp?: React.ReactNode; id?: string; children: React.ReactNode }) => (
  <section id={id} aria-label={label} className="mt-12 flex scroll-mt-24 flex-col gap-6 min-[720px]:mt-16">
    {/* The stamp is provenance, not content: it gives way on a phone. */}
    <RailHead num={n} label={label} stamp={stamp ? <span className="max-[720px]:hidden">{stamp}</span> : undefined} as="h2" className="px-0" />
    {children}
  </section>
)

type ArchSortKey = 'name' | 'metaShare' | 'winRate' | 'games' | 'players' | 'mirrorShare'
const ARCH_GET: Getters<StatArchetype, ArchSortKey> = {
  name: nameOf,
  metaShare: (a) => a.metaShare,
  winRate: (a) => a.winRate,
  games: (a) => a.games,
  players: (a) => a.players,
  mirrorShare: (a) => a.mirrorShare,
}

type TrapSortKey = 'name' | 'inclusion' | 'activations' | 'respondedRate' | 'calledRate' | 'crossoutRate' | 'ashedOrPurgedRate' | 'winRateWhenUsed'
const TRAP_GET: Getters<HandTrap, TrapSortKey> = {
  name: cardName,
  inclusion: (t) => t.inclusion,
  activations: (t) => t.activations,
  respondedRate: (t) => t.respondedRate,
  calledRate: (t) => t.calledRate,
  crossoutRate: (t) => t.crossoutRate,
  ashedOrPurgedRate: (t) => t.ashedOrPurgedRate,
  winRateWhenUsed: (t) => t.whenUsed?.winRate ?? null,
}

type StapleSortKey = 'name' | 'inclusion' | 'archetypes' | 'playRate' | 'winRateWhenUsed'
type StapleRow = Staple & { rank: number }
const STAPLE_GET: Getters<StapleRow, StapleSortKey> = {
  name: cardName,
  inclusion: (s) => s.inclusion,
  archetypes: (s) => s.archetypes,
  playRate: (s) => s.playRate,
  winRateWhenUsed: (s) => s.winRateWhenUsed,
}

/* ---------------------------------------------------------------- *
 * Page shell: header, ladder and season, then the report or a state
 * ---------------------------------------------------------------- */

type MetaStatisticsProps = { ladder: RankedLadderId; season?: string; past: PastSeason[]; result: StatisticsResult }

export const MetaStatistics = ({ ladder, season, past, result }: MetaStatisticsProps) => {
  const router = useRouter()
  const [pending, start] = useTransition()
  const go = (l: RankedLadderId, s?: string) =>
    start(() => router.push(`/statistics?${new URLSearchParams(s ? { ladder: l, season: s } : { ladder: l })}`, { scroll: false }))
  const data = result.ok ? result.data : null
  const format = FORMAT[ladder]
  const days = data?.syncedDays

  return (
    <div aria-busy={pending} className={twMerge('transition-opacity', pending && 'opacity-60')}>
      <PageHeader
        eyebrow="Meta report"
        eyebrowMeta={data ? `${format} · ${data.season.label}` : format}
        title="Meta statistics"
        lead="Archetype shares, win rates, trends and card choices from every ranked duel of the season. The numbers refresh once a day, after the nightly sweep."
      />

      <div className="mt-8 flex flex-wrap items-end justify-between gap-6">
        <ModeTabs
          label="Ladder"
          items={[{ id: 'tcg', label: 'TCG' }, { id: 'genesys', label: 'Genesys' }] as const}
          value={ladder}
          onChange={(l) => go(l)}
        />
        <div className="flex flex-wrap items-end gap-4">
          {days ? (
            <div className="flex flex-col items-end gap-2">
              {days.first && days.last ? (
                <span className="text-ink-muted signal-sm">
                  Synced {day(days.first)} – {day(days.last)} · {days.count} days
                </span>
              ) : null}
              <div className="flex gap-2">
                <Chip>Ranked duels only</Chip>
                <Chip>Cached 5 min</Chip>
              </div>
            </div>
          ) : null}
          <Select
            label="Season"
            value={season ?? ''}
            onChange={(e) => go(ladder, e.target.value || undefined)}
            options={[
              { value: '', label: !season && data ? `${data.season.label} · open` : 'Open season' },
              ...past.map((s) => ({ value: s.code, label: s.label })),
            ]}
          />
        </div>
      </div>

      {data ? <Report data={data} /> : <Failure status={result.ok ? 0 : result.status} format={format} season={season} past={past} onPast={(code) => go(ladder, code)} onRetry={() => start(() => router.refresh())} />}
    </div>
  )
}

const Failure = ({ status, format, season, past, onPast, onRetry }: { status: number; format: string; season?: string; past: PastSeason[]; onPast: (code: string) => void; onRetry: () => void }) => {
  const latest = past[0]
  if (status === 404)
    return (
      <Panel title={season ? 'Season not found' : 'No open season'} meta="404 · NOT_FOUND" className="mt-12">
        <div className="flex flex-col items-start gap-4">
          <p className="text-ink-dim body">
            {season ? `There is no ${format} season "${season}".` : `The ${format} ladder has no open season right now.`}
            {latest ? ' Pick a past season to see its numbers.' : ''}
          </p>
          {latest ? <Button size="sm" variant="secondary" onClick={() => onPast(latest.code)}>View {latest.label}</Button> : null}
        </div>
      </Panel>
    )
  return (
    <Panel title={status === 429 ? 'Too many requests' : "Couldn't read the statistics"} meta={status === 429 ? '429 · 60 a minute' : status ? `${status}` : 'Offline'} className="mt-12">
      <div className="flex flex-col items-start gap-4">
        <p className="text-ink-dim body">
          {status === 429
            ? 'Statistics take 60 requests a minute from one connection. Try again in a minute.'
            : "The game server didn't answer. Try again in a moment."}
        </p>
        <Button size="sm" variant="secondary" onClick={onRetry}>Retry</Button>
      </div>
    </Panel>
  )
}

/* ---------------------------------------------------------------- *
 * The report
 * ---------------------------------------------------------------- */

const TurnBlock = ({ title, meta, split }: { title: string; meta: string; split: TurnSplit }) => {
  const f = split.first.winRate, s = split.second.winRate
  const share = f != null && s != null && f + s > 0 ? (f / (f + s)) * 100 : 50
  return (
    <Panel title={title} meta={meta}>
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="font-display text-[40px] leading-none text-ink">{pct(f)}</span>
          <span className="text-ink-muted signal">Going first</span>
        </div>
        <div className="flex h-2 gap-0.5" aria-hidden>
          <span className="block h-2 rounded-l-xs bg-series-1" style={{ width: `${share}%` }} />
          <span className="block h-2 flex-1 rounded-r-xs bg-series-3" />
        </div>
        <div className="flex justify-between gap-3 text-[13px] leading-5 text-ink-dim">
          <span className="flex items-center gap-2"><span className="size-2 bg-series-1" />First {pct(f)}</span>
          <span className="flex items-center gap-2"><span className="size-2 bg-series-3" />Second {pct(s)}</span>
        </div>
        <div className="flex justify-between gap-3 border-t border-line pt-3">
          <span className="text-[13px] leading-5 font-bold text-ink">
            {f != null && s != null ? `${f >= s ? '+' : '−'}${Math.abs((f - s) * 100).toFixed(1)} pts going first` : 'No rated games'}
          </span>
          <span className="text-ink-muted signal-sm">{num(split.first.games)} games a side</span>
        </div>
      </div>
    </Panel>
  )
}

/** `#` stays the API's rank by inclusion whatever the sort, so a sorted row still says where it stands. */
const stapleCols = (sort: SortState<StapleSortKey>, onSort: (key: StapleSortKey, text?: boolean) => void): Column<StapleRow>[] => {
  const head = (key: StapleSortKey, label: string) => ({
    key,
    sort: ariaSort(sort, key),
    label: <SortButton label={label} state={ariaSort(sort, key)} onSort={() => onSort(key, key === 'name')} />,
  })
  return [
    { key: 'rank', label: '#', numeric: true, width: 40 },
    { ...head('name', 'Card'), strong: true, render: (s) => <Named card={s}><span className="truncate">{cardName(s)}</span></Named> },
    { ...head('inclusion', 'Inclusion'), numeric: true, render: (s) => pct(s.inclusion) },
    { ...head('archetypes', 'Archetypes'), numeric: true, render: (s) => num(s.archetypes) },
    { ...head('playRate', 'Play rate'), numeric: true, render: (s) => pct(s.playRate) },
    { ...head('winRateWhenUsed', 'WR when used'), numeric: true, strong: true, render: (s) => pct(s.winRateWhenUsed) },
  ]
}

const ARCH_COLS = '32px minmax(240px, 1.6fr) minmax(180px, 1.5fr) repeat(4, minmax(80px, 0.75fr))'
const TRAP_COLS = 'minmax(190px, 2fr) repeat(7, minmax(72px, 0.8fr))'

const Report = ({ data }: { data: Statistics }) => {
  const [showAll, setShowAll] = useState(false)
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const [remoteSeason, setRemoteSeason] = useState<string | null>(null) // season whose search shows a pick outside the page data
  const [searchRound, setSearchRound] = useState(0)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [metric, setMetric] = useState<'share' | 'wr'>('share')
  const [trapId, setTrapId] = useState<number | null>(null)
  const [archSort, sortArch] = useSort<ArchSortKey>()
  const [stapleSort, sortStaples] = useSort<StapleSortKey>()
  const [trapSort, sortTraps] = useSort<TrapSortKey>()

  const { season, totals, turnOrder, archetypes: arch, minSamples } = data
  const pctAxis = (v: number) => (v * 100).toFixed(1) + '%'

  const glance = (
    <Section num="01" label="Season at a glance" stamp={`${data.syncedDays.count} days synced`}>
      <StatGrid
        columns={5}
        items={[
          { label: 'Deck-games', value: num(totals.games), hint: 'Each game counted once a side' },
          { label: 'Matches', value: num(totals.matches), hint: 'Ranked' },
          { label: 'Unique Duelists', value: num(totals.players), hint: 'Accounts that played ranked' },
          { label: 'Archetypes', value: num(totals.archetypes), hint: `With ${minSamples}+ deck-games` },
          { label: 'Going first', value: pct(turnOrder.all.first.winRate), hint: 'Win rate, whole server' },
        ]}
      />
    </Section>
  )

  const closed = season.endsAt ? (
    <div className="cut notch mt-6 flex items-center gap-3 px-5 py-4 [--cut:var(--cut-md)] [--edge:var(--color-line-mid)] [--fill:var(--color-surface-100)]">
      <span className="size-2 flex-none bg-gold" />
      <span className="text-ink-dim body">{season.label} is closed. These are its final numbers.</span>
    </div>
  ) : null

  if (!arch.length)
    return (
      <>
        {closed}
        {glance}
        <Panel title="No games yet" meta="Nothing swept" className="mt-6">
          <p className="text-ink-dim body">
            No archetype has {minSamples} ranked deck-games in this season yet. The first numbers appear after tonight&apos;s sweep.
          </p>
        </Panel>
      </>
    )

  /* 03 · archetypes */
  const maxShare = arch[0]?.metaShare || 1
  /* Sorted across all listed decks first, then folded: "best win rate" means of all of them. */
  const rankOf = new Map(arch.map((a, i) => [a, i + 1]))
  /* The table lists pure archetypes; a mixed deck shows under each of its setcodes' rows. */
  const pure = arch.filter((a) => a.archetype.length === 1)
  const pureRank = new Map(pure.map((a, i) => [a, i + 1]))
  const sortedArch = sortBy(pure, archSort, ARCH_GET)
  const rows = showAll ? sortedArch : sortedArch.slice(0, FOLD)
  const pick = (key: string) => {
    setFocusKey(key)
    document.getElementById('deep-dive')?.scrollIntoView({ behavior: 'smooth' })
  }
  /** A pure deck's mixes in the list: `[451]` → `[451, 207]`, `[90, 451]`. A mixed deck has none. */
  const combosOf = (a: StatArchetype) =>
    a.archetype.length === 1 ? arch.filter((b) => b.archetype.length > 1 && b.archetype.includes(a.archetype[0]!)) : []
  /** `combos` > 0: the name opens the mixes under the row; otherwise it goes to the deep dive. */
  const archRow = (a: StatArchetype, nested: boolean, combos = 0, open = false) => {
    const key = archKey(a.archetype)
    const rank = rankOf.get(a) ?? 0
    return (
      <div key={key} role="row" className={twMerge(ROW, nested && 'bg-surface-200')} style={{ gridTemplateColumns: ARCH_COLS }}>
        <span role="cell" className={twMerge(NUM, 'font-mono text-xs text-ink-muted')}>{pureRank.get(a)}</span>
        <span role="cell" className={twMerge('flex min-w-0 items-center gap-2.5', nested && 'pl-5')}>
          <span className="size-2 flex-none" style={{ background: rank <= TREND_DECKS ? PALETTE[rank - 1] : 'var(--color-line-mid)' }} />
          <Art card={faceOf(a)} size={32} className="size-8" />
          <button
            type="button"
            onClick={() => (combos ? setOpenKey(open ? null : key) : pick(key))}
            aria-expanded={combos ? open : undefined}
            title={combos ? `Show the decks mixed with ${nameOf(a)}` : 'Open in the deep dive'}
            className="flex min-w-0 cursor-pointer items-center gap-2 font-bold text-ink hover:text-cyan"
          >
            <span className="truncate">{nameOf(a)}</span>
            {combos ? (
              <span className="flex-none font-mono text-[10px] font-normal tracking-[0.08em] text-ink-muted uppercase">
                {open ? '▾' : '▸'} {combos} mixed
              </span>
            ) : null}
          </button>
          {isSmall(a) ? <span title="Small sample" className="flex-none text-gold"><Icon icon="fa7-solid:warning" role="img" aria-label="Small sample" /></span> : null}
        </span>
        <span role="cell"><Bar value={a.metaShare} max={maxShare} label={pct(a.metaShare)} /></span>
        <span role="cell" className={twMerge(NUM, 'font-bold text-ink')}>{pct(a.winRate)}</span>
        <span role="cell" className={NUM}>{num(a.games)}</span>
        <span role="cell" className={NUM}>{num(a.players)}</span>
        <span role="cell" className={NUM}>{pct(a.mirrorShare)}</span>
      </div>
    )
  }

  /* share vs win rate scatter */
  const wrs = arch.flatMap((a) => (a.winRate == null ? [] : [a.winRate]))
  const yMin = Math.min(0.49, Math.floor((Math.min(...wrs, 0.5) - 0.01) * 100) / 100)
  const yMax = Math.max(0.51, Math.ceil((Math.max(...wrs, 0.5) + 0.01) * 100) / 100)
  const xMax = Math.ceil(maxShare * 100 + 1) / 100
  const yPos = (v: number) => ((v - yMin) / (yMax - yMin)) * 100
  const tick = (v: number) => pct(v).replace('.0%', '%')

  const byKey = new Map(arch.map((a) => [archKey(a.archetype), a]))

  /* 04 · trends: a day without a win rate repeats the last known one */
  const trends = data.trends.slice(0, TREND_DECKS)
  const trendLabels = (trends[0]?.points ?? []).map(([d]) => day(season.startsAt, d - 1))
  const trendSeries = trends.map((t) => {
    let last = byKey.get(archKey(t.archetype))?.winRate ?? 0.5
    return { name: nameOf(t), data: t.points.map(([, share, wr]) => (metric === 'share' ? share : (last = wr ?? last))) }
  })

  /* 05 · deep dive */
  const focus = (focusKey && byKey.get(focusKey)) || arch[0]!
  const fKey = archKey(focus.archetype)
  const picks = arch.slice(0, PICKS).some((a) => archKey(a.archetype) === fKey) ? arch.slice(0, PICKS) : [...arch.slice(0, PICKS), focus]
  const rank = arch.indexOf(focus) + 1

  /* 07 · hand traps */
  const traps = data.handTraps
  const trap = traps.find((t) => t.id === trapId) ?? traps[0]
  const maxHit = trap?.targets[0]?.activations || 1

  return (
    <>
      {closed}
      {glance}

      <Section num="02" label="Turn order" stamp="Whole server · mirrors and unknown decks in">
        <div className={THIRDS}>
          <TurnBlock title="All games" meta="Mirrors in" split={turnOrder.all} />
          <TurnBlock title="Game 1" meta="Before siding" split={turnOrder.game1} />
          <TurnBlock title="Games 2–3" meta="After siding" split={turnOrder.postSide} />
        </div>
      </Section>

      <Section num="03" label="Archetypes" stamp={`${pure.length} archetypes + ${arch.length - pure.length} mixes of the top ${arch.length} · by deck-games`}>
        <div className="overflow-x-auto">
          <div role="table" aria-label="Archetypes by deck-games" className="min-w-240 border border-line">
            <SortHeads
              cols={ARCH_COLS}
              labels={['#', 'Archetype', 'Meta share', 'Win rate', 'Deck-games', 'Unique Duelists', 'Mirrors']}
              keys={[null, 'name', 'metaShare', 'winRate', 'games', 'players', 'mirrorShare']}
              sort={archSort}
              onSort={sortArch}
              right={(i) => i === 0 || i > 2}
            />
            {rows.map((a) => {
              const key = archKey(a.archetype)
              const combos = combosOf(a)
              const open = openKey === key && combos.length > 0
              return (
                <Fragment key={key}>
                  {archRow(a, false, combos.length, open)}
                  {open ? (
                    <>
                      {sortBy(combos, archSort, ARCH_GET).map((b) => archRow(b, true))}
                      <div role="row" className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line bg-surface-200 py-2 pr-4 pl-15">
                        <span role="cell" className={NOTE}>
                          Mixed decks with {nameOf(a)} in the list. Each is its own archetype: its games are not in {nameOf(a)}&apos;s row.
                        </span>
                        <span role="cell"><Button size="sm" variant="secondary" onClick={() => pick(key)}>Deep dive {nameOf(a)}</Button></span>
                      </div>
                    </>
                  ) : null}
                </Fragment>
              )
            })}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className={NOTE}>Win rate leaves mirrors out. <Icon icon="fa7-solid:warning" aria-hidden className="inline align-[-2px] text-gold" /> Small sample: the 95% Wilson interval reaches more than 1.2 points below the rate.</span>
          {pure.length > FOLD ? (
            <Button size="sm" variant="secondary" onClick={() => setShowAll(!showAll)}>
              {showAll ? `Show top ${FOLD}` : `Show all ${pure.length}`}
            </Button>
          ) : null}
        </div>

        <div className={SPLIT}>
          <Panel title="Share vs win rate" meta="Mirrors out">
            <div className="grid grid-cols-[44px_minmax(0,1fr)] grid-rows-[320px_28px]">
              <div aria-hidden className="relative font-mono text-[10px] leading-3 tracking-[0.08em] text-ink-muted">
                <span className="absolute top-0 right-2">{tick(yMax)}</span>
                <span className="absolute right-2 translate-y-1/2" style={{ bottom: `${yPos(0.5)}%` }}>50%</span>
                <span className="absolute right-2 bottom-0">{tick(yMin)}</span>
              </div>
              <div role="img" aria-label={`Scatter of meta share against win rate for ${arch.length} archetypes`} className="relative border-b border-l border-line-mid bg-space-000">
                <span className="absolute inset-x-0 border-t border-dashed border-line-mid" style={{ bottom: `${yPos(0.5)}%` }} />
                {arch.map((a, k) =>
                  a.winRate == null ? null : (
                    <span
                      key={archKey(a.archetype)}
                      title={`${nameOf(a)} · ${pct(a.metaShare)} share · ${pct(a.winRate)} win rate · ${num(a.wins + a.losses + a.draws)} rated games`}
                      className="absolute size-0"
                      style={{ left: `${(a.metaShare / xMax) * 100}%`, bottom: `${yPos(a.winRate)}%` }}
                    >
                      <span className={twMerge('absolute -top-1.5 -left-1.5 size-3 rounded-round border-2 border-series-1', isSmall(a) ? 'bg-surface-100' : 'bg-series-1')} />
                      {k < 7 ? <span className="absolute -top-2 left-3 text-xs leading-4 font-semibold whitespace-nowrap text-ink-dim">{nameOf(a)}</span> : null}
                    </span>
                  ),
                )}
              </div>
              <span />
              <div aria-hidden className="flex items-end justify-between font-mono text-[10px] leading-3 tracking-[0.08em] text-ink-muted">
                <span>0%</span>
                <span>Meta share</span>
                <span>{tick(xMax)}</span>
              </div>
            </div>
            <p className={twMerge(NOTE, 'mt-4')}>Hollow dots are small samples. Above the dashed line the deck wins more than it loses.</p>
          </Panel>
          <BarList
            title="Unique Duelists"
            subtitle="Players per deck"
            items={[...arch].sort((a, b) => b.players - a.players).slice(0, 8).map((a) => ({ label: nameOf(a), value: a.players }))}
            format={num}
          />
        </div>
      </Section>

      {trendLabels.length ? (
        <Section num="04" label="Season trends" stamp={`Day 1 = ${day(season.startsAt)}`}>
          <TabBar
            label="Trend metric"
            fit
            tabs={[{ id: 'share', label: 'Meta share' }, { id: 'wr', label: 'Win rate' }] as const}
            active={metric}
            onSelect={setMetric}
          />
          <LineChart
            title={metric === 'share' ? 'Meta share by day' : 'Win rate by day'}
            subtitle={`Top ${trends.length} decks · one point per day`}
            labels={trendLabels}
            series={trendSeries}
            format={pctAxis}
            height={280}
            area={metric === 'share'}
          />
        </Section>
      ) : null}

      <Section num="05" id="deep-dive" label="Archetype deep dive" stamp="Mirrors out · up to 15 tracked cards">
        {/* Keyed by season: a new one starts a new search, and unmounting aborts the old one's requests. */}
        <DeepDiveSearch key={`${season.code}:${searchRound}`} season={season} onLocal={(key) => byKey.has(key) && (setFocusKey(key), true)} onRemote={(on) => setRemoteSeason(on ? season.code : null)} />
        <Segmented
          label="Archetype"
          options={picks.map((a) => ({ value: archKey(a.archetype), label: nameOf(a) }))}
          value={fKey}
          onChange={(key) => {
            setFocusKey(key)
            setRemoteSeason(null)
            setSearchRound((n) => n + 1) // remounts the search: its pick goes away with the chip click
          }}
        />

        {remoteSeason === season.code ? null : <DeepDive archetype={focus} rank={rank} />}
      </Section>

      <Section num="06" label="Staples" stamp="Cards in 2+ archetypes · all deck-games">
        <div className="overflow-x-auto">
          <DataTable
            caption="By inclusion over every deck-game"
            className="min-w-160"
            columns={stapleCols(stapleSort, sortStaples)}
            rows={[...sortBy(data.staples.map((s, k) => ({ ...s, rank: k + 1 })), stapleSort, STAPLE_GET)]}
            rowKey={(s) => s.id}
            empty="No generic card is in two archetypes yet."
          />
        </div>
      </Section>

      {trap ? (
        <Section num="07" label="Hand traps" stamp="Most activated first">
          <div className={SPLIT}>
            <div className="overflow-x-auto">
              <div role="table" aria-label="Hand traps" className="min-w-210 border border-line">
                <SortHeads
                  cols={TRAP_COLS}
                  labels={['Hand trap', 'In deck', 'Activations', 'Answered', 'Called', 'Crossout', "Ash'd or Purged", 'Win when used']}
                  keys={['name', 'inclusion', 'activations', 'respondedRate', 'calledRate', 'crossoutRate', 'ashedOrPurgedRate', 'winRateWhenUsed']}
                  sort={trapSort}
                  onSort={sortTraps}
                  right={(i) => i > 0}
                />
                {sortBy(traps, trapSort, TRAP_GET).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={t === trap}
                    onClick={() => setTrapId(t.id)}
                    className={twMerge(ROW, 'w-full cursor-pointer text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cyan aria-pressed:bg-ground-cyan aria-pressed:text-ink aria-pressed:shadow-selected')}
                    style={{ gridTemplateColumns: TRAP_COLS }}
                  >
                    <Named card={t}><span className="truncate font-bold text-ink">{cardName(t)}</span></Named>
                    <span className={NUM}>{pct(t.inclusion)}</span>
                    <span className={twMerge(NUM, 'font-bold text-ink')}>{num(t.activations)}</span>
                    <span className={NUM}>{pct(t.respondedRate)}</span>
                    <span className={NUM}>{pct(t.calledRate)}</span>
                    <span className={NUM}>{pct(t.crossoutRate)}</span>
                    <span className={NUM}>{pct(t.ashedOrPurgedRate)}</span>
                    <span className={NUM}>{pct(t.whenUsed?.winRate)}</span>
                  </button>
                ))}
              </div>
            </div>
            <Panel title={cardName(trap)} meta={`${num(trap.activations)} activations`}>
              <Art card={trap} size={400} className="mb-5 aspect-[2/1] w-full [&_img]:object-[center_30%]" />
              <span className="mb-4 block text-ink-muted signal">Most hit decks</span>
              {trap.targets.length ? (
                <div className="flex flex-col gap-3.5">
                  {trap.targets.map((g) => (
                    <div key={archKey(g.archetype)} className="flex flex-col gap-1.5">
                      <div className="flex justify-between gap-3 text-[13px] leading-5">
                        <span className="font-bold text-ink">{nameOf(g)}</span>
                        <span className="font-mono text-xs text-ink-dim">
                          {pct(g.respondedRate)} answered · {pct(g.whenUsed?.winRate)} won
                        </span>
                      </div>
                      <Bar value={g.activations} max={maxHit} label={num(g.activations)} w={60} />
                    </div>
                  ))}
                </div>
              ) : (
                <p className={NOTE}>Not activated against a listed deck yet.</p>
              )}
              <p className={twMerge(NOTE, 'mt-4')}>Answered: activations that got a chain response. Called, Crossout and Ash&apos;d or Purged (Ash Blossom or Dominus Purge): share of those answers. Win when used / won: games where it was activated at least once, from the side that used it; against a deck, that matchup. Listed decks only.</p>
            </Panel>
          </div>
        </Section>
      ) : null}

      <section aria-label="Method" className="mt-12 min-[720px]:mt-16">
        <Notice title="How it's counted" date={data.syncedDays.last ? day(data.syncedDays.last) : undefined} mark>
          Every game counts once per deck, so one Bo3 adds up to six deck-games. Win rates leave mirrors and unfinished games out; meta share keeps them in.
          The lists only hold decks with {minSamples} or more deck-games, so their shares don&apos;t add up to 100%.
        </Notice>
      </section>
    </>
  )
}
