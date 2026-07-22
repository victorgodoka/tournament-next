'use client'

import { useEffect, useRef } from 'react'
import type { Card } from '@lib/cards.types'
import IconComponent from '@components/icon/icon.component'
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

  return (
    <div className="card-grid-wrap">
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
        <ul className="card-grid" role="list">
          {cards.map((card) => {
            const count = totalCopies(state, card.id)
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
        </ul>
      )}

      <div ref={sentinel} className="card-grid__sentinel" aria-hidden="true" />

      {loading && (
        <p className="card-grid__status">
          <IconComponent icon="mdi:loading" className="card-grid__spin" width={20} height={20} />
          Loading cards…
        </p>
      )}
      {!loading && !hasMore && cards.length > 0 && (
        <p className="card-grid__status card-grid__status--end">
          {cards.length} of {total || cards.length} cards
        </p>
      )}
    </div>
  )
}

export default CardGrid
