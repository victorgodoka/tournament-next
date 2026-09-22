'use client'

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MatchLedgerHead, MatchRow } from "@omega/profile/match-row";
import { formatNumber } from "@omega/profile/labels";
import { EmptyBox } from "@omega/profile/empty-box";
import { SectionHead } from "@ui/section-head";
import { TabBar, tabPanelProps } from "@ui/tab-bar";
import { buttonClasses } from "@ui/button";
import { getMatches, ProfileApiError } from "@utils/profile";
import type { MatchPage } from "@utils/types";

type MatchHistoryProps = MatchPage & {
  num: string
  profileId: string
  /** Total duels the profile reports, used for the caption. */
  duelsPlayed: number
}

/** `all` is the embedded page; the other two are one ranked ladder each. History is ranked only. */
const TABS = [
  { id: 'all', label: 'All' },
  { id: 'tcg', label: 'TCG' },
  { id: 'genesys', label: 'Genesys' },
] as const

type Tab = (typeof TABS)[number]['id']

export const MatchHistory = ({ num, profileId, duelsPlayed, ...firstPage }: MatchHistoryProps) => {
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
    <section id="history" className="pt-section">
      <SectionHead num={num}>Match history</SectionHead>
      <p className="mt-2 text-ink-muted signal-sm">
        {formatNumber(matches.length)} {tab === 'all' ? `of ${formatNumber(duelsPlayed)} ` : ''}duels
      </p>

      <TabBar
        label="Ladder"
        idPrefix={idPrefix}
        tabs={TABS}
        active={tab}
        onSelect={selectTab}
        className="mt-4 max-w-130"
      />

      <div {...tabPanelProps(idPrefix, tab)}>
        {matches.length === 0 ? (
          isLoading ? (
            <p className="mt-3.5 text-ink-muted signal-sm">Loading duels…</p>
          ) : (
            <EmptyBox title="No duels recorded" className="mt-3.5">
              Duels appear here the moment the first one ends, with both decks shown card by card.
            </EmptyBox>
          )
        ) : (
          <div className="mt-3.5 border border-line">
            <MatchLedgerHead />
            <ul>
              {matches.map((match) => (
                <MatchRow key={match.id} match={match} />
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* `nextCursor === null` is the only stop condition the API gives. */}
      {nextCursor ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => load(tab, nextCursor)}
            disabled={isLoading}
            className={buttonClasses({ variant: 'ghost', size: 'sm' })}
          >
            {isLoading ? 'Loading…' : 'Load older duels'}
          </button>
          {status === 'error' ? (
            <p role="alert" className="text-gold body-sm">Couldn&apos;t load older duels. Try again.</p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
