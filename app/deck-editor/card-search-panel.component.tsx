'use client'

import { useMemo, useState } from 'react'
import type { Card } from '@lib/cards.types'
import IconComponent from '@components/icon/icon.component'
import CardFiltersComponent from './card-filters.component'
import CardGrid from './card-grid.component'
import { useCardSearch } from './use-card-search'
import type { CardFilters, EditorState } from './deck-editor.types'

interface CardSearchPanelProps {
  state: EditorState
  onOpen: (card: Card) => void
  onAdd: (card: Card) => void
  onRemove: (card: Card) => void
}

const activeCount = (filters: CardFilters): number =>
  Object.entries(filters).filter(([key, value]) => key !== 'name' && value !== undefined && value !== '').length

const CardSearchPanel = ({ state, onOpen, onAdd, onRemove }: CardSearchPanelProps) => {
  const [filters, setFilters] = useState<CardFilters>({})
  const [filtersOpen, setFiltersOpen] = useState(false)
  const search = useCardSearch(filters, state.format)

  const patch = (update: Partial<CardFilters>) => setFilters((prev) => ({ ...prev, ...update }))
  const reset = () => setFilters((prev) => ({ name: prev.name }))
  const filterBadge = useMemo(() => activeCount(filters), [filters])

  return (
    <section className="search-panel" aria-label="Card search">
      <div className="search-panel__bar">
        <div className="search-panel__search">
          <IconComponent icon="mdi:magnify" width={18} height={18} />
          <input
            type="search"
            className="search-panel__input"
            placeholder="Search cards by name…"
            value={filters.name ?? ''}
            onChange={(e) => patch({ name: e.target.value || undefined })}
            aria-label="Search cards by name"
          />
        </div>
        <button
          type="button"
          className="search-panel__filter-toggle"
          aria-expanded={filtersOpen}
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <IconComponent icon="mdi:tune-variant" width={18} height={18} />
          <span>Filters</span>
          {filterBadge > 0 && <span className="search-panel__filter-count">{filterBadge}</span>}
        </button>
      </div>

      <CardFiltersComponent
        filters={filters}
        onChange={patch}
        onReset={reset}
        open={filtersOpen}
      />

      <CardGrid
        cards={search.cards}
        state={state}
        total={search.total}
        loading={search.loading}
        hasMore={search.hasMore}
        error={search.error}
        onLoadMore={search.loadMore}
        onOpen={onOpen}
        onAdd={onAdd}
        onRemove={onRemove}
      />
    </section>
  )
}

export default CardSearchPanel
