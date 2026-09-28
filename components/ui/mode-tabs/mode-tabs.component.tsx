import { twMerge } from 'tailwind-merge'
import { Icon, type IconName } from '@ui/icon'

type ModeTabsProps<T extends string> = {
  items: ReadonlyArray<{ id: T; label: React.ReactNode; icon?: IconName }>
  value: T
  onChange: (id: T) => void
  /** Names the switch for screen readers. */
  label: string
  className?: string
}

/**
 * Segmented switch for 2–5 peer modes that swap the same view (Ranked, Casual, Event, Host).
 * The selected segment takes a cyan edge on ground-cyan. For sections of a page, use TabBar.
 */
export const ModeTabs = <T extends string>({ items, value, onChange, label, className }: ModeTabsProps<T>) => (
  <div role="tablist" aria-label={label} className={twMerge('inline-flex gap-1 border border-line bg-surface-100 p-1', className)}>
    {items.map((item) => {
      const selected = item.id === value
      return (
        <button
          key={item.id}
          type="button"
          role="tab"
          aria-selected={selected}
          onClick={() => onChange(item.id)}
          className={twMerge(
            'cut inline-flex h-9 cursor-pointer items-center gap-2 px-4 signal-strong [--edge:transparent] [--fill:transparent]',
            selected
              ? 'text-ink [--edge:var(--color-cyan)] [--fill:var(--color-ground-cyan)]'
              : 'text-ink-muted hover:text-ink hover:[--fill:var(--color-surface-300)]',
          )}
        >
          {item.icon ? <Icon name={item.icon} size={16} className={selected ? 'text-cyan' : undefined} /> : null}
          {item.label}
        </button>
      )
    })}
  </div>
)
