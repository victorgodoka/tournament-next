import { useCallback, useEffect, useRef, useState } from 'react'
import { queryCards, type PoolQuery } from '@utils/cards'
import type { CardData } from '@utils/deck/types'

const DEBOUNCE_MS = 250

/** One settled request: `req` names it, so a result for an older query or page is never shown as current. */
type Result = { key: string; req: string; cards: CardData[]; total: number; error: boolean }

const NONE: Result = { key: '', req: '', cards: [], total: 0, error: false }

/**
 * The card pool for `query`, a page at a time. The search text waits 250 ms after typing stops; any
 * change aborts the request in flight and starts again from page 1. `onPage` sees every page that lands.
 */
export const useCardPool = (query: PoolQuery, onPage?: (cards: CardData[]) => void) => {
  const [text, setText] = useState(query.text)
  const [page, setPage] = useState({ key: '', n: 1 })
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState<Result>(NONE)
  const onPageRef = useRef(onPage)

  useEffect(() => {
    onPageRef.current = onPage
  })

  useEffect(() => {
    const timer = setTimeout(() => setText(query.text), DEBOUNCE_MS)
    return () => clearTimeout(timer)
  }, [query.text])

  // A string, so the request effect reruns only when what is asked for changes.
  const key = JSON.stringify({ ...query, text })
  const n = page.key === key ? page.n : 1
  const req = `${key}#${n}#${attempt}`

  useEffect(() => {
    const controller = new AbortController()
    queryCards(JSON.parse(key) as PoolQuery, n, controller.signal).then(
      ({ cards, total }) => {
        onPageRef.current?.(cards)
        setResult((prev) => ({ key, req, total, error: false, cards: n > 1 && prev.key === key ? [...prev.cards, ...cards] : cards }))
      },
      () => {
        if (!controller.signal.aborted) setResult((prev) => ({ ...(prev.key === key ? prev : NONE), key, req, error: true }))
      },
    )
    return () => controller.abort()
  }, [key, n, req])

  const current = result.key === key
  const cards = current ? result.cards : []
  const total = current ? result.total : 0
  const loading = result.req !== req
  const error = !loading && result.error

  const more = useCallback(() => {
    if (!loading && !error && cards.length < total) setPage({ key, n: n + 1 })
  }, [loading, error, cards.length, total, key, n])

  const retry = useCallback(() => setAttempt((a) => a + 1), [])

  return { cards, total, loading, error, more, retry }
}
