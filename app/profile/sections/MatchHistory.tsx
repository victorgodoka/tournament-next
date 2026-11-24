'use client'

import { Fragment, useId, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { twMerge } from "tailwind-merge";
import { AdBanner } from "@omega/ads/ad-banner";
import { Button } from "@ui/button";
import { Select } from "@ui/field";
import { Icon } from "@ui/icon";
import { ResultPill, type Result } from "@ui/result";
import { TabBar, tabPanelProps } from "@ui/tab-bar";
import { DeckArt } from "@omega/profile/deck-art";
import { dayKey, DAY_MS, useNow } from "@omega/profile/use-now";
import { formatNumber, formatRecord, WINDOW_LABEL } from "@omega/profile/labels";
import { getMatches, ProfileApiError } from "@utils/profile";
import type { EloDay, Match, MatchPage, MatchWindow, TimelineEvent } from "@utils/types";
import { CAPTION, ordinal } from "./Ladders";

/** Own chunk, fetched on the first open: never downloaded while analytics is off. */
const MatchAnalytics = dynamic(() => import("@omega/analytics/match-analytics").then((m) => m.MatchAnalytics));

/** `all` is the embedded page; the other two are one ranked ladder each. History is ranked only. */
const TABS = [
  { id: 'all', label: 'All' },
  { id: 'tcg', label: 'TCG' },
  { id: 'genesys', label: 'Genesys' },
] as const

type Tab = (typeof TABS)[number]['id']

/** How many duels come before the in-feed ad. */
const AD_AFTER = 5

const subscribe = () => () => {}
const useIsBrowser = () => useSyncExternalStore(subscribe, () => true, () => false)

/** Duels are grouped by UTC day: the elo of a day (`eloDays`) is the daily sync's, which runs in UTC. */
const utcDay = (iso: string) => iso.slice(0, 10)
const TIME: Intl.DateTimeFormatOptions = { hour: '2-digit', minute: '2-digit' }
const SHORT: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }

const resultOf = (match: Match): Result => (match.win === null ? 'D' : match.win ? 'W' : 'L')
const ladderOf = (match: Match) => (match.format.startsWith('Genesys') ? 'Genesys' : 'TCG')

/** "Yesterday · Mon 2 Nov". Today / Yesterday only in the browser, which knows what day it is. */
const DayLabel = ({ day }: { day: string }) => {
  const now = useNow()
  const short = new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', SHORT)
  if (now === null) return <>{short}</>
  return <>{day === dayKey(now, 'UTC') ? `Today · ${short}` : day === dayKey(now - DAY_MS, 'UTC') ? `Yesterday · ${short}` : short}</>
}

/** Time of day in the reader's zone; the server renders UTC and the browser swaps it in. */
const Clock = ({ iso }: { iso: string }) => {
  const isBrowser = useIsBrowser()
  return <time dateTime={iso}>{new Date(iso).toLocaleTimeString('en-GB', isBrowser ? TIME : { ...TIME, timeZone: 'UTC' })}</time>
}

/** "Today 21:14", "Sun 1 Nov": the plain list's date column. */
const When = ({ iso }: { iso: string }) => {
  const now = useNow()
  const date = new Date(iso)
  const zone = now === null ? { timeZone: 'UTC' } : {}
  const day = dayKey(date)
  const time = date.toLocaleTimeString('en-GB', { ...TIME, ...zone })
  return (
    <time dateTime={iso}>
      {now !== null && day === dayKey(now) ? `Today ${time}` : now !== null && day === dayKey(now - DAY_MS) ? 'Yesterday' : date.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', ...zone })}
    </time>
  )
}

/* ── One duel ── */

const Side = ({ cards, hidden, title, sub, href }: { cards: Match['self']['cards']; hidden?: boolean; title: string; sub: string; href?: string }) => (
  <div className="flex min-w-0 items-center gap-3">
    <DeckArt cards={cards} hidden={hidden} />
    <div className="min-w-0">
      {href ? (
        <Link href={href} className="block truncate font-bold text-ink no-underline hover:text-cyan">{title}</Link>
      ) : (
        <b className="block truncate font-bold text-ink">{title}</b>
      )}
      <span className="block truncate text-xs leading-4 text-ink-muted">{sub}</span>
    </div>
  </div>
)

/**
 * A duel from the owner's side: their deck vs the opponent's. `win: null` is a draw, never a loss.
 * With `timeline`, the row opens the play-by-play and stats under it; mounted on first open, then kept.
 */
const DuelRow = ({ match, time }: { match: Match; time: 'clock' | 'date' }) => {
  const result = resultOf(match)
  const opponent = match.opponent.name || 'Unknown duelist'
  const selfDeck = match.self.deckHidden ? 'Hidden deck' : match.self.deck ?? 'Unknown deck'
  const opponentDeck = match.opponent.deck ?? 'Unknown deck'
  const panelId = useId()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const toggle = () => {
    if (!match.timeline) return
    setMounted(true)
    setOpen((current) => !current)
  }
  const score = `${match.score.self} – ${match.score.opponent}`
  const when = match.when ? (time === 'clock' ? <Clock iso={match.when} /> : <When iso={match.when} />) : '—'
  const ladder = ladderOf(match)

  return (
    <div role="listitem" className="bg-surface-100">
      <div
        onClick={(e) => !(e.target as HTMLElement).closest('a, button') && toggle()}
        className={twMerge('text-sm text-ink-dim transition-colors hover:bg-surface-300', match.timeline && 'cursor-pointer', open && 'bg-surface-200')}
      >
        <div className="grid grid-cols-[22px_64px_minmax(0,1fr)_28px_minmax(0,1fr)_96px] items-center gap-4 px-4 py-2.5 max-md:hidden">
          <ResultPill result={result} />
          <span className="text-center font-display text-[22px] leading-none whitespace-nowrap text-ink tabular-nums">{score}</span>
          <Side cards={match.self.cards} hidden={match.self.deckHidden} title={selfDeck} sub={match.format} />
          <span className={twMerge(CAPTION, 'text-center')}>vs</span>
          <Side cards={match.opponent.cards} title={opponent} sub={opponentDeck} href={`/profile/${match.opponent.id}`} />
          <span className={twMerge(CAPTION, 'flex items-center justify-end gap-2 text-right whitespace-nowrap')}>
            {when}
            {match.timeline ? <Icon name="down" className={twMerge('motion-safe:transition-transform', open ? 'rotate-180 text-ink' : '')} /> : null}
          </span>
        </div>
        <div className="grid grid-cols-[22px_44px_44px_44px_minmax(0,1fr)] items-center gap-2 px-3 py-2.5 md:hidden">
          <ResultPill result={result} />
          <DeckArt cards={match.self.cards} hidden={match.self.deckHidden} size="sm" />
          <span className="text-center font-display text-lg leading-none whitespace-nowrap text-ink">{score}</span>
          <DeckArt cards={match.opponent.cards} size="sm" />
          <div className="min-w-0">
            <Link href={`/profile/${match.opponent.id}`} className="block truncate text-sm font-bold text-ink no-underline">{opponent}</Link>
            <small className="block truncate text-xs leading-4 text-ink-muted">{when} · {ladder}</small>
          </div>
        </div>
        {match.timeline ? (
          <button type="button" aria-expanded={open} aria-controls={panelId} onClick={toggle} className="sr-only focus:not-sr-only focus:m-2">
            {open ? 'Hide duel' : 'Timeline & stats'}
          </button>
        ) : null}
      </div>
      {mounted ? (
        <div id={panelId} role="region" aria-label={`Duel against ${opponent}`} hidden={!open} className="border-t border-line px-4 py-5 lg:px-8 lg:py-7">
          <MatchAnalytics matchId={match.id} opponentId={match.opponent.id} />
        </div>
      ) : null}
    </div>
  )
}

/* ── Timeline ── */

type Item = { kind: 'duel'; key: string; at: string; match: Match } | { kind: 'event'; key: string; at: string; event: TimelineEvent }

const atOf = (event: TimelineEvent) => ('day' in event ? `${event.day}T23:59:59.999Z` : event.at)
const dayOfEvent = (event: TimelineEvent) => ('day' in event ? event.day : utcDay(event.at))

const EVENT_LADDER = { TCG: 'TCG', Genesys: 'Genesys' } as const

const eventText = (event: TimelineEvent, first: string): { icon: 'trophy' | 'star' | 'calendar'; title: string; sub: string; highlight: boolean; time?: string } => {
  switch (event.kind) {
    case 'tier':
      return {
        icon: 'trophy',
        title: event.direction === 'up' ? `Promoted to ${event.to}` : `Dropped to ${event.to}`,
        sub: `${EVENT_LADDER[event.ladder]} ladder · ${event.from} → ${event.to} · ${formatNumber(event.elo)} Glicko-2`,
        highlight: event.direction === 'up',
      }
    case 'tournament': {
      const podium = event.standing.rank <= 3
      return {
        icon: 'star',
        title: `${ordinal(event.standing.rank)} in Tournament #${event.tournament.id}`,
        sub: `${event.tournament.format} · Swiss · ${formatRecord(event.standing)} · ${formatNumber(event.tournament.players)} players`,
        highlight: podium,
        time: event.at,
      }
    }
    case 'season': {
      const s = event.standing
      const result = s ? [s.rank != null ? `Final #${formatNumber(s.rank)}` : null, s.tier ?? null, formatRecord(s)].filter(Boolean).join(' · ') : `${first} didn't play it`
      return event.phase === 'start'
        ? { icon: 'calendar', title: `${EVENT_LADDER[event.ladder]} ${event.label} opened`, sub: 'Ratings reset for the new season', highlight: false, time: event.at }
        : { icon: 'calendar', title: `${EVENT_LADDER[event.ladder]} ${event.label} closed`, sub: result, highlight: false, time: event.at }
    }
  }
}

const EventRow = ({ event, first }: { event: TimelineEvent; first: string }) => {
  const text = eventText(event, first)
  return (
    <div
      className={twMerge(
        'cut my-1.5 flex items-center gap-3.5 px-4 py-3 [--cut:var(--cut-sm)] [--edge:var(--color-line-mid)] [--fill:var(--color-surface-200)] max-md:gap-3 max-md:px-3 max-md:py-2.5',
        text.highlight && '[--edge:var(--color-gold)]',
      )}
    >
      <Icon name={text.icon} size={20} className={text.highlight ? 'text-gold' : 'text-ink-muted'} />
      <div className="flex min-w-0 flex-col gap-0.5">
        <b className={twMerge('font-bold max-md:text-sm', text.highlight ? 'text-gold' : 'text-ink')}>
          {event.kind === 'tournament' ? <Link href={`/tournament/${event.tournament.id}`} className="no-underline hover:underline">{text.title}</Link> : text.title}
        </b>
        <span className="text-sm text-ink-dim max-md:text-xs">{text.sub}</span>
      </div>
      {text.time ? <span className={twMerge(CAPTION, 'ml-auto max-md:hidden')}><Clock iso={text.time} /></span> : null}
    </div>
  )
}

const Axis = ({ dot }: { dot?: 'duel' | 'event' | 'muted' }) => (
  <div className="relative before:absolute before:top-0 before:bottom-0 before:left-[15px] before:w-0.5 before:bg-line max-md:before:left-2">
    {dot ? (
      <span
        className={twMerge(
          'absolute top-1/2 left-2.5 -mt-1.5 size-3 border-2 max-md:left-1 max-md:-mt-1.25 max-md:size-2.5',
          dot === 'duel' && 'border-line-mid bg-space-000',
          dot === 'event' && 'rotate-45 border-gold bg-gold',
          dot === 'muted' && 'rotate-45 border-line-strong bg-line-mid',
        )}
      />
    ) : null}
  </div>
)

const ROW = 'grid grid-cols-[32px_minmax(0,1fr)] items-stretch max-md:grid-cols-[20px_minmax(0,1fr)]'

const DayHead = ({ day, matches, deltas }: { day: string; matches: Match[]; deltas: EloDay[] }) => {
  const count = { W: 0, L: 0, D: 0 }
  for (const match of matches) count[resultOf(match)]++
  const summary = (['W', 'L', 'D'] as const).filter((r) => count[r]).map((r) => `${count[r]} ${r}`).join(' · ')
  return (
    <div className={ROW}>
      <Axis />
      <div className="flex items-center gap-3 pt-5 pb-2.5 max-md:gap-2.5 max-md:pt-4.5 max-md:pb-2">
        <span className="title text-[16px] leading-none max-md:text-[15px]"><DayLabel day={day} /></span>
        {summary ? <span className={twMerge(CAPTION, 'max-md:hidden')}>{summary}</span> : null}
        <span aria-hidden className="h-px grow bg-line" />
        {deltas.map((d) => (
          <span key={d.ladder} className="flex items-baseline gap-1.5" title={`${d.ladder}: ${formatNumber(d.elo)} Glicko-2 at the end of the day`}>
            {deltas.length > 1 ? <span className={CAPTION}>{d.ladder === 'Genesys' ? 'GEN' : 'TCG'}</span> : null}
            <span className={twMerge('font-display text-lg leading-none tabular-nums max-md:text-base', d.delta > 0 ? 'text-win' : d.delta < 0 ? 'text-loss' : 'text-draw')}>
              {d.delta > 0 ? '+' : d.delta < 0 ? '−' : '±'}{formatNumber(Math.abs(d.delta))}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}

/** Duels and events of every loaded page, grouped by UTC day, newest first. */
const Timeline = ({ matches, events, eloDays, first, ladder }: { matches: Match[]; events: TimelineEvent[]; eloDays: EloDay[]; first: string; ladder: 'TCG' | 'Genesys' | null }) => {
  const items: Item[] = [
    ...matches.map((match): Item => ({ kind: 'duel', key: match.id, at: match.when ?? '', match })),
    ...events.map((event): Item => ({ kind: 'event', key: event.id, at: atOf(event), event })),
  ].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))

  const days = new Map<string, Item[]>()
  for (const item of items) {
    const day = item.kind === 'event' ? dayOfEvent(item.event) : item.at ? utcDay(item.at) : 'unknown'
    days.set(day, [...(days.get(day) ?? []), item])
  }

  return (
    <div role="list" aria-label="Duel and event timeline" className="flex flex-col">
      {[...days].map(([day, list]) => (
        <Fragment key={day}>
          <DayHead
            day={day}
            matches={list.flatMap((item) => (item.kind === 'duel' ? [item.match] : []))}
            deltas={eloDays.filter((d) => d.day === day && (ladder === null || d.ladder === ladder))}
          />
          {list.map((item) => (
            <div key={item.key} className={ROW}>
              <Axis dot={item.kind === 'duel' ? 'duel' : eventText(item.event, first).highlight ? 'event' : 'muted'} />
              {item.kind === 'duel' ? (
                <div className="border-b border-line"><DuelRow match={item.match} time="clock" /></div>
              ) : (
                <div role="listitem"><EventRow event={item.event} first={first} /></div>
              )}
            </div>
          ))}
        </Fragment>
      ))}
    </div>
  )
}

/** Plain list with the in-feed ad after the 5th duel (shown only to viewers who see ads). */
const DuelList = ({ matches }: { matches: Match[] }) => {
  const groups = [matches.slice(0, AD_AFTER), matches.slice(AD_AFTER)].filter((g) => g.length)
  return groups.map((group, i) => (
    <Fragment key={i}>
      {i ? <AdBanner id="ad-history" placement="content" /> : null}
      <div role="list" aria-label={i ? 'More ranked duels' : 'Recent ranked duels'} className="flex flex-col gap-px border border-line bg-line">
        {group.map((match) => <DuelRow key={match.id} match={match} time="date" />)}
      </div>
    </Fragment>
  ))
}

/* ── The section ── */

type SeasonOption = { code: string; label: string; ladder: Exclude<Tab, 'all'>; open: boolean }

type MatchHistoryProps = Partial<MatchPage> & {
  profileId: string
  /** First name for the copy ("Yami's newest duels…"). */
  first: string
  vip: boolean
  matchWindow: MatchWindow | null
  delayed: boolean
  /** Seasons the history can be filtered by (`view.pastSeasonMatches`); empty hides the picker. */
  seasons: SeasonOption[]
  asVisitor?: boolean
}

const keyed = <T extends { id: string } | { day: string; ladder: string }>(list: T[]) => {
  const seen = new Map<string, T>()
  for (const item of list) seen.set('id' in item ? item.id : `${item.day}|${item.ladder}`, item)
  return [...seen.values()]
}

export const MatchHistory = ({ profileId, first, vip, matchWindow, delayed, seasons, asVisitor, ...firstPage }: MatchHistoryProps) => {
  const router = useRouter()
  const idPrefix = useId()
  const initial = { matches: firstPage.matches ?? [], nextCursor: firstPage.nextCursor ?? null, events: firstPage.events ?? [], eloDays: firstPage.eloDays ?? [] }
  const [tab, setTab] = useState<Tab>('all')
  const [season, setSeason] = useState('')
  const [page, setPage] = useState(initial)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  // Only the newest request may write: switching tab mid-load must not append a stale page.
  const requestId = useRef(0)

  const load = async (nextTab: Tab, nextSeason: string, cursor?: string) => {
    const id = ++requestId.current
    setStatus('loading')
    try {
      const got = await getMatches(profileId, { cursor, format: nextTab === 'all' ? undefined : nextTab, season: nextSeason || undefined, asVisitor })
      if (id !== requestId.current) return
      setPage((current) =>
        cursor
          ? {
              matches: [...current.matches, ...got.matches],
              nextCursor: got.nextCursor,
              events: keyed([...current.events, ...(got.events ?? [])]),
              eloDays: keyed([...current.eloDays, ...(got.eloDays ?? [])]),
            }
          : { matches: got.matches, nextCursor: got.nextCursor, events: got.events ?? [], eloDays: got.eloDays ?? [] },
      )
      setStatus('idle')
    } catch (error) {
      if (id !== requestId.current) return
      // Went private for this viewer mid-session: re-render the profile from the server.
      if (error instanceof ProfileApiError && error.status === 403) return router.refresh()
      console.error(error)
      setStatus('error')
    }
  }

  const select = (nextTab: Tab, nextSeason: string) => {
    if (nextTab === tab && nextSeason === season) return
    setTab(nextTab)
    setSeason(nextSeason)
    // The embedded page already is the unfiltered newest duels, so going back needs no request.
    if (nextTab === 'all' && !nextSeason) {
      requestId.current++
      setPage(initial)
      setStatus('idle')
      return
    }
    setPage({ matches: [], nextCursor: null, events: [], eloDays: [] })
    load(nextTab, nextSeason)
  }

  const isLoading = status === 'loading'
  const ladder = tab === 'all' ? null : tab === 'tcg' ? 'TCG' : 'Genesys'
  const shownSeasons = seasons.filter((s) => tab === 'all' || s.ladder === tab)
  const picker = shownSeasons.length > 1 || shownSeasons.some((s) => !s.open) ? (
    <Select
      aria-label="History season"
      value={season}
      onChange={(e) => {
        const picked = seasons.find((s) => s.code === e.target.value)
        select(picked ? picked.ladder : tab, e.target.value)
      }}
      options={[
        { value: '', label: matchWindow ? WINDOW_LABEL[matchWindow] : 'All duels' },
        ...shownSeasons.map((s) => ({ value: s.code, label: `${tab === 'all' ? `${s.ladder === 'tcg' ? 'TCG' : 'Genesys'} · ` : ''}${s.label}${s.open ? ' · open' : ''}` })),
      ]}
    />
  ) : null

  const tabs = <TabBar label="Ladder" idPrefix={idPrefix} tabs={TABS} active={tab} onSelect={(next) => select(next, '')} />
  const empty = isLoading ? 'Loading duels…' : 'No ranked duels in this range.'

  return (
    <>
      {picker ? (
        <div className="flex items-end gap-4 max-md:flex-col max-md:items-stretch">
          <div className="grow">{tabs}</div>
          {picker}
        </div>
      ) : tabs}

      {vip && (matchWindow || delayed) ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border border-line bg-surface-100 px-3.5 py-2.5 max-md:flex-col max-md:items-start">
          <span className="flex items-center gap-4">
            <Icon name="history" size={16} className="text-gold max-md:hidden" />
            <span className={twMerge(CAPTION, 'text-ink-dim')}>{matchWindow ? WINDOW_LABEL[matchWindow] : 'All duels'}</span>
            {delayed ? <><span className={CAPTION}>·</span><span className={twMerge(CAPTION, 'text-ink-dim')}>Shown 24 h late</span></> : null}
          </span>
          {delayed ? <span className="text-[13px] text-ink-muted md:ml-auto">{first}&apos;s newest duels appear here a day after they&apos;re played.</span> : null}
        </div>
      ) : null}

      <div {...tabPanelProps(idPrefix, tab)} className="flex flex-col gap-5">
        {page.matches.length || page.events.length ? (
          vip ? (
            <Timeline matches={page.matches} events={page.events} eloDays={page.eloDays} first={first} ladder={ladder} />
          ) : (
            <DuelList matches={page.matches} />
          )
        ) : (
          <p className="border border-line bg-surface-100 px-4 py-8 text-center text-sm text-ink-muted">{empty}</p>
        )}
      </div>

      {/* `nextCursor === null` is the only stop condition the API gives. */}
      <div className="flex flex-col items-center gap-2.5 pt-2">
        {page.nextCursor ? (
          <Button variant="secondary" className="max-md:w-full" onClick={() => load(tab, season, page.nextCursor!)} disabled={isLoading}>
            <Icon name="down" />
            {isLoading ? 'Loading…' : vip ? 'Load older duels' : 'Load more'}
          </Button>
        ) : !vip && matchWindow && page.matches.length ? (
          <span className="text-[13px] text-ink-muted">Duels older than {matchWindow.replace('d', '')} days aren&apos;t shown.</span>
        ) : null}
        {status === 'error' ? <p role="alert" className="text-sm text-loss">Couldn&apos;t load older duels. Try again.</p> : null}
      </div>
    </>
  )
}

/** The owner hides the whole history from this viewer. */
export const HistoryHidden = ({ first }: { first: string }) => (
  <section aria-label="Duel history hidden" className="cut notch [--cut:var(--cut-lg)] [--edge:var(--color-line)] [--fill:var(--color-space-000)]">
    <div className="flex flex-col items-center gap-3 bg-[radial-gradient(rgba(142,166,199,0.16)_1px,transparent_1.5px)] bg-size-[24px_24px] px-6 py-12 text-center">
      <svg viewBox="0 0 24 24" width={32} height={32} aria-hidden className="fill-line-strong">
        <path fillRule="evenodd" d="M7 10V7a5 5 0 0 1 10 0v3h2v11H5V10zm2 0h6V7a3 3 0 0 0-6 0zm2 4v4h2v-4z" />
      </svg>
      <h3 className="display-3">Duel history is private</h3>
      <p className="max-w-[44ch] text-sm leading-5.25 text-ink-dim">{first}&apos;s ladders and tournaments are still on this page.</p>
    </div>
  </section>
)

export type { SeasonOption }
