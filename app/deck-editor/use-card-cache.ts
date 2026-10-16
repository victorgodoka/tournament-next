import { useCallback, useRef, useState } from 'react'
import { cardsByIds } from '@utils/cards'
import type { CardData, CardMap } from '@utils/deck/types'

type Snapshot = { cards: CardMap; unknown: ReadonlySet<number>; failed: ReadonlySet<number> }

/**
 * Every card the editor has seen, keyed by passcode, so validation never waits on the network.
 * Refs are the source of truth; the snapshot is replaced after each settled change, so memoized
 * consumers rerender. A passcode is in exactly one of: `cards`, `unknown` (the API has no such card),
 * `failed` (the lookup errored; the next `ensure` retries it), or pending (none of those yet).
 */
export const useCardCache = () => {
  const known = useRef(new Map<number, CardData>())
  const unknown = useRef(new Set<number>())
  const failed = useRef(new Set<number>())
  const inflight = useRef(new Set<number>())
  const [snapshot, setSnapshot] = useState<Snapshot>(() => ({ cards: new Map(), unknown: new Set(), failed: new Set() }))

  const publish = useCallback(
    () => setSnapshot({ cards: new Map(known.current), unknown: new Set(unknown.current), failed: new Set(failed.current) }),
    [],
  )

  /** `[passcode, card]` pairs; the card is the API's, so an alternate artwork keys to its original as a lookup would. */
  const store = useCallback(
    (entries: Iterable<readonly [number, CardData]>) => {
      let added = false
      for (const [id, card] of entries) {
        if (known.current.get(id) === card) continue
        known.current.set(id, card)
        unknown.current.delete(id)
        failed.current.delete(id)
        added = true
      }
      if (added) publish()
    },
    [publish],
  )

  const remember = useCallback((list: Iterable<CardData>) => store(Array.from(list, (card) => [card.id, card] as const)), [store])

  /** An artwork picked in the detail sheet: `passcode` resolves to the API card, never to a `printOf` copy. */
  const rememberArt = useCallback((passcode: number, card: CardData) => store([[passcode, card]]), [store])

  /** Looks up the ids not known, not known-absent and not already in flight. Failed ids are asked again. */
  const ensure = useCallback(
    async (ids: readonly number[]) => {
      const missing = [...new Set(ids)].filter((id) => !known.current.has(id) && !unknown.current.has(id) && !inflight.current.has(id))
      if (!missing.length) return
      for (const id of missing) inflight.current.add(id)
      try {
        const found = await cardsByIds(missing)
        for (const id of missing) {
          const card = found.get(id) // keyed by the passcode asked for, so an alternate artwork resolves
          if (card) known.current.set(id, card)
          else unknown.current.add(id)
          failed.current.delete(id)
        }
      } catch (error) {
        for (const id of missing) failed.current.add(id)
        throw error
      } finally {
        for (const id of missing) inflight.current.delete(id)
        publish()
      }
    },
    [publish],
  )

  const { cards, failed: failedIds } = snapshot
  const isPending = useCallback(
    (id: number) => !snapshot.cards.has(id) && !snapshot.unknown.has(id) && !snapshot.failed.has(id),
    [snapshot],
  )

  return { cards, failed: failedIds, isPending, remember, rememberArt, ensure }
}
