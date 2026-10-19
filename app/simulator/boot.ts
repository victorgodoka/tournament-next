import { fromYdke } from '@utils/deck/codecs/ydke'
import { DeckCodeError } from '@utils/deck/types'
import { readDraft } from '@utils/simulator/draft'
import { emptySession, sessionReducer } from '@utils/simulator/session'
import type { Session } from '@utils/simulator/types'

export type Boot = { session: Session; notice: 'damagedLink' | null }

/** Runs once, client only: `?d=` (a ydke link) wins over the saved draft; a damaged `?d=` opens empty without touching the draft. */
export function bootSession(search: string, storage: Pick<Storage, 'getItem'> | null): Boot {
  const params = new URLSearchParams(search)
  const ydke = params.get('d')
  if (ydke === null) return { session: readDraft(storage) ?? emptySession(), notice: null }
  try {
    // URLSearchParams turns an unencoded `+` into a space; base64 has no spaces, so put them back.
    const deck = fromYdke(ydke.replaceAll(' ', '+'))
    // `load` cuts the name to LIMITS.name
    return { session: sessionReducer(emptySession(), { type: 'load', deck, name: (params.get('name') ?? '').trim() }), notice: null }
  } catch (error) {
    if (!(error instanceof DeckCodeError)) throw error
    return { session: emptySession(), notice: 'damagedLink' }
  }
}
