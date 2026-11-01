import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import { Icon, type IconName } from '@ui/icon'

type ModeTabsProps<T extends string> = {
  /** With `href`, a segment is a link and the switch needs no `onChange`: a server component can drive it from the URL. */
  items: ReadonlyArray<{ id: T; label: React.ReactNode; icon?: IconName; href?: string }>
  value: T
  onChange?: (id: T) => void
  /** Names the switch for screen readers. */
  label: string
  className?: string
}

const SEGMENT = 'cut inline-flex h-9 cursor-pointer items-center gap-2 px-4 signal-strong [--edge:transparent] [--fill:transparent]'
const ON = 'text-ink [--edge:var(--color-cyan)] [--fill:var(--color-ground-cyan)]'
const OFF = 'text-ink-muted hover:text-ink hover:[--fill:var(--color-surface-300)]'

/**
 * Segmented switch for 2–5 peer modes that swap the same view (Ranked, Casual, Event, Host).
 * The selected segment takes a cyan edge on ground-cyan. For sections of a page, use TabBar.
 */
export const ModeTabs = <T extends string>({ items, value, onChange, label, className }: ModeTabsProps<T>) => {
  const links = items.some((item) => item.href)
  const Box = links ? 'nav' : 'div'
  return (
    <Box role={links ? undefined : 'tablist'} aria-label={label} className={twMerge('inline-flex gap-1 border border-line bg-surface-100 p-1', className)}>
      {items.map((item) => {
        const selected = item.id === value
        const content = (
          <>
            {item.icon ? <Icon name={item.icon} size={16} className={selected ? 'text-cyan' : undefined} /> : null}
            {item.label}
          </>
        )
        return item.href ? (
          <Link key={item.id} href={item.href} scroll={false} aria-current={selected ? 'page' : undefined} className={twMerge(SEGMENT, selected ? ON : OFF)}>
            {content}
          </Link>
        ) : (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange?.(item.id)}
            className={twMerge(SEGMENT, selected ? ON : OFF)}
          >
            {content}
          </button>
        )
      })}
    </Box>
  )
}
