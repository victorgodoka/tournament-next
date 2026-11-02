import { twMerge } from 'tailwind-merge'
import { archetypeName, duelistName, pct, type GameStats, type MatchStats, type Side } from '@utils/analytics'
import { formatNumber } from '@omega/profile/labels'
import Link from 'next/link'
import { CardLine, Meter, PanelLabel, StatTiles, cardHref, other } from './primitives'
import { useSideTones } from './side-tones'

type Players = MatchStats['players']

/**
 * Actions per turn as lanes: the turn player's combo in their colour, the opponent's interruptions
 * after it in theirs. Every bar carries its numbers, so the colours are never the only reading.
 */
const TurnBars = ({ game, players }: { game: GameStats; players: Players }) => {
  const SIDE = useSideTones()
  const max = Math.max(1, ...game.perTurn.map((turn) => turn.actions))

  return (
    <ol className="grid gap-2.5">
      {game.perTurn.map((turn) => {
        const own = SIDE[turn.turnPlayer]
        const theirs = SIDE[other(turn.turnPlayer)]
        return (
          <li key={turn.turn} className="grid grid-cols-[44px_minmax(0,1fr)] items-center gap-x-3 gap-y-1 sm:grid-cols-[44px_minmax(0,1fr)_minmax(0,11rem)]">
            <span className={twMerge('signal-count tabular-nums', own.text)}>T{turn.turn}</span>
            <div className="min-w-0">
              <p className="truncate text-ink-dim signal-sm">{duelistName(players[turn.turnPlayer])}</p>
              <div className="mt-1 flex h-2.5 bg-surface-200" aria-hidden>
                <span className={own.bg} style={{ width: `${(turn.turnPlayerActions / max) * 100}%` }} />
                <span className={twMerge(theirs.bg, 'opacity-60')} style={{ width: `${(turn.opponentActions / max) * 100}%` }} />
              </div>
            </div>
            <p className="col-start-2 text-ink-muted mono-data tabular-nums sm:col-start-3 sm:text-right">
              <span className="text-ink">{turn.turnPlayerActions}</span>
              {turn.opponentActions ? <span> +{turn.opponentActions} opp.</span> : null} · {turn.specialSummons} SS
              {turn.longestChain > 1 ? ` · CL${turn.longestChain}` : ''}
            </p>
          </li>
        )
      })}
    </ol>
  )
}

const PlayerColumn = ({ side, game, players }: { side: Side; game: GameStats; players: Players }) => {
  const stats = game.players[side]
  const tone = useSideTones()[side]
  const name = players[side].deckName ?? archetypeName(stats.archetype)

  return (
    <section className={twMerge('min-w-0 border border-line bg-space-000 p-4', tone.stripe)}>
      <header className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h3 className={twMerge('min-w-0 truncate display-6', tone.text)}>{duelistName(players[side])}</h3>
        <span className="text-ink-muted signal-sm">{name}</span>
      </header>

      <StatTiles
        className="mt-3.5 grid-cols-2 sm:grid-cols-2 lg:grid-cols-2"
        items={[
          { label: 'Actions', value: formatNumber(stats.actions) },
          {
            label: 'Avg combo',
            value: stats.comboLength ? stats.comboLength.average.toFixed(1) : '—',
            note: stats.comboLength ? `over ${stats.comboLength.turns} own turn${stats.comboLength.turns === 1 ? '' : 's'}` : 'no own turn',
          },
        ]}
      />

      <div className="mt-4 grid gap-3">
        {(['main', 'extra'] as const).map((part) => {
          const coverage = stats.deckCoverage[part]
          return (
            <Meter
              key={part}
              label={`${part === 'main' ? 'Main' : 'Extra'} deck used`}
              rate={coverage.rate}
              tone={tone.bg}
              value={`${coverage.used}/${coverage.total} · ${pct(coverage.rate)}`}
            />
          )
        })}
      </div>

      {stats.mostUsed.length ? (
        <>
          <PanelLabel className="mt-5">Most used</PanelLabel>
          <ol className="mt-2 grid gap-2">
            {stats.mostUsed.map((card) => (
              <li key={card.cardId}>
                <CardLine id={card.cardId} name={card.name} size="sm">
                  {card.uses} use{card.uses === 1 ? '' : 's'}
                </CardLine>
              </li>
            ))}
          </ol>
        </>
      ) : null}

      {stats.sideCardsUsed.length ? (
        <>
          <PanelLabel className="mt-5">Sided in</PanelLabel>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {stats.sideCardsUsed.map((card) => (
              <li key={card.cardId}>
                <Link href={cardHref(card.cardId)} className="block border border-line px-2 py-1 text-ink-dim no-underline signal-sm hover:border-ink-muted hover:text-ink">
                  {card.name ?? `#${card.cardId}`}
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  )
}

/** One game on its own. Games are never summed: a match total would mix two different boards. */
export const GameStatsView = ({ game, players }: { game: GameStats; players: Players }) => {
  const SIDE = useSideTones()
  return (
  <div className="grid gap-6">
    <StatTiles
      items={[
        { label: 'Went first', value: <span className={SIDE[game.firstPlayer].text}>{duelistName(players[game.firstPlayer])}</span>, tone: 'truncate display-6' },
        { label: 'Turns', value: formatNumber(game.turns) },
        { label: 'Actions', value: formatNumber(game.totalActions) },
        { label: 'Longest chain', value: game.longestChain ? `CL${game.longestChain}` : '—' },
        { label: 'Turn 1 Special Summons', value: formatNumber(game.turn1SpecialSummons), tone: 'text-cyan' },
      ]}
    />

    {game.perTurn.length ? (
      <section>
        <PanelLabel>Actions per turn</PanelLabel>
        <p className="mt-1 text-ink-muted body-sm">The turn player&apos;s actions, then what the opponent did on that turn.</p>
        <div className="mt-3.5">
          <TurnBars game={game} players={players} />
        </div>
      </section>
    ) : null}

    <div className="grid gap-4 md:grid-cols-2">
      <PlayerColumn side="player1" game={game} players={players} />
      <PlayerColumn side="player2" game={game} players={players} />
    </div>

    <section>
      <PanelLabel>Staples</PanelLabel>
      {game.staples.length ? (
        <ol className="mt-2.5 grid gap-px border border-line bg-line">
          {game.staples.map((trap) => (
            <li key={trap.seq} className={twMerge('flex flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-space-000 px-3 py-2.5', trap.player && SIDE[trap.player].stripe)}>
              <CardLine id={trap.cardId} name={trap.name} size="sm" className="flex-[1_1_220px]">
                <span className={trap.player ? SIDE[trap.player].text : undefined}>{trap.player ? duelistName(players[trap.player]) : 'unknown'}</span> · turn {trap.turn} · CL{trap.link}
              </CardLine>
              <p className="min-w-0 text-ink-muted mono-note">
                {trap.chainedTo ? (
                  <>
                    chained to <Link href={cardHref(trap.chainedTo.cardId)} className="text-ink-dim hover:text-cyan">{trap.chainedTo.name ?? `#${trap.chainedTo.cardId}`}</Link>
                  </>
                ) : (
                  'started the chain'
                )}
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <p className="mt-2.5 text-ink-muted body-sm">No enabled staple was activated this game.</p>
      )}
    </section>
  </div>
  )
}
