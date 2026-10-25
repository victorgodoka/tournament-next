import { EMPTY_POOL_QUERY, type PoolQuery } from '@utils/cards'
import { cardStatus, releaseRegion } from '@utils/deck/rules'
import type { CardData } from '@utils/deck/types'
import type { Banlist } from '@utils/wiki'
import type { TileStatus } from './card-tile'

export const ATTRIBUTES = ['dark', 'light', 'earth', 'water', 'fire', 'wind', 'divine']

/**
 * The query as sent: the banlist's id, and only the filters its family accepts (the API 400s on a
 * Genesys `status` or a normal list's points). Legal-only also asks for cards released in the list's
 * region, as does a release window; WCS has no region, so neither applies there.
 */
export const effectiveQuery = (query: PoolQuery, banlist: Banlist | null): PoolQuery => {
  const region = banlist ? releaseRegion(banlist.format) : null
  const genesys = banlist?.pointCap != null
  const dated = !!(query.releasedAfter || query.releasedBefore)
  return {
    ...query,
    banlist: banlist?.id,
    format: region && (query.legalOnly || dated) ? region : undefined,
    status: banlist && !genesys ? query.status : [],
    pointsMin: genesys ? query.pointsMin : undefined,
    pointsMax: genesys ? query.pointsMax : undefined,
  }
}

const RANGES = [
  ['levelMin', 'levelMax'],
  ['atkMin', 'atkMax'],
  ['defMin', 'defMax'],
  ['scaleMin', 'scaleMax'],
  ['pointsMin', 'pointsMax'],
  ['releasedAfter', 'releasedBefore'],
] as const

/**
 * The drawer's filters that are set, one per field or range; legal-only counts when it's off (it starts
 * on). Pass the effective query so unsent filters don't count.
 */
export const activeFilterCount = (q: PoolQuery): number =>
  [q.kind.length, q.extraDeck, q.attribute.length, !q.legalOnly, q.archetype, q.types.length, q.race.length, q.linkMarkers.length, q.status.length].filter(Boolean).length +
  RANGES.filter(([min, max]) => (min !== 'releasedAfter' || q.format) && (q[min] !== undefined || q[max] !== undefined)).length

/** Clears the drawer, keeping the search and the sort, which sit beside the pool. */
export const resetFilters = (q: PoolQuery): PoolQuery => ({
  ...EMPTY_POOL_QUERY,
  name: q.name,
  text: q.text,
  sort: q.sort,
  order: q.order,
})

export const toggle = <T>(list: readonly T[], value: T): T[] => (list.includes(value) ? list.filter((v) => v !== value) : [...list, value])

const COPY_STATUS = ['forbidden', 'limited', 'semi-limited'] as const

/** The tile badge: a copy limit below 3, or a points cost above 0. */
export const tileStatus = (card: CardData, banlist: Banlist | null): TileStatus | undefined => {
  if (!banlist) return undefined
  const status = cardStatus(card, banlist)
  if ('points' in status) return status.points > 0 ? { points: status.points } : undefined
  return status.copies === 3 ? undefined : COPY_STATUS[status.copies]
}
