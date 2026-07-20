"use client";

import { useCallback, useState, useTransition } from 'react'
import './decks.styles.css'
import { DecksPageProps, SavedDecksResponse } from './decks.types'
import { getSavedDecks } from './decks.api'
import { BackdropComponent, ButtonComponent, ErrorPageComponent } from '@components'
import IconComponent from '../../components/icon/icon.component'
import DeckFiltersComponent from './deck-filters.component'
import DeckCardComponent from './deck-card.component'
import { type DeckSortValue } from './decks.const'
import { buildTagParam, parseDeckSearchQuery } from './decks.utils'

type DeckQueryState = {
  name?: string
  tag?: string
  archetype: string
  sortBy: DeckSortValue
  order: 'asc' | 'desc'
  page: number
}

const INITIAL_QUERY: DeckQueryState = {
  name: undefined,
  tag: undefined,
  archetype: '',
  sortBy: 'created_at',
  order: 'desc',
  page: 1,
}

const DecksPageClient = ({ initialData, initialError }: DecksPageProps) => {
  const [error, setError] = useState<string | null>(initialError)
  const [data, setData] = useState<SavedDecksResponse | null>(initialData)
  const [query, setQuery] = useState<DeckQueryState>(INITIAL_QUERY)
  const [searchInput, setSearchInput] = useState('')
  const [isPending, startTransition] = useTransition()

  const fetchDecks = useCallback((next: DeckQueryState) => {
    startTransition(async () => {
      const result = await getSavedDecks({
        page: next.page,
        name: next.name,
        tag: next.tag,
        archetype: next.archetype || undefined,
        sortBy: next.sortBy,
        order: next.order,
      })

      if (!result.ok) {
        setQuery(INITIAL_QUERY)
        setData(initialData)
        setError(result.message)
        return
      }

      setError(null)
      setData(result.data)
      setQuery(next)
    })
  }, [initialData])

  const handleSearchSubmit = useCallback(() => {
    const { name, tags } = parseDeckSearchQuery(searchInput)
    fetchDecks({ ...query, name, tag: buildTagParam(tags), page: 1 })
  }, [fetchDecks, query, searchInput])

  const handleArchetypeChange = useCallback((archetype: string) => {
    fetchDecks({ ...query, archetype, page: 1 })
  }, [fetchDecks, query])

  const handleSortByChange = useCallback((sortBy: DeckSortValue) => {
    fetchDecks({ ...query, sortBy, page: 1 })
  }, [fetchDecks, query])

  const handleOrderToggle = useCallback(() => {
    fetchDecks({ ...query, order: query.order === 'desc' ? 'asc' : 'desc', page: 1 })
  }, [fetchDecks, query])

  const handlePageChange = useCallback((page: number) => {
    fetchDecks({ ...query, page })
  }, [fetchDecks, query])

  const handleRetry = useCallback(() => {
    fetchDecks(query)
  }, [fetchDecks, query])

  const handleReset = useCallback(() => {
    setSearchInput('')
    fetchDecks(INITIAL_QUERY)
  }, [fetchDecks])

  if (error) return <ErrorPageComponent onRetry={handleRetry} isPending={isPending} />

  const decks = data?.data ?? []
  const total = data?.pagination.total ?? 0
  const totalPages = data?.pagination.totalPages ?? 1
  const currentPage = data?.pagination.page ?? query.page
  const availableArchetypes = data?.filters.availableArchetypes ?? []
  const hasActiveFilters = Boolean(query.archetype || query.name || query.tag)

  return (
    <div className="decks-page">
      <BackdropComponent />

      <div className="decks-page__content omega-container">
        <header className="decks-page__header">
          <h1 className="decks-page__title">Community Decks</h1>
          <p className="decks-page__lead">
            Discover and share decks with the community
          </p>
        </header>

        <DeckFiltersComponent
          searchValue={searchInput}
          onSearchChange={setSearchInput}
          onSearchSubmit={handleSearchSubmit}
          archetype={query.archetype}
          availableArchetypes={availableArchetypes}
          onArchetypeChange={handleArchetypeChange}
          sortBy={query.sortBy}
          onSortByChange={handleSortByChange}
          order={query.order}
          onOrderToggle={handleOrderToggle}
          isPending={isPending}
        />

        <div className="decks-page__listing-header">
          <small className="decks-page__count">
            {total.toLocaleString()} {total === 1 ? 'deck' : 'decks'}
          </small>
          {query.archetype ? (
            <button
              type="button"
              className="decks-page__active-filter"
              onClick={() => handleArchetypeChange('')}
              aria-label={`Remove archetype filter: ${query.archetype}`}
            >
              {query.archetype}
              <IconComponent icon="mdi:close" width={14} height={14} />
            </button>
          ) : null}
        </div>

        {decks.length === 0 ? (
          <div className="decks-page__empty" role="status">
            <IconComponent icon="mdi:cards-outline" className="decks-page__empty-icon" />
            <p>No decks match your search yet.</p>
            {hasActiveFilters ? (
              <ButtonComponent
                type="button"
                variant="outline"
                size="sm"
                icon="mdi:filter-remove-outline"
                onClick={handleReset}
              >
                Clear filters
              </ButtonComponent>
            ) : null}
          </div>
        ) : (
          <ul
            className={`decks-page__listing${isPending ? ' decks-page__listing--pending' : ''}`}
            aria-busy={isPending || undefined}
          >
            {decks.map((deck) => (
              <li key={deck.id}>
                <DeckCardComponent deck={deck} onArchetypeClick={handleArchetypeChange} />
              </li>
            ))}
          </ul>
        )}

        {totalPages > 1 ? (
          <div className="decks-page__pagination">
            <button
              type="button"
              className="decks-page__page-btn"
              disabled={currentPage <= 1 || isPending}
              onClick={() => handlePageChange(currentPage - 1)}
            >
              <IconComponent icon="mdi:chevron-left" width={16} height={16} />
              Prev
            </button>
            <span className="decks-page__page-status">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              className="decks-page__page-btn"
              disabled={currentPage >= totalPages || isPending}
              onClick={() => handlePageChange(currentPage + 1)}
            >
              Next
              <IconComponent icon="mdi:chevron-right" width={16} height={16} />
            </button>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default DecksPageClient