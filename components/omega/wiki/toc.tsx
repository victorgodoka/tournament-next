'use client'

import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Icon } from '@ui/icon'

export type TocItem = { anchor: string; text: string; level: 2 | 3; /** H2s only: `01`, `02`… */ num?: string }

/** The heading the reader is under: the last one to cross the band just below the fixed header. */
const useActiveAnchor = (items: TocItem[]) => {
  const [active, setActive] = useState(items[0]?.anchor)

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const crossed = entries.filter((entry) => entry.isIntersecting).at(-1)
        if (crossed) setActive(crossed.target.id)
      },
      { rootMargin: '-96px 0px -70% 0px' },
    )
    for (const { anchor } of items) {
      const heading = document.getElementById(anchor)
      if (heading) observer.observe(heading)
    }
    return () => observer.disconnect()
  }, [items])

  return active
}

const Links = ({ items, active, onPick }: { items: TocItem[]; active?: string; onPick?: () => void }) => (
  <ol>
    {items.map(({ anchor, text, level, num }) => {
      const current = anchor === active
      return (
        <li key={anchor}>
          <a
            href={`#${anchor}`}
            onClick={onPick}
            aria-current={current ? 'true' : undefined}
            className={twMerge(
              'block border-l-2 border-line px-3 py-1.5 text-[13px]/[18px] text-ink-dim hover:bg-surface-100 hover:text-ink',
              level === 3 && 'pl-10 text-xs/[18px] text-ink-muted',
              current && 'border-cyan bg-surface-100 text-ink',
            )}
          >
            {num ? <span className={twMerge('mr-2 text-ink-muted signal-sm', current && 'text-gold')}>{num}</span> : null}
            {text}
          </a>
        </li>
      )
    })}
  </ol>
)

/** Contents as a column: every heading, the current one marked. */
export const Toc = ({ items, className }: { items: TocItem[]; className?: string }) => {
  const active = useActiveAnchor(items)
  return (
    <nav aria-label="Contents" className={twMerge('flex flex-col gap-3', className)}>
      <span className="text-ink-muted signal">Contents</span>
      <Links items={items} active={active} />
    </nav>
  )
}

/** Contents on a phone: closed, it names the section the reader is in. Picking a heading closes it. */
export const TocDisclosure = ({ items, className }: { items: TocItem[]; className?: string }) => {
  const active = useActiveAnchor(items)
  const [open, setOpen] = useState(false)
  const current = items.find((item) => item.anchor === active)

  return (
    <nav aria-label="Contents" className={className}>
      <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)} className="group">
        <summary className="cut flex min-h-13 cursor-pointer list-none items-center gap-3 px-4 text-ink [--edge:var(--color-line-strong)] [&::-webkit-details-marker]:hidden">
          <span className="signal-strong">On this page</span>
          {current ? (
            <span className="min-w-0 truncate text-ink-muted signal-sm">
              {current.num} {current.text}
            </span>
          ) : null}
          <Icon name="down" size={18} className="ml-auto transition-transform group-open:rotate-180 motion-reduce:transition-none" />
        </summary>
        <div className="mt-2 max-h-[60dvh] overflow-y-auto">
          <Links items={items} active={active} onPick={() => setOpen(false)} />
        </div>
      </details>
    </nav>
  )
}
