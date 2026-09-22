'use client'

import { useState } from 'react'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import { CardArt } from '@omega/card-art'
import { LocalTime } from '@omega/profile/local-time'
import { DATE_TIME, formatNumber, formatRecord } from '@omega/tournament/labels'
import { StatGrid } from '@omega/tournament/stat-grid'
import { buttonClasses } from '@ui/button'
import { SectionHead } from '@ui/section-head'
import { listPlayerTournaments } from '@utils/tournaments'
import type { PlayerEntry, PlayerTournaments } from '@utils/types'

type TournamentRecordProps = {
  num: string
  profileId: string
  tournaments: PlayerTournaments
}

/** How many entries each "see all" page pulls. */
const PAGE_SIZE = 10

/** Column tracks shared by the ledger head and every row. */
const COLS = 'lg:grid-cols-[72px_minmax(0,1fr)_minmax(0,140px)_96px_150px] lg:items-center lg:gap-4'

const Entry = ({ entry }: { entry: PlayerEntry }) => {
  const { tournament, standing } = entry
  const won = standing.rank === 1
  // The API picks the deck's face: its top archetype's most-copied card in that list.
  const lead = standing.deck?.archetypes[0]

  return (
    <li>
      <Link
        href={`/tournament/${tournament.id}`}
        className={twMerge('grid grid-cols-1 gap-2.5 border-b border-line py-3.5 hover:bg-ground-soft', COLS)}
      >
        <span className={twMerge('display-5 tabular-nums', won ? 'text-gold' : 'text-ink-dim')}>
          {won ? '1st' : `#${standing.rank}`}
        </span>

        <span className="min-w-0">
          <span className="flex flex-wrap items-baseline gap-2.5">
            <span className="text-ink body-strong">{tournament.banlist}</span>
            <span className="text-gold signal-sm">{tournament.format}</span>
          </span>
          <span className="mt-1 block text-ink-muted signal">
            {tournament.players} players · {tournament.rounds} rounds
          </span>
        </span>

        <span className="flex min-w-0 items-center gap-2">
          {lead ? (
            <CardArt art={{ id: lead.art, name: lead.name }} alt="" sizes="24px" className="size-6 shrink-0 border border-line" />
          ) : null}
          <span className="truncate text-ink-dim signal">{standing.deck?.archetype ?? 'Unclassified'}</span>
        </span>

        <span className="text-ink-dim mono-data tabular-nums">
          {formatRecord(standing)} · {standing.points} pts
        </span>

        <span className="text-ink-muted mono-data">
          {tournament.endedAt ? <LocalTime iso={tournament.endedAt} options={DATE_TIME} /> : 'in progress'}
        </span>
      </Link>
    </li>
  )
}

/**
 * Swiss-tournament record. The profile embeds the 3 latest entries; "see all" pages through
 * `GET /tournaments/players/{id}`, whose first page repeats those three, so it replaces the list.
 */
export const TournamentRecord = ({ num, profileId, tournaments }: TournamentRecordProps) => {
  const [entries, setEntries] = useState(tournaments.recent)
  // `undefined` = still showing the embedded three; `null` = the history ran out.
  const [cursor, setCursor] = useState<string | null | undefined>(undefined)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')

  const loadMore = async () => {
    setStatus('loading')
    try {
      const page = await listPlayerTournaments(profileId, { limit: PAGE_SIZE, cursor: cursor ?? undefined })
      setEntries((current) => (cursor === undefined ? page.entries : [...current, ...page.entries]))
      setCursor(page.nextCursor)
      setStatus('idle')
    } catch (error) {
      console.error(error)
      setStatus('error')
    }
  }

  const more = cursor !== null && (cursor !== undefined || tournaments.played > entries.length)

  return (
    <section id="tournaments" className="pt-section">
      <SectionHead num={num}>Tournaments</SectionHead>
      <p className="mt-2 text-ink-muted signal-sm">
        {formatNumber(tournaments.played)} entered · Swiss rounds, no top cut
      </p>

      <StatGrid
        className="mt-3.5"
        items={[
          { label: 'Titles', value: formatNumber(tournaments.titles), tone: 'gold' },
          { label: 'Entered', value: formatNumber(tournaments.played) },
          { label: 'Match record', value: formatRecord(tournaments) },
          { label: 'Match points', value: formatNumber(tournaments.points), tone: 'cyan' },
        ]}
      />

      {entries.length ? (
        <ul className="mt-5">
          {entries.map((entry) => (
            <Entry key={entry.tournament.id} entry={entry} />
          ))}
        </ul>
      ) : null}

      {more ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={loadMore}
            disabled={status === 'loading'}
            className={buttonClasses({ variant: 'ghost', size: 'sm' })}
          >
            {status === 'loading' ? 'Loading…' : cursor === undefined ? 'See all tournaments' : 'Load older'}
          </button>
          {status === 'error' ? (
            <p role="alert" className="text-gold body-sm">
              Couldn&apos;t load this duelist&apos;s tournaments. Try again.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  )
}
