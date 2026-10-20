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
import { Select } from '@ui/field'
import { ModeTabs } from '@ui/mode-tabs'
import { Notice } from '@ui/notice'
import { PageHeader } from '@ui/page-header'
import { Panel } from '@ui/panel'
import { RailHead } from '@ui/rail-head'
import { StatGrid } from '@ui/stat-grid'
import { TabBar } from '@ui/tab-bar'
import { archKey, subRows, type DeepDiveMode, type LeanArchetype, type OmegaActivity as OmegaActivityData, type MostUsedCard, type Statistics, type StatisticsResult, type TurnSplit } from '@utils/statistics'
import type { PastSeason, RankedLadderId } from '@utils/types'
import {
  Art, Bar, cardName, DeepDive, faceOf, type Getters, nameOf, Named, NOTE, num, NUM, pct, ROW, SortHeads,
  sortBy, SPLIT, THIRDS, useSort,
} from './DeepDive'
import { CardSearch } from './CardSearch'
import { DeepDiveSearch, PICKS, type DeepDiveRequest } from './DeepDiveSearch'
import { OmegaActivity } from './OmegaActivity'
import { AdBanner } from '@omega/ads/ad-banner'
import { AdVideo } from '@omega/ads/ad-video'

const FORMAT: Record<RankedLadderId, string> = { tcg: 'TCG', genesys: 'Genesys' }
/** Rows the archetype table shows before "Show all". */
const FOLD = 12
const TREND_DECKS = 5
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
/** A mix's name without its parent's: "Lead with Second" (combined) or "A / B" (main), either side. The whole name if it doesn't split. */
const otherName = (mix: LeanArchetype, parent: LeanArchetype) => {
  const n = nameOf(mix), p = nameOf(parent)
  for (const sep of [' with ', ' / ']) {
    if (n.startsWith(p + sep)) return n.slice(p.length + sep.length)
    if (n.endsWith(sep + p)) return n.slice(0, -(sep.length + p.length))
  }
  return n
}

export const Section = ({ num: n, label, stamp, id, children }: { num: string; label: string; stamp?: React.ReactNode; id?: string; children: React.ReactNode }) => (
  <section id={id} aria-label={label} className="mt-12 flex scroll-mt-24 flex-col gap-6 min-[720px]:mt-16">
    {/* The stamp is provenance, not content: it gives way on a phone. */}
    <RailHead num={n} label={label} stamp={stamp ? <span className="max-[720px]:hidden">{stamp}</span> : undefined} as="h2" className="px-0 [&_h2]:text-xl [&_h2]:leading-7" />
    {children}
  </section>
)

type ArchSortKey = 'name' | 'metaShare' | 'winRate' | 'games' | 'players' | 'mirrorShare'
const ARCH_GET: Getters<LeanArchetype, ArchSortKey> = {
  name: nameOf,
  metaShare: (a) => a.metaShare,
  winRate: (a) => a.winRate,
  games: (a) => a.games,
  players: (a) => a.players,
  mirrorShare: (a) => a.mirrorShare,
}

type UsedSortKey = 'name' | 'popularity' | 'usageRate' | 'winRateWhenUsed'
/** `rank` stays the API's order whatever the sort, so a sorted row still says where it stands. */
type UsedRow = MostUsedCard & { rank: number }
const USED_GET: Getters<UsedRow, UsedSortKey> = {
  name: cardName,
  popularity: (c) => c.popularity,
  usageRate: (c) => c.usageRate,
  winRateWhenUsed: (c) => c.winRateWhenUsed,
}

/* ---------------------------------------------------------------- *
 * Page shell: header, ladder and season, then the report or a state
 * ---------------------------------------------------------------- */

type MetaStatisticsProps = { ladder: RankedLadderId; season?: string; past: PastSeason[]; result: StatisticsResult; omega: OmegaActivityData | null }

export const MetaStatistics = ({ ladder, season, past, result, omega }: MetaStatisticsProps) => {
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
      <AdVideo id="ad-video" className="mt-8" />

      {/* Whole-game activity first; the ladder and season below pick the report under them. */}
      {omega ? <OmegaActivity data={omega} ladder={ladder} /> : null}

      <div className={twMerge('flex flex-wrap items-end justify-between gap-6', omega ? 'mt-12 min-[720px]:mt-16' : 'mt-8')}>
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

/** `player`: one side, so first and second have their own game counts. */
const TurnBlock = ({ title, meta, split, player }: { title: string; meta: string; split: TurnSplit; player?: boolean }) => {
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
          <span className="text-ink-muted signal-sm">
            {player ? `${num(split.first.games)} / ${num(split.second.games)} games` : `${num(split.first.games)} games a side`}
          </span>
        </div>
      </div>
    </Panel>
  )
}

const ARCH_COLS = '32px minmax(300px, 2.4fr) minmax(160px, 1.2fr) repeat(4, minmax(80px, 0.7fr))'
const USED_COLS = '40px minmax(200px, 2fr) repeat(3, minmax(88px, 0.8fr))'

/**
 * A titled block of `[label, rate, color]` bar rows over a hairline; `null` reads "—" on an empty track.
 * `mark` ticks every track (0.5: even). `children` sit between the title and the rows.
 */
const Meter = ({ title, meta, rows, max = 1, mark, children }: {
  title: string
  meta?: React.ReactNode
  rows: [label: string, rate: number | null, color?: string][]
  max?: number
  mark?: number
  children?: React.ReactNode
}) => (
  <div className="flex flex-col gap-3 border-t border-line pt-4">
    <div className="flex items-baseline justify-between gap-3">
      <span className="text-ink-muted signal">{title}</span>
      {meta ? <span className="text-ink-muted signal-sm">{meta}</span> : null}
    </div>
    {children}
    {rows.map(([label, rate, color]) => (
      <div key={label} className="grid grid-cols-[104px_minmax(0,1fr)] items-center gap-3 text-[13px] leading-5">
        <span className={twMerge('truncate', rate ? 'font-semibold text-ink-dim' : 'text-ink-muted')}>{label}</span>
        <Bar value={rate ?? 0} max={max} color={color} label={pct(rate)} w={48} mark={mark} />
      </div>
    ))}
  </div>
)

/** Responder categories, as the API names them. Shown largest first. */
const RESPONDERS = [
  ['dominus', 'Dominus'],
  ['yokaiGirls', 'Yo-kai Girls'],
  ['psyFrame', 'Psy-Frame'],
  ['calledCrossout', 'Called / Crossout'],
  ['impermanence', 'Impermanence'],
  ['mulcharmy', 'Mulcharmy'],
  ['solemn', 'Solemns'],
  ['others', 'Others'],
] as const

/** The selected card: headline figures, then decklists, usage, win rate and who answered it. */
const CardDetail = ({ card, searched }: { card: MostUsedCard; searched: boolean }) => {
  const { decklists, usage, winRate, responded } = card.detail
  const sources = RESPONDERS.map(([key, label]): [string, number | null, string] => [label, responded[key], 'series-2'])
    .sort((a, b) => (b[1] ?? -1) - (a[1] ?? -1))
  return (
    <Panel title={cardName(card)} meta={[searched ? 'Searched' : null, card.handTrap ? 'Hand trap' : card.extra ? 'Extra deck' : 'Main deck'].filter(Boolean).join(' · ')}>
      <Art card={card} size={400} className="aspect-[2/1] w-full [&_img]:object-[center_30%]" />
      <dl className="mt-4 grid grid-cols-3 gap-px border border-line bg-line">
        {([['Popularity', card.popularity], ['Usage rate', card.usageRate], ['WR used', card.winRateWhenUsed]] as const).map(([label, rate]) => (
          <div key={label} className="flex min-w-0 flex-col gap-2 bg-surface-100 px-3 pt-3 pb-3.5">
            <dt className="truncate text-ink-muted signal-sm">{label}</dt>
            <dd className="stat text-ink">{pct(rate)}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-5 flex flex-col gap-5">
        <Meter title="In decklists" rows={[['Main / Extra', decklists.mainExtra], ['Side', decklists.side, 'series-3']]} />
        <Meter title="Usage rate" meta="When in deck" rows={[['Game 1', usage.game1], ['After side', usage.postSide, 'series-3']]} />
        <Meter
          title="Win rate"
          meta="When used · tick 50%"
          mark={0.5}
          rows={[['Match', winRate.match, 'ink-dim'], ['Game 1', winRate.game1], ['After side', winRate.postSide, 'series-3']]}
        />
        <Meter title="Responded rate" meta={`${num(responded.activations)} activations`} rows={sources} max={responded.rate || 1}>
          <div className="flex items-baseline gap-3">
            <span className="stat-lg text-ink">{pct(responded.rate)}</span>
            <span className="text-ink-muted signal">Answered by the opponent</span>
          </div>
        </Meter>
      </div>
      <p className={twMerge(NOTE, 'mt-5')}>Used: summoned or activated in the game. Win rates count games and matches where it was used, from the side that used it. Responded: activations the opponent answered with a chain link; each source is a share of activations, its bar a share of the answers. A side card only shows once it is used, so after-side usage leans high for side cards. — means not enough data: days swept before these counters.</p>
    </Panel>
  )
}

/** Both sides of a turn split as one rate: the duelist's own win rate. */
const overall = ({ first, second }: TurnSplit) => {
  const games = first.games + second.games
  return games ? ((first.winRate ?? 0) * first.games + (second.winRate ?? 0) * second.games) / games : null
}

/**
 * `player`: one duelist's side (`/profile/:id/statistics`). No unique duelists, no daily trends, and
 * the season-wide searches stay off: they read the whole server.
 */
export const Report = ({ data, player = false }: { data: Statistics; player?: boolean }) => {
  const [showAll, setShowAll] = useState(false)
  const [focusKey, setFocusKey] = useState<string | null>(null)
  const [remoteSeason, setRemoteSeason] = useState<string | null>(null) // season whose search shows a pick outside the page data
  const [searchRound, setSearchRound] = useState(0)
  const [searchBusy, setSearchBusy] = useState(false) // a searched pick is loading or calculating
  const [ddMode, setDdMode] = useState<DeepDiveMode>(data.views ? 'general' : 'pure') // section 05's mode, here so a remount of the search keeps it; a season frozen before modes starts on Pure
  const [request, setRequest] = useState<DeepDiveRequest | null>(null) // section 03's last click on a General row
  const [ddSeason, setDdSeason] = useState(data.season.code)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [metric, setMetric] = useState<'share' | 'wr'>('share')
  const [part, setPart] = useState<'main' | 'extra'>('main')
  const [cardId, setCardId] = useState<number | null>(null)
  const [searched, setSearched] = useState<MostUsedCard | null>(null) // card the search read from the API, outside the list
  const [archSort, sortArch] = useSort<ArchSortKey>()
  const [usedSort, sortUsed] = useSort<UsedSortKey>()

  const { season, totals, turnOrder, archetypes: arch, minSamples, views } = data
  const pctAxis = (v: number) => (v * 100).toFixed(1) + '%'
  /* A new season starts section 05 over in General (Pure when frozen before modes), as its search starts over. */
  if (ddSeason !== season.code) {
    setDdSeason(season.code)
    setDdMode(views ? 'general' : 'pure')
  }

  const glance = (
    <Section num="01" label={player ? 'At a glance' : 'Season at a glance'} stamp={player ? undefined : `${data.syncedDays.count} days synced`}>
      <StatGrid
        columns={5}
        items={player ? [
          { label: 'Deck-games', value: num(totals.games), hint: 'Each game of a match counted' },
          { label: 'Matches', value: num(totals.matches), hint: 'Ranked' },
          { label: 'Win rate', value: pct(overall(turnOrder.all)), hint: 'Every game, mirrors in' },
          { label: 'Decks', value: num(totals.archetypes), hint: 'Archetypes played' },
          { label: 'Going first', value: pct(turnOrder.all.first.winRate), hint: `${num(turnOrder.all.first.games)} games` },
        ] : [
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
        <Panel title="No games yet" meta={player ? 'Nothing played' : 'Nothing swept'} className="mt-6">
          <p className="text-ink-dim body">
            {player
              ? 'No ranked game with a known deck here yet.'
              : <>No archetype has {minSamples} ranked deck-games in this season yet. The first numbers appear after tonight&apos;s sweep.</>}
          </p>
        </Panel>
      </>
    )

  /* 03 · archetypes: General rows; a season frozen before modes (`views` null) keeps the main ones */
  /* One duelist has no "unique duelists" column. */
  const archCols = player ? ARCH_COLS.replace('repeat(4,', 'repeat(3,') : ARCH_COLS
  const top: readonly LeanArchetype[] = views?.general ?? arch
  const maxShare = top[0]?.metaShare || 1
  /* The dot color: a main key's place in `arch`, the order trends (04) colors. */
  const rankOf = new Map(arch.map((a, i) => [archKey(a.archetype), i + 1]))
  /* Without views the table lists pure archetypes; a mixed deck shows under each of its setcodes' rows. */
  const pure = arch.filter((a) => a.archetype.length === 1)
  const listed: readonly LeanArchetype[] = views?.general ?? pure
  const listRank = new Map(listed.map((a, i) => [a, i + 1]))
  /* Sorted across all listed decks first, then folded: "best win rate" means of all of them. */
  const sortedArch = sortBy(listed, archSort, ARCH_GET)
  const rows = showAll ? sortedArch : sortedArch.slice(0, FOLD)
  /* The page's own row, mix or pure, opens in Pure; the search remounts so a pick of its own goes away. */
  const pick = (key: string) => {
    setFocusKey(key)
    setDdMode('pure')
    setRemoteSeason(null)
    setSearchRound((n) => n + 1)
    document.getElementById('deep-dive')?.scrollIntoView({ behavior: 'smooth' })
  }
  /** A General row's click: the mounted search opens it in `mode`. No remount, or the request would count as handled. */
  const ask = (mode: DeepDiveMode, a: LeanArchetype) => {
    setRequest((r) => ({ mode, archetype: a.archetype, name: nameOf(a), nonce: (r?.nonce ?? 0) + 1 }))
    document.getElementById('deep-dive')?.scrollIntoView({ behavior: 'smooth' })
  }
  /** A pure deck's mixes in the list: `[451]` → `[451, 207]`, `[90, 451]`. A mixed deck has none. */
  const combosOf = (a: LeanArchetype) =>
    a.archetype.length === 1 ? arch.filter((b) => b.archetype.length > 1 && b.archetype.includes(a.archetype[0]!)) : []
  /**
   * `combos` > 0: the name opens the mixes under the row; otherwise it calls `go`. `tag` labels a row without mixes.
   * `dot`: the main key whose trend color the dot takes, the row's own key by default.
   * `parent`: a mix opened under it reads "+ Other", with Other's art: its own row's face, else the API's (the second deck's card).
   */
  const archRow = (
    a: LeanArchetype,
    { nested = false, combos = 0, open = false, go, tag, dot = a.archetype, parent }: { nested?: boolean; combos?: number; open?: boolean; go: () => void; tag?: string; dot?: number[]; parent?: LeanArchetype },
  ) => {
    const key = archKey(a.archetype)
    const rank = rankOf.get(archKey(dot)) ?? 0
    const label = combos ? `${open ? '▾' : '▸'} ${combos} mixed` : tag
    const other = parent && a.archetype.find((c) => c !== parent.archetype[0])
    const name = parent ? `+ ${otherName(a, parent)}` : nameOf(a)
    const face = faceOf((other !== undefined && byKey.get(String(other))) || a)
    return (
      <div key={key} role="row" className={twMerge(ROW, nested && 'bg-surface-200')} style={{ gridTemplateColumns: archCols }}>
        <span role="cell" className={twMerge(NUM, 'font-mono text-xs text-ink-muted')}>{listRank.get(a)}</span>
        <span role="cell" className={twMerge('flex min-w-0 items-center gap-2.5', nested && 'pl-5')}>
          <span className="size-2 flex-none" style={{ background: rank && rank <= TREND_DECKS ? PALETTE[rank - 1] : 'var(--color-line-mid)' }} />
          <Art card={face} size={32} className="size-8" />
          <button
            type="button"
            onClick={() => (combos ? setOpenKey(open ? null : key) : go())}
            aria-expanded={combos ? open : undefined}
            title={combos ? `Show the decks mixed with ${nameOf(a)}` : `Open ${nameOf(a)} in the deep dive`}
            className="flex min-w-0 cursor-pointer items-center gap-2 font-bold text-ink hover:text-cyan"
          >
            <span className="truncate">{name}</span>
            {label ? (
              <span className="flex-none font-mono text-[10px] font-normal tracking-[0.08em] text-ink-muted uppercase">{label}</span>
            ) : null}
          </button>
          {isSmall(a) ? <span title="Small sample" className="flex-none text-gold"><Icon icon="fa7-solid:warning" role="img" aria-label="Small sample" /></span> : null}
        </span>
        <span role="cell"><Bar value={a.metaShare} max={maxShare} label={pct(a.metaShare)} /></span>
        <span role="cell" className={twMerge(NUM, 'font-bold text-ink')}>{pct(a.winRate)}</span>
        <span role="cell" className={NUM}>{num(a.games)}</span>
        {player ? null : <span role="cell" className={NUM}>{num(a.players)}</span>}
        <span role="cell" className={NUM}>{pct(a.mirrorShare)}</span>
      </div>
    )
  }
  /** The last row under an open one: what the mixes are, and the deep dive of the whole archetype. */
  const mixNote = (a: LeanArchetype, text: React.ReactNode, go: () => void) => (
    <div role="row" className="flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line bg-surface-200 py-2 pr-4 pl-15">
      <span role="cell" className={NOTE}>{text}</span>
      <span role="cell"><Button size="sm" variant="secondary" onClick={go}>Deep dive {nameOf(a)}</Button></span>
    </div>
  )

  /* share vs win rate scatter */
  const wrs = top.flatMap((a) => (a.winRate == null ? [] : [a.winRate]))
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

  /* 05 · deep dive: Pure shows the page's own rows; the chips are pure decks, plus the focus when it isn't one of them */
  const focus = (focusKey && byKey.get(focusKey)) || pure[0] || arch[0]!
  const fKey = archKey(focus.archetype)
  const picks = pure.slice(0, PICKS).some((a) => archKey(a.archetype) === fKey) ? pure.slice(0, PICKS) : [...pure.slice(0, PICKS), focus]
  const rank = arch.indexOf(focus) + 1

  /* 06 · most used cards */
  const used: UsedRow[] = (data.mostUsed?.[part] ?? []).map((c, k) => ({ ...c, rank: k + 1 }))
  const sortedUsed = sortBy(used, usedSort, USED_GET)
  const card = searched ?? used.find((c) => c.id === cardId) ?? sortedUsed[0]
  /** A searched card already in the list: shown on its tab, selected in the table. */
  const pickListed = (id: number) => {
    const side = data.mostUsed?.main.some((c) => c.id === id) ? 'main' : data.mostUsed?.extra.some((c) => c.id === id) ? 'extra' : null
    if (!side) return false
    setPart(side)
    setCardId(id)
    return true
  }

  return (
    <>
      {closed}
      {glance}

      <Section num="02" label="Turn order" stamp={player ? 'Every game · mirrors and unknown decks in' : 'Whole server · mirrors and unknown decks in'}>
        <div className={THIRDS}>
          <TurnBlock title="All games" meta="Mirrors in" split={turnOrder.all} player={player} />
          <TurnBlock title="Game 1" meta="Before siding" split={turnOrder.game1} player={player} />
          <TurnBlock title="Games 2–3" meta="After siding" split={turnOrder.postSide} player={player} />
        </div>
      </Section>

      <AdBanner id="ad-mid" placement="content" className="mt-12 min-[720px]:mt-16" />

      <Section
        num="03"
        label={player ? 'Decks' : 'Archetypes'}
        stamp={views ? `${views.generalCount} archetypes · general: pure + the mixes each one leads · by deck-games` : `${pure.length} archetypes + ${arch.length - pure.length} mixes${player ? '' : ` of the top ${arch.length}`} · by deck-games`}
      >
        <div className="overflow-x-auto">
          <div role="table" aria-label="Archetypes by deck-games" className="min-w-240 border border-line">
            <SortHeads
              cols={archCols}
              labels={player ? ['#', 'Archetype', 'Share', 'Win rate', 'Deck-games', 'Mirrors'] : ['#', 'Archetype', 'Meta share', 'Win rate', 'Deck-games', 'Unique Duelists', 'Mirrors']}
              keys={player ? [null, 'name', 'metaShare', 'winRate', 'games', 'mirrorShare'] : [null, 'name', 'metaShare', 'winRate', 'games', 'players', 'mirrorShare']}
              sort={archSort}
              onSort={sortArch}
              right={(i) => i === 0 || i > 2}
            />
            {rows.map((a) => {
              const key = archKey(a.archetype)
              if (views) {
                /* Pure A first whatever the sort, then the mixes A leads: all their games are inside A's row. */
                const { pure: only, mixes } = subRows(a.archetype[0]!, views)
                const open = openKey === key && mixes.length > 0
                const general = () => ask('general', a)
                return (
                  <Fragment key={key}>
                    {archRow(a, { combos: mixes.length, open, go: general })}
                    {open ? (
                      <>
                        {only ? archRow(only, { nested: true, tag: 'Pure', go: () => ask('pure', only) }) : null}
                        {sortBy(mixes, archSort, ARCH_GET).map((b) =>
                          archRow(b, { nested: true, dot: [...b.archetype].sort((x, y) => x - y), go: () => ask('combined', b), parent: a }),
                        )}
                        {mixNote(a, <>Every mixed deck led by {nameOf(a)} that clears the sample minimum. Their games are inside {nameOf(a)}&apos;s row; a deck led by another archetype counts there.</>, general)}
                      </>
                    ) : null}
                  </Fragment>
                )
              }
              const combos = combosOf(a)
              const open = openKey === key && combos.length > 0
              return (
                <Fragment key={key}>
                  {archRow(a, { combos: combos.length, open, go: () => pick(key) })}
                  {open ? (
                    <>
                      {sortBy(combos, archSort, ARCH_GET).map((b) => archRow(b, { nested: true, go: () => pick(archKey(b.archetype)), parent: a }))}
                      {mixNote(a, <>Mixed decks with {nameOf(a)} in the list. Each is its own archetype: its games are not in {nameOf(a)}&apos;s row.</>, () => pick(key))}
                    </>
                  ) : null}
                </Fragment>
              )
            })}
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <span className={NOTE}>Win rate leaves mirrors out. <Icon icon="fa7-solid:warning" aria-hidden className="inline align-[-2px] text-gold" /> Small sample: the 95% Wilson interval reaches more than 1.2 points below the rate.</span>
          {listed.length > FOLD ? (
            <Button size="sm" variant="secondary" onClick={() => setShowAll(!showAll)}>
              {showAll ? `Show top ${FOLD}` : `Show all ${listed.length}`}
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
              <div role="img" aria-label={`Scatter of meta share against win rate for ${top.length} archetypes`} className="relative border-b border-l border-line-mid bg-space-000">
                <span className="absolute inset-x-0 border-t border-dashed border-line-mid" style={{ bottom: `${yPos(0.5)}%` }} />
                {top.map((a, k) =>
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
                <span>{player ? 'Share' : 'Meta share'}</span>
                <span>{tick(xMax)}</span>
              </div>
            </div>
            <p className={twMerge(NOTE, 'mt-4')}>Hollow dots are small samples. Above the dashed line the deck wins more than it loses.</p>
          </Panel>
          {player ? (
            <BarList title="Deck-games" subtitle="Most played decks" items={top.slice(0, 8).map((a) => ({ label: nameOf(a), value: a.games }))} format={num} />
          ) : (
            <BarList
              title="Unique Duelists"
              subtitle="Players per deck"
              items={[...top].sort((a, b) => b.players - a.players).slice(0, 8).map((a) => ({ label: nameOf(a), value: a.players }))}
              format={num}
            />
          )}
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

      <AdBanner id="ad-mid-2" placement="content" className="mt-12 min-[720px]:mt-16" />

      <Section num="05" id="deep-dive" label="Archetype deep dive" stamp="Mirrors out · up to 15 tracked cards">
        {/* Keyed by season: a new one starts a new search, and unmounting aborts the old one's requests. */}
        {player ? null : (
          <DeepDiveSearch
            key={`${season.code}:${searchRound}`}
            season={season}
            mode={ddMode}
            onMode={setDdMode}
            request={request}
            onLocal={(key) => byKey.has(key) && (setFocusKey(key), true)}
            onRemote={(on) => setRemoteSeason(on ? season.code : null)}
            onBusy={setSearchBusy}
          />
        )}
        {searchBusy || ddMode !== 'pure' ? null : <Segmented
          label="Archetype"
          options={picks.map((a) => ({ value: archKey(a.archetype), label: nameOf(a) }))}
          value={fKey}
          onChange={(key) => {
            setFocusKey(key)
            setRemoteSeason(null)
            setSearchRound((n) => n + 1) // remounts the search: its pick goes away with the chip click
          }}
        />}

        {ddMode !== 'pure' || remoteSeason === season.code ? null : <DeepDive archetype={focus} rank={rank} player={player} />}
      </Section>

      <Section num="06" label="Most used cards" stamp={player ? 'Generic cards · all deck-games' : 'Generic cards in 2+ archetypes · all deck-games'}>
        {/* Keyed by season like the deep dive's search: a new season starts empty. */}
        {player ? null : <CardSearch key={season.code} season={season} onLocal={pickListed} onCard={setSearched} />}
        <TabBar
          label="Deck part"
          fit
          tabs={[{ id: 'main', label: 'Main' }, { id: 'extra', label: 'Extra' }] as const}
          active={part}
          onSelect={(p) => { setPart(p); setCardId(null); setSearched(null) }}
        />
        {card ? (
          <div className={SPLIT}>
            <div className="overflow-x-auto">
              <div role="table" aria-label={`Most used ${part} deck cards`} className="min-w-160 border border-line">
                <SortHeads
                  cols={USED_COLS}
                  labels={['#', 'Card', 'Popularity', 'Usage rate', 'WR when used']}
                  keys={[null, 'name', 'popularity', 'usageRate', 'winRateWhenUsed']}
                  sort={usedSort}
                  onSort={sortUsed}
                  right={(i) => i === 0 || i > 1}
                />
                {sortedUsed.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={!searched && c.id === card.id}
                    onClick={() => { setCardId(c.id); setSearched(null) }}
                    className={twMerge(ROW, 'w-full cursor-pointer text-left focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cyan aria-pressed:bg-ground-cyan aria-pressed:text-ink aria-pressed:shadow-selected')}
                    style={{ gridTemplateColumns: USED_COLS }}
                  >
                    <span className={twMerge(NUM, 'font-mono text-xs text-ink-muted')}>{c.rank}</span>
                    <Named card={c}>
                      <span className="flex min-w-0 flex-col items-start gap-0.5">
                        <span className="max-w-full truncate font-bold text-ink">{cardName(c)}</span>
                        {c.handTrap ? <Chip tone="gold" className="h-4 px-1.5 text-[9px]">Hand trap</Chip> : null}
                      </span>
                    </Named>
                    <span className={NUM}>{pct(c.popularity)}</span>
                    <span className={NUM}>{pct(c.usageRate)}</span>
                    <span className={twMerge(NUM, 'font-bold text-ink')}>{pct(c.winRateWhenUsed)}</span>
                  </button>
                ))}
              </div>
            </div>
            <CardDetail card={card} searched={!!searched} />
          </div>
        ) : (
          <Panel title={part === 'main' ? 'Main deck' : 'Extra deck'} meta="Nothing yet">
            <p className={NOTE}>No most used cards for this season yet.</p>
          </Panel>
        )}
      </Section>

      <AdBanner id="ad-bottom" placement="content" className="mt-12 min-[720px]:mt-16" />

      <section aria-label="Method" className="mt-12 min-[720px]:mt-16">
        <Notice title="How it's counted" date={data.syncedDays.last ? day(data.syncedDays.last) : undefined} mark>
          {player ? (
            <>
              Only this duelist&apos;s side: every game of a match is one deck-game. Deck win rates leave mirrors and unfinished games out, like
              the meta report; the overall win rate keeps mirrors in. Read live from the duels, the newest 1000 matches at most.
            </>
          ) : (
            <>
              Every game counts once per deck, so one Bo3 adds up to six deck-games. Win rates leave mirrors and unfinished games out; meta share keeps them in.
              The lists only hold decks with {minSamples} or more deck-games, so their shares don&apos;t add up to 100%.
            </>
          )}
        </Notice>
      </section>
    </>
  )
}
