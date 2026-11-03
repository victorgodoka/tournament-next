'use client'

import { useState } from "react";
import Link from "next/link";
import { twMerge } from "tailwind-merge";
import { Chip } from "@ui/chip";
import { LineChart, WinRateRing } from "@ui/chart";
import { Select } from "@ui/field";
import { Panel } from "@ui/panel";
import { StatGrid } from "@ui/stat-grid";
import { TierBadge } from "@ui/tier-badge";
import { LocalTime } from "@omega/profile/local-time";
import { formatNumber, formatRate, formatRecord } from "@omega/profile/labels";
import type { CurrentSeason, Ladder, LadderSeason, PlayerTournaments } from "@utils/types";

type Played = Extract<Ladder, { played: true }>

const DAY_MONTH: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
export const CAPTION = "font-mono text-[10px] leading-3 tracking-[0.16em] uppercase text-ink-muted"
const ACCENT = { TCG: { chip: 'tcg', line: 'ladder-tcg' }, Genesys: { chip: 'genesys', line: 'ladder-genesys' } } as const

const openSeason = (ladder: Played): LadderSeason | undefined => ladder.seasons.find((season) => season.open)
const duelsOf = (r: { wins: number; loses: number; draws: number }) => r.wins + r.loses + r.draws

// ponytail: fixed locale and UTC so server and client agree on chart labels and season spans.
const utc = (iso: string, options: Intl.DateTimeFormatOptions) => new Date(iso).toLocaleDateString('en-GB', { ...options, timeZone: 'UTC' })
const dayLabel = (day: string) => utc(`${day}T00:00:00Z`, DAY_MONTH)

/** "May – Sep 2026": the span of a closed season. */
export const seasonSpan = (season: Pick<LadderSeason, 'startsAt' | 'endsAt'>) =>
  `${utc(season.startsAt, { month: 'short' })} – ${utc(season.endsAt ?? season.startsAt, { month: 'short', year: 'numeric' })}`

const optionLabel = (season: LadderSeason) => (season.open ? `${season.label} · open` : `${season.label} · ${seasonSpan(season)}`)

const Lock = ({ size = 18 }: { size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden className="shrink-0 fill-line-strong">
    <path fillRule="evenodd" d="M7 10V7a5 5 0 0 1 10 0v3h2v11H5V10zm2 0h6V7a3 3 0 0 0-6 0zm2 4v4h2v-4z" />
  </svg>
)

const PanelHead = ({ format, select }: { format: Ladder['format']; select?: React.ReactNode }) => (
  <div className="flex flex-wrap items-center gap-3">
    <Chip tone={ACCENT[format].chip}>{format}</Chip>
    <h3 className="font-display text-[22px] leading-[1.1] tracking-[0.01em] uppercase max-md:text-xl">{format} ladder</h3>
    {select ? <div className="ml-auto max-md:w-full max-md:*:w-full">{select}</div> : null}
  </div>
)

/** The ladder's elo is hidden from this viewer: a lock in place of the number, the record stays. */
const HiddenElo = ({ format, first }: { format: Ladder['format']; first: string }) => (
  <div className="flex items-center gap-3.5 border border-line bg-space-000 p-4">
    <Lock />
    <div className="flex flex-col gap-0.5">
      <b className="text-[15px] text-ink">Elo and tier hidden</b>
      <span className="text-[13px] text-ink-dim">{first} keeps their {format} rating private.</span>
    </div>
  </div>
)

type LadderProps = { ladder: Played; first: string; charts: boolean; main: boolean }

/**
 * One VIP ladder card: season picker, the elo, the record, and with charts on the win-rate ring and
 * the elo line. `main` is the big card (TCG); the other is the compact one.
 */
const VipLadder = ({ ladder, first, charts, main }: LadderProps) => {
  const open = openSeason(ladder)
  const [code, setCode] = useState(open?.code ?? ladder.seasons[0]?.code)
  const season = ladder.seasons.find((s) => s.code === code) ?? open
  const hidden = ladder.eloHidden === true
  const duels = season ? duelsOf(season) : 0

  // Today's live value is the season's `elo`, not the last sync point.
  const history = season?.open ? season.eloHistory ?? [] : []
  const points = history.map((p) => ({ label: dayLabel(p.day), elo: p.elo }))
  if (season?.open && season.elo != null && points.length && points.at(-1)?.elo !== season.elo) points.push({ label: 'Now', elo: season.elo })
  const chart = charts && season?.open && points.length > 1

  const stats = season
    ? [
        ...(hidden ? [] : [{ label: 'Season rank', value: season.rank != null ? `#${formatNumber(season.rank)}` : '—', hint: season.open ? 'From last sync' : 'Final position' }]),
        { label: 'Season record', value: formatRecord(season), hint: `${formatNumber(duels)} duels` },
        { label: 'All-time', value: formatRecord(ladder.allTime), hint: `Lifetime ${ladder.format}` },
      ]
    : []
  const select = ladder.seasons.length > 1 ? (
    <Select aria-label={`${ladder.format} season`} value={code} onChange={(e) => setCode(e.target.value)} options={ladder.seasons.map((s) => ({ value: s.code, label: optionLabel(s) }))} />
  ) : null

  const elo = season && !hidden && season.elo != null ? (
    <div className="flex items-end gap-4">
      <span className={twMerge('font-display leading-[0.9] text-ink tabular-nums', main ? 'text-[72px] max-md:text-[56px]' : 'text-[56px] max-md:text-[44px]')}>{formatNumber(season.elo)}</span>
      <div className="flex flex-col gap-2 pb-1">
        {season.tier ? <TierBadge tier={season.tier} size={main ? 'lg' : 'md'} /> : null}
        {main ? <span className={CAPTION}>{season.open ? 'Elo · live' : 'Final Elo'}</span> : null}
      </div>
    </div>
  ) : null

  return (
    <Panel label={`${ladder.format} ladder`} className={twMerge('flex flex-col', main ? 'gap-6' : 'gap-5')}>
      <PanelHead format={ladder.format} select={select} />
      {hidden ? <HiddenElo format={ladder.format} first={first} /> : null}

      {main ? (
        <div className={twMerge('grid items-center gap-6', charts && 'md:grid-cols-[minmax(0,1fr)_180px]')}>
          <div className="flex min-w-0 flex-col gap-4">
            {elo}
            <StatGrid columns={stats.length} items={stats} />
          </div>
          {charts && season && duels ? (
            <div className="flex flex-col items-center gap-2.5 max-md:hidden">
              <WinRateRing wins={season.wins} losses={season.loses} draws={season.draws} size={132} />
              <span className={CAPTION}>{season.label} win rate</span>
            </div>
          ) : null}
        </div>
      ) : (
        <div className={twMerge('grid items-center gap-6', elo && 'md:grid-cols-[220px_minmax(0,1fr)]')}>
          {elo}
          <StatGrid columns={stats.length} items={stats} />
        </div>
      )}

      {chart ? (
        <LineChart
          title="Elo this season"
          subtitle={`Daily sync · ${season.label}, day ${history.at(-1)?.seasonDay ?? 1}`}
          labels={points.map((p) => p.label)}
          series={[{ name: `${ladder.format} Elo`, data: points.map((p) => p.elo), color: ACCENT[ladder.format].line }]}
          format={formatNumber}
          height={main ? 200 : 140}
          area={main}
        />
      ) : null}

      {main ? (
        <div className="flex flex-wrap items-center justify-between gap-3 font-mono text-[10px] leading-3 tracking-[0.14em] text-ink-muted uppercase">
          <span>{open ? <>{open.label} opened <LocalTime iso={open.startsAt} options={DAY_MONTH} /></> : null}</span>
          <Link href="/leaderboard" className="text-[11px] leading-3.5 font-bold text-cyan underline underline-offset-3 hover:decoration-2">See full standings</Link>
        </div>
      ) : null}
    </Panel>
  )
}

const UnplayedLadder = ({ format, season }: { format: Ladder['format']; season?: CurrentSeason }) => (
  <Panel tone="sunken" label={`${format} ladder`} className="flex items-center gap-4 px-6 py-5 min-[720px]:px-6 min-[720px]:py-5">
    <Chip tone={ACCENT[format].chip}>{format}</Chip>
    <div className="flex grow flex-col gap-1">
      <h3 className="font-display text-[22px] leading-[1.1] uppercase">{format} ladder</h3>
      <p className="text-sm leading-5 text-ink-dim">
        No ranked {format} duels yet.
        {season ? <> {season.label} has been open since <LocalTime iso={season.startsAt} options={DAY_MONTH} />.</> : null}
      </p>
    </div>
    <span aria-hidden className="font-display text-[40px] leading-none text-line-mid">—</span>
  </Panel>
)

/** Final standing of every closed season the API sent (only when the profile shows past seasons). */
const PastSeasons = ({ ladders }: { ladders: Played[] }) => {
  const rows = ladders.flatMap((ladder) => ladder.seasons.filter((s) => !s.open).map((season) => ({ ladder, season })))
  if (!rows.length) return null
  const GRID = 'grid grid-cols-[96px_minmax(0,1fr)_80px_120px_90px_120px] items-center gap-4 px-4 py-2.5'
  return (
    <section aria-label="Past seasons" className="flex flex-col gap-3">
      <div className="flex items-center gap-3 font-mono text-[11px] leading-3.5 font-bold tracking-[0.14em] text-ink uppercase">
        Past seasons
        <span aria-hidden className="h-px flex-1 bg-line" />
        <span className="font-normal tracking-[0.16em] text-ink-muted">Final standing</span>
      </div>
      <div className="flex flex-col gap-px border border-line bg-line">
        <div className={twMerge(GRID, 'bg-surface-200 max-md:hidden')}>
          <span className={CAPTION}>Ladder</span><span className={CAPTION}>Season</span><span className={CAPTION}>Rank</span>
          <span className={CAPTION}>Tier</span><span className={twMerge(CAPTION, 'text-right')}>Elo</span><span className={twMerge(CAPTION, 'text-right')}>Record</span>
        </div>
        {rows.map(({ ladder, season }) => (
          <div key={season.code} className="bg-surface-100">
            <div className={twMerge(GRID, 'max-md:hidden')}>
              <Chip tone={ACCENT[ladder.format].chip}>{ladder.format}</Chip>
              <span className="font-semibold">{season.label} · {seasonSpan(season)}</span>
              <span className="font-display text-xl leading-none text-ink">{season.rank != null ? `#${formatNumber(season.rank)}` : '—'}</span>
              <span>{season.tier ? <TierBadge tier={season.tier} /> : '—'}</span>
              <span className="text-right font-display text-xl leading-none tabular-nums">{season.elo != null ? formatNumber(season.elo) : '—'}</span>
              <span className="text-right font-mono text-[13px] leading-none text-ink-dim">{formatRecord(season)}</span>
            </div>
            <div className="grid grid-cols-[64px_minmax(0,1fr)_auto] items-center gap-2.5 p-3 md:hidden">
              <Chip tone={ACCENT[ladder.format].chip}>{ladder.format}</Chip>
              <div>
                <b className="block text-sm">{season.label}</b>
                <span className="text-xs text-ink-muted">{season.rank != null ? `#${formatNumber(season.rank)} · ` : ''}{formatRecord(season)}</span>
              </div>
              {season.tier ? <TierBadge tier={season.tier} /> : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

type LaddersProps = { ladders: Ladder[]; currentSeasons: CurrentSeason[]; first: string; charts: boolean }

/** VIP layout: one card per ladder (TCG big, Genesys compact), then the closed seasons. */
export const VipLadders = ({ ladders, currentSeasons, first, charts }: LaddersProps) => {
  const played = ladders.filter((l): l is Played => l.played)
  return (
    <>
      {ladders.map((ladder) =>
        ladder.played ? (
          <VipLadder key={ladder.format} ladder={ladder} first={first} charts={charts} main={ladder.format === 'TCG'} />
        ) : (
          <UnplayedLadder key={ladder.format} format={ladder.format} season={currentSeasons.find((s) => s.format === ladder.format)} />
        ),
      )}
      <PastSeasons ladders={played} />
    </>
  )
}

/* ── Free layout: three compact cards in a row ── */

const Line = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex items-baseline justify-between border-t border-line py-2.5">
    <span className={CAPTION}>{label}</span>
    <b className="font-display text-lg leading-none font-normal text-ink tabular-nums">{value}</b>
  </div>
)

/** Phones: the three figures side by side under the number. */
const Trip = ({ items }: { items: [string, React.ReactNode][] }) => (
  <div className="mt-3 grid grid-cols-3 gap-px border border-line bg-line md:hidden">
    {items.map(([label, value]) => (
      <div key={label} className="flex flex-col gap-1 bg-surface-100 px-2.5 py-2">
        <span className={CAPTION}>{label}</span>
        <b className="font-display text-base leading-none font-normal text-ink">{value}</b>
      </div>
    ))}
  </div>
)

const FreeCard = ({ chip, title, caption, big, lines }: { chip: React.ReactNode; title: string; caption?: string; big: React.ReactNode; lines: [string, string, React.ReactNode][] }) => (
  <Panel label={title} className="flex flex-col gap-4.5 max-md:gap-1">
    <div className="flex items-center gap-2.5">
      {chip}
      <h3 className="font-display text-[22px] leading-[1.1] uppercase max-md:hidden">{title}</h3>
      {caption ? <span className={twMerge(CAPTION, 'md:hidden')}>{caption}</span> : null}
    </div>
    {big}
    <div className="max-md:hidden">{lines.map(([label, , value]) => <Line key={label} label={label} value={value} />)}</div>
    <Trip items={lines.map(([, short, value]) => [short, value])} />
  </Panel>
)

const FreeLadder = ({ ladder, season }: { ladder: Ladder; season?: CurrentSeason }) => {
  const open = ladder.played ? openSeason(ladder) : undefined
  const duels = open ? duelsOf(open) : 0
  return (
    <FreeCard
      chip={<Chip tone={ACCENT[ladder.format].chip}>{ladder.format}</Chip>}
      title={`${ladder.format} ladder`}
      caption={(open ?? season)?.label}
      big={
        <div className="flex items-end justify-between gap-3.5 md:justify-start">
          <span className="font-display text-[52px] leading-[0.9] text-ink tabular-nums max-md:order-2 max-md:text-[40px]">{ladder.played && ladder.elo != null ? formatNumber(ladder.elo) : '—'}</span>
          {ladder.played && ladder.tier ? <TierBadge tier={ladder.tier} className="max-md:order-1" /> : null}
        </div>
      }
      lines={[
        ['Season rank', 'Rank', open?.rank != null ? `#${formatNumber(open.rank)}` : '—'],
        ['Season record', 'Record', open ? formatRecord(open) : '—'],
        ['Win rate', 'Win rate', open ? formatRate(open.wins, duels) : '—'],
      ]}
    />
  )
}

const ordinal = (n: number) => {
  const tail = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' } as Record<number, string>)[n % 10] ?? 'th'
  return `${n}${tail}`
}

const FreeTournaments = ({ tournaments }: { tournaments: PlayerTournaments }) => {
  const best = [...tournaments.recent].sort((a, b) => a.standing.rank - b.standing.rank)[0]
  return (
    <FreeCard
      chip={<Chip tone="gold">Swiss</Chip>}
      title="Tournaments"
      caption="Tournaments"
      big={
        <div className="flex items-end gap-3.5">
          <span className="font-display text-[52px] leading-[0.9] text-gold tabular-nums max-md:text-[40px]">{formatNumber(tournaments.titles)}</span>
          <span className={twMerge(CAPTION, 'pb-1.5')}>Titles</span>
        </div>
      }
      lines={[
        ['Entered', 'Entered', formatNumber(tournaments.played)],
        ['Match record', 'Record', formatRecord(tournaments)],
        ['Best recent', 'Best', best ? <>{ordinal(best.standing.rank)}<span className="max-md:hidden"> · #{best.tournament.id}</span></> : '—'],
      ]}
    />
  )
}

/** Free layout: TCG, Genesys and tournaments as three compact cards. */
export const FreeLadders = ({ ladders, currentSeasons, tournaments }: { ladders: Ladder[]; currentSeasons: CurrentSeason[]; tournaments: PlayerTournaments }) => (
  <div className="grid gap-6 max-md:gap-4 md:grid-cols-3">
    {ladders.map((ladder) => <FreeLadder key={ladder.format} ladder={ladder} season={currentSeasons.find((s) => s.format === ladder.format)} />)}
    <FreeTournaments tournaments={tournaments} />
  </div>
)

export { ordinal }
