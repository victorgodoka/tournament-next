'use client'

import { Icon } from '@iconify/react'
import { twMerge } from 'tailwind-merge'

export type NavSection =
  | 'overview'
  | 'deck-ranking'
  | 'matchup-matrix'
  | 'archetype-analysis'
  | 'cards'
  | 'trends'
  | 'deck-comparator'
  | 'meta-history'
  | 'deep-dive'
  | 'card-search'

type DashboardSidebarProps = {
  activeSection: string
  onSelectSection: (section: NavSection) => void
  className?: string
}

const MAIN_NAV = [
  { id: 'overview', label: 'Visão geral', icon: 'mdi:view-dashboard-outline' },
  { id: 'deck-ranking', label: 'Ranking de decks', icon: 'mdi:trophy-outline' },
  { id: 'matchup-matrix', label: 'Matchup matrix', icon: 'mdi:grid' },
  { id: 'archetype-analysis', label: 'Análise de arquétipos', icon: 'mdi:hexagon-outline' },
  { id: 'cards', label: 'Cartas', icon: 'mdi:cards-outline' },
  { id: 'trends', label: 'Tendências', icon: 'mdi:chart-line' },
  { id: 'deck-comparator', label: 'Comparador de decks', icon: 'mdi:compare' },
  { id: 'meta-history', label: 'Histórico do meta', icon: 'mdi:history' },
] as const

const EXPLORE_NAV = [
  { id: 'deep-dive', label: 'Arquétipos', icon: 'mdi:circle-outline' },
  { id: 'card-search', label: 'Cartas', icon: 'mdi:circle-outline' },
] as const

export const DashboardSidebar = ({ activeSection, onSelectSection, className }: DashboardSidebarProps) => {
  return (
    <aside
      aria-label="Navegação de estatísticas"
      className={twMerge(
        'w-[210px] shrink-0 sticky top-24 h-[calc(100vh-120px)] hidden lg:flex flex-col gap-6 py-2 pr-3 overflow-y-auto select-none',
        className,
      )}
    >
      {/* Active Brand Capsule */}
      <div className="flex items-center gap-2.5 px-3 py-2 bg-azure/20 border border-azure/40 rounded-xs text-ink">
        <Icon icon="mdi:chart-box-outline" className="text-azure-lift text-lg shrink-0" />
        <span className="font-bold text-sm tracking-wide">Estatísticas</span>
      </div>

      {/* Main Sections */}
      <nav aria-label="Seções principais" className="flex flex-col gap-0.5">
        {MAIN_NAV.map((item) => {
          const isActive = activeSection === item.id
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onSelectSection(item.id as NavSection)}
              className={twMerge(
                'flex items-center gap-2.5 px-3 py-2 text-xs font-medium rounded-xs transition-colors cursor-pointer text-left',
                isActive
                  ? 'bg-surface-300 text-cyan shadow-selected border-l-2 border-cyan font-semibold'
                  : 'text-ink-dim hover:text-ink hover:bg-surface-200',
              )}
            >
              <Icon icon={item.icon} className={twMerge('text-base shrink-0', isActive ? 'text-cyan' : 'text-ink-muted')} />
              <span className="truncate">{item.label}</span>
            </button>
          )
        })}
      </nav>

      {/* Explorer Sections */}
      <div className="flex flex-col gap-1 pt-2 border-t border-line">
        <p className="px-3 py-1 font-mono text-[10px] uppercase tracking-[0.1em] text-ink-muted">
          Explorar
        </p>
        <nav aria-label="Explorar detalhes" className="flex flex-col gap-0.5">
          {EXPLORE_NAV.map((item) => {
            const isActive = activeSection === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectSection(item.id as NavSection)}
                className={twMerge(
                  'flex items-center gap-2.5 px-3 py-1.5 text-xs font-medium rounded-xs transition-colors cursor-pointer text-left',
                  isActive
                    ? 'bg-surface-300 text-cyan shadow-selected border-l-2 border-cyan font-semibold'
                    : 'text-ink-dim hover:text-ink hover:bg-surface-200',
                )}
              >
                <Icon icon={item.icon} className={twMerge('text-sm shrink-0', isActive ? 'text-cyan' : 'text-ink-muted')} />
                <span className="truncate">{item.label}</span>
              </button>
            )
          })}
        </nav>
      </div>
    </aside>
  )
}
