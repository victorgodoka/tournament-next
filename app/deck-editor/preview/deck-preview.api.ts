import YGOProDeck from 'ygopro-deck-encode'
import { API_ENDPOINTS } from '@const'
import { extractCardsFromResponse, searchCards } from '@lib/cards.api'
import { isRecord } from '@lib/api-result'
import type { ConvertedDeck } from '@app/decks/decks.types'
import type { DeckFormat, OmegaDeckResponse } from '../deck-editor.types'

export interface PreviewPayload {
  main: number[]
  extra: number[]
  side: number[]
  name?: string
  format?: DeckFormat
}

export interface PreviewResult {
  deck: ConvertedDeck
  ydke: string
  codes: Record<string, string>
  /** True when the Omega convert failed and the deck was rebuilt locally
   * (no archetype detection or Omega code available). */
  degraded: boolean
  /** The converter's reason for failing, when it gave one (e.g. a deck-size
   * rule), so the preview can explain the degradation instead of guessing. */
  note?: string
}

const uniq = (ids: number[]) => [...new Set(ids)]

/** YDKE is derivable from the raw ids alone, so it's always available even when
 * the convert service is unreachable. */
const ydkeFrom = ({ main, extra, side }: PreviewPayload) =>
  new YGOProDeck({ main, extra, side }).toYdkeURL()

async function convertFullDeck(payload: PreviewPayload): Promise<OmegaDeckResponse> {
  const response = await fetch(`${API_ENDPOINTS.MAIN}/convert?full=y`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ main: payload.main, side: payload.side, extra: payload.extra }),
  })
  const json: unknown = await response.json().catch(() => null)
  if (!response.ok || (isRecord(json) && json.success === false)) {
    // Surface the API's own reason (e.g. a deck-size rule) when it gives one.
    const reason = isRecord(json) && typeof json.error === 'string' ? json.error : 'convert failed'
    throw new Error(reason)
  }
  // Unwrap `{ success, data }` if the endpoint wraps its payload.
  if (isRecord(json) && isRecord(json.data)) return json.data as OmegaDeckResponse
  return json as OmegaDeckResponse
}

/** Map the loosely-typed Omega response into the `ConvertedDeck` the shared
 * deck-list and export components already consume. Extra-deck ids are merged
 * back into `main` because those components split them out by card type. */
function toConvertedDeck(
  omega: OmegaDeckResponse,
  payload: PreviewPayload,
): ConvertedDeck {
  const fd = omega.fullDeck ?? {}
  const main = [...(fd.main ?? payload.main), ...(fd.extra ?? payload.extra)]
  const side = fd.side ?? payload.side
  const archetypes = omega.archetypeData ?? []
  const codes = omega.codes ?? {}
  const primary = archetypes[0]?.name ?? payload.name ?? 'Untitled Deck'

  return {
    code: codes.omega ?? codes.ydk ?? Object.values(codes)[0] ?? '',
    primaryArchetype: omega.primaryArchetype ?? primary,
    primaryArchetypeWeighted: primary,
    primaryArchetypes: archetypes.slice(0, 3).map((a) => a.name),
    category: omega.category ?? '',
    archetypes,
    totalCards: main.length + side.length,
    mainDeckSize: main.length,
    sideDeckSize: side.length,
    uniqueCards: uniq([...main, ...side]),
    fullDeck: { main, side, extra },
    uniqueCardsData: omega.uniqueCardsData ?? [],
  }
}

/** Rebuild a renderable deck client-side when convert is unavailable: hydrate
 * card data straight from the cards API so the decklist and YDKE still work. */
async function buildLocalDeck(payload: PreviewPayload): Promise<ConvertedDeck> {
  const main = [...payload.main, ...payload.extra]
  const side = payload.side
  const ids = uniq([...main, ...side])
  let cards: ConvertedDeck['uniqueCardsData'] = []
  try {
    cards = extractCardsFromResponse(await searchCards({ id: ids, region: 'ALL', method: 'POST' }))
  } catch {
    /* leave cards empty — the list still renders by id */
  }

  return {
    code: '',
    primaryArchetype: payload.name ?? 'Untitled Deck',
    primaryArchetypeWeighted: payload.name ?? 'Untitled Deck',
    primaryArchetypes: [],
    category: '',
    archetypes: [],
    totalCards: main.length + side.length,
    mainDeckSize: main.length,
    sideDeckSize: side.length,
    uniqueCards: ids,
    fullDeck: { main, side, extra },
    uniqueCardsData: cards,
  }
}

export async function loadPreview(payload: PreviewPayload): Promise<PreviewResult> {
  const ydke = ydkeFrom(payload)
  try {
    const omega = await convertFullDeck(payload)
    const deck = toConvertedDeck(omega, payload)
    return { deck, ydke, codes: { ...(omega.codes ?? {}), ydke }, degraded: false }
  } catch (error) {
    const deck = await buildLocalDeck(payload)
    const note = error instanceof Error && error.message !== 'convert failed' ? error.message : undefined
    return { deck, ydke, codes: { ydke }, degraded: true, note }
  }
}
