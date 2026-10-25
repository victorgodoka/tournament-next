'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert } from '@ui/alert'
import { Button } from '@ui/button'
import { SearchField, Select } from '@ui/field'
import { EMPTY_POOL_QUERY, type PoolQuery } from '@utils/cards'
import { canonicalId, copyCounts } from '@utils/deck/model'
import type { CardData, CardMap, Deck, Zone } from '@utils/deck/types'
import type { Banlist } from '@utils/wiki'
import { CardTile } from './card-tile'
import { DRAG_TYPE, type DragPayload } from './deck-zone'
import { useLongPress } from './gestures'
import { PoolFilters } from './pool-filters'
import { activeFilterCount, effectiveQuery, tileStatus } from './pool-query'
import { useCardPool } from './use-card-pool'

const SORTS = ['name-asc', 'name-desc', 'atk-desc', 'atk-asc', 'def-desc', 'level-desc', 'level-asc', 'released_tcg-desc', 'released_ocg-desc'] as const
// Four columns in a ~26vw column on lg; four across the viewport from 600px, three below.
const SIZES = '(min-width: 1024px) 6.5vw, (min-width: 600px) 25vw, 33vw'

/** The nearest ancestor that scrolls vertically, or null (the viewport). */
const scrollParent = (el: HTMLElement): HTMLElement | null => {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const { overflowY } = getComputedStyle(p)
    if (overflowY === 'auto' || overflowY === 'scroll') return p
  }
  return null
}

type CardPoolProps = {
  deck: Deck
  cards: CardMap
  banlist: Banlist | null
  onAdd(card: CardData, zone?: Zone): void
  onOpen(card: CardData): void
  /** Every page of results, so deck validation already knows a card when it is added. */
  remember(cards: CardData[]): void
  /** With a card panel beside the pool: the tiles' corner button pins it instead of opening the sheet. */
  locked?: number | null
  onLock?(id: number): void
}

export const CardPool = ({ deck, cards, banlist, onAdd, onOpen, remember, locked, onLock }: CardPoolProps) => {
  const t = useTranslations('DeckEditor')
  const [query, setQuery] = useState<PoolQuery>(EMPTY_POOL_QUERY)
  const [drawer, setDrawer] = useState(false)
  const [focus, setFocus] = useState(0)
  const sent = useMemo(() => effectiveQuery(query, banlist), [query, banlist])
  // One pass per deck change, not one per tile.
  const copies = useMemo(() => copyCounts(deck, cards), [deck, cards])
  const pool = useCardPool(sent, remember)
  const sentinel = useRef<HTMLDivElement>(null)
  const press = useLongPress()
  const { more } = pool

  useEffect(() => {
    const el = sentinel.current
    if (!el) return
    // Re-observing after each page fires once more, so a short page that leaves the sentinel visible loads the next.
    // The root is the column that scrolls (lg), else the viewport; rootMargin only prefetches against the real root.
    const observer = new IntersectionObserver(([entry]) => entry?.isIntersecting && more(), { root: scrollParent(el), rootMargin: '400px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [more])

  const patch = (next: Partial<PoolQuery>) => setQuery((q) => ({ ...q, ...next }))
  const filters = activeFilterCount(sent)
  const roving = Math.min(focus, pool.cards.length - 1)

  return (
    <div className="flex flex-col gap-3">
      {/* Below lg the page scrolls the pool, so the search stays pinned. */}
      <div className="flex flex-col gap-3 max-lg:sticky max-lg:top-0 max-lg:z-(--z-sticky) max-lg:-mx-4 max-lg:border-b max-lg:border-line max-lg:bg-space-000 max-lg:px-4 max-lg:py-2">
        <div role="search" aria-label={t('pool.search')} className="flex flex-wrap items-center gap-2">
          <SearchField id="pool-search" value={query.name} onChange={(e) => patch({ name: e.target.value })} placeholder={t('pool.searchName')} className="min-w-0 flex-1 basis-40 max-lg:h-11" />
          <SearchField value={query.text} onChange={(e) => patch({ text: e.target.value })} placeholder={t('pool.searchText')} className="min-w-0 flex-1 basis-40 max-lg:h-11" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select
          prefix={t('pool.sort')}
          options={SORTS.map((s) => ({ value: s, label: t(`pool.sorts.${s}`) }))}
          value={`${query.sort}-${query.order}`}
          onChange={(e) => {
            const [sort, order] = e.target.value.split('-') as [PoolQuery['sort'], PoolQuery['order']]
            patch({ sort, order })
          }}
          className="min-w-0 max-lg:h-11"
        />
        <Button variant="secondary" size="mono" aria-haspopup="dialog" onClick={() => setDrawer(true)} className="ml-auto max-lg:min-h-11">
          {filters ? t('pool.filtersCount', { count: filters }) : t('pool.filters')}
        </Button>
      </div>

      {pool.error ? (
        <Alert tone="negative" edged title={t('pool.failed')} action={<Button variant="secondary" size="sm" onClick={pool.retry} className="max-lg:min-h-11">{t('retry')}</Button>} />
      ) : null}

      <p role="status" className="text-ink-muted signal-sm">
        {pool.loading && !pool.cards.length ? t('pool.loading') : t('pool.count', { count: pool.total })}
      </p>

      {!pool.loading && !pool.error && !pool.cards.length ? <p className="py-6 text-center text-ink-muted body-sm">{t('pool.empty')}</p> : null}

      <ul data-zone="pool" aria-label={t('pool.results')} aria-busy={pool.loading} className="grid grid-cols-3 gap-1 min-[600px]:grid-cols-4 pointer-coarse:[&_[data-info]]:hidden">
        {pool.cards.map((card, i) => (
          <li key={card.id} data-card={card.id}>
            {/* Mouse and keyboard: click adds. Touch and pen: tap opens the sheet, long-press adds. */}
            <CardTile
              id={card.id}
              card={card}
              sizes={SIZES}
              dots={copies.get(canonicalId(card)) ?? 0}
              status={tileStatus(card, banlist)}
              aria-description={t('pool.tileHint')} // named by the card; what a press does depends on the pointer
              tabIndex={i === roving ? 0 : -1}
              onFocus={() => setFocus(i)}
              {...press.bind(() => onAdd(card))}
              onClick={(e) => {
                const kind = press.kind(e)
                if (kind === 'tap') onOpen(card)
                else if (kind === 'click') onAdd(card, e.shiftKey ? 'side' : undefined)
              }}
              onContextMenu={(e) => {
                e.preventDefault()
                if (press.kind(e) === 'click') onAdd(card, 'side')
              }}
              onInfo={onLock ? () => onLock(card.id) : () => onOpen(card)}
              locked={onLock ? locked === card.id : undefined}
              draggable
              onDragStart={(e) => {
                // Touch and pen never drag from the pool: a drag would cancel the long press (which adds instead).
                if (press.kind(e) !== 'click') return e.preventDefault()
                e.dataTransfer.setData(DRAG_TYPE, JSON.stringify({ from: 'pool', id: card.id } satisfies DragPayload))
                e.dataTransfer.effectAllowed = 'copy'
              }}
            />
          </li>
        ))}
      </ul>
      <div ref={sentinel} aria-hidden />

      <PoolFilters open={drawer} onClose={() => setDrawer(false)} query={query} onChange={setQuery} banlist={banlist} />
    </div>
  )
}
