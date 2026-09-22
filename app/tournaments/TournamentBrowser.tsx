'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import { EmptyBox } from '@omega/profile/empty-box'
import { LocalTime } from '@omega/profile/local-time'
import { PlayerCell } from '@omega/tournament/player'
import { StatGrid, type Stat } from '@omega/tournament/stat-grid'
import { DATE_TIME, cardPoolNote, formatDecimal, formatDuration, formatNumber } from '@omega/tournament/labels'
import { Callout } from '@omega/wiki/wiki'
import { buttonClasses } from '@ui/button'
import { Chip } from '@ui/chip/chip.component'
import { Eyebrow } from '@ui/eyebrow/eyebrow'
import { TabBar, tabPanelProps } from '@ui/tab-bar/tab-bar.component'
import { getTournamentsStats, listTournaments } from '@utils/tournaments'
import type { BanlistTotals, TournamentPage, TournamentStatus, TournamentSummary } from '@utils/types'

type Filters = { status: TournamentStatus | 'all'; banlist: string }

const TABS = [
  { id: 'all', label: 'All' },
  { id: 'live', label: 'Live' },
  { id: 'finished', label: 'Finished' },
] as const

const PAGE_SIZE = 20

const query = ({ status, banlist }: Filters) => ({
  status: status === 'all' ? undefined : status,
  banlist: banlist === 'all' ? undefined : banlist,
  limit: PAGE_SIZE,
})

/** Column tracks shared by the ledger head and every row, so the two line up. */
const COLS = 'lg:grid-cols-[132px_minmax(0,1fr)_210px_150px] lg:items-center lg:gap-5'

const LedgerHead = () => (
  <div aria-hidden className={twMerge('hidden border-b border-line pb-2.5 text-ink-muted signal lg:grid', COLS)}>
    <span>Tournament</span>
    <span>Banlist</span>
    <span>Winner</span>
    <span>Ended</span>
  </div>
)

const Row = ({ tournament }: { tournament: TournamentSummary }) => {
  const { id, status, banlist, format, players, rounds, startedAt, endedAt, winner, cardPool } = tournament
  const live = status === 'live'
  const pool = cardPoolNote(cardPool)

  return (
    <li>
      <Link
        href={`/tournament/${id}`}
        className={twMerge('grid grid-cols-1 gap-3.5 border-b border-line py-4 hover:bg-ground-soft', COLS)}
      >
        <span className="flex items-center gap-2.5">
          <span className="text-ink-muted mono-data">#{id}</span>
          <Chip tone={live ? 'cyan' : 'neutral'} dot={live}>
            {live ? 'Live' : 'Finished'}
          </Chip>
        </span>

        <span className="min-w-0">
          <span className="flex flex-wrap items-baseline gap-2.5">
            <span className="text-ink body-strong">{banlist}</span>
            <span className="text-gold signal">{format}</span>
          </span>
          <span className="mt-1.5 block text-ink-muted signal">
            {players} players · {rounds} rounds
            {endedAt ? ` · ${formatDuration(startedAt, endedAt)}` : ''}
            {pool ? ` · ${pool}` : ''}
          </span>
        </span>

        {winner ? (
          <PlayerCell player={winner} note={`${winner.points} pts`} />
        ) : (
          <span className="text-ink-muted body-sm">{live ? 'Undecided' : 'No winner recorded'}</span>
        )}

        <span className="text-ink-dim mono-data">
          {endedAt ? <LocalTime iso={endedAt} options={DATE_TIME} /> : 'in progress'}
        </span>
      </Link>
    </li>
  )
}

const LiveBanner = ({ live }: { live: TournamentSummary | null }) => {
  if (!live) {
    return (
      <div className="border border-line px-[clamp(16px,2vw,22px)] py-[clamp(16px,2vw,22px)]">
        <Eyebrow tone="neutral">Nothing running</Eyebrow>
        <p className="mt-3 text-ink-dim body-sm">
          No tournament is live right now. A few run every day and each one lasts one to two and a half hours.
        </p>
      </div>
    )
  }

  return (
    <div className="border border-cyan bg-ground-cyan px-[clamp(16px,2vw,22px)] py-[clamp(16px,2vw,22px)]">
      <Eyebrow tone="cyan" live meta="Refreshes every 30 s">
        Live now
      </Eyebrow>
      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-ink display-5">{live.banlist}</p>
          <p className="mt-1 text-ink-dim mono-data">
            #{live.id} · {live.players} players · {live.rounds} Swiss rounds · started{' '}
            <LocalTime iso={live.startedAt} options={DATE_TIME} />
          </p>
        </div>
        <Link href={`/tournament/${live.id}`} className={buttonClasses({ variant: 'primary', size: 'sm' })}>
          Watch live
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
  const [filters, setFilters] = useState<Filters>({ status: 'all', banlist: 'all' })
  const [{ tournaments, nextCursor }, setPage] = useState(first)
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [banlists, setBanlists] = useState<BanlistTotals[]>([])
  const [totals, setTotals] = useState<Stat[]>([
    { label: 'Tournaments', value: '—' },
    { label: 'Entries', value: '—' },
    { label: 'Unique duelists', value: '—' },
    { label: 'Average players', value: '—' },
  ])

  // Only the newest answer wins: clicking two filters in a row must not resurrect the first one.
  const run = useRef(0)

  /* /tournaments/stats is seconds slow when its cache is cold, so it loads after paint and only
     feeds the totals strip and the banlist chips — never the list itself. */
  useEffect(() => {
    const controller = new AbortController()
    getTournamentsStats({}, controller.signal)
      .then((stats) => {
        setBanlists(stats.banlists)
        setTotals([
          { label: 'Tournaments', value: formatNumber(stats.tournaments) },
          { label: 'Entries', value: formatNumber(stats.entries) },
          { label: 'Unique duelists', value: formatNumber(stats.uniquePlayers), tone: 'cyan' },
          { label: 'Average players', value: formatDecimal(stats.averagePlayers), tone: 'gold' },
        ])
      })
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

  const chips = [{ banlist: 'all', format: 'All banlists', tournaments: 0 }, ...banlists]

  return (
    <div className="mx-auto w-full max-w-page px-gutter">
      <section>
        <Eyebrow meta="Read-only · recorded by the engine">Automatic Swiss</Eyebrow>
        <h1 className="mt-4 text-ink display-1">Tournaments</h1>
        <p className="mt-3.5 max-w-[62ch] text-ink-dim lead">
          Every tournament the game has run. Swiss rounds only — there is no top cut. Pairings, results and standings
          come out of the engine, so nothing here was reported by hand.
        </p>
      </section>

      <section className="pt-section">
        <LiveBanner live={live} />
      </section>

      <section className="pt-section">
        <StatGrid items={totals} />
        <p className="mt-2.5 text-ink-muted signal-sm">From /tournaments/stats · cached 10 min</p>
      </section>

      <section className="pt-section">
        <TabBar
          tabs={TABS}
          active={filters.status}
          onSelect={(status) => apply({ ...filters, status })}
          label="Filter tournaments by status"
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
                  {banlist === 'all' ? 'All banlists' : banlist}
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
          <EmptyBox title="No tournaments here" className="mt-4">
            {filters.status === 'live'
              ? 'Nothing is running right now. Switch to Finished to read the ones that already ended.'
              : 'No tournament matches this banlist yet.'}
          </EmptyBox>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3.5">
          <p className="text-ink-muted signal-sm">
            Showing {formatNumber(tournaments.length)} tournaments
            {state === 'loading' ? ' · loading…' : ''}
          </p>
          {nextCursor ? (
            <button
              type="button"
              onClick={loadMore}
              disabled={state === 'loading'}
              className={buttonClasses({ variant: 'ghost', size: 'sm' })}
            >
              {state === 'loading' ? 'Loading…' : 'Load more'}
            </button>
          ) : null}
        </div>

        {state === 'error' ? (
          <p role="alert" className="mt-3 text-gold body-sm">
            Couldn&apos;t load tournaments. Try again.
          </p>
        ) : null}
      </section>

      <section className="pt-section">
        <Callout>
          There is no schedule. The database records a tournament once it has started, so upcoming events cannot be
          listed — this page shows what is running and what has finished.
        </Callout>
      </section>
    </div>
  )
}
