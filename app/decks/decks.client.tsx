"use client";

import { useCallback, useRef, useState, useTransition } from 'react'
import './decks.styles.css'
import { DeckQuery, DecksPageProps, SavedDecksResponse } from './decks.types'
import { getDecksInfo, getSavedDecks } from './decks.api'
import BackdropComponent from '@components/backdrop/backdrop.component'
import ButtonComponent from '@components/button/button.component'
import ErrorPageComponent from '@components/error-page/error-page.component'
import IconComponent from '@components/icon/icon.component'
import DeckFiltersComponent from './deck-filters.component'
import DeckCardComponent from './deck-card.component'
import { INITIAL_DECK_QUERY, type DeckSortValue } from './decks.const'
import {
  buildDecksUrl,
  buildSearchInput,
  buildTagParam,
  getArchetypeOptions,
  parseDeckSearchQuery,
} from './decks.utils'

const DecksPageClient = ({
  initialData,
  initialError,
  initialInfo,
  initialQuery,
  initialNotice,
}: DecksPageProps) => {
  const [error, setError] = useState<string | null>(initialError)
  const [data, setData] = useState<SavedDecksResponse | null>(initialData)
  const [query, setQuery] = useState<DeckQuery>(initialQuery)
  const [deckInfo, setDeckInfo] = useState(initialInfo)
  const [searchInput, setSearchInput] = useState(() => buildSearchInput(initialQuery))
  const [noticeDismissed, setNoticeDismissed] = useState(false)
  const [isPending, startTransition] = useTransition()
  const lastQueryRef = useRef(initialQuery)

  // Set when a guarded page (e.g. create-deck) bounced a signed-out visitor here.
  const showSigninNotice = !noticeDismissed && initialNotice === 'signin'

  const fetchDecks = useCallback((next: DeckQuery) => {
    lastQueryRef.current = next

    startTransition(async () => {
      const [result, infoResult] = await Promise.all([
        getSavedDecks({ ...next, archetype: next.archetype || undefined }),
        getDecksInfo(),
      ])

      // Keep the current listing and filters on failure — the inline error
      // (or full error page when nothing loaded yet) offers a retry.
      if (!result.ok) {
        setError(result.message)
        return
      }

      setError(null)
      setData(result.data)
      // Metadata is a nice-to-have; a failed refresh keeps the old options.
      if (infoResult.ok) setDeckInfo(infoResult.data)
      setQuery(next)
      // Mirror the committed query into the URL so filters survive
      // refresh/back and are shareable — without a server round-trip.
      window.history.replaceState(null, '', buildDecksUrl(next))
    })
  }, [])

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
    fetchDecks(lastQueryRef.current)
  }, [fetchDecks])

  const handleReset = useCallback(() => {
    setSearchInput('')
    fetchDecks(INITIAL_DECK_QUERY)
  }, [fetchDecks])

  if (error && !data) {
    return <ErrorPageComponent onRetry={handleRetry} isPending={isPending} />
  }

  const decks = data?.data ?? []
  const total = data?.pagination.total ?? 0
  const totalPages = data?.pagination.totalPages ?? 1
  const currentPage = data?.pagination.page ?? query.page
  const availableArchetypes = getArchetypeOptions(deckInfo)
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

        {showSigninNotice ? (
          <div className="decks-page__notice" role="status">
            <IconComponent icon="mdi:login-variant" className="decks-page__notice-icon" width={18} height={18} />
            <p className="decks-page__notice-text">
              Sign in to create and manage your own decks.
            </p>
            <button
              type="button"
              className="decks-page__notice-dismiss"
              onClick={() => setNoticeDismissed(true)}
              aria-label="Dismiss notice"
            >
              <IconComponent icon="mdi:close" width={16} height={16} aria-hidden />
            </button>
          </div>
        ) : null}

        {error ? (
          <div className="decks-page__notice decks-page__notice--error" role="alert">
            <IconComponent icon="mdi:alert-circle-outline" className="decks-page__notice-icon" width={18} height={18} />
            <p className="decks-page__notice-text">{error}</p>
            <ButtonComponent
              type="button"
              variant="outline"
              size="sm"
              icon="mdi:refresh"
              loading={isPending}
              onClick={handleRetry}
            >
              Retry
            </ButtonComponent>
          </div>
        ) : null}

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
