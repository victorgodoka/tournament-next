import type { WikiCard } from '@utils/wiki'

export type Zone = 'main' | 'extra' | 'side'
export type Deck = { main: number[]; extra: number[]; side: number[] }

export const EMPTY_DECK: Deck = { main: [], extra: [], side: [] }

export type CardData = WikiCard
export type CardMap = ReadonlyMap<number, CardData>

export class DeckCodeError extends Error {
  constructor(message?: string) {
    super(message)
    this.name = 'DeckCodeError'
  }
}

export const ZONE_MAX = { main: 60, extra: 15, side: 15 } as const
export const MAIN_MIN = 40 as const
export const MAX_COPIES = 3 as const
