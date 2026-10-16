'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Alert } from '@ui/alert'
import { Button } from '@ui/button'
import { FilterChip } from '@ui/chip'
import { Segmented, Switch } from '@ui/choice'
import { SearchField, Select } from '@ui/field'
import { EMPTY_POOL_QUERY, type PoolQuery } from '@utils/cards'
import { copiesOf } from '@utils/deck/model'
import type { CardData, CardMap, Deck, Zone } from '@utils/deck/types'
import { titleCase, type Banlist, type CardKind } from '@utils/wiki'
import { CardTile } from './card-tile'
import { DRAG_TYPE, type DragPayload } from './deck-zone'
import { PoolFilters } from './pool-filters'
import { activeFilterCount, ATTRIBUTES, effectiveQuery, tileStatus, toggle } from './pool-query'
import { useCardPool } from './use-card-pool'

const KINDS: CardKind[] = ['monster', 'spell', 'trap']
const SORTS = ['name-asc', 'name-desc', 'atk-desc', 'atk-asc', 'def-desc', 'level-desc', 'level-asc', 'released_tcg-desc', 'released_ocg-desc'] as const
// Four columns in a ~38vw column on lg.
const SIZES = '(min-width: 1024px) 10vw, (min-width: 640px) 20vw, 33vw'

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
}

export const CardPool = ({ deck, cards, banlist, onAdd, onOpen, remember }: CardPoolProps) => {
  const t = useTranslations('DeckEditor')
  const [query, setQuery] = useState<PoolQuery>(EMPTY_POOL_QUERY)
  const [drawer, setDrawer] = useState(false)
  const [focus, setFocus] = useState(0)
  const sent = useMemo(() => effectiveQuery(query, banlist), [query, banlist])
  const pool = useCardPool(sent, remember)
  const sentinel = useRef<HTMLDivElement>(null)
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
      <div className="flex flex-wrap items-center gap-2">
        <SearchField
          id="pool-search"
          value={query.text}
          onChange={(e) => patch({ text: e.target.value })}
          placeholder={t('pool.search')}
          className="min-w-0 flex-1 basis-48"
        />
        <Segmented
          size="sm"
          label={t('pool.searchBy')}
          value={query.textMode}
          onChange={(textMode) => patch({ textMode })}
          options={[
            { value: 'name', label: t('pool.byName') },
            { value: 'text', label: t('pool.byText') },
          ]}
        />
      </div>

      <div role="group" aria-label={t('pool.quick')} className="flex flex-wrap gap-x-1">
        {KINDS.map((kind) => (
          <FilterChip key={kind} pressed={query.kind.includes(kind)} label={t(`pool.${kind}`)} onClick={() => patch({ kind: toggle(query.kind, kind) })} />
        ))}
        <FilterChip pressed={!!query.extraDeck} label={t('pool.extra')} onClick={() => patch({ extraDeck: query.extraDeck ? undefined : true })} />
        {ATTRIBUTES.map((a) => (
          <FilterChip key={a} pressed={query.attribute.includes(a)} label={titleCase(a)} onClick={() => patch({ attribute: toggle(query.attribute, a) })} />
        ))}
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
          className="min-w-0"
        />
        <Switch quiet checked={query.legalOnly} onChange={(legalOnly) => patch({ legalOnly })} label={t('pool.legalOnly')} disabled={!banlist} />
        <Button variant="secondary" size="mono" aria-haspopup="dialog" onClick={() => setDrawer(true)} className="ml-auto">
          {filters ? t('pool.filtersCount', { count: filters }) : t('pool.filters')}
        </Button>
      </div>

      {pool.error ? (
        <Alert tone="negative" edged title={t('pool.failed')} action={<Button variant="secondary" size="sm" onClick={pool.retry}>{t('retry')}</Button>} />
      ) : null}

      <p role="status" className="text-ink-muted signal-sm">
        {pool.loading && !pool.cards.length ? t('pool.loading') : t('pool.count', { count: pool.total })}
      </p>

      {!pool.loading && !pool.error && !pool.cards.length ? <p className="py-6 text-center text-ink-muted body-sm">{t('pool.empty')}</p> : null}

      <ul data-zone="pool" aria-label={t('pool.results')} aria-busy={pool.loading} className="grid grid-cols-3 gap-1 sm:grid-cols-5 lg:grid-cols-4">
        {pool.cards.map((card, i) => (
          <li key={card.id} data-card={card.id}>
            <CardTile
              id={card.id}
              card={card}
              sizes={SIZES}
              dots={copiesOf(deck, card, cards)}
              status={tileStatus(card, banlist)}
              label={t('zones.addOne', { name: card.name })}
              tabIndex={i === roving ? 0 : -1}
              onFocus={() => setFocus(i)}
              onClick={(e) => onAdd(card, e.shiftKey ? 'side' : undefined)}
              onContextMenu={(e) => {
                e.preventDefault()
                onAdd(card, 'side')
              }}
              onInfo={() => onOpen(card)}
              draggable
              onDragStart={(e) => {
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
