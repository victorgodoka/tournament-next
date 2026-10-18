import { readFileSync } from 'node:fs'
import { PDFDocument } from 'pdf-lib'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { toOmega } from '@utils/deck/codecs/omega'
import { toYdk } from '@utils/deck/codecs/ydk'
import { toYdke } from '@utils/deck/codecs/ydke'
import { DeckCodeError, type CardData, type CardMap, type Deck } from '@utils/deck/types'
import { fileName, konamiPdf, readDeck } from './deck-io'

const card = (id: number, name: string, kind: string, monsterTypes: string[] = []) => ({ id, name, kind, monsterTypes }) as unknown as CardData
const cards: CardMap = new Map([
  [1, card(1, 'Ash Blossom & Joyous Spring', 'monster', ['effect'])],
  [2, card(2, 'Pot of Greed', 'spell')],
  [3, card(3, 'Infinite Impermanence', 'trap')],
  [4, card(4, 'Evil★Twin Ki-sikil', 'monster', ['link'])],
])
const deck: Deck = { main: [1, 1, 2, 3], extra: [4], side: [2] }
const lookup = async () => cards

afterEach(() => vi.unstubAllGlobals())

describe('deck io', () => {
  it('reads every import format; Omega splits the extra deck by card type', async () => {
    expect(await readDeck(toYdke(deck), lookup)).toEqual({ deck, format: 'ydke' })
    expect(await readDeck(toYdk(deck), lookup)).toEqual({ deck, format: 'ydk' })
    expect(await readDeck(`  ${await toOmega(deck)}\n`, lookup)).toEqual({ deck, format: 'omega' })
    await expect(readDeck('3 Pot of Greed', lookup)).rejects.toThrow(DeckCodeError)
  })

  it('fills the Konami form, grouping copies and keeping the font encodable', async () => {
    vi.stubGlobal('fetch', async () => new Response(readFileSync('public/konami-decklist.pdf')))
    const { blob, overflow } = await konamiPdf(deck, cards)
    const form = (await PDFDocument.load(await blob.arrayBuffer())).getForm()
    const get = (name: string) => form.getTextField(name).getText()
    expect(overflow).toBe(false)
    expect([get('Monster 1'), get('Monster Card 1 Count'), get('Total Monster Cards')]).toEqual(['Ash Blossom & Joyous Spring', '2', '2'])
    expect([get('Spell 1'), get('Trap 1'), get('Extra Deck 1'), get('Side Deck 1'), get('Main Deck Total')]).toEqual(['Pot of Greed', 'Infinite Impermanence', 'Evil*Twin Ki-sikil', 'Pot of Greed', '4'])
  })

  it('names files safely', () => {
    expect(fileName(' Snake-Eye: v2? ', 'ydk')).toBe('Snake-Eye v2.ydk')
    expect(fileName('', 'pdf')).toBe('deck.pdf')
  })
})
