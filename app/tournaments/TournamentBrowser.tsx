'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { EmptyBox } from '@omega/profile/empty-box'
import { LocalTime } from '@omega/profile/local-time'
import { PlayerCell } from '@omega/tournament/player'
import { StatGrid, type Stat } from '@omega/tournament/stat-grid'
import { DATE_TIME, cardPoolYear, formatDecimal, formatDuration, formatNumber } from '@omega/tournament/labels'
import { Callout } from '@omega/wiki/wiki'
import { buttonClasses } from '@ui/button'
import { Chip } from '@ui/chip/chip.component'
import { Eyebrow } from '@ui/eyebrow/eyebrow'
import { TabBar, tabPanelProps } from '@ui/tab-bar/tab-bar.component'
import { getTournamentsStats, listTournaments } from '@utils/tournaments'
import type { TournamentPage, TournamentStatus, TournamentSummary, TournamentsStats } from '@utils/types'

type Filters = { status: TournamentStatus | 'all'; banlist: string }

const TABS = ['all', 'live', 'finished'] as const

const PAGE_SIZE = 20

const query = ({ status, banlist }: Filters) => ({
  status: status === 'all' ? undefined : status,
  banlist: banlist === 'all' ? undefined : banlist,
  limit: PAGE_SIZE,
})

/** Column tracks shared by the ledger head and every row, so the two line up. */
const COLS = 'lg:grid-cols-[132px_minmax(0,1fr)_210px_150px] lg:items-center lg:gap-5'

const LedgerHead = () => {
  const t = useTranslations('Tournaments.browser.columns')
  return (
    <div aria-hidden className={twMerge('hidden border-b border-line pb-2.5 text-ink-muted signal lg:grid', COLS)}>
      <span>{t('tournament')}</span>
      <span>{t('banlist')}</span>
      <span>{t('winner')}</span>
      <span>{t('ended')}</span>
    </div>
  )
}

const Row = ({ tournament }: { tournament: TournamentSummary }) => {
  const t = useTranslations('Tournaments')
  const { id, status, banlist, format, players, rounds, startedAt, endedAt, winner, cardPool } = tournament
  const live = status === 'live'
  const year = cardPoolYear(cardPool)

  return (
    // The row link is an overlay rather than a wrapper, so the winner's profile link can sit inside it.
    <li className={twMerge('relative grid grid-cols-1 gap-3.5 border-b border-line py-4 hover:bg-ground-soft', COLS)}>
      <Link href={`/tournament/${id}`} aria-label={t('browser.rowLabel', { id, banlist })} className="absolute inset-0" />

      <span className="flex items-center gap-2.5">
        <span className="text-ink-muted mono-data">#{id}</span>
        <Chip tone={live ? 'negative' : 'neutral'} dot={live}>
          {t(live ? 'status.live' : 'status.finished')}
        </Chip>
      </span>

      <span className="min-w-0">
        <span className="flex flex-wrap items-baseline gap-2.5">
          <span className="text-ink body-strong">{banlist}</span>
          <span className="text-gold signal">{format}</span>
        </span>
        <span className="mt-1.5 block text-ink-muted signal">
          {t('browser.rowSummary', { players, rounds })}
          {endedAt ? ` · ${formatDuration(startedAt, endedAt)}` : ''}
          {year ? ` · ${t('cardPool', { year })}` : ''}
        </span>
      </span>

      {winner ? (
        <PlayerCell player={winner} note={t('browser.points', { points: winner.points })} className="relative" />
      ) : (
        <span className="text-ink-muted body-sm">{t(live ? 'browser.undecided' : 'browser.noWinner')}</span>
      )}

      <span className="text-ink-dim mono-data">
        {endedAt ? <LocalTime iso={endedAt} options={DATE_TIME} /> : t('browser.inProgress')}
      </span>
    </li>
  )
}

const LiveBanner = ({ live }: { live: TournamentSummary | null }) => {
  const t = useTranslations('Tournaments.browser')

  if (!live) {
    return (
      <div className="border border-line px-[clamp(16px,2vw,22px)] py-[clamp(16px,2vw,22px)]">
        <Eyebrow tone="neutral">{t('noneTitle')}</Eyebrow>
        <p className="mt-3 text-ink-dim body-sm">{t('noneText')}</p>
      </div>
    )
  }

  return (
    <div className="border border-negative bg-ground-negative px-[clamp(16px,2vw,22px)] py-[clamp(16px,2vw,22px)]">
      <Eyebrow tone="negative" live meta={t('liveMeta')}>
        {t('liveTitle')}
      </Eyebrow>
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-ink display-5">{live.banlist}</p>
          <p className="mt-1 text-ink-dim mono-data">
            {t('liveSummary', { id: live.id, players: live.players, rounds: live.rounds })}{' '}
            <LocalTime iso={live.startedAt} options={DATE_TIME} />
          </p>
        </div>
        <Link href={`/tournament/${live.id}`} className={buttonClasses({ variant: 'primary', size: 'sm' })}>
          {t('watchLive')}
        </Link>
      </div>
    </div>
  )
}

type TournamentBrowserProps = {
  /** The one running tournament, if any. Separate from the list so the banner survives every filter. */
  live: TournamentSummary | null
  first: TournamentPage
}

export const TournamentBrowser = ({ live, first }: TournamentBrowserProps) => {
  const t = useTranslations('Tournaments.browser')
  const [filters, setFilters] = useState<Filters>({ status: 'all', banlist: 'all' })
  const [{ tournaments, nextCursor }, setPage] = useState(first)
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [stats, setStats] = useState<TournamentsStats | null>(null)

  // Labels live in render, not state, so a language switch relabels the strip without a refetch.
  const totals: Stat[] = [
    { label: t('totals.tournaments'), value: stats ? formatNumber(stats.tournaments) : '—' },
    { label: t('totals.entries'), value: stats ? formatNumber(stats.entries) : '—' },
    { label: t('totals.uniqueDuelists'), value: stats ? formatNumber(stats.uniquePlayers) : '—', tone: stats ? 'cyan' : undefined },
    { label: t('totals.averagePlayers'), value: stats ? formatDecimal(stats.averagePlayers) : '—', tone: stats ? 'gold' : undefined },
  ]

  // Only the newest answer wins: clicking two filters in a row must not resurrect the first one.
  const run = useRef(0)

  /* /tournaments/stats is seconds slow when its cache is cold, so it loads after paint and only
     feeds the totals strip and the banlist chips — never the list itself. */
  useEffect(() => {
    const controller = new AbortController()
    getTournamentsStats({}, controller.signal)
      .then(setStats)
      .catch((error) => {
        if (!controller.signal.aborted) console.error(error)
      })
    return () => controller.abort()
  }, [])

  const apply = async (next: Filters) => {
    const token = ++run.current
    setFilters(next)
    setState('loading')
    try {
      const page = await listTournaments(query(next))
      if (run.current !== token) return
      setPage(page)
      setState('idle')
    } catch (error) {
      if (run.current !== token) return
      console.error(error)
      setState('error')
    }
  }

  const loadMore = async () => {
    if (!nextCursor) return
    const token = ++run.current
    setState('loading')
    try {
      const page = await listTournaments({ ...query(filters), cursor: nextCursor })
      if (run.current !== token) return
      setPage((current) => ({ tournaments: [...current.tournaments, ...page.tournaments], nextCursor: page.nextCursor }))
      setState('idle')
    } catch (error) {
      if (run.current !== token) return
      console.error(error)
      setState('error')
    }
  }

  const chips = [{ banlist: 'all', format: t('allBanlists'), tournaments: 0 }, ...(stats?.banlists ?? [])]
  const tabs = TABS.map((id) => ({ id, label: t(`tabs.${id}`) }))

  return (
    <div className="mx-auto w-full max-w-page px-gutter">
      <section>
        <Eyebrow meta={t('eyebrowMeta')}>{t('eyebrow')}</Eyebrow>
        <h1 className="mt-4 text-ink display-1">{t('heading')}</h1>
        <p className="mt-3.5 max-w-[62ch] text-ink-dim lead">{t('lead')}</p>
      </section>

      <section className="pt-section">
        <LiveBanner live={live} />
      </section>

      <section className="pt-section">
        <StatGrid items={totals} />
        <p className="mt-2.5 text-ink-muted signal-sm">{t('totals.note')}</p>
      </section>

      <section className="pt-section">
        <TabBar
          tabs={tabs}
          active={filters.status}
          onSelect={(status) => apply({ ...filters, status })}
          label={t('tabs.label')}
          idPrefix="tournaments"
          className="max-w-105"
        />

        {chips.length > 1 ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {chips.map(({ banlist, format, tournaments: count }) => {
              const on = filters.banlist === banlist
              return (
                <button
                  key={banlist}
                  type="button"
                  aria-pressed={on}
                  onClick={() => apply({ ...filters, banlist })}
                  className={twMerge(
                    'inline-flex min-h-11 cursor-pointer items-center gap-2 border px-3 signal-chip',
                    on ? 'border-gold bg-ground-gold text-gold' : 'border-line text-ink-dim hover:border-gold hover:text-gold',
                  )}
                >
                  {banlist === 'all' ? t('allBanlists') : banlist}
                  {count ? <span className="text-ink-muted">{formatNumber(count)}</span> : null}
                  <span className="sr-only">{banlist === 'all' ? '' : ` (${format})`}</span>
                </button>
              )
            })}
          </div>
        ) : null}
      </section>

      <section {...tabPanelProps('tournaments', filters.status)} className="pt-[clamp(20px,2.4vw,28px)]">
        <LedgerHead />

        {tournaments.length ? (
          <ul>
            {tournaments.map((tournament) => (
              <Row key={tournament.id} tournament={tournament} />
            ))}
          </ul>
        ) : (
          <EmptyBox title={t('emptyTitle')} className="mt-4">
            {filters.status === 'live' ? t('emptyLive') : t('emptyBanlist')}
          </EmptyBox>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3.5">
          <p className="text-ink-muted signal-sm">
            {t('showing', { count: tournaments.length })}
            {state === 'loading' ? ` · ${t('loading')}` : ''}
          </p>
          {nextCursor ? (
            <button
              type="button"
              onClick={loadMore}
              disabled={state === 'loading'}
              className={buttonClasses({ variant: 'ghost', size: 'sm' })}
            >
              {state === 'loading' ? t('loading') : t('loadMore')}
            </button>
          ) : null}
        </div>

        {state === 'error' ? (
          <p role="alert" className="mt-3 text-negative body-sm">
            {t('error')}
          </p>
        ) : null}
      </section>

      <section className="pt-section">
        <Callout>{t('schedule')}</Callout>
      </section>
    </div>
  )
}
