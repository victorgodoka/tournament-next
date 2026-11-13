'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { AdBanner } from '@omega/ads/ad-banner'
import { EmptyBox } from '@omega/profile/empty-box'
import { LocalTime } from '@omega/profile/local-time'
import { DAY, TIME_ONLY, banlistLabel, formatDecimal, formatDuration, formatNumber, formatTone, minutesBetween } from '@omega/tournament/labels'
import { playerName } from '@omega/tournament/player'
import { Avatar } from '@ui/avatar'
import { Button } from '@ui/button'
import { Chip } from '@ui/chip'
import { Select } from '@ui/field'
import { Icon } from '@ui/icon'
import { PageHeader } from '@ui/page-header'
import { Panel } from '@ui/panel'
import { RailHead } from '@ui/rail-head'
import { calendarHref, getTournamentsStats, listTournaments } from '@utils/tournaments'
import type { CalendarEntry, Standing, TournamentDetail, TournamentPage, TournamentSummary, TournamentsStats } from '@utils/types'

const PAGE_SIZE = 20
/** The API's own advice for a running tournament: re-read it every 30 s. */
const POLL_MS = 30_000
/** The formats the game runs, for the segments until the stats say which exist. */
const FORMATS = ['TCG', 'Genesys', 'Edison', 'Rush Duel']
/** The summary bar's colors: the chip tones' colors. */
const FORMAT_COLOR: Record<string, string> = {
  TCG: 'var(--color-ladder-tcg)',
  Genesys: 'var(--color-ladder-genesys)',
  Edison: 'var(--color-gold)',
  'Rush Duel': 'var(--color-cyan)',
}
const META = 'signal-sm text-ink-muted'
const DAY_SHORT: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }
/** Column tracks of a result row from `lg`; below it the id, the format and the winner share one line. */
const ROW = 'grid grid-cols-[56px_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1.5 px-5 py-3.5 lg:grid-cols-[72px_minmax(180px,1.4fr)_minmax(150px,1fr)_150px_minmax(170px,1.2fr)_24px]'
const LG = 'max-lg:hidden'
const subscribe = () => () => {}

type Filters = { format: string; banlist: string }

/** `YYYY-MM-DD` of an instant: the reader's day in the browser, UTC on the server (it can't know the zone). */
const dayOf = (iso: string, local: boolean) => {
  const at = new Date(iso)
  return local
    ? `${at.getFullYear()}-${String(at.getMonth() + 1).padStart(2, '0')}-${String(at.getDate()).padStart(2, '0')}`
    : at.toISOString().slice(0, 10)
}

/** `today`, `tomorrow`, or nothing, for a day relative to `now`. */
const relativeDay = (iso: string, now: string, local: boolean) => {
  const day = dayOf(iso, local)
  if (day === dayOf(now, local)) return 'today' as const
  if (day === dayOf(new Date(Date.parse(now) + 86_400_000).toISOString(), local)) return 'tomorrow' as const
  return null
}

const pct = (value: number, max: number) => `${max ? Math.min(100, (value / max) * 100) : 0}%`

/* ------------------------------------------------------------------ live */

/** The running tournament: its round, the match on the table and the standings as they are. */
const LiveBanner = ({ detail, now }: { detail: TournamentDetail; now: string }) => {
  const t = useTranslations('Tournaments')
  const tl = useTranslations('Tournaments.list.live')
  const { tournament, standings, rounds } = detail
  const current = rounds.at(-1)
  const pending = current?.matches.filter((match) => match.outcome === 'unplayed') ?? []
  const onTable = pending[0]
  const roster = new Map(standings.map((standing) => [standing.player.id, standing.player]))
  const name = (id: string) => playerName(roster.get(id), t('player.unknown'))
  const progress = (number: number) => {
    const round = rounds.find((r) => r.number === number)
    return round ? { done: round.matches.filter((match) => match.outcome !== 'unplayed').length, total: round.matches.length } : null
  }
  const final = current?.number === tournament.rounds
  const bye = current?.bye ? name(current.bye) : null

  const note = (standing: Standing) => {
    if (standing.dropped) return tl('dropped')
    if (!current) return null
    if (current.bye === standing.player.id) return tl('byeIn', { round: current.number })
    const match = current.matches.find((m) => m.player1 === standing.player.id || m.player2 === standing.player.id)
    if (!match) return null
    return match.outcome === 'unplayed' ? tl('playing', { room: match.room }) : tl('roundDone', { round: current.number })
  }

  return (
    <Panel tone="steel" label={t('browser.live.label')} className="min-[720px]:px-8 min-[720px]:py-7">
      <div className="grid gap-8 min-[900px]:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <Chip tone="live">{t('status.live')}</Chip>
            <Chip tone={formatTone(tournament.format)}>{tournament.format}</Chip>
            <span className="text-ink-dim signal">
              #{tournament.id} · {tl('started')} <LocalTime iso={tournament.startedAt} options={TIME_ONLY} /> · {t('browser.live.players', { count: tournament.players })}
            </span>
          </div>
          <div className="flex flex-col gap-1.5">
            <h2 className="text-ink display-hero text-[clamp(40px,6vw,64px)]">
              {current ? tl('round', { round: current.number, rounds: tournament.rounds }) : banlistLabel(tournament)}
            </h2>
            <p className="m-0 text-ink-dim body">
              {current ? `${final ? `${tl('finalRound')} ` : ''}${tl('left', { count: pending.length })}${bye ? ` ${tl('byeHas', { name: bye })}` : ''}` : tl('pairing')}
            </p>
          </div>

          <div className="flex max-w-130 flex-col gap-2" role="img" aria-label={t('browser.live.progress', { round: current?.number ?? 0, rounds: tournament.rounds })}>
            <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${tournament.rounds}, minmax(0, 1fr))` }}>
              {Array.from({ length: tournament.rounds }, (_, i) => {
                const p = progress(i + 1)
                const fill = !p ? 0 : p.total ? (p.done / p.total) * 100 : 100
                return (
                  <span
                    key={i}
                    className={twMerge('h-1.5', current && i + 1 < current.number && 'opacity-45')}
                    style={{ background: `linear-gradient(90deg, var(--color-cyan) ${fill}%, rgba(255,255,255,0.12) ${fill}%)` }}
                  />
                )
              })}
            </div>
            <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${tournament.rounds}, minmax(0, 1fr))` }}>
              {Array.from({ length: tournament.rounds }, (_, i) => {
                const p = progress(i + 1)
                return (
                  <span key={i} className={twMerge('truncate', META, current && i + 1 === current.number ? 'text-cyan' : p && 'text-ink-dim')}>
                    {p ? tl('stepDone', { round: i + 1, done: p.done, total: p.total }) : `R${i + 1}`}
                  </span>
                )
              })}
            </div>
          </div>

          {onTable ? (
            <div className="cut flex max-w-140 flex-wrap items-center gap-4 px-4.5 py-3.5 drop-shadow-[0_0_10px_color-mix(in_srgb,var(--color-cyan-glow)_35%,transparent)] [--cut:var(--cut-md)] [--edge:var(--color-cyan)] [--sw:var(--stroke)]">
              <span aria-hidden className="size-2 rounded-round bg-cyan-glow shadow-glow-live" />
              <span className="text-cyan signal-strong">{tl('onTable')}</span>
              <span className="flex min-w-55 flex-1 items-center gap-2.5">
                <Avatar name={name(onTable.player1)} src={roster.get(onTable.player1)?.avatar} cosmetics={roster.get(onTable.player1)?.cosmetics} size="sm" className="size-6 text-[10px]" />
                <b className="truncate text-ink body-strong">{name(onTable.player1)}</b>
                <span className={META}>{tl('vs')}</span>
                <Avatar name={name(onTable.player2)} src={roster.get(onTable.player2)?.avatar} cosmetics={roster.get(onTable.player2)?.cosmetics} size="sm" className="size-6 text-[10px]" />
                <b className="truncate text-ink body-strong">{name(onTable.player2)}</b>
              </span>
              <span className={META}>{t('rounds.room', { room: onTable.room })}</span>
            </div>
          ) : null}

          <div className="flex flex-wrap items-center gap-5 pt-1">
            <Button href={`/tournament/${tournament.id}`} variant="primary">
              {t('browser.live.follow')} <Icon name="right" size={14} />
            </Button>
            <span className={META}>
              {tl('updated')} <LocalTime iso={now} options={TIME_ONLY} /> · {tl('refreshes')}
            </span>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-ink-dim signal">{tl('standingsNow')}</span>
            <span className={META}>{tl('byKts')}</span>
          </div>
          <ol className="flex flex-col gap-px border border-steel-edge bg-steel-edge">
            {standings.slice(0, 4).map((standing) => {
              const { rank, player, points } = standing
              return (
                <li key={player.id} className="grid grid-cols-[28px_32px_minmax(0,1fr)_auto_auto] items-center gap-3 bg-space-000/35 px-3.5 py-3">
                  <span className={twMerge('stat text-xl', rank === 1 ? 'text-gold' : rank <= 3 ? 'text-ink-dim' : 'text-ink-muted')}>{rank}</span>
                  <Avatar name={playerName(player, t('player.unknown'))} src={player.avatar} cosmetics={player.cosmetics} size="sm" className="size-8 text-xs" />
                  <span className="flex min-w-0 flex-col">
                    <b className="truncate text-ink body-strong">{playerName(player, t('player.unknown'))}</b>
                    <span className={twMerge('truncate', META)}>{note(standing)}</span>
                  </span>
                  <span className="text-ink-dim data">{`${standing.wins}–${standing.loses}–${standing.draws}`}</span>
                  <span className="min-w-7 text-right text-ink stat text-xl">{points}</span>
                </li>
              )
            })}
          </ol>
          <span className="text-ink-muted caption">{tl('hidden')}</span>
        </div>
      </div>
    </Panel>
  )
}

/* ------------------------------------------------------------------ next up */

const NextCard = ({ entry, first, now }: { entry: CalendarEntry; first: boolean; now: string }) => {
  const t = useTranslations('Tournaments.list.next')
  const tc = useTranslations('Calendar')
  const tt = useTranslations('Tournaments')
  const isBrowser = useSyncExternalStore(subscribe, () => true, () => false)
  const href = calendarHref(entry)
  const staff = entry.source === 'panel'
  const minutes = minutesBetween(now, entry.startsAt)
  const when = minutes < 60 ? t('inMinutes', { minutes }) : minutes < 1440 ? t('inHours', { hours: Math.floor(minutes / 60), minutes: minutes % 60 }) : t('inDays', { days: Math.round(minutes / 1440) })
  const day = relativeDay(entry.startsAt, now, isBrowser)
  const label = entry.format ? banlistLabel({ banlist: entry.banlist ?? entry.format, format: entry.format }) : tc('fallbackFormat')

  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <Chip tone={entry.format ? formatTone(entry.format) : 'neutral'}>{entry.format ?? tc('fallbackFormat')}</Chip>
        <span className={twMerge(META, staff ? 'text-gold' : first && 'text-cyan')}>{staff ? t('staff') : when}</span>
      </div>
      <span className="text-ink display-3">
        {day ? t(day) : <LocalTime iso={entry.startsAt} options={DAY} />} · <LocalTime iso={entry.startsAt} options={TIME_ONLY} />
      </span>
      <span className="truncate text-ink-dim body-sm">
        {label} · {tt(`mode.short.${entry.mode}`)}
        {entry.structure ? ` ${tc(`structure.${entry.structure}`)}` : ''}
        {staff && entry.players !== null ? ` · ${tc('preRegistered', { count: entry.players })}` : ''}
      </span>
      <span className={twMerge('border-t border-line pt-1.5', staff ? 'text-gold signal-strong' : META)}>
        {staff ? `${t('preRegister')} →` : entry.registration === 'ingame' ? tc('registration.ingame') : ' '}
      </span>
    </>
  )
  const className = twMerge(
    'cut notch flex min-w-0 flex-col gap-2.5 p-4.5 text-ink [--cut:var(--cut-md)]',
    staff && '[--edge:var(--color-gold)] [--fill:var(--color-surface-200)]',
    href && 'hover:[--fill:var(--color-surface-300)]',
  )
  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  )
}

/* ------------------------------------------------------------------ results */

const Row = ({ tournament, live, now, maxPlayers }: { tournament: TournamentSummary; live: TournamentDetail | null; now: string; maxPlayers: number }) => {
  const t = useTranslations('Tournaments')
  const tr = useTranslations('Tournaments.list.results')
  const { id, status, format, players, rounds, startedAt, endedAt, winner } = tournament
  const isLive = status === 'live'
  const snap = live?.tournament.id === id ? live : null
  const round = snap?.rounds.at(-1)
  const leader = snap?.standings[0]
  const unknown = !winner?.name?.trim()

  return (
    <li>
      <Link
        href={`/tournament/${id}`}
        aria-label={t('browser.row.label', { id, banlist: banlistLabel(tournament) })}
        className={twMerge(ROW, 'text-ink', isLive ? 'bg-ground-cyan' : 'bg-surface-100 hover:bg-surface-300')}
      >
        <span className="text-ink-muted data">#{id}</span>

        <span className="flex min-w-0 items-center gap-2.5">
          <Chip tone={formatTone(format)}>{format}</Chip>
          <span className="truncate text-ink-dim body-sm">{banlistLabel(tournament)}</span>
        </span>

        <span className={twMerge(LG, 'flex flex-col gap-1.5')}>
          <span className="text-ink-dim signal-sm">{tr('field', { players, rounds })}</span>
          <span aria-hidden className="block h-1 max-w-40 rounded-xs bg-surface-300">
            <span className="block h-full bg-azure-lift" style={{ width: pct(players, maxPlayers) }} />
          </span>
        </span>

        <span className={twMerge(LG, 'flex flex-col')}>
          <span className="text-ink data">
            <LocalTime iso={startedAt} options={TIME_ONLY} />
          </span>
          <span className={META}>{endedAt ? formatDuration(startedAt, endedAt) : t('browser.row.running', { duration: formatDuration(startedAt, now) })}</span>
        </span>

        {isLive ? (
          <span className="flex items-center gap-2.5">
            <span aria-hidden className="size-2 shrink-0 rounded-round bg-cyan-glow shadow-glow-live" />
            <span className="flex min-w-0 flex-col">
              <span className="text-cyan signal-strong">{round ? t('browser.row.round', { round: round.number, rounds }) : t('browser.row.inProgress')}</span>
              {leader ? <span className={twMerge('truncate', META)}>{tr('leader', { name: playerName(leader.player, t('player.unknown')), points: leader.points })}</span> : null}
            </span>
          </span>
        ) : winner ? (
          <span className="flex min-w-0 items-center gap-2.5">
            <Avatar name={playerName(winner, t('player.unknown'))} src={winner.avatar} cosmetics={winner.cosmetics} size="sm" className="size-6 text-[10px]" />
            <span className="flex min-w-0 flex-col">
              <b className={twMerge('truncate text-sm leading-4.5', unknown ? 'text-ink-muted italic' : 'text-ink')}>{unknown ? tr('unlinked') : playerName(winner)}</b>
              <span className="text-gold signal-sm">{tr('first', { points: winner.points })}</span>
            </span>
          </span>
        ) : (
          <span className="text-ink-muted body-sm">{t('browser.row.noWinner')}</span>
        )}

        <Icon name="right" size={16} className={twMerge(LG, 'text-ink-muted')} />
      </Link>
    </li>
  )
}

/* ------------------------------------------------------------------ rail */

/** The first page in figures: entries, average field, the split by format, the biggest, the longest, a repeat winner. */
const Summary = ({ list }: { list: TournamentSummary[] }) => {
  const t = useTranslations('Tournaments.list.summary')
  const locale = useLocale()
  if (!list.length) return null

  const entries = list.reduce((sum, row) => sum + row.players, 0)
  const byFormat = [...list.reduce((map, row) => map.set(row.format, (map.get(row.format) ?? 0) + 1), new Map<string, number>())].sort((a, b) => b[1] - a[1])
  const biggest = list.reduce((best, row) => (row.players > best.players ? row : best))
  const ended = list.filter((row) => row.endedAt)
  const longest = ended.length ? ended.reduce((best, row) => (minutesBetween(row.startedAt, row.endedAt!) > minutesBetween(best.startedAt, best.endedAt!) ? row : best)) : null
  const wins = new Map<string, { name: string; count: number }>()
  for (const { winner } of list) {
    if (!winner?.name?.trim()) continue
    wins.set(winner.id, { name: winner.name, count: (wins.get(winner.id)?.count ?? 0) + 1 })
  }
  const twice = [...wins].find(([, w]) => w.count >= 2)
  const first = list[0]!
  const last = list.at(-1)!

  const row = 'flex items-center justify-between gap-3 py-3 border-b border-line last:border-0'
  return (
    <Panel tone="framed" label={t('title', { count: list.length })} className="flex flex-col gap-4.5 p-5.5">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-ink display-3">{t('title', { count: list.length })}</h3>
        <span className={META}>
          <LocalTime iso={last.startedAt} options={DAY_SHORT} /> – <LocalTime iso={first.startedAt} options={DAY_SHORT} />
        </span>
      </div>
      <div className="grid grid-cols-2 gap-px border border-line bg-line">
        <div className="flex flex-col gap-1.5 bg-surface-100 p-3.5">
          <span className={META}>{t('entries')}</span>
          <span className="text-ink stat-lg text-[32px]">{formatNumber(entries, locale)}</span>
        </div>
        <div className="flex flex-col gap-1.5 bg-surface-100 p-3.5">
          <span className={META}>{t('avgField')}</span>
          <span className="text-ink stat-lg text-[32px]">{formatDecimal(Math.round((entries / list.length) * 10) / 10, locale)}</span>
        </div>
      </div>
      <div className="flex flex-col gap-2.5">
        <span className="text-ink-muted signal">{t('byFormat')}</span>
        <span aria-hidden className="flex h-2.5 gap-0.5">
          {byFormat.map(([format, count]) => (
            <span key={format} className="block h-full" style={{ width: pct(count, list.length), background: FORMAT_COLOR[format] ?? 'var(--color-ink-muted)' }} />
          ))}
        </span>
        <span className="flex flex-wrap gap-3.5">
          {byFormat.map(([format, count]) => (
            <span key={format} className={META}>
              <span style={{ color: FORMAT_COLOR[format] ?? 'var(--color-ink-muted)' }}>■</span> {format} {count}
            </span>
          ))}
        </span>
      </div>
      <div className="flex flex-col border-t border-line">
        <div className={row}>
          <span className="text-ink-dim body-sm">{t('biggest')}</span>
          <Link href={`/tournament/${biggest.id}`} className="text-ink body-sm hover:text-cyan">
            {t('biggestValue', { id: biggest.id, players: biggest.players })}
          </Link>
        </div>
        {longest ? (
          <div className={row}>
            <span className="text-ink-dim body-sm">{t('longest')}</span>
            <Link href={`/tournament/${longest.id}`} className="text-ink body-sm hover:text-cyan">
              {t('longestValue', { id: longest.id, duration: formatDuration(longest.startedAt, longest.endedAt!) })}
            </Link>
          </div>
        ) : null}
        {twice ? (
          <div className={row}>
            <span className="text-ink-dim body-sm">{t('twice')}</span>
            <Link href={`/profile/${twice[0]}`} className="text-gold body-sm hover:text-ink">
              {twice[1].name}
            </Link>
          </div>
        ) : null}
      </div>
    </Panel>
  )
}

/* ------------------------------------------------------------------ page */

type TournamentBrowserProps = {
  /** The running tournament's page, if any. Separate from the list so the banner survives every filter. */
  live: TournamentDetail | null
  first: TournamentPage
  upcoming: CalendarEntry[]
  /** When the server read the API, ISO. */
  now: string
}

export const TournamentBrowser = ({ live, first, upcoming, now }: TournamentBrowserProps) => {
  const t = useTranslations('Tournaments')
  const tl = useTranslations('Tournaments.list')
  const locale = useLocale()
  const router = useRouter()
  const isBrowser = useSyncExternalStore(subscribe, () => true, () => false)
  const [filters, setFilters] = useState<Filters>({ format: '', banlist: '' })
  const [{ tournaments, nextCursor }, setPage] = useState(first)
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle')
  const [stats, setStats] = useState<TournamentsStats | null>(null)

  // Only the newest answer wins: clicking two filters in a row must not resurrect the first one.
  const run = useRef(0)

  /* /tournaments/stats is seconds slow when its cache is cold, so it loads after paint and only feeds the
     count, the format segments and the banlist filter — never the list itself. */
  useEffect(() => {
    const controller = new AbortController()
    getTournamentsStats({}, controller.signal)
      .then(setStats)
      .catch((error) => {
        if (!controller.signal.aborted) console.error(error)
      })
    return () => controller.abort()
  }, [])

  // While a tournament runs, the banner re-reads the page every 30 s; a hidden tab waits.
  useEffect(() => {
    if (!live) return
    const id = setInterval(() => document.visibilityState === 'visible' && router.refresh(), POLL_MS)
    return () => clearInterval(id)
  }, [live, router])

  const banlistsOf = (format: string) => (stats?.banlists ?? []).filter((row) => !format || row.format === format)

  /**
   * The API filters by banlist only. A format with one banlist maps to it; any other format is filtered in
   * the browser over the pages loaded so far.
   * ponytail: a format with several banlists shows only what the loaded pages hold; add `format` to GET /tournaments if it matters.
   */
  const query = ({ format, banlist }: Filters) => {
    const list = banlistsOf(format)
    return { banlist: banlist || (format && list.length === 1 ? list[0]!.banlist : undefined), limit: PAGE_SIZE }
  }

  const load = async (next: Filters, cursor?: string) => {
    const token = ++run.current
    setState('loading')
    try {
      const page = await listTournaments({ ...query(next), cursor })
      if (run.current !== token) return
      setPage((current) => (cursor ? { tournaments: [...current.tournaments, ...page.tournaments], nextCursor: page.nextCursor } : page))
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

  // TCG first, then the game's order; a format only the stats know goes last.
  const known = stats ? new Set(stats.banlists.map((row) => row.format)) : null
  const formats = known ? [...FORMATS.filter((f) => known.has(f)), ...[...known].filter((f) => !FORMATS.includes(f))] : FORMATS
  const visible = filters.format ? tournaments.filter((row) => row.format === filters.format) : tournaments
  const maxPlayers = Math.max(20, ...visible.map((row) => row.players))
  const today = dayOf(now, isBrowser)

  const days: { key: string; rows: TournamentSummary[] }[] = []
  for (const row of visible) {
    const key = dayOf(row.startedAt, isBrowser)
    const day = days.at(-1)
    if (day?.key === key) day.rows.push(row)
    else days.push({ key, rows: [row] })
  }

  return (
    <div className="mx-auto flex w-full max-w-page flex-col gap-8 px-gutter pt-8">
      <PageHeader
        eyebrow={t('browser.eyebrow')}
        eyebrowMeta={t('browser.eyebrowMeta')}
        title={t('browser.heading')}
        lead={t('browser.lead')}
        end={
          <>
            <Button href="/statistics" variant="secondary" size="mono-md">
              {tl('metaReport')}
            </Button>
            <Button href="/calendar" variant="secondary" size="mono-md">
              {tl('calendar')}
            </Button>
          </>
        }
      />

      {live ? <LiveBanner detail={live} now={now} /> : null}

      <section aria-label={tl('next.label')} className="flex flex-col gap-4">
        <RailHead num="01" label={tl('next.label')} stamp={tl('next.stamp')} className="px-0" />
        {upcoming.length ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {upcoming.map((entry, i) => (
              <NextCard key={`${entry.source}-${entry.id ?? entry.startsAt}-${entry.format}`} entry={entry} first={i === 0} now={now} />
            ))}
          </div>
        ) : (
          <EmptyBox title={tl('next.empty')} />
        )}
      </section>

      <div className="flex flex-wrap items-start gap-6">
        <section aria-label={tl('results.label')} className="flex min-w-0 flex-[999_1_640px] flex-col gap-4">
          <RailHead
            num="02"
            label={tl('results.label')}
            stamp={stats ? tl('results.stamp', { count: formatNumber(stats.tournaments, locale) }) : tl('results.stampNoCount')}
            className="px-0"
          />

          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav aria-label={tl('results.format')} className="inline-flex border border-line-mid">
              {['', ...formats].map((format) => {
                const on = format === filters.format
                return (
                  <button
                    key={format}
                    type="button"
                    aria-pressed={on}
                    onClick={() => apply({ format, banlist: '' })}
                    className={twMerge(
                      'inline-flex h-9 cursor-pointer items-center border-r border-line-mid px-3.5 signal-strong last:border-r-0',
                      on ? 'bg-ground-cyan text-ink shadow-tab-active' : 'text-ink-muted hover:text-ink',
                    )}
                  >
                    {format || tl('results.all')}
                  </button>
                )
              })}
            </nav>
            <Select
              prefix={t('browser.banlist')}
              banlist
              options={[{ value: '', label: t('browser.allBanlists') }, ...banlistsOf(filters.format).map((row) => ({ value: row.banlist, label: banlistLabel(row) }))]}
              value={filters.banlist}
              onChange={(e) => apply({ ...filters, banlist: e.target.value })}
            />
          </div>

          <div aria-hidden className={twMerge(ROW, 'py-0 max-lg:hidden', META)}>
            <span>{tl('results.columns.id')}</span>
            <span>{tl('results.columns.format')}</span>
            <span>{tl('results.columns.field')}</span>
            <span>{tl('results.columns.when')}</span>
            <span>{tl('results.columns.winner')}</span>
            <span />
          </div>

          {days.length ? (
            days.map(({ key, rows }) => {
              const liveCount = rows.filter((row) => row.status === 'live').length
              return (
                <div key={key} className="flex flex-col gap-2">
                  <div className="flex items-center gap-3 pt-2">
                    <span className="text-ink-dim signal-strong">
                      <LocalTime iso={rows[0]!.startedAt} options={DAY} />
                      {key === today ? ` · ${tl('results.today')}` : ''}
                    </span>
                    <span aria-hidden className="h-px flex-1 bg-line" />
                    <span className={META}>{liveCount ? tl('results.dayLive', { count: liveCount }) : tl('results.dayCount', { count: rows.length })}</span>
                  </div>
                  <ol aria-busy={state === 'loading'} className="flex flex-col gap-px border border-line bg-line">
                    {rows.map((row) => (
                      <Row key={row.id} tournament={row} live={live} now={now} maxPlayers={maxPlayers} />
                    ))}
                  </ol>
                </div>
              )
            })
          ) : (
            <EmptyBox title={t('browser.emptyTitle')}>{t('browser.emptyBanlist')}</EmptyBox>
          )}

          {state === 'error' ? (
            <p role="alert" className="text-loss body-sm">
              {t('browser.error')}
            </p>
          ) : null}

          {nextCursor ? (
            <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
              <Button variant="secondary" size="mono-md" onClick={() => load(filters, nextCursor)} disabled={state === 'loading'}>
                {state === 'loading' ? t('browser.loading') : tl('results.loadMore', { count: PAGE_SIZE })}
              </Button>
              <span className={META}>{tl('results.showing', { count: tournaments.length, cursor: nextCursor })}</span>
            </div>
          ) : null}
        </section>

        <aside aria-label={tl('summary.label')} className="flex min-w-0 flex-[1_1_320px] flex-col gap-6">
          <Summary list={first.tournaments} />

          <Panel tone="framed" label={tl('report.label')} className="flex flex-col gap-3.5 p-5.5">
            <span className="text-cyan signal">{tl('report.label')}</span>
            <h3 className="text-ink display-3">{tl('report.title', { banlist: mostCommonBanlist(first.tournaments) ?? t('browser.allBanlists') })}</h3>
            <p className="m-0 text-ink-dim body-sm">{tl('report.body')}</p>
            <Button href="/statistics" variant="secondary" size="mono" className="self-start">
              {tl('report.open')}
            </Button>
          </Panel>

          <AdBanner id="ad-rail" placement="aside" />
        </aside>
      </div>
    </div>
  )
}

/** The banlist most of the first page ran on: what the meta report reads best for right now. */
const mostCommonBanlist = (list: TournamentSummary[]) => {
  const counts = new Map<string, { row: TournamentSummary; count: number }>()
  for (const row of list) counts.set(row.banlist, { row, count: (counts.get(row.banlist)?.count ?? 0) + 1 })
  const best = [...counts.values()].sort((a, b) => b.count - a.count)[0]
  return best ? banlistLabel(best.row) : null
}
