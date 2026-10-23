'use client'

import { useTranslations } from 'next-intl'
import { twMerge } from 'tailwind-merge'
import { Icon } from '@ui/icon'
import { Select } from '@ui/field'
import { ModeTabs } from '@ui/mode-tabs'
import type { RankedLadderId, PastSeason } from '@utils/types'
import { NAV, type NavSection } from './DashboardSidebar'

type DashboardHeaderProps = {
  ladder: RankedLadderId
  season?: string
  pastSeasons: PastSeason[]
  /** The open season's name, for the select's first option; `null` when it can't be read. */
  openLabel: string | null
  syncedDaysCount: number
  lastSyncedDate?: string
  activeSection: NavSection
  onSelectLadder: (ladder: RankedLadderId) => void
  onSelectSeason: (seasonCode?: string) => void
  onSelectSection: (section: NavSection) => void
}

export const DashboardHeader = ({
  ladder,
  season,
  pastSeasons,
  openLabel,
  syncedDaysCount,
  lastSyncedDate,
  activeSection,
  onSelectLadder,
  onSelectSeason,
  onSelectSection,
}: DashboardHeaderProps) => {
  const t = useTranslations('Statistics')
  return (
    <header className="flex flex-col gap-5 border-b border-line pb-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="flex flex-col gap-1">
          <h1 className="display-2 text-ink">{t('header.title')}</h1>
          <p className="max-w-2xl text-sm text-ink-dim">{t('header.lede')}</p>
        </div>
        <div className="flex flex-col gap-1 font-mono text-xs text-ink-muted md:items-end">
          <span className="text-ink-dim">
            {lastSyncedDate ? t('header.updated', { date: lastSyncedDate, days: syncedDaysCount }) : t('header.noDays')}
          </span>
          <span>{t('header.coverage', { format: ladder === 'genesys' ? 'Genesys' : 'TCG' })}</span>
        </div>
      </div>

      {/* Global filters */}
      <div className="flex flex-wrap items-end gap-4">
        <ModeTabs
          label={t('header.format')}
          items={[
            { id: 'tcg', label: 'TCG' },
            { id: 'genesys', label: 'Genesys' },
          ] as const}
          value={ladder}
          onChange={onSelectLadder}
        />
        <div className="min-w-60">
          <Select
            label={t('header.season')}
            value={season ?? ''}
            onChange={(e) => onSelectSeason(e.target.value || undefined)}
            options={[
              { value: '', label: openLabel ? t('header.open', { label: openLabel }) : t('header.openFallback') },
              ...pastSeasons.map((s) => ({ value: s.code, label: s.label })),
            ]}
          />
        </div>
      </div>

      {/* Below lg the sidebar is hidden: these pills stand in for it. */}
      <nav aria-label={t('nav.aria')} className="flex items-center gap-1 overflow-x-auto pb-1 lg:hidden">
        {NAV.map((item) => (
          <button
            key={item.id}
            type="button"
            aria-current={activeSection === item.id ? 'location' : undefined}
            onClick={() => onSelectSection(item.id)}
            className={twMerge(
              'flex cursor-pointer items-center gap-1.5 whitespace-nowrap border px-3 py-1.5 text-xs font-medium transition-colors',
              activeSection === item.id
                ? 'border-cyan bg-surface-300 text-cyan'
                : 'border-line bg-surface-100 text-ink-dim hover:bg-surface-200 hover:text-ink',
            )}
          >
            <Icon name={item.icon} size={14} />
            {t(`nav.${item.id}`)}
          </button>
        ))}
      </nav>
    </header>
  )
}
