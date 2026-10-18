'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useLocale, useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { Panel } from '@ui/panel'
import { StatGrid } from '@ui/stat-grid'
import { LocalTime } from '@omega/profile/local-time'
import { formatNumber, formatRecord } from '@omega/tournament/labels'
import { listPlayerTournaments } from '@utils/tournaments'
import type { PlayerEntry, PlayerTournaments } from '@utils/types'
import { Rail } from './rail'

/** How many entries each "see all" page pulls. */
const PAGE_SIZE = 10
const DATE: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }
const LINK = 'self-start font-mono text-[11px] leading-3.5 font-bold tracking-[0.14em] text-cyan uppercase underline underline-offset-3 hover:decoration-2 disabled:cursor-wait'

const Entry = ({ entry: { tournament, standing } }: { entry: PlayerEntry }) => {
  const t = useTranslations('Tournaments.record')
  return (
    <Link
      href={`/tournament/${tournament.id}`}
      className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 bg-surface-100 px-3.5 py-3 text-ink no-underline hover:bg-surface-300"
    >
      <span className={twMerge('text-center font-display text-[22px] leading-none', standing.rank === 1 ? 'text-gold' : 'text-ink-dim')}>
        {t('rank', { rank: standing.rank })}
      </span>
      <span className="flex min-w-0 flex-col gap-0.5">
        <b className="truncate text-sm">{t('tournament', { id: tournament.id })}</b>
        <span className="font-mono text-[10px] leading-3 tracking-[0.14em] text-ink-muted uppercase">
          {tournament.format} · <LocalTime iso={tournament.endedAt ?? tournament.startedAt} options={DATE} />
        </span>
      </span>
      <span className="font-mono text-xs leading-none text-ink-dim tabular-nums">{formatRecord(standing)}</span>
    </Link>
  )
}

/**
 * Swiss-tournament record. The profile embeds the 3 latest entries; "see all" pages through
 * `GET /tournaments/players/{id}`, whose first page repeats those three, so it replaces the list.
 */
export const TournamentRecord = ({ profileId, tournaments }: { profileId: string; tournaments: PlayerTournaments }) => {
  const t = useTranslations('Tournaments.record')
  const locale = useLocale()
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
    <>
      <Rail num="04" label={t('label')} stamp={t('stamp')} />
      <Panel label={t('label')} className="flex flex-col gap-5">
        <StatGrid
          columns={2}
          items={[
            { label: t('entered'), value: formatNumber(tournaments.played, locale) },
            { label: t('titles'), value: formatNumber(tournaments.titles, locale), tone: 'gold' },
            { label: t('matchRecord'), value: formatRecord(tournaments) },
            { label: t('points'), value: formatNumber(tournaments.points, locale) },
          ]}
        />
        {entries.length ? (
          <div className="flex flex-col gap-px border border-line bg-line">
            {entries.map((entry) => <Entry key={entry.tournament.id} entry={entry} />)}
          </div>
        ) : null}
        {more ? (
          <button type="button" onClick={loadMore} disabled={status === 'loading'} className={LINK}>
            {status === 'loading' ? t('loading') : cursor === undefined ? t('seeAll') : t('loadOlder')}
          </button>
        ) : null}
        {status === 'error' ? <p role="alert" className="text-sm text-loss">{t('error')}</p> : null}
      </Panel>
    </>
  )
}
