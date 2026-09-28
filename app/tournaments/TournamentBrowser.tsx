'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { EmptyBox } from '@omega/profile/empty-box'
import { LocalTime } from '@omega/profile/local-time'
import { playerName } from '@omega/tournament/player'
import {
  DAY,
  TIME_ONLY,
  banlistLabel,
  formatDecimal,
  formatDuration,
  formatNumber,
  formatRecord,
  formatTone,
} from '@omega/tournament/labels'
import { Avatar } from '@ui/avatar'
import { BarList } from '@ui/chart'
import { Button } from '@ui/button/button.component'
import { Chip } from '@ui/chip/chip.component'
import { Select } from '@ui/field'
import { Icon } from '@ui/icon'
import { ModeTabs } from '@ui/mode-tabs'
import { PageHeader } from '@ui/page-header'
import { Panel } from '@ui/panel'
import { RailHead } from '@ui/rail-head/rail-head.component'
import { StatGrid } from '@ui/stat-grid'
import { getTournamentsStats, listTournaments } from '@utils/tournaments'
import type { TournamentPage, TournamentStatus, TournamentSummary, TournamentsStats } from '@utils/types'

/** What the live banner and the live row show beyond the summary: built on the server from the tournament page. */
export type LiveSnapshot = {
  tournament: TournamentSummary
  /** Latest paired round; 0 before the first pairing. */
  round: number
  /** Matches of that round with a result, out of `total`. */
  done: number
  total: number
  leader: { name: string | null; points: number } | null
  /** Time since it started, at render. */
  elapsed: string
}

type Filters = { status: TournamentStatus | 'all'; banlist: string }

const PAGE_SIZE = 20

const query = ({ status, banlist }: Filters) => ({
  status: status === 'all' ? undefined : status,
  banlist: banlist || undefined,
  limit: PAGE_SIZE,
})

const META = 'signal-sm text-ink-muted'

/** Column tracks for a list row from `lg`; below it the cells stack. */
const ROW = 'grid grid-cols-1 gap-3 px-5 py-3.5 lg:grid-cols-[72px_minmax(0,1fr)_170px_240px_20px] lg:items-center lg:gap-4'

const LiveBanner = ({ live }: { live: LiveSnapshot }) => {
  const t = useTranslations('Tournaments')
  const { tournament, round, done, total, leader } = live
  const label = banlistLabel(tournament)
  // The current round fills as its matches report; rounds before it are full, rounds after it empty.
  const fill = (n: number) => (n < round ? 100 : n > round || !total ? 0 : Math.round((done / total) * 100))

  return (
    <Panel tone="steel" label={t('browser.live.label')} className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:px-8 lg:py-7">
      <div className="flex min-w-0 flex-col gap-3.5">
        <div className="flex flex-wrap items-center gap-2.5">
          <Chip tone="live">{t('status.live')}</Chip>
          <Chip tone={formatTone(tournament.format)}>{tournament.format}</Chip>
          <span className="text-ink-dim signal-sm">
            {t('browser.live.meta', { id: tournament.id })} <LocalTime iso={tournament.startedAt} options={TIME_ONLY} />
          </span>
        </div>
        <h2 className="text-[40px] leading-none text-ink uppercase">
          {round ? t('browser.live.heading', { banlist: label, round, rounds: tournament.rounds }) : label}
        </h2>
        <div className="flex flex-wrap items-center gap-4">
          <div
            role="img"
            aria-label={t('browser.live.progress', { round, rounds: tournament.rounds })}
            className="grid grid-cols-[repeat(var(--n),64px)] gap-1"
            style={{ '--n': tournament.rounds } as React.CSSProperties}
          >
            {Array.from({ length: tournament.rounds }, (_, i) => (
              <span
                key={i}
                className="h-1.5"
                style={{ background: `linear-gradient(90deg, var(--color-cyan) ${fill(i + 1)}%, var(--color-surface-400) ${fill(i + 1)}%)` }}
              />
            ))}
          </div>
          <span className="text-sm text-ink-dim">
            {t('browser.live.players', { count: tournament.players })}
            {round ? ` · ${t('browser.live.done', { done, total, round })}` : ''}
            {leader ? ` · ${t('browser.live.leader', { name: leader.name?.trim() || t('player.unknown'), points: leader.points })}` : ''}
          </span>
        </div>
      </div>
      <Button href={`/tournament/${tournament.id}`} variant="primary" className="min-h-12 justify-self-start px-7">
        {t('browser.live.follow')} <Icon name="right" />
      </Button>
    </Panel>
  )
}

const Row = ({ tournament, live }: { tournament: TournamentSummary; live: LiveSnapshot | null }) => {
  const t = useTranslations('Tournaments')
  const { id, status, format, players, rounds, startedAt, endedAt, winner, settings } = tournament
  const isLive = status === 'live'
  // Round progress is only known for the tournament the server snapshotted.
  const snap = live?.tournament.id === id ? live : null
  const label = banlistLabel(tournament)
  const meta = isLive ? 'text-ink-dim' : 'text-ink-muted'

  return (
    <li>
      <Link
        href={`/tournament/${id}`}
        aria-label={t('browser.row.label', { id, banlist: label })}
        className={twMerge(ROW, 'text-ink', isLive ? 'bg-ground-cyan shadow-selected' : 'bg-surface-100 hover:bg-surface-300')}
      >
        <span className={twMerge('font-mono text-xs leading-none', meta)}>#{id}</span>

        <span className="flex min-w-0 flex-col gap-1.5">
          <span className="flex min-w-0 items-center gap-2.5">
            {isLive ? <Chip tone="live">{t('status.live')}</Chip> : null}
            <Chip tone={formatTone(format)}>{format}</Chip>
            <b className="truncate text-[15px]">{label}</b>
          </span>
          <span className={twMerge('signal-sm', meta)}>
            {t('browser.row.summary', { players, rounds, mode: t(`mode.short.${settings.mode}`) })}
          </span>
        </span>

        <span className="flex flex-col gap-1">
          <span className="text-sm text-ink-dim">
            <LocalTime iso={startedAt} options={DAY} /> · <LocalTime iso={startedAt} options={TIME_ONLY} />
          </span>
          <span className={twMerge('signal-sm', meta)}>
            {endedAt
              ? formatDuration(startedAt, endedAt)
              : snap
                ? t('browser.row.running', { duration: snap.elapsed })
                : t('browser.row.inProgress')}
          </span>
        </span>

        {isLive ? (
          <span className="flex flex-col gap-1">
            <b className="text-sm">
              {snap?.round ? t('browser.row.round', { round: snap.round, rounds }) : t('browser.row.inProgress')}
            </b>
            {snap?.round ? (
              <span className={twMerge('signal-sm', meta)}>{t('browser.row.matchesDone', { done: snap.done, total: snap.total })}</span>
            ) : null}
          </span>
        ) : winner ? (
          <span className="flex min-w-0 items-center gap-2.5">
            <Avatar name={playerName(winner, t('player.unknown'))} src={winner.avatar} cosmetics={winner.cosmetics} size="sm" />
            <span className="flex min-w-0 flex-col gap-0.5">
              <b className="truncate text-sm">{playerName(winner, t('player.unknown'))}</b>
              <span className="text-gold signal-sm">{t('browser.row.winner', { points: winner.points })}</span>
            </span>
          </span>
        ) : (
          <span className="text-sm text-ink-muted">{t('browser.row.noWinner')}</span>
        )}

        <Icon name="right" className={twMerge('hidden lg:block', isLive ? 'text-cyan' : 'text-ink-muted')} />
      </Link>
    </li>
  )
}

/** The three strips beside the list, all from `/tournaments/stats`. */
const Aside = ({ stats }: { stats: TournamentsStats | null }) => {
  const t = useTranslations('Tournaments')

  if (!stats) {
    return (
      <aside className="flex min-w-0 flex-col gap-5">
        <RailHead num="01" label={t('browser.aside.titles')} className="px-0" />
        <p className={META}>{t('browser.aside.loading')}</p>
      </aside>
    )
  }

  const champions = stats.players.slice(0, 5)
  // ponytail: first 6 banlists by tournaments; the full list is in the filter.
  const banlists = stats.banlists.slice(0, 6)
  const wins = [...stats.archetypes]
    .sort((a, b) => (b.tournamentWins ?? 0) - (a.tournamentWins ?? 0))
    .slice(0, 5)
    .map((row) => ({ label: row.archetype, value: row.tournamentWins ?? 0 }))

  return (
    <aside className="flex min-w-0 flex-col gap-5">
      <RailHead num="01" label={t('browser.aside.titles')} stamp={t('browser.aside.titlesStamp')} className="px-0" />
      <ol className="flex flex-col gap-px border border-line bg-line">
        {champions.map((player, index) => (
          <li key={player.id}>
            <Link
              href={`/profile/${player.id}`}
              className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 bg-surface-100 px-4 py-3 text-ink hover:bg-surface-300"
            >
              <span className={twMerge('text-center font-display text-xl leading-none', index ? 'text-ink-dim' : 'text-gold')}>
                {index + 1}
              </span>
              <span className="flex min-w-0 items-center gap-2.5">
                <Avatar name={playerName(player, t('player.unknown'))} src={player.avatar} cosmetics={player.cosmetics} size="sm" />
                <span className="flex min-w-0 flex-col gap-0.5">
                  <b className="truncate text-sm">{playerName(player, t('player.unknown'))}</b>
                  <span className={twMerge('truncate', META)}>
                    {t('browser.aside.entered', { count: player.tournaments, record: formatRecord(player) })}
                  </span>
                </span>
              </span>
              <span className="flex flex-col items-end gap-0.5">
                <span className="font-display text-[22px] leading-none text-gold">{player.tournamentWins}</span>
                <span className={META}>{t('browser.aside.titlesLabel')}</span>
              </span>
            </Link>
          </li>
        ))}
      </ol>

      <RailHead num="02" label={t('browser.aside.banlists')} stamp={t('browser.aside.banlistsStamp')} className="px-0" />
      <ul className="flex flex-col gap-px border border-line bg-line">
        {banlists.map((row) => {
          const label = banlistLabel(row)
          return (
            <li key={row.banlist} className="grid grid-cols-[minmax(0,1fr)_64px_72px] items-center gap-3 bg-surface-100 px-4 py-3">
              <span className="flex min-w-0 items-center gap-2">
                <Chip tone={formatTone(row.format)}>{row.format}</Chip>
                {label === row.format ? null : <span className="truncate text-[13px] text-ink-dim">{label}</span>}
              </span>
              <span className="text-right font-mono text-xs leading-none">{formatNumber(row.tournaments)}</span>
              <span className="text-right font-mono text-xs leading-none text-ink-muted">{formatNumber(row.entries)}</span>
            </li>
          )
        })}
      </ul>

      <RailHead num="03" label={t('browser.aside.archetypeWins')} className="px-0" />
      {wins.length ? <BarList items={wins} /> : null}
    </aside>
  )
}

type TournamentBrowserProps = {
  /** The running tournament, if any. Separate from the list so the banner survives every filter. */
  live: LiveSnapshot | null
  first: TournamentPage
}

export const TournamentBrowser = ({ live, first }: TournamentBrowserProps) => {
  const t = useTranslations('Tournaments')
  const [filters, setFilters] = useState<Filters>({ status: 'all', banlist: '' })
  const [{ tournaments, nextCursor }, setPage] = useState(first)
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [stats, setStats] = useState<TournamentsStats | null>(null)

  // Only the newest answer wins: clicking two filters in a row must not resurrect the first one.
  const run = useRef(0)

  /* /tournaments/stats is seconds slow when its cache is cold, so it loads after paint and only
     feeds the totals, the banlist filter and the side strips — never the list itself. */
  useEffect(() => {
    const controller = new AbortController()
    getTournamentsStats({}, controller.signal)
      .then(setStats)
      .catch((error) => {
        if (!controller.signal.aborted) console.error(error)
      })
    return () => controller.abort()
  }, [])

  const load = async (next: Filters, cursor?: string) => {
    const token = ++run.current
    setState('loading')
    try {
      const page = await listTournaments({ ...query(next), cursor })
      if (run.current !== token) return
      setPage((current) =>
        cursor ? { tournaments: [...current.tournaments, ...page.tournaments], nextCursor: page.nextCursor } : page,
      )
      setState('idle')
    } catch (error) {
      if (run.current !== token) return
      console.error(error)
      setState('error')
    }
  }

  const apply = (next: Filters) => {
    setFilters(next)
    load(next)
  }

  const dash = (value: string) => (stats ? value : '—')
  const statusTabs = (['all', 'live', 'finished'] as const).map((id) => ({ id, label: t(`browser.tabs.${id}`) }))
  const banlistOptions = [
    { value: '', label: t('browser.allBanlists') },
    ...(stats?.banlists ?? []).map((row) => ({ value: row.banlist, label: banlistLabel(row) })),
  ]

  return (
    <div className="mx-auto flex w-full max-w-page flex-col gap-8 px-gutter pt-8">
      <PageHeader
        eyebrow={t('browser.eyebrow')}
        eyebrowMeta={t('browser.eyebrowMeta')}
        title={t('browser.heading')}
        lead={t('browser.lead')}
        className="pt-4"
      />

      {live ? <LiveBanner live={live} /> : null}

      <StatGrid
        items={[
          { label: t('browser.totals.tournaments'), value: dash(formatNumber(stats?.tournaments ?? 0)), hint: t('browser.totals.tournamentsHint') },
          { label: t('browser.totals.entries'), value: dash(formatNumber(stats?.entries ?? 0)) },
          { label: t('browser.totals.uniqueDuelists'), value: dash(formatNumber(stats?.uniquePlayers ?? 0)) },
          { label: t('browser.totals.averagePlayers'), value: dash(formatDecimal(Math.round((stats?.averagePlayers ?? 0) * 10) / 10)), hint: t('browser.totals.averageHint') },
        ]}
      />

      <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <div className="flex flex-wrap items-end gap-4">
            <ModeTabs
              label={t('browser.tabs.label')}
              value={filters.status}
              items={statusTabs}
              onChange={(status) => apply({ ...filters, status })}
            />
            <Select
              label={t('browser.banlist')}
              banlist
              options={banlistOptions}
              value={filters.banlist}
              onChange={(e) => apply({ ...filters, banlist: e.target.value })}
              className="lg:ml-auto"
            />
          </div>

          {tournaments.length ? (
            <ul aria-label={t('browser.listLabel')} aria-busy={state === 'loading'} className="flex flex-col gap-px border border-line bg-line">
              {tournaments.map((tournament) => (
                <Row key={tournament.id} tournament={tournament} live={live} />
              ))}
            </ul>
          ) : (
            <EmptyBox title={t('browser.emptyTitle')}>
              {filters.status === 'live' ? t('browser.emptyLive') : t('browser.emptyBanlist')}
            </EmptyBox>
          )}

          {state === 'error' ? (
            <p role="alert" className="text-loss body-sm">
              {t('browser.error')}
            </p>
          ) : null}

          {nextCursor ? (
            <div className="flex justify-center">
              <Button variant="secondary" onClick={() => load(filters, nextCursor)} disabled={state === 'loading'}>
                <Icon name="down" /> {state === 'loading' ? t('browser.loading') : t('browser.loadMore')}
              </Button>
            </div>
          ) : null}
        </div>

        <Aside stats={stats} />
      </div>
    </div>
  )
}
