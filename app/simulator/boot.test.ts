import { describe, expect, it, vi } from 'vitest'
import { toYdke } from '@utils/deck/codecs/ydke'
import type { Deck } from '@utils/deck/types'
import { DRAFT_KEY } from '@utils/simulator/draft'
import { emptySession } from '@utils/simulator/session'
import type { Session } from '@utils/simulator/types'
import { bootSession } from './boot'

const draft: Session = {
  deck: { main: [101, 102, 103], extra: [201], side: [] },
  name: 'Saved',
  actions: [{ t: 'draw', n: 2 }, { t: 'move', card: 0, to: 'm0' }],
  cursor: 2,
  start: 0,
  deckId: null,
  combo: null,
  counterTypes: [],
}

/** A storage holding `draft` (or `text`) under the draft key, whose reads are counted. */
const stored = (text: string | null = JSON.stringify({ v: 2, ...draft })) => ({ getItem: vi.fn((key: string) => (key === DRAFT_KEY ? text : null)) })

describe('bootSession', () => {
  it('?d= boots that deck, restoring + and trimming the name', () => {
    // A deck whose ydke carries a `+`: URLSearchParams turns a raw + into a space, so the boot has to put it back.
    const deck: Deck = Array.from({ length: 500 }, (_, i) => ({ main: [14558127, 46986414, 1000 + i], extra: [], side: [] })).find((d) => toYdke(d).includes('+'))!
    const ydke = toYdke(deck)
    expect(ydke).toContain('+')
    const storage = stored()

    const long = bootSession(`?d=${ydke.replaceAll('+', ' ')}&name=${'x'.repeat(100)}`, storage)
    expect(long).toEqual({ session: { ...emptySession(), deck, name: 'x'.repeat(80) }, notice: null })

    const padded = bootSession(`?d=${encodeURIComponent(ydke)}&name=${encodeURIComponent('  Snake-Eye \n')}`, storage)
    expect(padded).toEqual({ session: { ...emptySession(), deck, name: 'Snake-Eye' }, notice: null })

    expect(bootSession(`?d=${encodeURIComponent(ydke)}`, storage).session.name).toBe('')
    expect(storage.getItem).not.toHaveBeenCalled() // ?d= wins over a saved draft
  })

  it('?deck= with a valid id ties the session to that saved deck, and anything else leaves it null', () => {
    const d = encodeURIComponent(toYdke(draft.deck))
    const deckOf = (search: string) => bootSession(search, null).session.deckId
    expect(deckOf(`?d=${d}&deck=0123456789abcdef`)).toBe('0123456789abcdef')
    expect(deckOf(`?d=${d}&name=Mine&deck=0123456789abcdef`)).toBe('0123456789abcdef')
    for (const bad of ['bad', '', '0123456789ABCDEF', '0123456789abcde', '0123456789abcdef0']) expect(deckOf(`?d=${d}&deck=${bad}`), bad).toBeNull()
    expect(deckOf(`?d=${d}`)).toBeNull()
    expect(bootSession(`?d=${d}&deck=0123456789abcdef`, null).session.combo).toBeNull()
    // a damaged link opens empty, so it carries no deck id
    expect(deckOf('?d=ydke://!&deck=0123456789abcdef')).toBeNull()
  })

  it('a v1 draft written before the saved combos still boots', () => {
    const old = { v: 1, deck: draft.deck, name: draft.name, actions: draft.actions, cursor: draft.cursor, start: draft.start }
    expect(bootSession('', stored(JSON.stringify(old)))).toEqual({ session: draft, notice: null })
  })

  it('a damaged ?d= opens empty with damagedLink and ignores the draft', () => {
    const storage = stored()
    for (const search of ['?d=ydke://!', '?d=', '?d=not-a-deck', `?d=${encodeURIComponent('ydke://!!!!')}`]) {
      expect(bootSession(search, storage), search).toEqual({ session: emptySession(), notice: 'damagedLink' })
    }
    expect(storage.getItem).not.toHaveBeenCalled()
  })

  it('without ?d= the draft is restored, else the session is empty', () => {
    expect(bootSession('', stored())).toEqual({ session: draft, notice: null })
    expect(bootSession('?name=ignored&deck=abcdefabcdefabcd', stored())).toEqual({ session: draft, notice: null })

    const empty = { session: emptySession(), notice: null }
    expect(bootSession('', stored(null))).toEqual(empty)
    expect(bootSession('', stored('{broken'))).toEqual(empty)
    expect(bootSession('', stored(JSON.stringify({ v: 2, ...draft, cursor: 99 })))).toEqual(empty)
    expect(bootSession('', null)).toEqual(empty)
  })
})
