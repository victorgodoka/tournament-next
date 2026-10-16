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

const HEADER = /^(main|extra|side)( deck)?:?$/i
const QTY = /^(\d+)\s*x?\s+(.+)$/i

export const fromText = (text: string): { zone: Zone; qty: number; name: string }[] => {
  let zone: Zone = 'main'
  const out: { zone: Zone; qty: number; name: string }[] = []
  for (const line of text.split(/\r?\n/).map((l) => l.trim())) {
    if (!line) continue
    const header = HEADER.exec(line)
    if (header) {
      zone = header[1]!.toLowerCase() as Zone
      continue
    }
    const m = QTY.exec(line)
    out.push({ zone, qty: m ? Number(m[1]) : 1, name: (m ? m[2]! : line).trim() })
  }
  return out
}
