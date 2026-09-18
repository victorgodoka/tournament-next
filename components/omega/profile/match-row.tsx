import { twMerge } from "tailwind-merge";
import { CardArt } from "@omega/card-art";
import type { Match, MatchSide } from "@utils/types";
import { LocalTime } from "./local-time";

const MatchSideBlock = ({ side, mirrored }: { side: MatchSide; mirrored?: boolean }) => (
  <div className={twMerge("flex items-center gap-4", mirrored && "lg:flex-row-reverse")}>
    <ul className="flex shrink-0 gap-[3px]">
      {side.cards.map((art) => (
        <li key={art.id}>
          <CardArt art={art} sizes="46px" className="size-11.5 border border-line" />
        </li>
      ))}
    </ul>
    <div className={twMerge("flex min-w-0 flex-col", mirrored && "lg:items-end lg:text-right")}>
      <p className="text-ink display-6">{side.name ?? 'Unknown duelist'}</p>
      {side.deck ? <p className="mt-1.5 font-mono text-[11px] text-ink-muted">{side.deck}</p> : null}
    </div>
  </div>
)

/** `win: null` is a draw or an unfinished duel, never a loss. */
/** Same colors as the form streak: a win reads as confirmed (cyan), a loss as caution (gold). */
const RESULT = {
  win: { label: 'Win', bar: 'bg-cyan', tag: 'bg-cyan text-cyan-on', tint: 'bg-ground-cyan' },
  loss: { label: 'Loss', bar: 'bg-gold', tag: 'bg-gold text-gold-on', tint: 'bg-ground-gold' },
  draw: { label: 'Draw', bar: 'bg-surface-400', tag: 'bg-surface-400 text-ink-dim', tint: '' },
}

export const MatchRow = ({ match }: { match: Match }) => {
  const result = RESULT[match.win === null ? 'draw' : match.win ? 'win' : 'loss']

  return (
    <article className={twMerge("grid grid-cols-[6px_minmax(0,1fr)] border-b border-line", result.tint)}>
      <div aria-hidden className={result.bar} />
      <div className="px-5.5 py-5 lg:px-11">
        <div className="flex flex-wrap items-center gap-3.5 signal">
          <span className={twMerge("px-2.5 py-1 signal-chip tracking-[.2em]", result.tag)}>{result.label}</span>
          <span className="text-ink">{match.score.self} - {match.score.opponent}</span>
          <span className="text-ink-muted">{match.format}</span>
          <span className="text-ink-muted">{match.event}</span>
          <span className="min-w-0 flex-1" />
          {match.when ? (
            <span className="text-ink-muted">
              <LocalTime iso={match.when} options={{ dateStyle: 'medium', timeStyle: 'short' }} />
            </span>
          ) : null}
        </div>

        <div className="mt-4 grid grid-cols-1 items-center lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-6">
          <MatchSideBlock side={match.self} />
          <div className="my-2.5 border-y border-line py-2.5 text-center text-ink-muted display-6 tracking-[.08em] lg:my-0 lg:border-x lg:border-y-0 lg:px-2 lg:py-0">
            VS
          </div>
          <MatchSideBlock side={match.opponent} mirrored />
        </div>
      </div>
    </article>
  )
}
