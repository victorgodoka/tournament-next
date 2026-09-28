import { twMerge } from 'tailwind-merge'

export type BracketSide = { seed?: number; name: string | null; score?: number }
export type BracketRound = { name: string; matches: Array<{ a: BracketSide; b: BracketSide; live?: boolean }> }

const Side = ({ side, winner }: { side: BracketSide; winner: boolean }) => (
  <div
    className={twMerge(
      'grid h-8.5 grid-cols-[22px_1fr_24px] items-center gap-2 pr-3 pl-2 text-sm text-ink-dim [&+&]:border-t [&+&]:border-line',
      winner && 'font-bold text-ink',
    )}
  >
    <span className="text-center font-mono text-[10px] leading-none text-ink-muted">{side.seed ?? ''}</span>
    <span className="truncate">{side.name ?? 'TBD'}</span>
    <span className={twMerge('text-right font-display text-lg leading-none tabular-nums', winner && 'text-win')}>{side.score ?? '–'}</span>
  </div>
)

/**
 * Single elimination: rounds are columns, matches are chamfered two-row plates joined by hairline
 * connectors. The winner goes bold with the score in `win`; a live match gets the cyan edge and glow.
 * Scrolls sideways on narrow screens; plates never go under 212px.
 */
export const Bracket = ({ rounds, label = 'Bracket', className }: { rounds: BracketRound[]; label?: string; className?: string }) => (
  <div role="group" aria-label={label} className={twMerge('flex gap-8 overflow-x-auto border border-line bg-surface-100 p-5', className)}>
    {rounds.map((round, ri) => (
      <div key={ri} className="flex min-w-53 flex-col">
        <div className="mb-4 border-b border-line pb-2 text-ink-muted signal-sm">{round.name}</div>
        <div className="flex flex-1 flex-col justify-around gap-4">
          {round.matches.map((m, mi) => {
            const done = !m.live && m.a.score != null && m.b.score != null
            return (
              <div
                key={mi}
                className={twMerge('relative', ri < rounds.length - 1 && 'after:absolute after:top-1/2 after:-right-8 after:h-px after:w-8 after:bg-line-mid')}
              >
                <div
                  aria-label={`${m.a.name ?? 'TBD'} vs ${m.b.name ?? 'TBD'}${m.live ? ', live' : ''}`}
                  className={twMerge(
                    'cut flex flex-col [--cut:var(--cut-xs)] [--fill:var(--color-surface-200)]',
                    m.live && 'drop-shadow-[0_0_8px_rgba(0,253,255,0.35)] [--edge:var(--color-cyan)]',
                  )}
                >
                  <Side side={m.a} winner={done && m.a.score! > m.b.score!} />
                  <Side side={m.b} winner={done && m.b.score! > m.a.score!} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    ))}
  </div>
)
