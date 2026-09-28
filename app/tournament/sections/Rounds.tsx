'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { LocalTime } from '@omega/profile/local-time'
import { TIME_ONLY, minutesBetween } from '@omega/tournament/labels'
import { playerName } from '@omega/tournament/player'
import { Avatar } from '@ui/avatar'
import { Chip } from '@ui/chip/chip.component'
import { ModeTabs } from '@ui/mode-tabs'
import { Panel } from '@ui/panel'
import { ResultPill, type Result } from '@ui/result'
import type { Standing, TournamentMatch, TournamentPlayer, TournamentRound } from '@utils/types'

/** Winner, score and opponent on a phone; room, games and end time join from `lg`. */
const COLS =
  'grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4 px-4 lg:grid-cols-[64px_minmax(0,1fr)_96px_minmax(0,1fr)_132px_120px] lg:px-5'

const META = 'signal-sm text-ink-muted'

type Side = 'player1' | 'player2'
type Roster = Map<string, TournamentPlayer>
type T = ReturnType<typeof useTranslations<'Tournaments'>>

const other = (side: Side): Side => (side === 'player1' ? 'player2' : 'player1')

const Duelist = ({ player, t, align, strong, notes }: {
  player: TournamentPlayer | undefined
  t: T
  align: 'start' | 'end'
  strong?: boolean
  notes: React.ReactNode
}) => {
  const name = playerName(player, t('player.unknown'))
  const end = align === 'end'
  return (
    <span className={twMerge('flex min-w-0 items-center gap-2.5', end && 'flex-row-reverse text-right')}>
      <Avatar name={name} src={player?.avatar} cosmetics={player?.cosmetics} size="sm" />
      <span className={twMerge('flex min-w-0 flex-col gap-0.5', end && 'items-end')}>
        {player ? (
          <Link
            href={`/profile/${player.id}`}
            className={twMerge('max-w-full truncate text-[15px] hover:text-cyan', strong ? 'font-bold text-ink' : 'text-ink-dim')}
          >
            {name}
          </Link>
        ) : (
          <span className="truncate text-[15px] text-ink-muted">{name}</span>
        )}
        <span className="flex gap-2">{notes}</span>
      </span>
    </span>
  )
}

const First = ({ t }: { t: T }) => (
  <span title={t('rounds.firstTitle')} className="text-cyan signal-sm">
    {t('rounds.first')}
  </span>
)

/** A decided or drawn match, read from the winner's side (player1 on a draw). */
const MatchRow = ({ match, round, roster }: { match: TournamentMatch; round: TournamentRound; roster: Roster }) => {
  const t = useTranslations('Tournaments')
  const draw = match.outcome === 'draw'
  const lead: Side = match.outcome === 'player2' ? 'player2' : 'player1'
  const trail = other(lead)
  const [a, b] = [match.score[lead], match.score[trail]]
  const pills: Result[] = match.games.map((game) => (game.winner === 'draw' ? 'D' : game.winner === lead ? 'W' : 'L'))

  return (
    <li className={twMerge(COLS, 'bg-surface-100 py-3.5')}>
      <span className="hidden font-mono text-xs leading-none text-ink-muted lg:block">{t('rounds.room', { room: match.room })}</span>

      <Duelist
        player={roster.get(match[lead])}
        t={t}
        align="start"
        strong={!draw}
        notes={
          <>
            <span className={twMerge('signal-sm', draw ? 'text-draw' : 'text-win')}>{t(draw ? 'rounds.draw' : 'rounds.winner')}</span>
            {match.first === lead ? <First t={t} /> : null}
          </>
        }
      />

      <span className="text-center font-display text-[28px] leading-none">
        {a} – {b}
      </span>

      <Duelist
        player={roster.get(match[trail])}
        t={t}
        align="end"
        notes={
          <>
            {match.first === trail ? <First t={t} /> : null}
            {/* The outcome is official even when the games don't add up to it (concession, disconnect). */}
            {!draw && a <= b ? <span className={META}>{t('rounds.scoreNote', { score: `${a}–${b}` })}</span> : null}
          </>
        }
      />

      <span aria-label={t('rounds.pillsLabel')} className="hidden justify-center gap-1 lg:flex">
        {pills.map((result, index) => (
          <ResultPill key={index} result={result} />
        ))}
      </span>

      <span className="hidden flex-col items-end gap-0.5 lg:flex">
        {match.endedAt ? (
          <>
            <span className="text-sm text-ink-dim">
              <LocalTime iso={match.endedAt} options={TIME_ONLY} />
            </span>
            <span className={META}>{t('rounds.minutes', { count: minutesBetween(round.startedAt, match.endedAt) })}</span>
          </>
        ) : (
          <span className={META}>—</span>
        )}
      </span>
    </li>
  )
}

type RoundsProps = { rounds: TournamentRound[]; standings: Standing[]; live: boolean }

/** One round at a time: its played matches as a table, its bye, then any match that has no result. */
export const Rounds = ({ rounds, standings, live }: RoundsProps) => {
  const t = useTranslations('Tournaments')
  const [selected, setSelected] = useState(() => String(live ? (rounds.at(-1)?.number ?? 1) : (rounds[0]?.number ?? 1)))

  const round = rounds.find((r) => String(r.number) === selected) ?? rounds[0]
  if (!round) return <p className="text-sm text-ink-muted">{t('rounds.empty')}</p>

  // Only `standings` carries full players; rounds reference them by id.
  const roster: Roster = new Map(standings.map(({ player }) => [player.id, player]))
  const played = round.matches.filter((match) => match.outcome !== 'unplayed')
  const pending = round.matches.filter((match) => match.outcome === 'unplayed')
  const threeGames = played.filter((match) => match.games.length >= 3).length
  const bye = round.bye ? roster.get(round.bye) : undefined

  return (
    <>
      <div className="flex flex-wrap items-center gap-5">
        <ModeTabs
          label={t('rounds.tabsLabel')}
          value={selected}
          items={rounds.map((r) => ({ id: String(r.number), label: t('rounds.round', { number: r.number }) }))}
          onChange={setSelected}
          className="max-w-full overflow-x-auto"
        />
        <span className="text-sm text-ink-dim">
          {t('rounds.paired')} <LocalTime iso={round.startedAt} options={TIME_ONLY} /> ·{' '}
          {t('rounds.summary', { matches: round.matches.length, three: threeGames })}
          {round.bye ? ` · ${t('rounds.byeSummary', { name: playerName(bye, t('player.unknown')) })}` : ''}
        </span>
      </div>

      {played.length || round.bye ? (
        <div className="flex flex-col gap-px border border-line bg-line">
          <div aria-hidden className={twMerge(COLS, 'hidden bg-surface-200 py-2.5 lg:grid', META)}>
            <span>{t('rounds.columns.room')}</span>
            <span>{t('rounds.columns.winner')}</span>
            <span className="text-center">{t('rounds.columns.games')}</span>
            <span className="text-right">{t('rounds.columns.opponent')}</span>
            <span className="text-center">{t('rounds.columns.gameByGame')}</span>
            <span className="text-right">{t('rounds.columns.ended')}</span>
          </div>
          <ol aria-label={t('rounds.round', { number: round.number })} className="flex flex-col gap-px">
            {played.map((match) => (
              <MatchRow key={`${round.number}-${match.room}`} match={match} round={round} roster={roster} />
            ))}
            {round.bye ? (
              <li className={twMerge(COLS, 'bg-surface-100 py-3.5')}>
                <span className="hidden font-mono text-xs leading-none text-ink-muted lg:block">—</span>
                <Duelist
                  player={bye}
                  t={t}
                  align="start"
                  strong
                  notes={<span className="text-gold signal-sm">{t('rounds.bye')}</span>}
                />
              </li>
            ) : null}
          </ol>
        </div>
      ) : null}

      <p className={META}>{t('rounds.note')}</p>

      {pending.length ? (
        <Panel tone="sunken" label={t(live ? 'rounds.inProgress' : 'rounds.unplayed')} className="flex flex-col gap-3">
          {pending.map((match) => (
            <div key={match.room} className="flex flex-wrap items-center gap-3">
              <Chip tone={live ? 'live' : 'neutral'}>{t(live ? 'rounds.inProgress' : 'rounds.unplayed')}</Chip>
              <span className="font-bold">
                {t('rounds.pendingLine', {
                  round: round.number,
                  room: match.room,
                  a: playerName(roster.get(match.player1), t('player.unknown')),
                  b: playerName(roster.get(match.player2), t('player.unknown')),
                })}
              </span>
            </div>
          ))}
          <span className="text-sm text-ink-dim">{t(live ? 'rounds.inProgressText' : 'rounds.unplayedText')}</span>
        </Panel>
      ) : null}
    </>
  )
}
