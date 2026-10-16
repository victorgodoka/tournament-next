import { useCallback, useRef, useState } from 'react'
import { cardsByIds } from '@utils/cards'
import type { CardData, CardMap } from '@utils/deck/types'

/**
 * Every card the editor has seen, keyed by passcode, so validation never waits on the network.
 * The ref is the source of truth; `cards` is a fresh snapshot after each change, so memoized
 * consumers rerender.
 */
export const useCardCache = () => {
  const known = useRef(new Map<number, CardData>())
  // Asked once, never re-asked: an unknown passcode would otherwise refetch on every deck change.
  const asked = useRef(new Set<number>())
  const [cards, setCards] = useState<CardMap>(() => new Map())

  const publish = useCallback(() => setCards(new Map(known.current)), [])

  const remember = useCallback(
    (list: Iterable<CardData>) => {
      let added = false
      for (const card of list) {
        if (known.current.get(card.id) === card) continue
        known.current.set(card.id, card)
        added = true
      }
      if (added) publish()
    },
    [publish],
  )

  const ensure = useCallback(
    async (ids: readonly number[]) => {
      const missing = [...new Set(ids)].filter((id) => !known.current.has(id) && !asked.current.has(id))
      if (!missing.length) return
      for (const id of missing) asked.current.add(id)
      let found: Map<number, CardData>
      try {
        found = await cardsByIds(missing)
      } catch (error) {
        for (const id of missing) asked.current.delete(id) // a later call retries
        throw error
      }
      // Keyed by the passcode asked for, so an alternate artwork resolves to its card.
      for (const [id, card] of found) known.current.set(id, card)
      if (found.size) publish()
    },
    [publish],
  )

  return { cards, remember, ensure }
}
