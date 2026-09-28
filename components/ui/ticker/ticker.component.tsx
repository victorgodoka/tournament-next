import { twMerge } from 'tailwind-merge'

export type TickerItem = { value?: React.ReactNode; label: React.ReactNode; delta?: number }

const Group = ({ items, hidden }: { items: TickerItem[]; hidden?: boolean }) => (
  <div aria-hidden={hidden || undefined} className="flex shrink-0">
    {items.map((item, i) => (
      <span key={i} className="flex items-center">
        <span className="flex items-center gap-2.5 px-5 py-2.5 whitespace-nowrap text-ink-muted signal">
          {item.value != null ? <b className="font-bold text-ink">{item.value}</b> : null}
          {item.label}
          {item.delta ? (
            <span className={item.delta > 0 ? 'text-win' : 'text-loss'}>
              {item.delta > 0 ? '▲' : '▼'}
              {Math.abs(item.delta)}
            </span>
          ) : null}
        </span>
        <span aria-hidden className="size-1 bg-line-mid" />
      </span>
    ))}
  </div>
)

/**
 * Marquee band of live counts under the SiteNav: only numbers that are changing, never a link, one per
 * page. The duplicate copy is hidden from screen readers; the loop stops under reduced motion.
 */
export const Ticker = ({ items, label = 'Live', className }: { items: TickerItem[]; label?: string; className?: string }) => (
  <div role="marquee" aria-label={label} className={twMerge('relative overflow-hidden border-y border-line bg-surface-100', className)}>
    <div className="flex w-max animate-ticker">
      <Group items={items} />
      <Group items={items} hidden />
    </div>
  </div>
)
