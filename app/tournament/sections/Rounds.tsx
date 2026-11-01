import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { LocalTime } from '@omega/profile/local-time'
import { TIME_ONLY } from '@omega/tournament/labels'
import { playerName } from '@omega/tournament/player'
import { Avatar } from '@ui/avatar'
import { Chip } from '@ui/chip/chip.component'
import { RailHead } from '@ui/rail-head/rail-head.component'
import type { Standing, TournamentMatch, TournamentPlayer, TournamentRound, TournamentSummary } from '@utils/types'
import { META, Pill, type Roster, type RoundResult, rosterOf } from '../helpers'

type T = ReturnType<typeof useTranslations<'Tournaments'>>
type Side = 'player1' | 'player2'

/** Past this many entrants the cross table stops reading as a table. */
const CROSS_MAX = 16
const CARD = 'cut notch [--cut:var(--cut-md)]'
const TH = 'border-r border-b border-line bg-surface-200 px-2.5 py-2 text-center font-normal whitespace-nowrap text-ink-muted signal-sm'
const TD = 'border-r border-b border-line px-2.5 py-2 text-center'

const other = (side: Side): Side => (side === 'player1' ? 'player2' : 'player1')

/** A game as a 10px square from `side`'s view: won, lost or drawn. */
const Games = ({ match, side }: { match: TournamentMatch; side: Side }) => (
  <span aria-hidden className="flex gap-0.75">
    {match.games.map((game, i) => (
      <span key={i} className={twMerge('size-2.5', game.winner === side ? 'bg-win' : game.winner === 'draw' ? 'bg-draw' : 'bg-surface-400')} />
    ))}
  </span>
)

/** One duelist's line of a match card: portrait, name, who went first, their games and their score. */
const SideLine = ({ match, side, player, won, t }: { match: TournamentMatch; side: Side; player: TournamentPlayer | undefined; won: boolean; t: T }) => {
  const name = playerName(player, t('player.unknown'))
  return (
    <>
      <span className="flex min-w-0 items-center gap-2">
        <Avatar name={name} src={player?.avatar} cosmetics={player?.cosmetics} size="sm" className={twMerge('size-6 text-[10px]', !won && 'opacity-70')} />
        {player ? (
          <Link href={`/profile/${player.id}`} className={twMerge('truncate hover:text-cyan', won ? 'text-ink body-strong' : 'text-ink-dim body-sm')}>
            {name}
          </Link>
        ) : (
          <span className="truncate text-ink-muted body-sm">{name}</span>
        )}
        {match.first === side ? (
          <span title={t('rounds.firstTitle')} className="shrink-0 text-azure-lift signal-sm">
            {t('rounds.first')}
          </span>
        ) : null}
      </span>
      <Games match={match} side={side} />
      <span className={twMerge('min-w-3.5 text-right font-display text-xl leading-none', won ? 'text-win' : 'text-ink-muted')}>{match.score[side]}</span>
    </>
  )
}

/** A decided or drawn match: the winner's line first, room and end time under a rule. */
const MatchCard = ({ match, roster, t }: { match: TournamentMatch; roster: Roster; t: T }) => {
  const draw = match.outcome === 'draw'
  const lead: Side = match.outcome === 'player2' ? 'player2' : 'player1'
  return (
    <article className={CARD}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-2.5 gap-y-1 px-3.5 py-3">
        <SideLine match={match} side={lead} player={roster.get(match[lead])} won={!draw} t={t} />
        <SideLine match={match} side={other(lead)} player={roster.get(match[other(lead)])} won={false} t={t} />
      </div>
      <div className="flex justify-between gap-3 border-t border-line px-3.5 pt-1.5 pb-2.5">
        <span className={META}>{t('rounds.room', { room: match.room })}</span>
        <span className={META}>
          {draw ? `${t('rounds.draw')} · ` : null}
          {match.endedAt ? (
            <>
              {t('pairings.ended')} <LocalTime iso={match.endedAt} options={TIME_ONLY} />
            </>
          ) : (
            '—'
          )}
        </span>
      </div>
    </article>
  )
}

const Pending = ({ match, roster, live, t }: { match: TournamentMatch; roster: Roster; live: boolean; t: T }) => (
  <article className={twMerge(CARD, '[--fill:var(--color-surface-200)] [--edge:var(--color-line)]')}>
    <div className="flex flex-wrap items-center gap-2.5 px-3.5 py-3">
      <Chip tone={live ? 'live' : 'neutral'}>{t(live ? 'rounds.inProgress' : 'rounds.unplayed')}</Chip>
      <span className="min-w-0 truncate text-ink body-sm">
        {playerName(roster.get(match.player1), t('player.unknown'))} <span className={META}>vs</span> {playerName(roster.get(match.player2), t('player.unknown'))}
      </span>
      <span className={twMerge(META, 'ml-auto')}>{t('rounds.room', { room: match.room })}</span>
    </div>
  </article>
)

/** A round as a column: its heading and stamp, then a card per match and the bye. */
const Column = ({ round, last, roster, live, t }: { round: TournamentRound; last: boolean; roster: Roster; live: boolean; t: T }) => {
  const played = round.matches.filter((match) => match.outcome !== 'unplayed')
  const three = played.filter((match) => match.games.length >= 3).length
  const bye = round.bye ? roster.get(round.bye) : undefined
  return (
    <section aria-label={t('rounds.round', { number: round.number })} className="flex flex-col gap-3">
      <div className={twMerge('flex flex-col gap-1.5 border-b-2 pb-2.5', last ? 'border-gold' : 'border-line-mid')}>
        <span className="flex items-baseline justify-between gap-3">
          <h2 className="text-ink display-2">{t('rounds.round', { number: round.number })}</h2>
          {last ? <span className={META}>{t('pairings.finalRound')}</span> : null}
        </span>
        <span className="text-ink-dim signal-sm">
          {t('rounds.paired')} <LocalTime iso={round.startedAt} options={TIME_ONLY} /> · {t('rounds.summary', { matches: round.matches.length, three })}
        </span>
      </div>
      {round.matches.map((match) =>
        match.outcome === 'unplayed' ? (
          <Pending key={match.room} match={match} roster={roster} live={live} t={t} />
        ) : (
          <MatchCard key={match.room} match={match} roster={roster} t={t} />
        ),
      )}
      {round.bye ? (
        <div className={twMerge(CARD, 'flex items-center gap-2.5 px-3.5 py-3 [--fill:var(--color-surface-200)] [--edge:var(--color-line)]')}>
          <Pill result="BYE" />
          <span className="truncate text-ink body-strong">{playerName(bye, t('player.unknown'))}</span>
          <span className={twMerge(META, 'ml-auto')}>{t('rounds.bye')}</span>
        </div>
      ) : null}
    </section>
  )
}

/** Each duelist's result against each other, with the round it happened in. */
const CrossTable = ({ rounds, standings, roster, t }: { rounds: TournamentRound[]; standings: Standing[]; roster: Roster; t: T }) => {
  const short = (name: string) => (name.length > 9 ? `${name.slice(0, 8)}…` : name)
  const against = (a: string, b: string): { result: RoundResult; round: number } | null => {
    for (const round of rounds) {
      const match = round.matches.find((m) => (m.player1 === a && m.player2 === b) || (m.player1 === b && m.player2 === a))
      if (!match || match.outcome === 'unplayed') continue
      const side: Side = match.player1 === a ? 'player1' : 'player2'
      return { result: match.outcome === 'draw' ? 'D' : match.outcome === side ? 'W' : 'L', round: round.number }
    }
    return null
  }
  return (
    <section aria-label={t('pairings.crossTitle')} className="flex flex-col gap-3.5">
      <RailHead num="01" label={t('pairings.crossTitle')} stamp={t('pairings.crossStamp')} className="px-0" />
      <div className="overflow-x-auto border-t border-l border-line">
        <table className="w-full min-w-225 border-collapse bg-surface-100">
          <thead>
            <tr>
              <th className={twMerge(TH, 'text-left')}>{t('standings.duelist')}</th>
              {standings.map(({ player }) => (
                <th key={player.id} className={TH} title={playerName(player, t('player.unknown'))}>
                  {short(playerName(player, t('player.unknown')))}
                </th>
              ))}
              <th className={TH}>{t('standings.points')}</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row) => (
              <tr key={row.player.id}>
                <td className={twMerge(TD, 'text-left whitespace-nowrap')}>
                  <span className="pr-2.5 font-display text-base leading-none text-ink-muted">{row.rank}</span>
                  <span className="text-ink body-strong">{playerName(roster.get(row.player.id), t('player.unknown'))}</span>
                </td>
                {standings.map((col) => {
                  if (col.player.id === row.player.id) {
                    return <td key={col.player.id} className={twMerge(TD, 'bg-[repeating-linear-gradient(45deg,var(--color-surface-200)_0_4px,var(--color-surface-100)_4px_8px)]')} />
                  }
                  const cell = against(row.player.id, col.player.id)
                  return (
                    <td key={col.player.id} className={TD}>
                      {cell ? (
                        <>
                          <Pill result={cell.result} />
                          <span className={twMerge(META, 'block pt-0.75')}>R{cell.round}</span>
                        </>
                      ) : null}
                    </td>
                  )
                })}
                <td className={TD}>
                  <span className="text-ink stat text-lg">{row.points}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

type RoundsProps = { tournament: TournamentSummary; rounds: TournamentRound[]; standings: Standing[] }

/** Every round side by side, a card per match, then who played whom. */
export const Rounds = ({ tournament, rounds, standings }: RoundsProps) => {
  const t = useTranslations('Tournaments')
  if (!rounds.length) return <p className="text-ink-muted body-sm">{t('rounds.empty')}</p>

  const roster = rosterOf(standings)
  const live = tournament.status === 'live'

  return (
    <>
      <div className="overflow-x-auto">
        <div className="grid gap-6" style={{ gridTemplateColumns: `repeat(${rounds.length}, minmax(260px, 1fr))`, minWidth: `${rounds.length * 280}px` }}>
          {rounds.map((round) => (
            <Column key={round.number} round={round} last={round.number === tournament.rounds} roster={roster} live={live} t={t} />
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4.5">
        <span className={twMerge(META, 'inline-flex items-center gap-1.5')}>
          <span aria-hidden className="size-2.5 bg-win" /> {t('pairings.gameWon')}
        </span>
        <span className={twMerge(META, 'inline-flex items-center gap-1.5')}>
          <span aria-hidden className="size-2.5 bg-surface-400" /> {t('pairings.gameLost')}
        </span>
        <span className={META}>
          <span className="text-azure-lift">{t('rounds.first')}</span> {t('pairings.firstLegend')}
        </span>
        <span className={META}>{t('pairings.outcomeNote')}</span>
      </div>

      {standings.length <= CROSS_MAX ? <CrossTable rounds={rounds} standings={standings} roster={roster} t={t} /> : null}
    </>
  )
}
