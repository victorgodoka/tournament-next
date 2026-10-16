import YGOProDeck from 'ygopro-deck-encode'
import { DeckCodeError, type Deck } from '../types'
import { assertDeck } from './ydk'

const YDKE = /^ydke:\/\/[A-Za-z0-9+/=]*![A-Za-z0-9+/=]*![A-Za-z0-9+/=]*!?$/

export const toYdke = (deck: Deck): string => {
  try {
    return new YGOProDeck(deck).toYdkeURL()
  } catch (e) {
    throw new DeckCodeError(e instanceof Error ? e.message : 'Cannot encode ydke')
  }
}

export const fromYdke = (url: string): Deck => {
  const trimmed = url.trim()
  if (!YDKE.test(trimmed)) throw new DeckCodeError('Not a ydke:// URL')
  let parsed: YGOProDeck
  try {
    parsed = YGOProDeck.fromYdkeURL(trimmed)
  } catch (e) {
    throw new DeckCodeError(e instanceof Error ? e.message : 'Invalid ydke:// URL')
  }
  const deck = { main: [...parsed.main], extra: [...parsed.extra], side: [...parsed.side] }
  assertDeck(deck)
  return deck
}
