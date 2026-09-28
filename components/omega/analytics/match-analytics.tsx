'use client'

import { useEffect, useId, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { TabBar, tabPanelProps } from '@ui/tab-bar'
import {
  AnalyticsApiError,
  archetypeName,
  duelistName,
  getMatchStats,
  getMatchTimeline,
  type MatchStats,
  type MatchTimeline,
  type Side,
  type SideWinner,
} from '@utils/analytics'
import { GameStatsView } from './game-stats'
import { MatchTimelineView } from './match-timeline'
import { SIDE, Skeleton } from './primitives'
import { SideTones, useSideTones } from './side-tones'

const TABS = [
  { id: 'timeline', label: 'Timeline' },
  { id: 'stats', label: 'Statistics' },
] as const

type Tab = (typeof TABS)[number]['id']

type Load<T> = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; data: T }

const failure = (error: unknown) => {
  if (error instanceof AnalyticsApiError && error.status === 403) return 'Both duelists hide their match history from you.'
  if (error instanceof AnalyticsApiError && error.status === 404) return 'No play log was recorded for this duel.'
  return "Couldn't load this duel. Try again in a moment."
}

/** Fetches once, when the tab is first shown; the answer is cached for the life of the row. */
const useLoad = <T,>(active: boolean, load: (signal: AbortSignal) => Promise<T>) => {
  const [state, setState] = useState<Load<T> | null>(null)
  const [attempt, setAttempt] = useState(0)
  const needed = active && state?.status !== 'ready'

  useEffect(() => {
    if (!needed) return
    const abort = new AbortController()
    load(abort.signal).then(
      (data) => setState({ status: 'ready', data }),
      (error) => !abort.signal.aborted && setState({ status: 'error', message: failure(error) }),
    )
    return () => abort.abort()
    // `load` closes over the match id only, which never changes for a mounted row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needed, attempt])

  return { state: state ?? { status: 'loading' as const }, retry: () => (setState(null), setAttempt((n) => n + 1)) }
}

const DURATION = (seconds: number) => `${Math.floor(seconds / 60)}m ${String(seconds % 60).padStart(2, '0')}s`

const resultMark = (winner: SideWinner, tones: typeof SIDE) =>
  winner === null ? { label: 'Not played', className: 'bg-surface-400' } : winner === 'draw' ? { label: 'Draw', className: 'bg-draw' } : { label: `Won by`, className: tones[winner].bg }

type Header = { match: MatchTimeline['match']; players: Record<Side, { displayName: string | null; username: string | null; archetype: string | null; name: string | null }> }

const toHeader = (data: MatchTimeline | MatchStats): Header => ({
  match: data.match,
  players: {
    player1: { ...data.players.player1, name: 'deck' in data.players.player1 ? (data.players.player1.deck?.name ?? null) : data.players.player1.deckName },
    player2: { ...data.players.player2, name: 'deck' in data.players.player2 ? (data.players.player2.deck?.name ?? null) : data.players.player2.deckName },
  },
})

/** The two duelists facing each other over the score. Curated deck name first, detected archetype after. */
const MatchHeader = ({ header }: { header: Header }) => {
  const { match, players } = header
  const SIDE = useSideTones()
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3">
      {(['player1', 'player2'] as const).map((side, index) => (
        <div key={side} className={twMerge('min-w-0', index === 1 ? 'order-3 text-right' : 'order-1')}>
          <p className={twMerge('truncate display-6', SIDE[side].text)}>{duelistName(players[side])}</p>
          <p className="truncate text-ink-muted signal-sm">{players[side].name ?? archetypeName(players[side].archetype)}</p>
        </div>
      ))}
      <div className="order-2 text-center">
        <p className="text-ink display-5 tabular-nums">
          <span className={SIDE.player1.text}>{match.score.player1}</span>
          <span className="px-1.5 text-ink-muted">–</span>
          <span className={SIDE.player2.text}>{match.score.player2}</span>
        </p>
        <p className="text-ink-muted mono-note">
          {match.durationSeconds !== null ? DURATION(match.durationSeconds) : `${match.gamesPlayed} games`}
          {match.score.draws ? ` · ${match.score.draws} drawn` : ''}
        </p>
      </div>
    </div>
  )
}

/** One button per game, shared by both tabs so switching tab keeps the game in view. */
const GamePicker = ({
  games,
  active,
  onSelect,
  players,
  opponent,
}: {
  games: { gameNumber: number; winner: SideWinner }[]
  active: number
  onSelect: (index: number) => void
  players?: Header['players']
  /** The profile owner's opponent: games they won are the owner's losses. */
  opponent?: Side
}) => {
  const tones = useSideTones()
  return (
  <div role="group" aria-label="Game" className="flex flex-wrap gap-2">
    {games.map((game, index) => {
      const lost = opponent !== undefined && game.winner === opponent
      const mark = lost ? { label: 'Lost to', className: 'bg-loss' } : resultMark(game.winner, tones)
      const winner = game.winner === 'player1' || game.winner === 'player2' ? duelistName(players?.[game.winner]) : null
      const on = index === active
      return (
        <button
          key={game.gameNumber}
          type="button"
          aria-pressed={on}
          onClick={() => onSelect(index)}
          className={twMerge(
            'inline-flex min-h-11 cursor-pointer items-center gap-2 border px-3 signal-chip',
            on ? 'border-ink bg-ground-soft text-ink' : 'border-line text-ink-muted hover:border-ink-muted hover:text-ink-dim',
            lost && (on ? 'border-loss bg-ground-loss text-loss' : 'border-loss/50 text-loss hover:border-loss hover:text-loss'),
          )}
        >
          <span aria-hidden className={twMerge('size-2', mark.className)} />
          Game {game.gameNumber}
          <span className="sr-only">
            , {mark.label}
            {winner ? ` ${winner}` : ''}
          </span>
        </button>
      )
    })}
  </div>
  )
}

const Failed = ({ message, onRetry }: { message: string; onRetry: () => void }) => (
  <div role="alert" className="flex flex-wrap items-center justify-between gap-3 border border-line bg-surface-100 px-4 py-3.5">
    <p className="text-ink-dim body-sm">{message}</p>
    <button type="button" onClick={onRetry} className="min-h-11 cursor-pointer border border-surface-400 px-3 text-ink-dim signal hover:border-ink hover:text-ink">
      Retry
    </button>
  </div>
)

/**
 * The play log of one ranked duel: a turn-by-turn timeline and the per-game numbers, as two tabs.
 * Each tab fetches on first view only. Tournament and casual duels have no log — mount this for
 * ranked matches only. With `opponentId` (seen from a profile), the opponent is always gold and
 * the owner's lost games are red.
 */
export const MatchAnalytics = ({ matchId, opponentId }: { matchId: string; opponentId?: string }) => {
  const idPrefix = useId()
  const [tab, setTab] = useState<Tab>('timeline')
  const [gameIndex, setGameIndex] = useState(0)
  const timeline = useLoad(tab === 'timeline', (signal) => getMatchTimeline(matchId, signal))
  const stats = useLoad(tab === 'stats', (signal) => getMatchStats(matchId, signal))

  const loaded = [timeline.state, stats.state].find((state) => state.status === 'ready')
  const header = loaded?.status === 'ready' ? toHeader(loaded.data) : null
  const games = loaded?.status === 'ready' ? loaded.data.games : []
  const current = Math.min(gameIndex, Math.max(games.length - 1, 0))
  const opponent = loaded?.status === 'ready' && opponentId ? (['player1', 'player2'] as const).find((side) => loaded.data.players[side].id === opponentId) : undefined
  const tones = opponent === 'player1' ? { player1: SIDE.player2, player2: SIDE.player1 } : SIDE

  return (
    <SideTones value={tones}>
    <div className="grid gap-4">
      {header ? <MatchHeader header={header} /> : null}

      <TabBar label="Duel detail" idPrefix={idPrefix} tabs={TABS} active={tab} onSelect={setTab} />

      {games.length > 1 ? <GamePicker games={games} active={current} onSelect={setGameIndex} players={header?.players} opponent={opponent} /> : null}

      <div {...tabPanelProps(idPrefix, tab)} className="min-w-0">
        {tab === 'timeline' ? (
          timeline.state.status === 'loading' ? (
            <Skeleton rows={5} label="Loading the timeline…" />
          ) : timeline.state.status === 'error' ? (
            <Failed message={timeline.state.message} onRetry={timeline.retry} />
          ) : timeline.state.data.games[current] ? (
            <>
              <p className="mb-3 text-ink-muted body-sm">
                Summons and activations in the order they happened. Chain links are listed as activated; they resolve in reverse.
              </p>
              <MatchTimelineView game={timeline.state.data.games[current]} players={timeline.state.data.players} />
            </>
          ) : (
            <p className="text-ink-muted body-sm">No game was played.</p>
          )
        ) : stats.state.status === 'loading' ? (
          <Skeleton rows={4} label="Loading the statistics…" />
        ) : stats.state.status === 'error' ? (
          <Failed message={stats.state.message} onRetry={stats.retry} />
        ) : stats.state.data.games[current] ? (
          <GameStatsView game={stats.state.data.games[current]} players={stats.state.data.players} />
        ) : (
          <p className="text-ink-muted body-sm">No game was played.</p>
        )}
      </div>
    </div>
    </SideTones>
  )
}
