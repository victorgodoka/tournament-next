import { DeckCodeError, ZONE_MAX, type Deck } from '../types'
import { assertPasscodes } from './ydk'

/** `bytes` through a native (de)compression stream. Shared with the calculator's share codec. */
export const pipe = async (bytes: Uint8Array<ArrayBuffer>, t: CompressionStream | DecompressionStream) =>
  new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(t)).arrayBuffer())

/** Omega layout: base64(raw DEFLATE([main+extra count, side count, ...uint32 LE passcodes])). */
export const toOmega = async ({ main, extra, side }: Deck): Promise<string> => {
  if (main.length + extra.length > ZONE_MAX.main + ZONE_MAX.extra || side.length > ZONE_MAX.side) throw new DeckCodeError('Deck too large for an Omega code')
  const ids = [...main, ...extra, ...side]
  const raw = new Uint8Array(2 + 4 * ids.length)
  raw[0] = main.length + extra.length
  raw[1] = side.length
  const view = new DataView(raw.buffer)
  ids.forEach((id, i) => view.setUint32(2 + 4 * i, id, true))
  const packed = await pipe(raw, new CompressionStream('deflate-raw'))
  return btoa(String.fromCharCode(...packed))
}

/** `main` is main + extra together, in stored order; callers split with `splitExtra`. */
export const fromOmega = async (code: string): Promise<{ main: number[]; side: number[] }> => {
  // 90 cards * 4 bytes deflates to well under 1 KB of base64.
  if (code.length > 1024) throw new DeckCodeError('Omega deck code too long')
  let raw: Uint8Array
  try {
    const bytes = Uint8Array.from(atob(code.trim()), (c) => c.charCodeAt(0))
    raw = await pipe(bytes, new DecompressionStream('deflate-raw'))
  } catch {
    throw new DeckCodeError('Invalid Omega deck code')
  }
  if (raw.length < 2 || raw.length < 2 + 4 * (raw[0]! + raw[1]!)) throw new DeckCodeError('Truncated Omega deck code')
  if (raw[0]! > ZONE_MAX.main + ZONE_MAX.extra) throw new DeckCodeError('Too many cards in main + extra')
  if (raw[1]! > ZONE_MAX.side) throw new DeckCodeError('Too many cards in the side deck')
  const view = new DataView(raw.buffer, raw.byteOffset, raw.byteLength)
  const ids = Array.from({ length: raw[0]! + raw[1]! }, (_, i) => view.getUint32(2 + 4 * i, true))
  assertPasscodes(ids)
  return { main: ids.slice(0, raw[0]), side: ids.slice(raw[0]) }
}
