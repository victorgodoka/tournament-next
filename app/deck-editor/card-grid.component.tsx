'use client'

import { useEffect, useRef } from 'react'
import type { Card } from '@lib/cards.types'
import IconComponent from '@components/icon/icon.component'
import SkeletonComponent from '@components/skeleton/skeleton.component'
import CardTile from './card-tile.component'
import type { EditorState } from './deck-editor.types'
import {
  banStatus,
  canAdd,
  copyLimit,
  defaultZone,
  genesysCost,
  totalCopies,
} from './deck-editor.utils'

/** Placeholder matching CardTile's footprint, shown while results load. */
function CardTileSkeleton() {
  return (
    <div className="card-tile card-tile--skeleton" aria-hidden="true">
      <div className="card-tile__art">
        <SkeletonComponent width="100%" height="100%" radius="var(--radius-sm)" />
      </div>
      <div className="card-tile__foot">
        <SkeletonComponent width="70%" height="0.65rem" />
      </div>
    </div>
  )
}

const INITIAL_SKELETON_COUNT = 12
const MORE_SKELETON_COUNT = 6

interface CardGridProps {
  cards: Card[]
  state: EditorState
  total: number
  loading: boolean
  hasMore: boolean
  error: string | null
  onLoadMore: () => void
  onOpen: (card: Card) => void
  onAdd: (card: Card) => void
  onRemove: (card: Card) => void
}

const CardGrid = ({
  cards,
  state,
  total,
  loading,
  hasMore,
  error,
  onLoadMore,
  onOpen,
  onAdd,
  onRemove,
}: CardGridProps) => {
  const sentinel = useRef<HTMLDivElement>(null)

  // Load the next page as the sentinel scrolls into view (400px early so the
  // grid never visibly runs dry). `onLoadMore` is a no-op while loading/at end.
  useEffect(() => {
    const node = sentinel.current
    if (!node) return
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onLoadMore()
      },
      { rootMargin: '400px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [onLoadMore])

  const showEmpty = !loading && cards.length === 0 && !error
  const skeletonCount = cards.length === 0 ? INITIAL_SKELETON_COUNT : MORE_SKELETON_COUNT

  return (
    <div className="card-grid-wrap">
      <div className="card-grid__head">
        <span className="card-grid__head-label">
          <IconComponent icon="mdi:cards-outline" width={14} height={14} />
          Results
        </span>
        {!showEmpty && (total > 0 || cards.length > 0) && (
          <span className="card-grid__head-count">{total || cards.length}</span>
        )}
      </div>

      {error && (
        <p className="card-grid__error" role="alert">
          <IconComponent icon="mdi:alert-circle-outline" width={18} height={18} />
          {error}
        </p>
      )}

      {showEmpty ? (
        <div className="card-grid__empty">
          <IconComponent icon="mdi:card-search-outline" width={40} height={40} />
          <p>No cards match your filters.</p>
          <span>Try widening the search or clearing a filter.</span>
        </div>
      ) : (
        <ul className="card-grid" role="list" aria-busy={loading}>
          {cards.map((card) => {
            const count = totalCopies(state, card.id, card)
            return (
              <li key={card.id} className="card-grid__item">
                <CardTile
                  card={card}
                  count={count}
                  max={copyLimit(card, state.format)}
                  status={banStatus(card, state.format)}
                  points={state.format === 'genesys' ? genesysCost(card) : undefined}
                  addDisabled={!canAdd(state, card, defaultZone(card))}
                  onOpen={onOpen}
                  onAdd={onAdd}
                  onRemove={onRemove}
                />
              </li>
            )
          })}
          {loading &&
            Array.from({ length: skeletonCount }).map((_, index) => (
              <li key={`skeleton-${index}`} className="card-grid__item" aria-hidden="true">
                <CardTileSkeleton />
              </li>
            ))}
        </ul>
      )}

      <div ref={sentinel} className="card-grid__sentinel" aria-hidden="true" />

      {!loading && !hasMore && cards.length > 0 && (
        <p className="card-grid__status card-grid__status--end">
          {cards.length} of {total || cards.length} cards
        </p>
      )}
    </div>
  )
}

export default CardGrid
