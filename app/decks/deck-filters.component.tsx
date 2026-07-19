'use client'

import ButtonComponent from '../../components/button/button.component'
import IconComponent from '../../components/icon/icon.component'
import { DECK_SORT_OPTIONS, type DeckSortValue } from './decks.const'

type DeckFiltersProps = {
  searchValue: string
  onSearchChange: (value: string) => void
  onSearchSubmit: () => void
  archetype: string
  availableArchetypes: string[]
  onArchetypeChange: (archetype: string) => void
  sortBy: DeckSortValue
  onSortByChange: (sortBy: DeckSortValue) => void
  order: 'asc' | 'desc'
  onOrderToggle: () => void
  isPending?: boolean
}

const DeckFiltersComponent = ({
  searchValue,
  onSearchChange,
  onSearchSubmit,
  archetype,
  availableArchetypes,
  onArchetypeChange,
  sortBy,
  onSortByChange,
  order,
  onOrderToggle,
  isPending = false,
}: DeckFiltersProps) => {
  return (
    <div className="decks-filters">
      <div className="decks-filters__group">
        <span className="decks-filters__field-label">Archetype</span>
        <form
          className="decks-filters__search"
          role="search"
          onSubmit={(event) => {
            event.preventDefault()
            onSearchSubmit()
          }}
        >
          <IconComponent icon="mdi:magnify" className="decks-filters__search-icon" />
          <input
            type="search"
            className="decks-filters__search-input"
            placeholder="Search by name or #tags"
            value={searchValue}
            onChange={(event) => onSearchChange(event.target.value)}
            aria-label="Search decks by name or tags"
          />
          <ButtonComponent type="submit" variant="secondary" size="sm" loading={isPending}>
            Search
          </ButtonComponent>
        </form>
      </div>

      <div className="decks-filters__controls">
        <label className="decks-filters__field">
          <span className="decks-filters__field-label">Archetype</span>
          <select
            className="decks-filters__select"
            value={archetype}
            onChange={(event) => onArchetypeChange(event.target.value)}
          >
            <option value="">All archetypes</option>
            {availableArchetypes.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="decks-filters__field">
          <span className="decks-filters__field-label">Sort by</span>
          <select
            className="decks-filters__select"
            value={sortBy}
            onChange={(event) => onSortByChange(event.target.value as DeckSortValue)}
          >
            {DECK_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <ButtonComponent
          type="button"
          variant="ghost"
          size="sm"
          icon={order === 'desc' ? 'mdi:sort-descending' : 'mdi:sort-ascending'}
          aria-label={order === 'desc' ? 'Sorted descending, click to sort ascending' : 'Sorted ascending, click to sort descending'}
          title={order === 'desc' ? 'Descending' : 'Ascending'}
          onClick={onOrderToggle}
        />
      </div>
    </div>
  )
}

export default DeckFiltersComponent
