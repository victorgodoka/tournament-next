'use client'

import { useId, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { twMerge } from "tailwind-merge";
import { Avatar } from "@ui/avatar";
import { Button } from "@ui/button";
import { Icon } from "@ui/icon";
import { ResultPill } from "@ui/result";
import { TabBar, tabPanelProps } from "@ui/tab-bar";
import { CardArt } from "@omega/card-art";
import { LocalTime } from "@omega/profile/local-time";
import { getMatches, ProfileApiError } from "@utils/profile";
import type { Match, MatchPage } from "@utils/types";
import { ANALYTICS_ENABLED } from "@utils/const";

/** Own chunk, fetched on the first open: never downloaded while analytics is off. */
const MatchAnalytics = dynamic(() => import("@omega/analytics/match-analytics").then((m) => m.MatchAnalytics));

/** `all` is the embedded page; the other two are one ranked ladder each. History is ranked only. */
const TABS = [
  { id: 'all', label: 'All' },
  { id: 'tcg', label: 'TCG' },
  { id: 'genesys', label: 'Genesys' },
] as const

type Tab = (typeof TABS)[number]['id']

const WORD = { W: 'Win', L: 'Loss', D: 'Draw' }
const WHEN: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }

/**
 * One duel. `win: null` is a draw or unfinished duel, never a loss. Clicking the row (anywhere but
 * a link) opens the duel's timeline and statistics under it; mounted on first open, then kept.
 */
const DuelRow = ({ match }: { match: Match }) => {
  const result = match.win === null ? 'D' : match.win ? 'W' : 'L'
  const opponent = match.opponent.name || 'Unknown duelist'
  const panelId = useId()
  const [open, setOpen] = useState(false)
  const [mounted, setMounted] = useState(false)
  const toggle = () => {
    if (!ANALYTICS_ENABLED) return
    setMounted(true)
    setOpen((current) => !current)
  }

  return (
    <div role="listitem" className="bg-surface-100">
      <div
        onClick={(e) => !(e.target as HTMLElement).closest('a, button') && toggle()}
        className={twMerge(
          ANALYTICS_ENABLED && "cursor-pointer",
          "grid grid-cols-[22px_56px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-sm text-ink-dim transition-colors hover:bg-surface-300 md:grid-cols-[22px_88px_minmax(0,1fr)_132px_124px] md:gap-5",
          open && "bg-surface-200",
        )}
      >
        <ResultPill result={result} />
        <span className="text-center font-display text-2xl leading-none whitespace-nowrap text-ink tabular-nums">
          {match.score.self} – {match.score.opponent}
        </span>
        <div className="flex min-w-0 items-center gap-3">
          <Avatar name={opponent} src={match.opponent.avatar} cosmetics={match.opponent.cosmetics} size="sm" />
          <div className="min-w-0">
            <Link href={`/profile/${match.opponent.id}`} className="block truncate font-bold text-ink no-underline hover:text-cyan">
              <span className="sr-only">versus </span>{opponent}
            </Link>
            <span className="block text-xs leading-4 text-ink-muted">{WORD[result]} · {match.format}</span>
          </div>
        </div>
        <div className="flex gap-1 max-md:hidden" aria-label={match.self.cards.length ? `Deck: ${match.self.cards.map((c) => c.name ?? 'Unknown card').join(', ')}` : undefined}>
          {match.self.cards.map((card) => (
            <Link key={card.id} href={`/wiki/card/${card.id}`} title={card.name ?? undefined}>
              <CardArt art={card} alt={card.name ?? ''} sizes="32px" className="h-11.5 w-8 rounded-xs border border-line-mid bg-surface-200 hover:border-cyan" />
            </Link>
          ))}
        </div>
        <span className="flex items-center justify-end gap-2 font-mono text-[10px] leading-3 tracking-[0.14em] whitespace-nowrap text-ink-muted uppercase">
          {match.when ? <LocalTime iso={match.when} options={WHEN} /> : '—'}
          {ANALYTICS_ENABLED ? (
            <>
              <Icon name="down" className={twMerge("motion-safe:transition-transform", open ? "rotate-180 text-ink" : "")} />
              <button type="button" aria-expanded={open} aria-controls={panelId} onClick={toggle} className="sr-only focus:not-sr-only focus:ml-2">
                {open ? 'Hide duel' : 'Timeline & stats'}
              </button>
            </>
          ) : null}
        </span>
      </div>
      {mounted ? (
        <div id={panelId} role="region" aria-label={`Duel against ${opponent}`} hidden={!open} className="border-t border-line px-4 py-5 lg:px-8 lg:py-7">
          <MatchAnalytics matchId={match.id} opponentId={match.opponent.id} />
        </div>
      ) : null}
    </div>
  )
}

export const MatchHistory = ({ profileId, ...firstPage }: MatchPage & { profileId: string }) => {
  const router = useRouter()
  const idPrefix = useId()
  const [tab, setTab] = useState<Tab>('all')
  const [{ matches, nextCursor }, setPage] = useState(firstPage)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  // Only the newest request may write: switching tab mid-load must not append a stale page.
  const requestId = useRef(0)

  const load = async (format: Tab, cursor?: string) => {
    const id = ++requestId.current
    setStatus('loading')
    try {
      const page = await getMatches(profileId, { cursor, format: format === 'all' ? undefined : format })
      if (id !== requestId.current) return
      setPage((current) => (cursor ? { matches: [...current.matches, ...page.matches], nextCursor: page.nextCursor } : page))
      setStatus('idle')
    } catch (error) {
      if (id !== requestId.current) return
      // Went private for this viewer mid-session: re-render the profile from the server.
      if (error instanceof ProfileApiError && error.status === 403) return router.refresh()
      console.error(error)
      setStatus('error')
    }
  }

  const selectTab = (next: Tab) => {
    if (next === tab) return
    setTab(next)
    // The embedded page already is the unfiltered newest duels, so going back needs no request.
    if (next === 'all') {
      requestId.current++
      setPage(firstPage)
      setStatus('idle')
      return
    }
    setPage({ matches: [], nextCursor: null })
    load(next)
  }

  const isLoading = status === 'loading'

  return (
    <>
      <TabBar label="Ladder" idPrefix={idPrefix} tabs={TABS} active={tab} onSelect={selectTab} />

      <div {...tabPanelProps(idPrefix, tab)}>
        {matches.length ? (
          <div role="list" aria-label="Recent ranked duels" className="flex flex-col gap-px border border-line bg-line">
            {matches.map((match) => <DuelRow key={match.id} match={match} />)}
          </div>
        ) : (
          <p className="border border-line bg-surface-100 px-4 py-8 text-center text-sm text-ink-muted">
            {isLoading ? 'Loading duels…' : 'No ranked duels recorded yet.'}
          </p>
        )}
      </div>

      {/* `nextCursor === null` is the only stop condition the API gives. */}
      {nextCursor ? (
        <div className="flex flex-col items-center gap-2 pt-2">
          <Button variant="secondary" onClick={() => load(tab, nextCursor)} disabled={isLoading}>
            <Icon name="down" />
            {isLoading ? 'Loading…' : 'Load older duels'}
          </Button>
          {status === 'error' ? <p role="alert" className="text-sm text-loss">Couldn&apos;t load older duels. Try again.</p> : null}
        </div>
      ) : null}
    </>
  )
}
