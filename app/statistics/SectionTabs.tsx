'use client'

import { useSyncExternalStore } from 'react'
import { twMerge } from 'tailwind-merge'

export type SectionTab = { id: string; label: string; panel: React.ReactNode }

/** The tab lives in the URL hash (`#face`), so a link can open one and reload keeps it. */
const HASH_EVENT = 'statistics-hash'
const subscribe = (notify: () => void) => {
  window.addEventListener('hashchange', notify)
  window.addEventListener(HASH_EVENT, notify)
  return () => {
    window.removeEventListener('hashchange', notify)
    window.removeEventListener(HASH_EVENT, notify)
  }
}
const readHash = () => window.location.hash.slice(1)
const noHash = () => ''

const STEP: Partial<Record<string, number>> = { ArrowRight: 1, ArrowLeft: -1 }

/**
 * Numbered section tabs: `01 What to play`. Only the open panel is mounted, so a client section (How to beat a deck)
 * spends its requests only when it is opened. Under 720px the bar sticks to the top and scrolls sideways.
 */
export const SectionTabs = ({ tabs, label }: { tabs: SectionTab[]; label: string }) => {
  const hash = useSyncExternalStore(subscribe, readHash, noHash)
  const active = tabs.find((t) => t.id === hash) ?? tabs[0]!
  const pick = (id: string) => {
    window.history.replaceState(window.history.state, '', `${window.location.pathname}${window.location.search}#${id}`)
    window.dispatchEvent(new Event(HASH_EVENT))
  }
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.indexOf(active)
    const step = STEP[e.key]
    const next = e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : step ? (index + step + tabs.length) % tabs.length : -1
    const tab = tabs[next]
    if (!tab) return
    e.preventDefault()
    pick(tab.id)
    e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
  }

  return (
    <>
      <div className="overflow-x-auto border-b border-line max-[719px]:sticky max-[719px]:top-0 max-[719px]:z-30 max-[719px]:-mx-4 max-[719px]:bg-space-000 max-[719px]:px-2">
        <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className="flex gap-1 max-[719px]:w-max max-[719px]:gap-0.5">
          {tabs.map((tab, i) => {
            const on = tab === active
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                id={`tab-${tab.id}`}
                aria-controls={`panel-${tab.id}`}
                aria-selected={on}
                tabIndex={on ? 0 : -1}
                onClick={() => pick(tab.id)}
                className={twMerge(
                  'inline-flex min-h-13 flex-none cursor-pointer items-center gap-2.5 px-5 whitespace-nowrap signal-strong transition-colors duration-[120ms] ease-out focus-visible:shadow-focus-ring focus-visible:outline-none max-[719px]:min-h-12 max-[719px]:gap-2 max-[719px]:px-3.5',
                  on ? 'text-ink shadow-tab-active' : 'text-ink-muted hover:bg-surface-100 hover:text-ink',
                )}
              >
                <span className="font-display text-lg leading-none text-gold max-[719px]:text-base">{String(i + 1).padStart(2, '0')}</span>
                {tab.label}
              </button>
            )
          })}
        </div>
      </div>
      <section id={`panel-${active.id}`} role="tabpanel" aria-labelledby={`tab-${active.id}`} className="flex flex-col gap-6 max-[719px]:gap-4">
        {active.panel}
      </section>
    </>
  )
}
