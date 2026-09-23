import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { LocalTime } from '@omega/profile/local-time'
import { TIME_ONLY } from '@omega/tournament/labels'
import { PlayerCell, playerName } from '@omega/tournament/player'
import { Callout } from '@omega/wiki/wiki'
import { Eyebrow } from '@ui/eyebrow/eyebrow'
import type { MatchOutcome, Standing, TournamentMatch, TournamentPlayer, TournamentRound } from '@utils/types'

/**
 * Edge colour per outcome. A decided match is a result, not a failure, so both sides read the same:
 * red would say the duelist in column two lost *more*. Which of them won is marked on their cell.
 */
const EDGE = {
  player1: 'border-l-win',
  player2: 'border-l-win',
  draw: 'border-l-draw',
  unplayed: 'border-l-surface-400',
} satisfies Record<MatchOutcome, string>

/** Game pips follow the same rule: who took the game, not who "lost" it. */
const PIP = { player1: 'bg-win', player2: 'bg-cyan', draw: 'bg-draw' }

const COLS =
  'grid grid-cols-1 gap-2.5 lg:grid-cols-[76px_minmax(0,1fr)_132px_minmax(0,1fr)_96px] lg:items-center lg:gap-4'

type Roster = Map<string, TournamentPlayer>
type T = ReturnType<typeof useTranslations<'Tournaments'>>

/** Spoken, never drawn: the visual marks belong to the winner's own cell. */
const resultText = (match: TournamentMatch, roster: Roster, t: T) => {
  if (match.outcome === 'draw') return t('rounds.drawn')
  if (match.outcome === 'unplayed') return t('rounds.unplayed')
  const winner = roster.get(match.outcome === 'player1' ? match.player1 : match.player2)
  return t('rounds.won', { name: playerName(winner, t('player.unknown')) })
}

/**
 * The winner's side carries a filled bar; the loser's an empty slot of the same width, so the two
 * cells stay aligned and the mark reads as presence, not as a colour.
 */
const WinBar = ({ won }: { won: boolean }) => (
  <span aria-hidden className={twMerge('h-4.5 w-1 shrink-0', won ? 'bg-win' : 'bg-transparent')} />
)

/** Draw and unplayed have no winner to point at, so the centre says which of the two it is. */
const NoWinner = ({ outcome }: { outcome: MatchOutcome }) =>
  outcome === 'draw' ? (
    <span aria-hidden className="flex shrink-0 flex-col gap-1">
      <span className="h-0.5 w-3 bg-draw" />
      <span className="h-0.5 w-3 bg-draw" />
    </span>
  ) : (
    <span aria-hidden className="h-0.5 w-3 shrink-0 bg-surface-400" />
  )

const MatchRow = ({ match, roster }: { match: TournamentMatch; roster: Roster }) => {
  const t = useTranslations('Tournaments')
  const decided = match.outcome === 'player1' || match.outcome === 'player2'
  const { player1: one, player2: two } = match.score

  return (
    <li
      className={twMerge(
        'border-b border-l-3 border-line px-3.5 py-3 last:border-b-0',
        EDGE[match.outcome],
        decided ? 'bg-ground-subtle' : '',
        COLS,
      )}
    >
      <span className="text-ink-muted signal">{t('rounds.room', { room: match.room })}</span>

      <span className="flex min-w-0 items-center gap-2.5">
        <WinBar won={match.outcome === 'player1'} />
        <PlayerCell
          player={roster.get(match.player1)}
          note={match.first === 'player1' ? t('rounds.onThePlay') : undefined}
          className={match.outcome === 'player1' ? '' : 'opacity-(--opacity-duotone-lead)'}
        />
      </span>

      <span className="flex items-center gap-2.5">
        {decided ? null : <NoWinner outcome={match.outcome} />}

        {/* The score can disagree with the outcome, so the winning side's digit is lifted, not summed. */}
        <span className="mono-data tabular-nums">
          {decided || match.outcome === 'draw' ? (
            <>
              <span className={match.outcome === 'player1' ? 'text-win' : 'text-ink-muted'}>{one}</span>
              <span className="text-ink-muted">–</span>
              <span className={match.outcome === 'player2' ? 'text-win' : 'text-ink-muted'}>{two}</span>
            </>
          ) : (
            <span className="text-ink-muted">—</span>
          )}
        </span>

        <span aria-hidden className="flex gap-1">
          {match.games.map((game, index) => (
            <span key={index} className={twMerge('size-2.25', PIP[game.winner])} />
          ))}
        </span>

        <span className="sr-only">{resultText(match, roster, t)}</span>
      </span>

      <span className="flex min-w-0 items-center gap-2.5">
        <WinBar won={match.outcome === 'player2'} />
        <PlayerCell
          player={roster.get(match.player2)}
          note={match.first === 'player2' ? t('rounds.onThePlay') : undefined}
          className={match.outcome === 'player2' ? '' : 'opacity-(--opacity-duotone-lead)'}
        />
      </span>

      <span className="text-ink-muted mono-data">
        {match.endedAt ? <LocalTime iso={match.endedAt} options={TIME_ONLY} /> : '—'}
      </span>
    </li>
  )
}

/** Round-by-round pairings. Byes are listed with the round they belong to, not as a match. */
export const Rounds = ({ rounds, standings }: { rounds: TournamentRound[]; standings: Standing[] }) => {
  const t = useTranslations('Tournaments')
  // Only `standings` carries full players; rounds reference them by id.
  const roster: Roster = new Map(standings.map(({ player }) => [player.id, player]))

  if (!rounds.length) {
    return <p className="text-ink-muted body-sm">{t('rounds.empty')}</p>
  }

  return (
    <>
      {rounds.map((round) => (
        <section key={round.number} className="mb-6.5">
          <Eyebrow tone="neutral" meta={<LocalTime iso={round.startedAt} options={TIME_ONLY} />}>
            {t('rounds.round', { number: round.number })}
          </Eyebrow>

          <ul className="mt-3 border border-line">
            {round.matches.map((match) => (
              <MatchRow key={`${round.number}-${match.room}`} match={match} roster={roster} />
            ))}
            {round.bye ? (
              <li className="bg-ground-subtle px-3.5 py-3 text-ink-muted signal">
                {t('rounds.bye', { name: playerName(roster.get(round.bye), t('player.unknown')) })}
              </li>
            ) : null}
          </ul>
        </section>
      ))}

      <div className="max-w-[72ch]">
        <Callout>{t('rounds.note')}</Callout>
      </div>
    </>
  )
}
