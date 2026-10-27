import { detectFormat } from '@utils/deck/codecs/detect'
import { fromOmega } from '@utils/deck/codecs/omega'
import { assertDeck, fromYdk } from '@utils/deck/codecs/ydk'
import { fromYdke } from '@utils/deck/codecs/ydke'
import { splitExtra } from '@utils/deck/model'
import { DeckCodeError, type CardMap, type Deck } from '@utils/deck/types'
import { download } from '@utils/download'

export type ImportFormat = 'omega' | 'ydke' | 'ydk'

/**
 * A pasted Omega code, ydke:// URL or .ydk text. Omega codes keep main and extra together, so their
 * cards are looked up (`lookup`) to split them; anything else throws DeckCodeError.
 */
export const readDeck = async (text: string, lookup: (ids: number[]) => Promise<CardMap>): Promise<{ deck: Deck; format: ImportFormat }> => {
  const format = detectFormat(text)
  if (format === 'ydke') return { deck: fromYdke(text), format }
  if (format === 'ydk') return { deck: fromYdk(text), format }
  if (format !== 'omega') throw new DeckCodeError('Not a deck code')
  const { main, side } = await fromOmega(text.trim())
  const deck = { ...splitExtra(main, await lookup(main)), side }
  assertDeck(deck)
  return { deck, format }
}

/** `name` as a file name: characters Windows refuses dropped, `deck` when nothing is left. */
export const fileName = (name: string, ext: string) => `${name.trim().replace(/[\\/:*?"<>|]+/g, '').slice(0, 80) || 'deck'}.${ext}`

export { download }

/** The system share sheet where the browser takes files, else a download. `cancelled`: the user closed the sheet. */
export const share = async (blob: Blob, name: string, title: string): Promise<'shared' | 'downloaded' | 'cancelled'> => {
  const file = new File([blob], name, { type: blob.type })
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title })
      return 'shared'
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return 'cancelled'
      // NotAllowedError: the tap's activation ran out before the image was ready. A download needs none.
    }
  }
  download(blob, name)
  return 'downloaded'
}

/** Name → copies, in deck order; alternate artworks share a name and a row. */
const tally = (ids: readonly number[], cards: CardMap) => {
  const counts = new Map<string, number>()
  for (const id of ids) {
    const name = cards.get(id)?.name ?? String(id)
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return [...counts]
}

/** The form's Helvetica only encodes WinAnsi: stars become `*`, anything else outside it `?`. */
const winAnsi = (s: string) => s.replace(/[★☆]/g, '*').replace(/[^\x20-\x7E\xA0-\xFF–—‘’“”•…]/g, '?')

/** [name field, count field, total field, rows] for `${name} ${i}` / `${count} ${i} Count`, 1-based. */
const FORM = {
  monster: ['Monster', 'Monster Card', 'Total Monster Cards', 18],
  spell: ['Spell', 'Spell Card', 'Total Spell Cards', 18],
  trap: ['Trap', 'Trap Card', 'Total Trap Cards', 18],
  extra: ['Extra Deck', 'Extra Deck', 'Total Extra Deck', 15],
  side: ['Side Deck', 'Side Deck', 'Total Side Deck', 15],
} as const

/**
 * Konami's official decklist (public/konami-decklist.pdf) with the cards filled in; player and event
 * fields stay editable. `overflow`: a section had more distinct cards than the form has rows.
 */
export const konamiPdf = async (deck: Deck, cards: CardMap): Promise<{ blob: Blob; overflow: boolean }> => {
  const [{ PDFDocument }, template] = await Promise.all([import('pdf-lib'), fetch('/konami-decklist.pdf').then((r) => r.arrayBuffer())])
  const doc = await PDFDocument.load(template)
  const form = doc.getForm()
  const kindOf = (id: number) => cards.get(id)?.kind ?? 'monster'
  const sections: [keyof typeof FORM, number[]][] = [
    ['monster', deck.main.filter((id) => kindOf(id) === 'monster')],
    ['spell', deck.main.filter((id) => kindOf(id) === 'spell')],
    ['trap', deck.main.filter((id) => kindOf(id) === 'trap')],
    ['extra', deck.extra],
    ['side', deck.side],
  ]
  let overflow = false
  for (const [section, ids] of sections) {
    const [name, count, total, rows] = FORM[section]
    const lines = tally(ids, cards)
    overflow ||= lines.length > rows
    lines.slice(0, rows).forEach(([card, qty], i) => {
      form.getTextField(`${name} ${i + 1}`).setText(winAnsi(card))
      form.getTextField(`${count} ${i + 1} Count`).setText(String(qty))
    })
    form.getTextField(total).setText(String(ids.length))
  }
  form.getTextField('Main Deck Total').setText(String(deck.main.length))
  return { blob: new Blob([new Uint8Array(await doc.save())], { type: 'application/pdf' }), overflow }
}
