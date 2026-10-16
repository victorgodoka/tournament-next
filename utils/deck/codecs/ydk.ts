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

const MARKER = /^[#!]\s*(main|extra|side)\s*$/i

/** Canonical lines for the library: markers fixed to `#main` / `#extra` / `!side`, annotations and comments dropped. */
const normalizeYdk = (text: string): string[] => {
  const lines: string[] = []
  for (const raw of text.replace(/^﻿/, '').split(/\r\n|\r|\n/)) {
    const line = raw.trim()
    const marker = MARKER.exec(line)
    if (marker) lines.push(marker[1]!.toLowerCase() === 'side' ? '!side' : `#${marker[1]!.toLowerCase()}`)
    else if (/^\d/.test(line)) {
      const id = line.replace(/\s*[#;].*$/, '')
      // The library silently skips lines it can't read; a damaged file must fail instead of losing cards.
      if (!/^\d+$/.test(id)) throw new DeckCodeError('Invalid line in .ydk file')
      lines.push(id)
    } else if (line && !/^[#!]/.test(line)) throw new DeckCodeError('Invalid line in .ydk file')
  }
  return lines
}

export const fromYdk = (text: string): Deck => {
  const lines = normalizeYdk(text)
  if (!lines.includes('#main')) throw new DeckCodeError('Not a .ydk file')
  let parsed: YGOProDeck
  try {
    parsed = YGOProDeck.fromYdkString(lines.join('\n'))
  } catch (e) {
    throw new DeckCodeError(e instanceof Error ? e.message : 'Invalid .ydk file')
  }
  const deck = { main: [...parsed.main], extra: [...parsed.extra], side: [...parsed.side] }
  assertDeck(deck)
  return deck
}
