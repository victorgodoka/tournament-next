'use client'

import { Icon } from '@iconify/react'
import { twMerge } from 'tailwind-merge'
import { Select } from '@ui/field'
import { ModeTabs } from '@ui/mode-tabs'
import type { RankedLadderId, PastSeason } from '@utils/types'
import type { NavSection } from './DashboardSidebar'

type DashboardHeaderProps = {
  ladder: RankedLadderId
  season?: string
  pastSeasons: PastSeason[]
  syncedDaysCount?: number
  lastSyncedDate?: string | null
  activeSection: string
  onSelectLadder: (ladder: RankedLadderId) => void
  onSelectSeason: (seasonCode?: string) => void
  onSelectSection: (section: NavSection) => void
}

const SUBNAV_ITEMS: { id: NavSection; label: string; icon: string }[] = [
  { id: 'overview', label: 'Visão geral', icon: 'mdi:view-dashboard-outline' },
  { id: 'deck-ranking', label: 'Ranking de decks', icon: 'mdi:trophy-outline' },
  { id: 'matchup-matrix', label: 'Matchup matrix', icon: 'mdi:grid' },
  { id: 'archetype-analysis', label: 'Análise de arquétipos', icon: 'mdi:hexagon-outline' },
  { id: 'cards', label: 'Cartas', icon: 'mdi:cards-outline' },
  { id: 'trends', label: 'Tendências', icon: 'mdi:chart-line' },
]

export const DashboardHeader = ({
  ladder,
  season,
  pastSeasons,
  syncedDaysCount,
  lastSyncedDate,
  activeSection,
  onSelectLadder,
  onSelectSeason,
  onSelectSection,
}: DashboardHeaderProps) => {
  const formatName = ladder === 'genesys' ? 'Genesys' : 'TCG'

  return (
    <header className="flex flex-col gap-5 border-b border-line pb-6">
      {/* Title & Metadata Top Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h1 className="display-2 text-ink text-2xl sm:text-3xl font-extrabold tracking-tight">
              Estatísticas
            </h1>
          </div>
          <p className="text-ink-dim text-xs sm:text-sm max-w-2xl">
            Explore dados reais do meta de YGO Omega. Descubra os decks mais fortes, entenda os matchups e tome decisões melhores.
          </p>
        </div>

        {/* Sync Info Badge */}
        <div className="flex flex-col md:items-end gap-1 text-xs font-mono text-ink-muted">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-round bg-win animate-pulse" />
            <span className="text-ink-dim font-medium">
              Dados atualizados {lastSyncedDate ? `em ${lastSyncedDate}` : 'recentemente'}
            </span>
          </div>
          <span>Cobertura: {formatName} · Exclui mirrors · Melhor de 3</span>
        </div>
      </div>

      {/* Global Filters Row */}
      <div className="flex flex-wrap items-center justify-between gap-4 p-3 bg-surface-100 border border-line rounded-xs">
        <div className="flex flex-wrap items-center gap-4">
          {/* Format */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-ink-muted uppercase">Formato:</span>
            <ModeTabs
              label="Formato"
              items={[
                { id: 'tcg', label: 'TCG' },
                { id: 'genesys', label: 'Genesys' },
              ] as const}
              value={ladder}
              onChange={onSelectLadder}
            />
          </div>

          {/* Season select */}
          <div className="flex items-center gap-2 min-w-44">
            <span className="text-xs font-mono text-ink-muted uppercase">Temporada:</span>
            <Select
              label="Temporada"
              value={season ?? ''}
              onChange={(e) => onSelectSeason(e.target.value || undefined)}
              options={[
                { value: '', label: 'Temporada aberta' },
                ...pastSeasons.map((s) => ({ value: s.code, label: s.label })),
              ]}
              className="text-xs"
            />
          </div>
        </div>

        {syncedDaysCount != null && (
          <span className="text-xs font-mono text-ink-muted hidden sm:inline">
            {syncedDaysCount} dias sincronizados
          </span>
        )}
      </div>

      {/* Horizontal Nav Pills (Mobile & Desktop quick anchors) */}
      <nav aria-label="Navegação rápida" className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-none">
        {SUBNAV_ITEMS.map((item) => {
          const isActive = activeSection === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectSection(item.id)}
              className={twMerge(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xs whitespace-nowrap transition-colors cursor-pointer',
                isActive
                  ? 'bg-azure text-ink font-bold shadow-sm'
                  : 'text-ink-dim hover:text-ink hover:bg-surface-200 bg-surface-100 border border-line'
              )}
            >
              <Icon icon={item.icon} className="text-sm shrink-0" />
              <span>{item.label}</span>
            </button>
          )
        })}
      </nav>
    </header>
  )
}
