import { twMerge } from 'tailwind-merge'

export type Stat = {
  label: string
  value: React.ReactNode
  /** Gold marks a caveat (unplayed matches), cyan marks live or notable volume. */
  tone?: 'gold' | 'cyan'
}

const toneClasses = { gold: 'text-gold', cyan: 'text-cyan' }

/** Hairline grid of counts. The 1px gap over a `line` background is the rule between cells. */
export const StatGrid = ({ items, className }: { items: Stat[]; className?: string }) => (
  <dl className={twMerge('grid grid-cols-2 gap-px border border-line bg-line lg:grid-cols-4', className)}>
    {items.map(({ label, value, tone }) => (
      <div key={label} className="bg-surface-000 px-4.5 py-4">
        <dt className="text-ink-muted signal">{label}</dt>
        <dd className={twMerge('mt-1.5 display-5 tabular-nums', tone ? toneClasses[tone] : 'text-ink')}>{value}</dd>
      </div>
    ))}
  </dl>
)
