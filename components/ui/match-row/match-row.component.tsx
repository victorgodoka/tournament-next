import { twMerge } from 'tailwind-merge'
import { Avatar } from '@ui/avatar'
import { ResultPill, type Result } from '@ui/result'

export type Duelist = { name: string; deck?: React.ReactNode; avatar?: string | null }

const Side = ({ duelist, right }: { duelist: Duelist; right?: boolean }) => (
  <div className={twMerge('flex min-w-0 items-center gap-3', right && 'flex-row-reverse text-right')}>
    <Avatar name={duelist.name} src={duelist.avatar} size="sm" />
    <div className="min-w-0">
      <b className="block truncate text-ink">{duelist.name}</b>
      {duelist.deck ? <span className="block text-ink-muted caption">{duelist.deck}</span> : null}
    </div>
  </div>
)

type MatchRowProps = {
  /** From the viewer's side; the viewer is always on the left. */
  result: Result
  /** Spaced en dash: "2 – 1". */
  score: React.ReactNode
  me: Duelist
  opp: Duelist
  meta?: React.ReactNode
  className?: string
}

/** One match in a history: result, both duelists and decks, the score in Anton, mono meta. */
export const MatchRow = ({ result, score, me, opp, meta, className }: MatchRowProps) => (
  <div
    role="listitem"
    className={twMerge(
      'grid grid-cols-[22px_minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-4 bg-surface-100 px-4 py-3 text-sm text-ink-dim hover:bg-surface-300',
      className,
    )}
  >
    <ResultPill result={result} />
    <Side duelist={me} />
    <span className="whitespace-nowrap text-ink stat">{score}</span>
    <Side duelist={opp} right />
    <span className="whitespace-nowrap text-ink-muted signal-sm">{meta}</span>
  </div>
)

/** Wraps MatchRows so they share one hairline grid. */
export const MatchList = ({ label = 'Matches', className, children }: { label?: string; className?: string; children: React.ReactNode }) => (
  <div role="list" aria-label={label} className={twMerge('flex flex-col gap-px border border-line bg-line', className)}>
    {children}
  </div>
)
