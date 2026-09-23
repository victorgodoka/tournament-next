import { twMerge } from 'tailwind-merge'
import { CardArt } from '@omega/card-art'
import { KIND_LABEL, PHASE_LABEL, duelistName, type MatchTimeline, type Side, type TimelineEvent, type TimelineGame } from '@utils/analytics'
import { SIDE } from './primitives'

type Players = MatchTimeline['players']

/** Turns, then runs of the same phase inside each turn — the order the log already has. */
export const groupGame = (events: TimelineEvent[]) => {
  const turns: { turn: number; turnPlayer: Side; phases: { key: string; phase: TimelineEvent['phase']; code: number; events: TimelineEvent[] }[] }[] = []
  for (const event of events) {
    let turn = turns.at(-1)
    if (!turn || turn.turn !== event.turn) {
      turn = { turn: event.turn, turnPlayer: event.turnPlayer, phases: [] }
      turns.push(turn)
    }
    let run = turn.phases.at(-1)
    if (!run || run.code !== event.phaseCode) {
      run = { key: `${event.turn}-${event.seq}`, phase: event.phase, code: event.phaseCode, events: [] }
      turn.phases.push(run)
    }
    run.events.push(event)
  }
  return turns
}

/** Who played the card: `owner`, falling back to `controller` for tokens and unknown cards. */
const actorOf = (event: TimelineEvent): Side => event.owner ?? event.controller

const EventCard = ({ event, players, respondsTo }: { event: TimelineEvent; players: Players; respondsTo?: TimelineEvent }) => {
  const actor = actorOf(event)
  const tone = SIDE[actor]
  const link = event.chain?.link ?? 0
  const crossed = event.ownership === 'deck' && event.owner !== null && event.owner !== event.controller

  return (
    <li
      className={twMerge(
        'relative min-w-0 border-t border-line py-2.5 pr-3 pl-[calc(12px+var(--indent))]',
        tone.stripe,
        actor === 'player2' ? 'lg:col-start-2' : 'lg:col-start-1',
      )}
      // Chain links step in, so CL2 sits visibly under CL1. Capped: a 10-link chain stays on screen.
      style={{ '--indent': `${Math.min(Math.max(link - 1, 0), 4) * 14}px` } as React.CSSProperties}
    >
      <div className="flex min-w-0 items-center gap-3">
        <CardArt art={{ id: event.card.id, name: event.card.name }} alt="" sizes="36px" className="size-9 shrink-0 border border-line" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-ink body-strong" title={event.card.name ?? undefined}>
            {event.card.name ?? <span className="text-ink-muted mono-data">#{event.card.id}</span>}
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-ink-muted signal-sm">
            <span className="lg:sr-only">
              <span className={tone.text}>{duelistName(players[actor])}</span> ·{' '}
            </span>
            <span className={event.kind === 'card_activated' ? 'text-ink-dim' : undefined}>
              {event.kind ? KIND_LABEL[event.kind] : `Action ${event.kindCode}`}
            </span>
            {event.ownership === 'token' ? <span className="border border-line px-1.5">Token</span> : null}
            {event.ownership === 'ambiguous' ? <span title="In both decklists: owner assumed from the field">?</span> : null}
          </p>
          {crossed ? (
            <p className="mt-0.5 truncate text-ink-muted mono-note">
              from {duelistName(players[event.owner as Side])}&apos;s deck, placed on {duelistName(players[event.controller])}&apos;s field
            </p>
          ) : null}
          {respondsTo ? (
            <p className="mt-0.5 truncate text-ink-muted mono-note">
              ↳ chained to {respondsTo.card.name ?? `#${respondsTo.card.id}`}
            </p>
          ) : null}
        </div>
        {event.chain ? (
          <span
            title={`Chain ${event.chain.id}, link ${event.chain.link}`}
            className={twMerge('shrink-0 border px-1.5 py-0.5 signal-chip tabular-nums', link > 1 ? twMerge(tone.border, tone.text) : 'border-line text-ink-muted')}
          >
            CL{event.chain.link}
          </span>
        ) : null}
      </div>
    </li>
  )
}

/**
 * The game as it was logged, turn by turn. On desktop each duelist owns a column, so a hand trap on
 * the opponent's turn sits on its own side; on a phone everything stacks with a coloured stripe.
 * Only order is shown — resolution and outcomes are not in the log.
 */
export const MatchTimelineView = ({ game, players }: { game: TimelineGame; players: Players }) => {
  if (!game.events.length) {
    return <p className="border border-dashed border-line px-4 py-8 text-center text-ink-muted body-sm">Nothing was logged for this game.</p>
  }

  const bySeq = new Map(game.events.map((event) => [event.seq, event]))
  const end =
    game.winner === 'draw' ? { text: 'Game ended — Draw', tone: 'text-draw', ground: 'bg-ground-draw' }
    : game.winner ? { text: `Game ended — ${duelistName(players[game.winner])} won`, tone: SIDE[game.winner].text, ground: SIDE[game.winner].ground }
    : { text: 'Game not finished — no result was recorded', tone: 'text-ink-muted', ground: 'bg-surface-100' }

  return (
    // Never taller than what is left of the screen under the 64px header: long games scroll inside.
    <div tabIndex={0} aria-label={`Game ${game.gameNumber} timeline`} className="max-h-[calc(100dvh-5rem)] overflow-y-auto overscroll-contain border-b border-line">
      {/* Column heads line up with the two event columns from `lg` up. */}
      <div aria-hidden className="sticky top-0 z-(--z-dropdown) hidden grid-cols-2 gap-px border border-line bg-line lg:grid">
        {(['player1', 'player2'] as const).map((side) => (
          <p key={side} className={twMerge('truncate bg-surface-100 px-3 py-2 signal-sm', SIDE[side].text)}>
            {duelistName(players[side])}
          </p>
        ))}
      </div>

      <ol className="mt-3 grid gap-4">
        {groupGame(game.events).map((turn) => {
          const tone = SIDE[turn.turnPlayer]
          const count = turn.phases.reduce((sum, run) => sum + run.events.length, 0)
          return (
            <li key={turn.turn} className="border border-line">
              <div className={twMerge('flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-line px-3 py-2', tone.ground)}>
                <span className={twMerge('display-6 tabular-nums', tone.text)}>Turn {turn.turn}</span>
                <span className="min-w-0 truncate text-ink body-strong">{duelistName(players[turn.turnPlayer])}</span>
                <span className="ml-auto text-ink-muted mono-data tabular-nums">
                  {count} action{count === 1 ? '' : 's'}
                </span>
              </div>

              {turn.phases.map((run) => (
                <div key={run.key}>
                  <p className="flex items-center gap-3 px-3 pt-2.5 pb-1.5 text-ink-muted signal-sm">
                    <span aria-hidden className="h-px w-3 bg-line" />
                    {run.phase ? PHASE_LABEL[run.phase] : `Phase ${run.code}`}
                    <span aria-hidden className="h-px flex-1 bg-line" />
                  </p>
                  {/* Two lanes with a hairline spine; the lane a duelist didn't act in stays empty. */}
                  <ol className="grid lg:grid-cols-2 lg:bg-[linear-gradient(var(--color-line),var(--color-line))] lg:bg-size-[1px_100%] lg:bg-center lg:bg-no-repeat">
                    {run.events.map((event) => (
                      <EventCard
                        key={event.seq}
                        event={event}
                        players={players}
                        respondsTo={event.chain?.respondsTo != null ? bySeq.get(event.chain.respondsTo) : undefined}
                      />
                    ))}
                  </ol>
                </div>
              ))}
            </li>
          )
        })}
      </ol>

      <p className={twMerge('mt-4 mb-3 border border-line px-3 py-3 text-center display-6', end.ground, end.tone)}>{end.text}</p>
    </div>
  )
}
