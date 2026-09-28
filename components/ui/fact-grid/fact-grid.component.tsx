import { twMerge } from 'tailwind-merge'

export type Fact = { label: React.ReactNode; value: React.ReactNode }

const TONE = {
  raised: { grid: 'bg-line', cell: 'bg-surface-200', label: 'text-ink-muted' },
  steel: { grid: 'bg-line-mid', cell: 'bg-steel', label: 'text-ink-dim' },
}

type FactGridProps = {
  items: Fact[]
  /** Cells per row from 720px; two below. */
  columns: number
  /** `steel` inside the featured steel panel. */
  tone?: keyof typeof TONE
  className?: string
}

/**
 * Settings read at a glance: mono label over a bold value, cells split by hairline gaps. Smaller
 * than {@link StatGrid}, which is for figures.
 */
export const FactGrid = ({ items, columns, tone = 'raised', className }: FactGridProps) => (
  <dl
    style={{ '--cols': columns } as React.CSSProperties}
    className={twMerge('grid grid-cols-2 gap-px min-[720px]:grid-cols-[repeat(var(--cols),minmax(0,1fr))]', TONE[tone].grid, className)}
  >
    {items.map((item, i) => (
      <div key={i} className={twMerge('flex min-w-0 flex-col gap-1.5 px-4 py-3.5', TONE[tone].cell)}>
        <dt className={twMerge('signal-sm', TONE[tone].label)}>{item.label}</dt>
        <dd className="truncate text-[15px] font-bold text-ink">{item.value}</dd>
      </div>
    ))}
  </dl>
)
