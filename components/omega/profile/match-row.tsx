import Link from "next/link";
import { twMerge } from "tailwind-merge";
import { CardArt } from "@omega/card-art";
import type { Match, MatchSide } from "@utils/types";
import { RESULT } from "./accent";
import { LocalTime } from "./local-time";

/** Desktop column tracks, shared by the head and every row so they line up. */
const COLS =
  "lg:grid-cols-[40px_minmax(0,1.1fr)_minmax(0,1fr)_76px_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,0.9fr)] lg:gap-x-5"

/** Every cell sits in column two on a phone and takes its own track from `lg` up. */
const CELL = "col-start-2 lg:col-auto lg:row-auto"

/** Column labels over the ledger. Hidden on phones, where each row stacks. */
export const MatchLedgerHead = () => (
  <div aria-hidden className={twMerge("hidden border-b border-line bg-ground-soft px-4 py-2.5 text-ink-muted signal-sm lg:grid", COLS)}>
    <span>Res</span>
    <span>Duelist</span>
    <span>Deck</span>
    <span>Score</span>
    <span>Opponent</span>
    <span>Their deck</span>
    <span className="text-right">When</span>
  </div>
)

/** A deck as a fan of up to three overlapping art chips plus its name. */
const DeckCell = ({ side, muted, className }: { side: MatchSide; muted?: boolean; className?: string }) => (
  <div className={twMerge("flex min-w-0 items-center gap-2.5", className)}>
    {side.cards.length ? (
      <ul aria-hidden className="flex shrink-0">
        {side.cards.map((art) => (
          <li key={art.id} className="-ml-2.5 first:ml-0">
            <CardArt art={art} alt="" sizes="36px" className="size-9 border-2 border-surface-000" />
          </li>
        ))}
      </ul>
    ) : null}
    {side.deck ? <span className={twMerge("truncate signal", muted ? "text-ink-muted" : "text-ink-dim")}>{side.deck}</span> : null}
  </div>
)

/**
 * One square per game: green for the games this duelist took, red for the opponent's.
 * The order they were played in isn't recorded, so the squares are a count, not a sequence.
 */
const ScoreCell = ({ score }: { score: Match['score'] }) => {
  if (!score.self && !score.opponent) return <span className="text-ink-muted mono-data">—</span>

  return (
    <span className="flex items-center gap-1">
      <span className="sr-only">
        {score.self}–{score.opponent}
      </span>
      {Array.from({ length: score.self }, (_, index) => (
        <span key={`w${index}`} aria-hidden className="size-2.5 bg-win" />
      ))}
      {Array.from({ length: score.opponent }, (_, index) => (
        <span key={`l${index}`} aria-hidden className="size-2.5 bg-loss" />
      ))}
    </span>
  )
}

/** "TCG ranked · Ranked ladder" says ranked twice: keep the event only when it adds something. */
const queueLabel = ({ format, event }: Match) => {
  const kind = format.split(' ').pop()?.toLowerCase()
  return !event || (kind && event.toLowerCase().includes(kind)) ? format : `${format} · ${event}`
}

/** One ledger line. `win: null` is a draw or an unfinished duel, never a loss. */
export const MatchRow = ({ match }: { match: Match }) => {
  const result = RESULT[match.win === null ? 'draw' : match.win ? 'win' : 'loss']

  return (
    <li className={twMerge("grid grid-cols-[40px_minmax(0,1fr)] items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3.5 last:border-b-0", COLS)}>
      <span className={twMerge("row-span-6 inline-flex size-10 items-center justify-center self-start text-surface-000 signal-tab lg:row-span-1 lg:self-center", result.fill)}>
        <span aria-hidden>{result.label[0]}</span>
        <span className="sr-only">{result.label}</span>
      </span>

      <div className={twMerge("min-w-0", CELL)}>
        <p className="truncate text-ink body-strong">{match.self.name || 'Unknown duelist'}</p>
        <p className="mt-0.5 truncate text-ink-muted signal-sm">{queueLabel(match)}</p>
      </div>

      <DeckCell side={match.self} className={CELL} />

      <span className={CELL}>
        <ScoreCell score={match.score} />
      </span>

      <div className={twMerge("min-w-0", CELL)}>
        <span className="sr-only">versus </span>
        <Link href={`/profile/${match.opponent.id}`} className="block truncate text-ink body-strong hover:text-gold">
          {match.opponent.name || 'Unknown duelist'}
        </Link>
      </div>

      <DeckCell side={match.opponent} muted className={CELL} />

      <p className={twMerge("text-ink-muted mono-data lg:text-right", CELL)}>
        {match.when ? <LocalTime iso={match.when} options={{ dateStyle: 'medium', timeStyle: 'short' }} /> : '—'}
      </p>
    </li>
  )
}
