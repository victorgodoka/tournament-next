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
}

/** A storage holding `draft` (or `text`) under the draft key, whose reads are counted. */
const stored = (text: string | null = JSON.stringify({ v: 1, ...draft })) => ({ getItem: vi.fn((key: string) => (key === DRAFT_KEY ? text : null)) })

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
    expect(bootSession('', stored(JSON.stringify({ v: 1, ...draft, cursor: 99 })))).toEqual(empty)
    expect(bootSession('', null)).toEqual(empty)
  })
})
