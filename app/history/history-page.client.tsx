'use client'

import { useCallback, useState, useTransition, type CSSProperties } from 'react'
import Link from 'next/link'
import { Icon } from '@iconify/react/offline'

import ButtonComponent from '@components/button/button.component'
import ErrorPageComponent from '@components/error-page/error-page.component'
import { getTournaments } from './history.api'
import { HISTORY_PAGE_LIMIT } from './history.const'
import {
  formatTournamentDate,
  formatTournamentRounds,
  getTournamentStatusLabel,
  getTournamentStatusModifier,
} from './history.utils'
import type { TournamentsListResponse } from './history.types'
import type { Tournament } from '../tournament/tournament.types'
import IconComponent from '../../components/icon/icon.component'
import { cn } from '@sglara/cn'

type HistoryData = TournamentsListResponse['data']

type HistoryPageClientProps = {
  initialData: HistoryData | null
  initialError: string | null
}

type HistoryCardProps = {
  tournament: Tournament
  index: number
}

function HistoryCard({ tournament, index }: HistoryCardProps) {
  const isLive = getTournamentStatusLabel(tournament) === 'Live'

  return (
    <Link
      href={`/tournament/${tournament.id}`}
      className="history-card"
      style={{ '--history-stagger': `${Math.min(index, 12) * 35}ms` } as CSSProperties}
    >
      <header className="history-card__header">
        <h2 className="history-card__title">Tournament #{tournament.id}</h2>
        <span
          className={cn("history-card__status", getTournamentStatusModifier(tournament))}
        >
          {isLive ? <span className="history-card__status-dot" aria-hidden="true" /> : null}
          {getTournamentStatusLabel(tournament)}
        </span>
      </header>

      <div className="history-card__meta">
        <div className="history-card__meta-row">
          <div>
            <IconComponent icon="mdi:format-list-numbered" aria-hidden="true" />
            <span className="visually-hidden">Rounds</span>
          </div>
          <div>{formatTournamentRounds(tournament.phases)}</div>
        </div>

        <div className="history-card__meta-row">
          <div>
            <IconComponent icon="mdi:calendar-blank-outline" aria-hidden="true" />
            <span className="visually-hidden">Date</span>
          </div>
          <div>{formatTournamentDate(tournament.starttime)}</div>
        </div>
      </div>

      <span className="history-card__banlist omega-badge omega-badge--secondary">
        <IconComponent icon="mdi:shield-outline" aria-hidden="true" />
        {tournament.banlist}
      </span>
    </Link>
  )
}

const HistoryPageClient = ({ initialData, initialError }: HistoryPageClientProps) => {
  const [data, setData] = useState(initialData)
  const [error, setError] = useState(initialError)
  const [page, setPage] = useState(initialData?.pagination.currentPage ?? 1)
  const [isPending, startTransition] = useTransition()

  const loadPage = useCallback((targetPage: number) => {
    startTransition(async () => {
      const result = await getTournaments({ page: targetPage, limit: HISTORY_PAGE_LIMIT })
      if (result.ok) {
        setData(result.data.data)
        setError(null)
        setPage(targetPage)
        // Keep the page shareable/restorable without a server round-trip.
        window.history.replaceState(
          null,
          '',
          targetPage > 1 ? `/history?page=${targetPage}` : '/history',
        )
        return
      }

      setError(result.message)
    })
  }, [])

  const tournaments = data?.tournaments ?? []
  const pagination = data?.pagination ?? null

  if (error && !data) {
    return (
      <ErrorPageComponent
        title="Tournament history unavailable"
        description={error}
        onRetry={() => loadPage(page)}
        isPending={isPending}
      />
    )
  }

  return (
    <div className="history">
      

      <div className="history__content omega-container">
        <header className="history__header">
          <span className="history__eyebrow omega-badge omega-badge--secondary">
            Tournament History
          </span>
          <h1 className="history__title">Past Tournaments</h1>
          <p className="history__lead">
            Browse completed and live Yu-Gi-Oh! tournaments on YGO Omega.
          </p>
        </header>

        {tournaments.length === 0 ? (
          <div className="history__empty-state" role="status">
            <IconComponent icon="mdi:trophy-outline" className="history__empty-state-icon" />
            <p>No tournaments found.</p>
          </div>
        ) : (
          <ul
            className={cn("history__grid-list", {
              "history__grid-list--pending": isPending,
            })}
            aria-busy={isPending}
          >
            {tournaments.map((tournament, index) => (
              <li key={tournament.id}>
                <HistoryCard tournament={tournament} index={index} />
              </li>
            ))}
          </ul>
        )}

        {pagination && pagination.totalPages > 1 ? (
          <nav className="history__pagination" aria-label="Tournament history pages">
            <ButtonComponent
              variant="secondary"
              icon="mdi:chevron-left"
              onClick={() => loadPage(page - 1)}
              disabled={isPending || page <= 1}
            >
              Previous
            </ButtonComponent>
            <span className="history__pagination-status">
              Page {pagination.currentPage} of {pagination.totalPages}
            </span>
            <ButtonComponent
              variant="secondary"
              icon="mdi:chevron-right"
              iconPosition="end"
              onClick={() => loadPage(page + 1)}
              disabled={isPending || page >= pagination.totalPages}
            >
              Next
            </ButtonComponent>
          </nav>
        ) : null}
      </div>
    </div>
  )
}

export default HistoryPageClient
