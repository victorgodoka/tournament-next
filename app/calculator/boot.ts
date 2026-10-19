import { decodeShare, ShareError } from '@utils/combo/share'
import { LIMITS, type Calculation } from '@utils/combo/types'
import { fromYdke } from '@utils/deck/codecs/ydke'
import { DeckCodeError } from '@utils/deck/types'
import { emptyCalculation } from './calculator.reducer'

export type Boot = {
  calc: Calculation
  from: 'share' | 'builder' | 'empty'
  notice: 'damagedLink' | null
  /** The saved deck to read roles and revision from, when the link names one. */
  deckId: string | null
}

const DECK_ID = /^[0-9a-f]{16}$/

const damaged = (): Boot => ({ calc: emptyCalculation(), from: 'empty', notice: 'damagedLink', deckId: null })

/** Runs once, client only: `?c=` (a share link) wins over `?d=` (the deck builder's hand-off); a damaged link opens empty. */
export const bootState = async (search: string): Promise<Boot> => {
  const params = new URLSearchParams(search)
  const code = params.get('c')
  if (code !== null) {
    try {
      const calc = await decodeShare(code)
      return { calc, from: 'share', notice: null, deckId: calc.builds[0]!.deckId }
    } catch (error) {
      if (!(error instanceof ShareError)) throw error
      return damaged()
    }
  }
  const ydke = params.get('d')
  if (ydke !== null) {
    try {
      // URLSearchParams turns an unencoded `+` into a space; base64 has no spaces, so put them back.
      const deck = fromYdke(ydke.replaceAll(' ', '+'))
      const raw = params.get('deck')
      const deckId = raw !== null && DECK_ID.test(raw) ? raw : null
      const name = (params.get('name') ?? '').trim().slice(0, LIMITS.name)
      return { calc: { ...emptyCalculation(), builds: [{ name, deck, roles: new Map(), format: null, deckId }] }, from: 'builder', notice: null, deckId }
    } catch (error) {
      if (!(error instanceof DeckCodeError)) throw error
      return damaged()
    }
  }
  return { calc: emptyCalculation(), from: 'empty', notice: null, deckId: null }
}
