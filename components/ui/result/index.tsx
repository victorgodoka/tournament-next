import { twMerge } from 'tailwind-merge'

export type Result = 'W' | 'L' | 'D'

const LABEL: Record<Result, string> = { W: 'Win', L: 'Loss', D: 'Draw' }
const FILL: Record<Result, string> = { W: 'bg-win', L: 'bg-loss', D: 'bg-draw' }

/** One result as a mono letter on its color. The letter carries the meaning; the color confirms it. */
export const ResultPill = ({ result, className }: { result: Result; className?: string }) => (
  <span
    title={LABEL[result]}
    aria-label={LABEL[result]}
    className={twMerge('inline-grid size-5.5 shrink-0 place-items-center rounded-xs font-mono text-[11px] leading-none font-bold text-space-000', FILL[result], className)}
  >
    {result}
  </span>
)
