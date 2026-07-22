'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Card, CardsSearchParams } from '@lib/cards.types'
import { extractCardsFromResponse, searchCards } from '@lib/cards.api'
import { CARDS_PER_PAGE, FORMATS } from './deck-editor.const'
import type { CardFilters, DeckFormat } from './deck-editor.types'

interface SearchState {
  results: Card[]
  page: number
  total: number
  loading: boolean
  error: string | null
  hasMore: boolean
}

const initial: SearchState = {
  results: [],
  page: 1,
  total: 0,
  loading: true,
  error: null,
  hasMore: false,
}

const dedupeById = (cards: Card[]): Card[] => {
  const seen = new Set<number>()
  return cards.filter((c) => (seen.has(c.id) ? false : (seen.add(c.id), true)))
}

/** Client-side refine over already-loaded results, for card properties the
 * cards API doesn't filter on server-side (type/genre/category tags). */
function refine(cards: Card[], subtype?: string, tag?: string): Card[] {
  if (!subtype && !tag) return cards
  const sub = subtype?.toLowerCase()
  const needle = tag?.toLowerCase()
  return cards.filter((c) => {
    if (sub && !c.type_tags.some((t) => t.toLowerCase() === sub)) return false
    if (needle) {
      const hay = [...c.type_tags, ...c.genre_tags, ...c.category_tags, c.race ?? '', c.name_en]
        .join(' ')
        .toLowerCase()
      if (!hay.includes(needle)) return false
    }
    return true
  })
}

/**
 * Debounced, paginated card search built entirely on `searchCards`. Server-side
 * filters map straight to the API; `subtype`/`tag` refine the loaded page
 * client-side. A monotonically increasing request seq discards stale responses
 * so fast typing never renders an out-of-order page.
 */
export function useCardSearch(filters: CardFilters, format: DeckFormat) {
  const region = useMemo(
    () => FORMATS.find((f) => f.value === format)?.region ?? 'ALL',
    [format],
  )

  const params = useMemo<CardsSearchParams>(
    () => ({
      fname: filters.name || undefined,
      desc: filters.desc || undefined,
      type: filters.type,
      attribute: (filters.attribute || undefined) as CardsSearchParams['attribute'],
      race: filters.race || undefined,
      atkMin: filters.atkMin,
      atkMax: filters.atkMax,
      defMin: filters.defMin,
      defMax: filters.defMax,
      levelMin: filters.levelMin,
      levelMax: filters.levelMax,
      pScale: filters.pScale,
      setcode: filters.setcode || undefined,
      region,
      pageSize: CARDS_PER_PAGE,
      method: 'GET',
    }),
    [
      filters.name, filters.desc, filters.type, filters.attribute, filters.race,
      filters.atkMin, filters.atkMax, filters.defMin, filters.defMax,
      filters.levelMin, filters.levelMax, filters.pScale, filters.setcode, region,
    ],
  )

  const [state, setState] = useState<SearchState>(initial)
  const seq = useRef(0)

  const fetchPage = useCallback(async (page: number, replace: boolean) => {
    const token = ++seq.current
    setState((prev) => ({ ...prev, loading: true, error: null }))
    try {
      const response = await searchCards({ ...params, page })
      if (token !== seq.current) return
      const cards = extractCardsFromResponse(response)
      const total = response.data?.total ?? 0
      setState((prev) => {
        const results = replace ? cards : dedupeById([...prev.results, ...cards])
        const hasMore =
          cards.length > 0 &&
          (total ? results.length < total : cards.length >= CARDS_PER_PAGE)
        return { results, page, total: total || results.length, loading: false, error: null, hasMore }
      })
    } catch {
      if (token !== seq.current) return
      setState((prev) => ({ ...prev, loading: false, error: 'Failed to load cards. Try again.' }))
    }
  }, [params])

  // Debounce filter changes so each keystroke doesn't fire a request.
  // `fetchPage` is recreated whenever `params` change, so this re-runs then too.
  useEffect(() => {
    const timer = setTimeout(() => fetchPage(1, true), 300)
    return () => clearTimeout(timer)
  }, [fetchPage])

  const loadMore = useCallback(() => {
    if (!state.loading && state.hasMore) fetchPage(state.page + 1, false)
  }, [state.loading, state.hasMore, state.page, fetchPage])

  const cards = useMemo(
    () => refine(state.results, filters.subtype, filters.tag),
    [state.results, filters.subtype, filters.tag],
  )

  return {
    cards,
    total: state.total,
    loading: state.loading,
    error: state.error,
    hasMore: state.hasMore,
    loadMore,
  }
}
