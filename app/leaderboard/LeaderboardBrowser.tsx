'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import { useAuth } from '@hooks/index'
import { EmptyBox } from '@omega/profile/empty-box'
import { LocalTime } from '@omega/profile/local-time'
import { TierBadge } from '@omega/ranked/tier-badge'
import { PlayerAvatar, playerName } from '@omega/tournament/player'
import { DATE_ONLY, DATE_TIME, formatNumber, formatRecord } from '@omega/tournament/labels'
import { Callout } from '@omega/wiki/wiki'
import { buttonClasses } from '@ui/button'
import { Chip } from '@ui/chip/chip.component'
import { Eyebrow } from '@ui/eyebrow/eyebrow'
import { TabBar, tabPanelProps } from '@ui/tab-bar/tab-bar.component'
import { can } from '@utils/articles'
import { signIn } from '@utils/auth'
import { LADDERS, TIER_FLOORS, getLeaderboard, getSeasonStandings, refreshLeaderboard } from '@utils/ranked'
import type { LeaderboardEntry, LeaderboardPage, PastSeason, RankedLadderId, RankedSeason } from '@utils/types'

const TABS = LADDERS.map(({ id, format }) => ({ id, label: format }))

/** Select value for the open season. Every other value is a closed season's `code`. */
const LIVE = ''

type Board = {
  entries: LeaderboardEntry[]
  nextCursor: string | null
  /** Live only: when the game server was read. `null` on a past season, or when the read failed. */
  syncedAt: string | null
  /** Live only: the open season the list is titled with. */
  season: RankedSeason | null
  status: 'idle' | 'loading' | 'error'
  /** A page arrived from a newer read, so the walk restarted from the top. */
  resynced: boolean
}

const BLANK: Board = { entries: [], nextCursor: null, syncedAt: null, season: null, status: 'idle', resynced: false }

const fromLive = ({ entries, nextCursor, syncedAt, season }: LeaderboardPage) => ({ entries, nextCursor, syncedAt, season })

/** One board per ladder and season, so switching either keeps what the other had loaded. */
const keyOf = (ladder: RankedLadderId, code: string) => `${ladder}:${code}`

const played = ({ wins, loses, draws }: LeaderboardEntry) => wins + loses + draws

const winRate = (entry: LeaderboardEntry) => {
  const total = played(entry)
  return total ? `${Math.round((entry.wins / total) * 100)}%` : '—'
}

const profileHref = (entry: LeaderboardEntry) => `/profile/${entry.id}`

/** What a screen reader hears for a row: the column names the layout otherwise only shows once. */
const describe = (entry: LeaderboardEntry) =>
  `Rank ${entry.rank}, ${playerName(entry)}, ${entry.tier}, ${formatNumber(entry.elo)} Elo, ` +
  `${entry.wins} wins, ${entry.loses} losses, ${entry.draws} draws, ${winRate(entry)} win rate`

const Handle = ({ entry, className }: { entry: LeaderboardEntry; className?: string }) =>
  entry.handle ? <span className={twMerge('block truncate text-ink-muted mono-data', className)}>{entry.handle}</span> : null

/* ---------------------------------------------------------------- *
 * Top five
 * ---------------------------------------------------------------- */

/** Rank 1 takes a band of its own: the only row that gets the gold plate and the display Elo. */
const Champion = ({ entry, season }: { entry: LeaderboardEntry; season?: string }) => (
  <Link
    href={profileHref(entry)}
    aria-label={describe(entry)}
    className="group flex flex-wrap items-center gap-[clamp(16px,3vw,32px)] border border-gold bg-ground-gold px-[clamp(16px,2.4vw,28px)] py-[clamp(18px,2.4vw,28px)]"
  >
    <span className="flex items-center gap-[clamp(12px,2vw,20px)]">
      <span className="text-gold display-2 tabular-nums">01</span>
      <TierBadge season={season} tier={entry.tier} sizes="120px" className="size-[clamp(72px,9vw,112px)] border-line-strong" />
    </span>

    <span className="min-w-0 flex-[1_1_240px]">
      <span className="flex items-center gap-3">
        <PlayerAvatar player={entry} size={36} />
        <span className="min-w-0">
          <span className="block truncate text-ink display-4 group-hover:text-gold">{playerName(entry)}</span>
          <Handle entry={entry} />
        </span>
      </span>
      <span className="mt-3 flex flex-wrap items-center gap-2.5">
        <Chip tone="gold" solid>
          {entry.tier}
        </Chip>
        <span className="text-ink-dim mono-data">
          {formatRecord(entry)} · {winRate(entry)} win rate
        </span>
      </span>
    </span>

    <span className="shrink-0">
      <span className="block text-ink-muted signal">Elo</span>
      <span className="block text-gold display-1 tabular-nums">{formatNumber(entry.elo)}</span>
    </span>
  </Link>
)

/** Ranks 2 to 5: the same card four times, so nothing in the group outranks the others by layout. */
const RunnerUp = ({ entry, season }: { entry: LeaderboardEntry; season?: string }) => (
  <Link
    href={profileHref(entry)}
    aria-label={describe(entry)}
    className="group flex items-center gap-3.5 border border-line bg-surface-000 p-[clamp(12px,1.6vw,18px)] hover:border-gold"
  >
    <span className="text-ink-muted display-5 tabular-nums">{String(entry.rank).padStart(2, '0')}</span>
    <TierBadge season={season} tier={entry.tier} sizes="64px" className="size-[clamp(44px,5vw,60px)]" />
    <span className="min-w-0 flex-1">
      <span className="block truncate text-ink body-strong group-hover:text-gold">{playerName(entry)}</span>
      <Handle entry={entry} />
      <span className="mt-1.5 block text-gold mono-data">{formatNumber(entry.elo)} Elo</span>
      <span className="block text-ink-muted signal-sm">{formatRecord(entry)}</span>
    </span>
  </Link>
)

/* ---------------------------------------------------------------- *
 * The ledger
 * ---------------------------------------------------------------- */

const COLS = 'lg:grid-cols-[64px_minmax(0,1fr)_132px_110px_132px_84px] lg:items-center lg:gap-5'

const LedgerHead = () => (
  <div aria-hidden className={twMerge('hidden border-b border-line pb-2.5 text-ink-muted signal lg:grid', COLS)}>
    <span>Rank</span>
    <span>Duelist</span>
    <span>Tier</span>
    <span>Elo</span>
    <span>W / L / D</span>
    <span>Win rate</span>
  </div>
)

/** Below `lg` the four stat columns fold into one line under the name, so a row stays two lines tall. */
const Row = ({ entry, mine, season }: { entry: LeaderboardEntry; mine: boolean; season?: string }) => (
  <li>
    <Link
      href={profileHref(entry)}
      aria-label={describe(entry)}
      aria-current={mine || undefined}
      className={twMerge(
        'group grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3.5 border-b border-line py-3.5 hover:bg-ground-soft',
        COLS,
        mine && 'border-cyan bg-ground-cyan',
      )}
    >
      <span className={twMerge('mono-data tabular-nums', mine ? 'text-cyan' : 'text-ink-muted')}>
        {String(entry.rank).padStart(2, '0')}
      </span>

      <span className="flex min-w-0 items-center gap-2.5">
        <PlayerAvatar player={entry} size={28} />
        <span className="min-w-0">
          <span
            className={twMerge(
              'block truncate body-strong group-hover:text-gold',
              entry.name?.trim() ? 'text-ink' : 'text-ink-muted',
            )}
          >
            {playerName(entry)}
          </span>
          <span className="block truncate text-ink-dim mono-data lg:hidden">
            {entry.tier} · <span className="text-gold">{formatNumber(entry.elo)} Elo</span> · {formatRecord(entry)} ·{' '}
            {winRate(entry)}
          </span>
        </span>
      </span>

      <span className="hidden items-center gap-2 lg:flex">
        <TierBadge season={season} tier={entry.tier} sizes="32px" className="size-7 border-0 bg-transparent" />
        <span className="truncate text-ink-dim signal">{entry.tier}</span>
      </span>

      <span className="hidden text-gold mono-data tabular-nums lg:block">{formatNumber(entry.elo)}</span>
      <span className="hidden text-ink-dim mono-data tabular-nums lg:block">{formatRecord(entry)}</span>
      <span className="hidden text-ink-muted mono-data tabular-nums lg:block">{winRate(entry)}</span>
    </Link>
  </li>
)

/* ---------------------------------------------------------------- *
 * Where the viewer stands
 * ---------------------------------------------------------------- */

/** Every state of the strip shares this floor, so it does not push the ledger down when auth resolves. */
const STRIP = 'flex min-h-[76px] flex-wrap items-center gap-3.5 border px-4.5 py-4'

type YouProps = {
  entry: LeaderboardEntry | null
  signedIn: boolean | undefined
  loaded: number
  format: string
  /** Present while there is another page to reach. */
  onLoadMore?: () => void
  loading: boolean
  season?: string
}

/**
 * The API has no "my position" read, so this highlights the viewer's row when the pages loaded
 * reach it and offers the next page when they do not.
 */
const YourStanding = ({ entry, signedIn, loaded, format, onLoadMore, loading, season }: YouProps) => {
  if (signedIn === undefined) return <div aria-hidden className={twMerge(STRIP, 'border-line bg-surface-100')} />

  if (!signedIn) {
    return (
      <div className={twMerge(STRIP, 'justify-between border-line bg-surface-100')}>
        <p className="text-ink-dim body-sm">Sign in to see where you sit on the {format} ladder.</p>
        <button type="button" onClick={signIn} className={buttonClasses({ variant: 'ghost', size: 'sm' })}>
          Sign in with Discord
        </button>
      </div>
    )
  }

  if (!entry) {
    return (
      <div className={twMerge(STRIP, 'justify-between border-line bg-surface-100')}>
        <p className="max-w-[62ch] text-ink-dim body-sm">
          You&apos;re not in the top {formatNumber(loaded)} loaded so far.
        </p>
        <span className="flex flex-wrap gap-2.5">
          {onLoadMore ? (
            <button
              type="button"
              onClick={onLoadMore}
              disabled={loading}
              className={buttonClasses({ variant: 'ghost', size: 'sm' })}
            >
              {loading ? 'Loading…' : 'Load more'}
            </button>
          ) : null}
          <Link href="/profile" className={buttonClasses({ variant: 'ghost', size: 'sm' })}>
            Open your profile
          </Link>
        </span>
      </div>
    )
  }

  return (
    <div className={twMerge(STRIP, 'gap-[clamp(14px,2.4vw,28px)] border-cyan bg-ground-cyan')}>
      <span>
        <span className="block text-ink-muted signal">Your rank</span>
        <span className="block text-cyan display-3 tabular-nums">#{formatNumber(entry.rank)}</span>
      </span>
      <TierBadge season={season} tier={entry.tier} sizes="64px" className="size-[clamp(44px,5vw,60px)]" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-ink body-strong">{playerName(entry)}</span>
        <span className="block text-ink-dim mono-data">
          {entry.tier} · {formatNumber(entry.elo)} Elo · {formatRecord(entry)} · {winRate(entry)} win rate
        </span>
      </span>
      <Link href="/profile" className={buttonClasses({ variant: 'ghost', size: 'sm' })}>
        Open your profile
      </Link>
    </div>
  )
}

/* ---------------------------------------------------------------- *
 * Tier legend
 * ---------------------------------------------------------------- */

/** Points are Elo: each tier is a band of it, and this is where each band starts. */
const TierLegend = ({ season }: { season?: string }) => (
  <ul className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4 xl:grid-cols-8">
    {TIER_FLOORS.map(([tier, floor]) => (
      <li key={tier} className="flex items-center gap-2.5 bg-surface-000 px-3.5 py-3">
        <TierBadge season={season} tier={tier} sizes="40px" className="size-9 border-0 bg-transparent" />
        <span className="min-w-0">
          <span className="block truncate text-ink signal">{tier}</span>
          <span className="block text-ink-muted mono-data">{floor === null ? 'under 50' : `${formatNumber(floor)}+`}</span>
        </span>
      </li>
    ))}
  </ul>
)

/* ---------------------------------------------------------------- *
 * Page
 * ---------------------------------------------------------------- */

type LeaderboardBrowserProps = {
  tcg: LeaderboardPage
  genesys: LeaderboardPage
  /** Closed seasons per ladder, newest first. */
  past: Record<RankedLadderId, PastSeason[]>
}

export const LeaderboardBrowser = ({ tcg, genesys, past }: LeaderboardBrowserProps) => {
  const { user } = useAuth()
  const [active, setActive] = useState<RankedLadderId>('tcg')
  const [picked, setPicked] = useState<Record<RankedLadderId, string>>({ tcg: LIVE, genesys: LIVE })
  const [boards, setBoards] = useState<Record<string, Board>>({
    [keyOf('tcg', LIVE)]: { ...BLANK, ...fromLive(tcg) },
    [keyOf('genesys', LIVE)]: { ...BLANK, ...fromLive(genesys) },
  })
  const [refresh, setRefresh] = useState<'idle' | 'loading' | 'error'>('idle')

  // One token per board: switching tabs or seasons mid-load must not discard another board's answer.
  const run = useRef<Record<string, number>>({})

  const code = picked[active]
  const isLive = code === LIVE
  const key = keyOf(active, code)
  const current = boards[key] ?? BLANK
  const season = past[active].find((entry) => entry.code === code)
  const { entries, nextCursor, syncedAt } = current
  const seasonCode = (isLive ? current.season : season)?.code
  const champion = entries[0]
  const runnersUp = entries.slice(1, 5)
  const rest = entries.slice(5)
  const mine = user ? (entries.find((entry) => entry.id === user.id) ?? null) : null
  const signedIn = user === undefined ? undefined : Boolean(user)
  const admin = can(user, 'system.manage')
  const format = LADDERS.find((ladder) => ladder.id === active)?.format ?? 'TCG'
  const loading = current.status === 'loading'

  const patch = (id: string, next: Partial<Board>) =>
    setBoards((state) => ({ ...state, [id]: { ...(state[id] ?? BLANK), ...next } }))

  const fetchPage = async (ladder: RankedLadderId, seasonCode: string, cursor?: string, reload?: boolean) => {
    if (seasonCode === LIVE) return fromLive(await getLeaderboard(ladder, { cursor, reload }))
    const page = await getSeasonStandings(seasonCode, { cursor })
    return { entries: page.entries, nextCursor: page.nextCursor, syncedAt: null, season: null }
  }

  /** No cursor loads the top of the board; a cursor appends the next page. */
  const load = async (ladder: RankedLadderId, seasonCode: string, cursor?: string, reload?: boolean) => {
    const id = keyOf(ladder, seasonCode)
    const token = (run.current[id] ?? 0) + 1
    run.current[id] = token
    patch(id, { status: 'loading' })
    try {
      const page = await fetchPage(ladder, seasonCode, cursor, reload)
      if (run.current[id] !== token) return
      if (!cursor) return patch(id, { ...page, status: 'idle', resynced: false })

      /* `rank` is recomputed by every live read, so a walk that straddles one can skip or repeat a
         duelist. A different `syncedAt` means exactly that: restart from the top. Past seasons are
         frozen and never straddle anything. */
      if (seasonCode === LIVE && page.syncedAt !== boards[id]?.syncedAt) {
        const top = await fetchPage(ladder, seasonCode)
        if (run.current[id] !== token) return
        return patch(id, { ...top, status: 'idle', resynced: true })
      }

      setBoards((state) => {
        const board = state[id] ?? BLANK
        return { ...state, [id]: { ...board, ...page, entries: [...board.entries, ...page.entries], status: 'idle' } }
      })
    } catch (error) {
      if (run.current[id] !== token) return
      console.error(error)
      patch(id, { status: 'error' })
    }
  }

  const loadMore = () => (entries.length ? nextCursor && load(active, code, nextCursor) : load(active, code))

  const choose = (next: string) => {
    setPicked((state) => ({ ...state, [active]: next }))
    if (!boards[keyOf(active, next)]) load(active, next)
  }

  /** Re-reads both ladders on the server, then both live boards past the browser cache. */
  const refreshNow = async () => {
    setRefresh('loading')
    try {
      await refreshLeaderboard()
      await Promise.all(LADDERS.map(({ id }) => load(id, LIVE, undefined, true)))
      setRefresh('idle')
    } catch (error) {
      console.error(error)
      setRefresh('error')
    }
  }

  const title = isLive ? (current.season?.label ?? 'No open season') : (season?.label ?? 'Past season')

  const empty =
    isLive && !syncedAt ? (
      <EmptyBox title="The ladder is unreachable" note="Try again" className="mt-4.5">
        We couldn&apos;t read the {format} ladder right now. Elo, tier and records keep working on every profile.
      </EmptyBox>
    ) : isLive ? (
      <EmptyBox title={`No ${format} games this season yet`} note="Nothing to rank" className="mt-4.5">
        The list fills in as soon as someone plays a ranked {format} duel this season.
      </EmptyBox>
    ) : (
      <EmptyBox title="No final results" note="Nothing to rank" className="mt-4.5">
        Nobody finished this season on the {format} ladder.
      </EmptyBox>
    )

  return (
    <div className="mx-auto w-full max-w-page px-gutter mt-8">
      <section>
        <Eyebrow live meta="Live · refreshed every 30 min">
          Ranked ladder
        </Eyebrow>
        <h1 className="mt-4 text-ink display-2">Leaderboard</h1>
        <p className="mt-3.5 max-w-[62ch] text-ink-dim lead">
          Two ladders, kept apart: TCG and Genesys each have their own season, their own rank 1 and their own Elo. The
          record counts only the games played this season. Points are Elo — reach the Elo a tier starts at and you are
          in that tier.
        </p>
      </section>

      <section className="pt-section">
        <TabBar
          tabs={TABS}
          active={active}
          onSelect={setActive}
          label="Choose a ranked ladder"
          idPrefix="leaderboard"
          className="max-w-90"
        />
      </section>

      <section {...tabPanelProps('leaderboard', active)} className="pt-[clamp(20px,2.4vw,28px)]">
        <div className="flex flex-wrap items-end justify-between gap-3.5">
          <div>
            <h2 className="text-ink display-5">
              <span className="sr-only">{format} </span>
              {title}
            </h2>
            <p className="mt-1 text-ink-muted signal-sm">
              {!isLive && season ? (
                <>
                  Final results · <LocalTime iso={season.startsAt} options={DATE_ONLY} /> –{' '}
                  <LocalTime iso={season.endsAt} options={DATE_ONLY} />
                </>
              ) : syncedAt ? (
                <>
                  Live · as of <LocalTime iso={syncedAt} options={DATE_TIME} />
                </>
              ) : (
                'Live ladder unavailable'
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {past[active].length ? (
              <label className="flex items-center gap-2.5 text-ink-muted signal">
                Season
                <select
                  value={code}
                  onChange={(e) => choose(e.target.value)}
                  className="border border-surface-400 bg-surface-200 px-2.5 py-2 text-ink signal hover:border-ink-muted"
                >
                  <option value={LIVE}>{boards[keyOf(active, LIVE)]?.season?.label ?? 'Current season'} · live</option>
                  {past[active].map((entry) => (
                    <option key={entry.code} value={entry.code}>
                      {entry.label} · final
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {admin && isLive ? (
              <button
                type="button"
                onClick={refreshNow}
                disabled={refresh === 'loading'}
                className={buttonClasses({ variant: 'ghost', size: 'sm' })}
              >
                {refresh === 'loading' ? 'Refreshing…' : 'Refresh leaderboard'}
              </button>
            ) : null}
          </div>
        </div>

        {refresh === 'error' && isLive ? (
          <p role="alert" className="mt-3 text-negative body-sm">
            Couldn&apos;t refresh the leaderboard. Try again.
          </p>
        ) : null}

        {current.resynced ? (
          <p role="status" className="mt-3 border border-cyan bg-ground-cyan px-4 py-3 text-ink-dim body-sm">
            The ladder refreshed while you were reading it, so the list restarted from rank 1.
          </p>
        ) : null}

        {entries.length ? (
          <>
            <div className="mt-4.5">{champion ? <Champion season={seasonCode} entry={champion} /> : null}</div>

            {runnersUp.length ? (
              <ul className="mt-3.5 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
                {runnersUp.map((entry) => (
                  <li key={entry.id}>
                    <RunnerUp season={seasonCode} entry={entry} />
                  </li>
                ))}
              </ul>
            ) : null}

            <div className="mt-[clamp(20px,2.4vw,28px)]">
              <YourStanding
                entry={mine}
                signedIn={signedIn}
                loaded={entries.length}
                format={format}
                onLoadMore={nextCursor ? loadMore : undefined}
                loading={loading}
                season={seasonCode}
              />
            </div>

            {rest.length ? (
              <div className="mt-[clamp(20px,2.4vw,28px)]">
                <LedgerHead />
                <ul>
                  {rest.map((entry) => (
                    <Row key={entry.id} season={seasonCode} entry={entry} mine={entry.id === user?.id} />
                  ))}
                </ul>
              </div>
            ) : null}

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3.5">
              <p className="text-ink-muted signal-sm" aria-live="polite">
                Showing {formatNumber(entries.length)}
                {season ? ` of ${formatNumber(season.standings)}` : ''} duelists
                {loading ? ' · loading…' : ''}
              </p>
              {nextCursor ? (
                <span className="flex flex-wrap items-center gap-3">
                  {current.status === 'error' ? (
                    <span role="alert" className="text-negative body-sm">
                      Couldn&apos;t load the next page.
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={loading}
                    className={buttonClasses({ variant: 'ghost', size: 'sm' })}
                  >
                    {loading ? 'Loading…' : current.status === 'error' ? 'Try again' : 'Load more'}
                  </button>
                </span>
              ) : (
                <p className="text-ink-muted signal-sm">End of the ladder</p>
              )}
            </div>
          </>
        ) : loading ? (
          <p role="status" className="mt-4.5 text-ink-muted signal-sm">
            Loading {title}…
          </p>
        ) : current.status === 'error' ? (
          <div className="mt-4.5 flex flex-wrap items-center gap-3">
            <p role="alert" className="text-negative body-sm">
              Couldn&apos;t load {title}.
            </p>
            <button type="button" onClick={loadMore} className={buttonClasses({ variant: 'ghost', size: 'sm' })}>
              Try again
            </button>
          </div>
        ) : (
          empty
        )}
      </section>

      <section className="pt-section">
        <h2 className="text-ink display-5">Tiers</h2>
        <p className="mt-3.5 mb-4 max-w-[62ch] text-ink-dim body-sm">
          A tier is a band of Elo, not a separate score, and it has no subdivisions. The Elo below is where each band
          starts.
        </p>
        <TierLegend season={seasonCode} />
      </section>

      <section className="pt-section">
        <Callout>
          The live list is read from the game server and kept for 30 minutes, while a profile reads its Elo on every
          visit — so right after a duel your profile can be a little ahead of the ladder. Past seasons show the rank,
          Elo and tier frozen when the season closed, and only the games played in it.
        </Callout>
      </section>
    </div>
  )
}
