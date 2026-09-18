'use client'

import { useState } from "react";
import { useRouter } from "next/navigation";
import { MatchRow } from "@omega/profile";
import { formatNumber } from "@omega/profile/labels";
import { buttonClasses } from "@ui/button";
import { RailHead } from "@ui/rail-head";
import { getMatches, ProfileApiError } from "@utils/profile";
import type { MatchPage } from "@utils/types";

type MatchHistoryProps = MatchPage & {
  profileId: string
  /** Total duels the profile reports, used for the rail caption. */
  duelsPlayed: number
}

export const MatchHistory = ({ profileId, duelsPlayed, ...firstPage }: MatchHistoryProps) => {
  const router = useRouter()
  const [{ matches, nextCursor }, setPage] = useState(firstPage)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')

  const loadOlder = async () => {
    if (!nextCursor) return
    setStatus('loading')
    try {
      const page = await getMatches(profileId, nextCursor)
      setPage((current) => ({ matches: [...current.matches, ...page.matches], nextCursor: page.nextCursor }))
      setStatus('idle')
    } catch (error) {
      // Went private for this viewer mid-session: re-render the profile from the server.
      if (error instanceof ProfileApiError && error.status === 403) return router.refresh()
      console.error(error)
      setStatus('error')
    }
  }

  return (
    <section id="history">
      <RailHead num="02" label="Match history" stamp={`${matches.length} of ${formatNumber(duelsPlayed)} duels`} />

      {matches.map((match) => (
        <MatchRow key={match.id} match={match} />
      ))}

      {nextCursor ? (
        <div className="flex flex-col items-center gap-3 border-t border-b border-line border-b-line-strong px-5.5 py-9 lg:px-11">
          <button
            type="button"
            onClick={loadOlder}
            disabled={status === 'loading'}
            className={buttonClasses({ variant: 'secondary' })}
          >
            {status === 'loading' ? 'Loading…' : 'Load older duels'}
          </button>
          {status === 'error' ? (
            <p role="alert" className="text-gold signal-nav">Couldn&apos;t load older duels. Try again.</p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
