'use client'

import {
  useCallback,
  useMemo,
  useState,
  useTransition,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react'
import Link from 'next/link'
import { Icon } from '@iconify/react/offline'
import AvatarComponent from '@components/avatar/avatar.component'
import BackdropComponent from '@components/backdrop/backdrop.component'
import ButtonComponent from '@components/button/button.component'
import { discordAvatar } from '@assets/discord.avatar'
import { getLeaderboard } from './leaderboards.api'
import {
  LEADERBOARD_MODES,
  LEADERBOARD_TOP_COUNT,
  type LeaderboardMode,
} from './leaderboards.const'
import type { LeaderboardData, PlayerStats } from './leaderboards.types'
import {
  formatLeaderboardRating,
  formatLeaderboardRecord,
  formatLeaderboardWinRate,
  getLeaderboardRankIcon,
  getLeaderboardRankModifier,
  getLeaderboardTierInfo,
  getLeaderboardWinRateClass,
  getPlayerDisplayName,
  sliceTopPlayers,
} from './leaderboards.utils'
import IconComponent from '../../components/icon/icon.component'
import Image from 'next/image'
import { cn } from '@sglara/cn'

type LeaderboardsPageClientProps = {
  data: LeaderboardData | null
  error: string | null
  initialMode: LeaderboardMode
}

type LeaderboardRowProps = {
  player: PlayerStats
  rank: number
  mode: LeaderboardMode
}

function LeaderboardRow({ player, rank, mode }: LeaderboardRowProps) {
  const displayName = getPlayerDisplayName(player)
  const tierInfo = getLeaderboardTierInfo(player.rating, mode)
  const rankModifier = getLeaderboardRankModifier(rank)
  const rankIcon = getLeaderboardRankIcon(rank)
  const winRateClass = getLeaderboardWinRateClass(
    player.wins,
    player.loses,
    player.draws,
  )

  return (
    <li
      className={cn("leaderboards__row", rankModifier)}
      style={{ '--leaderboards-stagger': `${Math.min(rank, 12) * 35}ms` } as CSSProperties}
    >
      <div className="leaderboards__cell leaderboards__cell--rank">
        <span className="leaderboards__rank" aria-label={`Rank ${rank}`}>
          {rankIcon ? (
            <IconComponent icon={rankIcon} className="leaderboards__rank-icon" aria-hidden="true" />
          ) : null}
          <span className="leaderboards__rank-value">{rank}</span>
        </span>
      </div>

      <div className="leaderboards__cell leaderboards__cell--player">
        <Link href={`/profile/${player.id}`} className="leaderboards__player-link">
          <AvatarComponent
            src={discordAvatar(player.id, player.avatar ?? '')}
            alt={displayName}
            size={rank === 1 ? 'lg' : 'md'}
          />
          <span className="leaderboards__player-meta">
            <span className="leaderboards__player-name">{displayName}</span>
            <span className="leaderboards__player-handle">@{player.username}</span>
          </span>
          <Image
            src={tierInfo.image}
            alt=""
            className="leaderboards__tier-badge"
            width={28}
            height={28}
            loading="lazy"
          />
        </Link>
      </div>

      <div className="leaderboards__cell leaderboards__cell--rating" data-label="Rating">
        <span className={cn("leaderboards__rating", tierInfo.accentClass)}>
          {formatLeaderboardRating(player.rating)}
        </span>
        <span className="leaderboards__tier-name">{tierInfo.name}</span>
      </div>

      <div className="leaderboards__cell leaderboards__cell--record" data-label="Record">
        <span className="leaderboards__record">
          {formatLeaderboardRecord(player.wins, player.loses, player.draws)}
        </span>
      </div>

      <div className="leaderboards__cell leaderboards__cell--winrate" data-label="Win rate">
        <span className={cn("leaderboards__win-rate", winRateClass)}>
          {formatLeaderboardWinRate(player.wins, player.loses, player.draws)}
        </span>
      </div>

      <div className="leaderboards__cell leaderboards__cell--games" data-label="Games">
        <span className="leaderboards__games">{player.games.toLocaleString()}</span>
      </div>
    </li>
  )
}

const LeaderboardsPageClient = ({
  data: initialData,
  error: initialError,
  initialMode,
}: LeaderboardsPageClientProps) => {
  const [data, setData] = useState(initialData)
  const [error, setError] = useState(initialError)
  const [mode, setMode] = useState<LeaderboardMode>(initialMode)
  const [isPending, startTransition] = useTransition()

  const players = useMemo(() => {
    if (!data) return []
    const source = mode === 'TCG' ? data.TCG : data.Genesys
    return sliceTopPlayers(source)
  }, [data, mode])

  const handleRetry = useCallback(() => {
    startTransition(async () => {
      const result = await getLeaderboard()
      if (result.ok) {
        setData(result.data)
        setError(null)
        return
      }

      setError(result.message)
    })
  }, [])

  const handleModeChange = useCallback((nextMode: LeaderboardMode) => {
    setMode(nextMode)
    // Keep the selected format shareable/restorable without a server round-trip.
    window.history.replaceState(
      null,
      '',
      nextMode === 'TCG' ? '/leaderboards' : `/leaderboards?mode=${nextMode}`,
    )
  }, [])

  // Roving tabindex + arrow keys — required by the tab pattern the roles declare.
  const handleTabKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLButtonElement>, currentMode: LeaderboardMode) => {
      if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return

      event.preventDefault()
      const currentIndex = LEADERBOARD_MODES.findIndex((tab) => tab.id === currentMode)
      const direction = event.key === 'ArrowRight' ? 1 : -1
      const nextTab =
        LEADERBOARD_MODES[
          (currentIndex + direction + LEADERBOARD_MODES.length) % LEADERBOARD_MODES.length
        ]
      if (!nextTab) return
      handleModeChange(nextTab.id)
      document.getElementById(`leaderboards-tab-${nextTab.id}`)?.focus()
    },
    [handleModeChange],
  )

  if (error && !data) {
    return (
      <div className="leaderboards leaderboards--empty" aria-labelledby="leaderboards-error-title">
        <BackdropComponent />

        <div className="leaderboards__empty omega-container omega-container--narrow">
          <span className="leaderboards__empty-icon-wrap" aria-hidden="true">
            <IconComponent icon="mdi:trophy-broken" className="leaderboards__empty-icon" />
          </span>
          <h1 id="leaderboards-error-title" className="leaderboards__empty-title">
            Leaderboard unavailable
          </h1>
          <p className="leaderboards__empty-description">{error}</p>
          <div className="leaderboards__empty-actions">
            <ButtonComponent
              variant="primary"
              icon="mdi:refresh"
              onClick={handleRetry}
              disabled={isPending}
            >
              {isPending ? 'Retrying…' : 'Try again'}
            </ButtonComponent>
            <ButtonComponent to="/" variant="secondary" icon="mdi:home">
              Back to Home
            </ButtonComponent>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="leaderboards">
      <BackdropComponent />

      <div className="leaderboards__content omega-container">
        <header className="leaderboards__header">
          <span className="leaderboards__eyebrow omega-badge omega-badge--secondary">
            Rankings
          </span>
          <h1 className="leaderboards__title">Leaderboard</h1>
          <p className="leaderboards__lead">
            Top {LEADERBOARD_TOP_COUNT} duelists ranked by rating. Switch between TCG and
            Genesys to compare standings.
          </p>
        </header>

        <div
          className="leaderboards__tabs"
          role="tablist"
          aria-label="Leaderboard format"
        >
          {LEADERBOARD_MODES.map((tab) => {
            const isActive = mode === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`leaderboards-tab-${tab.id}`}
                aria-selected={isActive}
                aria-controls="leaderboards-panel"
                tabIndex={isActive ? 0 : -1}
                className={cn(
                  "leaderboards__tab",
                  isActive && "leaderboards__tab--active",
                )}
                onKeyDown={(event) => handleTabKeyDown(event, tab.id)}
                onClick={() => handleModeChange(tab.id)}
              >
                {tab.label}
              </button>
            )
          })}
        </div>

        <section
          id="leaderboards-panel"
          role="tabpanel"
          aria-labelledby={`leaderboards-tab-${mode}`}
          className="leaderboards__panel"
        >
          <div className="leaderboards__panel-meta">
            <span className="leaderboards__panel-count">
              {players.length.toLocaleString()} players
            </span>
            <span className="leaderboards__panel-format">{mode}</span>
          </div>

          {players.length === 0 ? (
            <div className="leaderboards__empty-state" role="status">
              <IconComponent icon="mdi:account-group-outline" className="leaderboards__empty-state-icon" />
              <p>No ranked players yet for {mode}.</p>
            </div>
          ) : (
            <>
              <div className="leaderboards__columns" aria-hidden="true">
                <span>Rank</span>
                <span>Player</span>
                <span>Rating</span>
                <span>Record</span>
                <span>Win rate</span>
                <span>Games</span>
              </div>

              <ol className="leaderboards__list" aria-label={`${mode} top ${LEADERBOARD_TOP_COUNT}`}>
                {players.map((player, index) => (
                  <LeaderboardRow
                    key={player.id}
                    player={player}
                    rank={index + 1}
                    mode={mode}
                  />
                ))}
              </ol>
            </>
          )}
        </section>
      </div>
    </div>
  )
}

export default LeaderboardsPageClient
