import { describe, expect, it } from 'vitest'
import { encodeShare } from '@utils/combo/share'
import type { Calculation } from '@utils/combo/types'
import { toYdke } from '@utils/deck/codecs/ydke'
import { bootState } from './boot'

const calc = (): Calculation => ({
  builds: [{ name: 'Saved', deck: { main: Array.from({ length: 40 }, (_, i) => 1000 + i), extra: [], side: [] }, roles: new Map([[1000, ['Starter']]]), format: null, deckId: null }],
  analysis: { hands: [{ name: '', rules: [{ subject: { kind: 'role', role: 'Starter' }, min: 1, max: null }] }] },
  draw: { going: 'first', handSize: null, extraDraws: 0, turn: 1 },
  focus: null,
})

describe('bootState', () => {
  it('boots from a share link, a builder link with + turned into spaces, and nothing', async () => {
    const code = await encodeShare(calc())
    expect(await bootState(`?c=${code}`)).toMatchObject({ from: 'share', notice: null, deckId: null, calc: calc() })

    // A deck whose ydke carries a `+`: the case this guards against, URLSearchParams turning a raw + into a space.
    const deck = Array.from({ length: 500 }, (_, i) => ({ main: [14558127, 46986414, 1000 + i], extra: [], side: [] })).find((d) => toYdke(d).includes('+'))!
    const ydke = toYdke(deck)
    expect(ydke).toContain('+')
    const spaced = `?d=${ydke.replaceAll('+', ' ')}&name=Snake-Eye&deck=abcdefabcdefabcd`
    expect(await bootState(spaced)).toMatchObject({
      from: 'builder',
      notice: null,
      deckId: 'abcdefabcdefabcd',
      calc: { builds: [{ name: 'Snake-Eye', deck, deckId: 'abcdefabcdefabcd' }] },
    })
    expect(await bootState(`?d=${encodeURIComponent(ydke)}&deck=nope`)).toMatchObject({ from: 'builder', deckId: null, calc: { builds: [{ name: '', deckId: null }] } })

    expect(await bootState('?c=garbage!!')).toMatchObject({ from: 'empty', notice: 'damagedLink' })
    expect(await bootState('?d=ydke://!')).toMatchObject({ from: 'empty', notice: 'damagedLink' })
    expect(await bootState('')).toMatchObject({ from: 'empty', notice: null, deckId: null })
  })
})
