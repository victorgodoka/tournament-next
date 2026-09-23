'use client'

import { twMerge } from 'tailwind-merge'

type TabBarProps<T extends string> = {
  tabs: ReadonlyArray<{ id: T; label: React.ReactNode }>
  /** `id` of the selected tab. */
  active: T
  onSelect: (id: T) => void
  /** Names the tab list for screen readers. */
  label: string
  /** Links each tab to its panel; spread {@link tabPanelProps} with the same prefix on the panel. */
  idPrefix?: string
  /** Underlines the active tab in cyan instead of gold. */
  tone?: 'gold' | 'cyan'
  className?: string
}

const tabId = (prefix: string, id: string) => `${prefix}-tab-${id}`
const panelId = (prefix: string, id: string) => `${prefix}-panel-${id}`

/** Props for the panel a tab shows. One swapping panel passes the active id; one panel per tab passes its own. */
export const tabPanelProps = (prefix: string, id: string) => ({
  role: 'tabpanel',
  id: panelId(prefix, id),
  'aria-labelledby': tabId(prefix, id),
}) as const

const STEP: Partial<Record<string, number>> = { ArrowRight: 1, ArrowLeft: -1 }

/**
 * Equal-width mono tabs over a hairline. The active one takes a ground, an ink shift and a 2px underline.
 * Arrow keys, Home and End move between tabs and select as they go (roving tab index).
 */
export const TabBar = <T extends string>({ tabs, active, onSelect, label, idPrefix, tone = 'gold', className }: TabBarProps<T>) => {
  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const index = tabs.findIndex((tab) => tab.id === active)
    const step = STEP[e.key]
    const next =
      e.key === 'Home' ? 0
      : e.key === 'End' ? tabs.length - 1
      : step ? (index + step + tabs.length) % tabs.length
      : -1
    const tab = tabs[next]
    if (!tab) return
    e.preventDefault()
    onSelect(tab.id)
    e.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
  }

  return (
    <div role="tablist" aria-label={label} onKeyDown={onKeyDown} className={twMerge('w-full flex shrink-0 border-b border-line', className)}>
      {tabs.map(({ id, label: tabLabel }) => {
        const isActive = id === active
        return (
          <button
            key={id}
            type="button"
            role="tab"
            id={idPrefix ? tabId(idPrefix, id) : undefined}
            aria-controls={idPrefix ? panelId(idPrefix, id) : undefined}
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onSelect(id)}
            className={twMerge(
              'min-h-11 min-w-0 flex-1 cursor-pointer px-2.5 signal-tab',
              isActive
                ? twMerge('bg-ground-soft text-ink', tone === 'cyan' ? 'shadow-tab-active-cyan' : 'shadow-tab-active')
                : 'text-ink-muted hover:text-ink-dim',
            )}
          >
            {tabLabel}
          </button>
        )
      })}
    </div>
  )
}
