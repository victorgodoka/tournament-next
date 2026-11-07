import { deckHref, leadOf, type DeckStat, type Meta } from './statistics'
import type { WikiStatisticsDeck } from './wiki-doc'

export const statisticsDeckHref = (deck: WikiStatisticsDeck) => deckHref(deck.key, { ladder: deck.ladder })

/** Resolve every named package's cover, with the selected build's own face as fallback. */
export const statisticsDeckOf = (deck: Pick<DeckStat, 'key' | 'name' | 'face'>, meta: Pick<Meta, 'decks'>, ladder: WikiStatisticsDeck['ladder']): WikiStatisticsDeck => {
  const facesByKey = new Map(meta.decks.map((d) => [d.key, d.face]))
  const parts = deck.key.replace(/\*$/, '').split('>')
  const faces = parts.map((key, i) => facesByKey.get(key) ?? facesByKey.get(`${key}*`) ?? (i === 0 ? deck.face : null))
    .filter((id): id is number => Number.isInteger(id) && Number(id) > 0)
  if (!faces.length && deck.face) faces.push(deck.face)
  // The same fallback name as the tier lists' `name`: a lead row `123*` reads "Archetype 123".
  return { key: deck.key, name: (deck.name ?? `Archetype ${deck.key.endsWith('*') ? leadOf(deck.key) : deck.key}`).replace(/[<>]/g, ''), ladder, faces: [...new Set(faces)].slice(0, 5) }
}
