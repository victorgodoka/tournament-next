import { describe, expect, it } from 'vitest'
import { DeckCodeError, type CardData, type Deck } from '../types'
import { detectFormat } from './detect'
import { fromOmega, toOmega } from './omega'
import { fromText, toText } from './text'
import { fromYdk, toYdk } from './ydk'
import { fromYdke, toYdke } from './ydke'

const deck: Deck = { main: [14558127, 14558127, 46986414], extra: [84013237], side: [24224830] }

describe('codecs', () => {
  it('round-trips ydk, ydke and Omega codes', async () => {
    expect(fromYdk(toYdk(deck))).toEqual(deck)
    expect(fromYdke(toYdke(deck))).toEqual(deck)
    expect(await fromOmega(await toOmega(deck))).toEqual({ main: [14558127, 14558127, 46986414, 84013237], side: [24224830] })
  })
  it('writes the Omega layout: main+extra count, side count, uint32 LE passcodes', async () => {
    const raw = new Uint8Array(await new Response(new Blob([Uint8Array.from(atob(await toOmega(deck)), (c) => c.charCodeAt(0))]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer())
    expect([raw[0], raw[1], raw.length]).toEqual([4, 1, 2 + 4 * 5])
    expect(new DataView(raw.buffer).getUint32(2, true)).toBe(14558127)
  })
  it('writes ydk with the header and trailing newline', () => {
    expect(toYdk(deck)).toBe('#created by Duelists Unite Hub\n#main\n14558127\n14558127\n46986414\n#extra\n84013237\n!side\n24224830\n')
  })
  it('reads ydk with CRLF and comments', () => {
    expect(fromYdk('#created by x\r\n#main\r\n14558127\r\n#extra\r\n84013237\r\n!side\r\n')).toEqual({ main: [14558127], extra: [84013237], side: [] })
  })
  it('throws DeckCodeError on damaged codes', async () => {
    expect(() => fromYdke('ydke://not-base64!!')).toThrow(DeckCodeError)
    await expect(fromOmega('AAAA')).rejects.toThrow(DeckCodeError)
    expect(() => fromYdk('#main\n' + '1\n'.repeat(61))).toThrow(DeckCodeError)
  })
  it('rejects garbage, oversized zones and bad passcodes', async () => {
    expect(() => fromYdk('hello world')).toThrow(DeckCodeError)
    expect(() => fromYdk('#main\nabc\n')).toThrow(DeckCodeError)
    expect(() => fromYdk('#main\n0\n')).toThrow(DeckCodeError)
    expect(() => fromYdk('#main\n2147483648\n')).toThrow(DeckCodeError)
    expect(() => fromYdk('#main\n#extra\n' + '1\n'.repeat(16))).toThrow(DeckCodeError)
    expect(() => fromYdk('#main\n!side\n' + '1\n'.repeat(16))).toThrow(DeckCodeError)
    expect(() => fromYdke('http://x')).toThrow(DeckCodeError)
    expect(() => fromYdke('ydke://!')).toThrow(DeckCodeError)
    expect(() => fromYdke(toYdke({ main: Array(61).fill(1), extra: [], side: [] }))).toThrow(DeckCodeError)
    await expect(fromOmega('!!!!')).rejects.toThrow(DeckCodeError)
    await expect(toOmega({ main: Array(60).fill(1), extra: Array(16).fill(2), side: [] }).then(fromOmega)).rejects.toThrow(DeckCodeError)
    await expect(toOmega({ main: [0], extra: [], side: [] }).then(fromOmega)).rejects.toThrow(DeckCodeError)
  })
  it('writes and reads the text list', () => {
    const names = new Map<number, CardData>([[14558127, 'Ash Blossom & Joyous Spring'], [46986414, 'Dark Magician'], [84013237, 'Number 39: Utopia'], [24224830, 'Called by the Grave']].map(([id, name]) => [id as number, { id, name } as CardData]))
    expect(toText(deck, names)).toBe('Main Deck\n2 Ash Blossom & Joyous Spring\n1 Dark Magician\n\nExtra Deck\n1 Number 39: Utopia\n\nSide Deck\n1 Called by the Grave\n')
    expect(fromText('Main:\n3x Ash Blossom & Joyous Spring\nPot of Greed\nExtra Deck\n1 Number 39: Utopia')).toEqual([
      { zone: 'main', qty: 3, name: 'Ash Blossom & Joyous Spring' },
      { zone: 'main', qty: 1, name: 'Pot of Greed' },
      { zone: 'extra', qty: 1, name: 'Number 39: Utopia' },
    ])
  })
  it('text: unknown cards print their passcode, empty zones print no header', () => {
    expect(toText({ main: [5, 5], extra: [], side: [] }, new Map())).toBe('Main Deck\n2 5\n')
  })
  it('detects the format of pasted text', () => {
    expect(detectFormat('ydke://abc!def!ghi!')).toBe('ydke')
    expect(detectFormat('#created by\n#main\n1')).toBe('ydk')
    expect(detectFormat('  #main\n1')).toBe('ydk')
    expect(detectFormat('7Vi7SgNBFL2zSUyCRbQQLWwsLCwsLBQLC8HCxk/wEyws/AMbP0LbtLCwsLCwsBAsLBQRwSJGTMhkdmZ3Z2fP7MzOJsQkkMDl3Hvuuffc2b1oACgFAIVCoaASlUqlUCgUigVSqWTkcrmSyWQikUgkEolEIpFIJBKJRCKRSCQSCcrLy8vLy8vL')).toBe('omega')
    expect(detectFormat('3 Ash Blossom & Joyous Spring')).toBe('text')
  })
})
