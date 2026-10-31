'use client'

import { useTranslations } from 'next-intl'
import { Segmented } from '@ui/choice'
import { Select } from '@ui/field'
import { ModeTabs } from '@ui/mode-tabs'
import type { RankedLadderId, PastSeason } from '@utils/types'

/** Every section of the page, in order: the jump bar and the headings both read it. */
export const SECTIONS = ['season', 'meta-shape', 'deck-ranking', 'matchups', 'compare', 'trends', 'sample-decks', 'cards', 'activity'] as const
export type Section = (typeof SECTIONS)[number]
export const sectionId = (s: Section) => `stat-section-${s}`
export const sectionNum = (s: Section) => String(SECTIONS.indexOf(s) + 1).padStart(2, '0')
export const LISTED = [30, 50] as const
export type Listed = (typeof LISTED)[number]

type DashboardHeaderProps = {
  ladder: RankedLadderId
  season?: string
  pastSeasons: PastSeason[]
  /** The open season's name, for the select's first option; `null` when it can't be read. */
  openLabel: string | null
  syncedLabel: string
  listed: Listed
  /** Share and download links of the whole overview. */
  actions: React.ReactNode
  onSelectLadder: (ladder: RankedLadderId) => void
  onSelectSeason: (seasonCode?: string) => void
  onSelectListed: (listed: Listed) => void
}

export const DashboardHeader = ({ ladder, season, pastSeasons, openLabel, syncedLabel, listed, actions, onSelectLadder, onSelectSeason, onSelectListed }: DashboardHeaderProps) => {
  const t = useTranslations('Statistics')
  return (
    <header className="flex flex-col gap-5 border-b border-line pb-6">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="flex flex-col gap-2">
          <h1 className="display-2 text-ink">{t('header.title')}</h1>
          <p className="max-w-2xl text-sm text-ink-dim">{t('header.lede')}</p>
        </div>
        {actions}
      </div>

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
        <div className="flex flex-col gap-1.5">
          <span className="text-ink-muted signal-sm">{t('header.listed')}</span>
          <Segmented size="sm" label={t('header.listed')} options={LISTED.map((value) => ({ value, label: String(value) }))} value={listed} onChange={onSelectListed} />
        </div>
        <span className="ml-auto font-mono text-xs text-ink-muted max-md:ml-0">{syncedLabel}</span>
      </div>

      <nav aria-label={t('nav.aria')} className="flex items-center gap-1 overflow-x-auto pb-1">
        {SECTIONS.map((id) => (
          <a key={id} href={`#${sectionId(id)}`} className="flex items-center gap-1.5 whitespace-nowrap border border-line bg-surface-100 px-3 py-1.5 text-xs font-medium text-ink-dim transition-colors hover:bg-surface-200 hover:text-ink">
            <span className="font-mono text-gold">{sectionNum(id)}</span>
            {t(`nav.${id}`)}
          </a>
        ))}
      </nav>
    </header>
  )
}
