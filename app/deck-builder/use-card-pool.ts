import { useCallback, useEffect, useRef, useState } from 'react'
import { queryCards, type PoolQuery } from '@utils/cards'
import type { CardData } from '@utils/deck/types'

const DEBOUNCE_MS = 250

/**
 * One settled request. `gen` counts query changes, so a result from an earlier visit to the same
 * query (A → B → A) is never shown as current; `req` adds the page and the retry.
 */
type Result = { gen: number; req: string; cards: CardData[]; total: number; error: boolean }

const NONE: Result = { gen: -1, req: '', cards: [], total: 0, error: false }

/**
 * The card pool for `query`, a page at a time. The search text waits 250 ms after typing stops; any
 * change aborts the request in flight and starts again from page 1. `onPage` sees every page that lands.
 */
export const useCardPool = (query: PoolQuery, onPage?: (cards: CardData[]) => void) => {
  const [typed, setTyped] = useState({ name: query.name, text: query.text })
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<Result>(NONE)
  const onPageRef = useRef(onPage)

  useEffect(() => {
    onPageRef.current = onPage
  })

  useEffect(() => {
    const timer = setTimeout(() => setTyped({ name: query.name, text: query.text }), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query.name, query.text])

  // A string, so the request effect reruns only when what is asked for changes.
  const key = JSON.stringify({ ...query, ...typed })
  const [page, setPage] = useState({ key, gen: 0, n: 1 })
  if (page.key !== key) setPage({ key, gen: page.gen + 1, n: 1 }) // a new query: a new generation, page 1
  const { gen, n } = page
  const req = `${gen}#${n}#${attempt}`

  useEffect(() => {
    const controller = new AbortController()
    queryCards(JSON.parse(key) as PoolQuery, n, controller.signal).then(
      ({ cards, total }) => {
        onPageRef.current?.(cards)
        setResult((prev) => ({ gen, req, total, error: false, cards: n > 1 && prev.gen === gen ? [...prev.cards, ...cards] : cards }))
      },
      () => {
        if (!controller.signal.aborted) setResult((prev) => ({ ...(prev.gen === gen ? prev : NONE), gen, req, error: true }))
      },
    )
    return () => controller.abort()
  }, [key, gen, n, req])

  const current = result.gen === gen
  const cards = current ? result.cards : []
  const total = current ? result.total : 0
  const loading = result.req !== req
  const error = !loading && result.error

  const more = useCallback(() => {
    if (!loading && !error && cards.length < total) setPage((p) => ({ ...p, n: p.n + 1 }))
  }, [loading, error, cards.length, total])

  const retry = useCallback(() => setAttempt((a) => a + 1), [])

  return { cards, total, loading, error, more, retry }
}
