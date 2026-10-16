import YGOProDeck from 'ygopro-deck-encode'
import { DeckCodeError, ZONE_MAX, type Deck } from '../types'

const isPasscode = (n: unknown) => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= 2147483647

export const assertPasscodes = (ids: readonly number[]) => {
  if (!ids.every(isPasscode)) throw new DeckCodeError('Invalid card passcode')
}

/** Shared by the ydk and ydke readers (Omega codes check main + extra combined instead). */
export const assertDeck = ({ main, extra, side }: Deck) => {
  assertPasscodes([...main, ...extra, ...side])
  if (main.length > ZONE_MAX.main) throw new DeckCodeError('Too many cards in the main deck')
  if (extra.length > ZONE_MAX.extra) throw new DeckCodeError('Too many cards in the extra deck')
  if (side.length > ZONE_MAX.side) throw new DeckCodeError('Too many cards in the side deck')
}

export const toYdk = (deck: Deck): string =>
  ['#created by Duelists Unite Hub', '#main', ...deck.main, '#extra', ...deck.extra, '!side', ...deck.side, ''].join('\n')

export const fromYdk = (text: string): Deck => {
  if (!/^\s*#main\s*$/im.test(text)) throw new DeckCodeError('Not a .ydk file')
  // The library silently skips lines it can't read; a damaged file must fail instead of losing cards.
  if (text.split(/\r?\n/).some((l) => l.trim() && !/^[#!]|^\d+$/.test(l.trim()))) throw new DeckCodeError('Invalid line in .ydk file')
  let parsed: YGOProDeck
  try {
    parsed = YGOProDeck.fromYdkString(text)
  } catch (e) {
    throw new DeckCodeError(e instanceof Error ? e.message : 'Invalid .ydk file')
  }
  const deck = { main: [...parsed.main], extra: [...parsed.extra], side: [...parsed.side] }
  assertDeck(deck)
  return deck
}
