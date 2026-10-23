'use client'

import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { Icon, type IconName } from '@ui/icon'

/** Every section the dashboard renders, in page order: the sidebar and the mobile pills both read it. */
export const NAV = [
  { id: 'overview', icon: 'chart' },
  { id: 'trends', icon: 'history' },
  { id: 'deck-ranking', icon: 'trophy' },
  { id: 'matchup-matrix', icon: 'brick' },
  { id: 'archetype-analysis', icon: 'deck' },
  { id: 'cards', icon: 'cards' },
  { id: 'deep-dive', icon: 'search' },
  { id: 'sample-decks', icon: 'copy' },
] as const satisfies readonly { id: string; icon: IconName }[]

export type NavSection = (typeof NAV)[number]['id']

type DashboardSidebarProps = {
  activeSection: NavSection
  onSelectSection: (section: NavSection) => void
}

export const DashboardSidebar = ({ activeSection, onSelectSection }: DashboardSidebarProps) => {
  const t = useTranslations('Statistics.nav')
  return (
    <aside aria-label={t('aria')} className="sticky top-24 hidden w-[200px] shrink-0 select-none lg:block">
      <nav className="flex flex-col gap-0.5">
        {NAV.map((item) => {
          const isActive = activeSection === item.id
          return (
            <button
              key={item.id}
              type="button"
              aria-current={isActive ? 'location' : undefined}
              onClick={() => onSelectSection(item.id)}
              className={twMerge(
                'flex cursor-pointer items-center gap-2.5 border-l-2 px-3 py-2 text-left text-xs font-medium transition-colors',
                isActive
                  ? 'border-cyan bg-surface-300 font-semibold text-cyan'
                  : 'border-transparent text-ink-dim hover:bg-surface-200 hover:text-ink',
              )}
            >
              <Icon name={item.icon} size={16} className={isActive ? 'text-cyan' : 'text-ink-muted'} />
              <span className="truncate">{t(item.id)}</span>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
