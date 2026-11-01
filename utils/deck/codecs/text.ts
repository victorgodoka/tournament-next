import { type CardMap, type Deck, type Zone } from '../types'

const TITLES: [Zone, string][] = [['main', 'Main Deck'], ['extra', 'Extra Deck'], ['side', 'Side Deck']]

export const toText = (deck: Deck, cards: CardMap): string =>
  TITLES.filter(([zone]) => deck[zone].length)
    .map(([zone, title]) => {
      const counts = new Map<number, number>()
      for (const id of deck[zone]) counts.set(id, (counts.get(id) ?? 0) + 1)
      return [title, ...[...counts].map(([id, qty]) => `${qty} ${cards.get(id)?.name ?? id}`)].join('\n') + '\n'
    })
    .join('\n')
