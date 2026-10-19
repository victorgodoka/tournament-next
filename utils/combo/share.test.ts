import { describe, expect, it } from 'vitest'
import { pipe } from '@utils/deck/codecs/omega'
import type { Deck } from '@utils/deck/types'
import { MAX_SEED } from './rng'
import { decodeShare, encodeShare, ShareError } from './share'
import { DEFAULT_EFFECTS, type Analysis, type Calculation, type Draw, type Effects } from './types'

const calc = (): Calculation => ({
  builds: [
    {
      name: 'Snake-Eye',
      deck: { main: [...Array<number>(3).fill(14558127), ...Array.from({ length: 37 }, (_, i) => 1000 + i)], extra: [84013237], side: [24224830] },
      roles: new Map([[14558127, ['Hand Trap']], [1000, ['Starter', 'Engine']]]),
      format: 2,
      deckId: 'abcdefabcdefabcd',
    },
  ],
  analysis: {
    hands: [
      { name: 'Combo', rules: [{ subject: { kind: 'role', role: 'Starter' }, min: 1, max: null }, { subject: { kind: 'role', role: 'Brick' }, min: 0, max: 0 }] },
      { name: '', rules: [{ subject: { kind: 'card', id: 14558127 }, min: 2, max: 3 }] },
    ],
  },
  draw: { going: 'second', handSize: null, extraDraws: 1, turn: 2 },
  focus: { kind: 'card', id: 14558127 },
  seed: 123456789,
  effects: { resolve: [35261759], prosperity: 3, extravagance: 6 },
})

const fromBase64url = (text: string) => Uint8Array.from(atob(text.replaceAll('-', '+').replaceAll('_', '/')), (c) => c.charCodeAt(0))
const toBase64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/, '')
const inflateForTest = async (code: string) => new TextDecoder().decode(await pipe(fromBase64url(code), new DecompressionStream('deflate-raw')))
const deflateForTest = async (json: string) => toBase64url(await pipe(new TextEncoder().encode(json), new CompressionStream('deflate-raw')))
/** The fixture's payload with one field tampered, re-encoded. */
const edit = async (f: (raw: Record<string, unknown>) => void) => {
  const raw = JSON.parse(await inflateForTest(await encodeShare(calc()))) as Record<string, unknown>
  f(raw)
  return deflateForTest(JSON.stringify(raw))
}

describe('share', () => {
  it('round-trips a calculation through a URL-safe string', async () => {
    const code = await encodeShare(calc())
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/)
    expect(code.length).toBeLessThan(1200)
    const back = await decodeShare(code)
    expect(back).toEqual(calc())
  })
  it('refuses damaged or out-of-range links', async () => {
    await expect(decodeShare('not-base64!!')).rejects.toThrow(ShareError)
    await expect(decodeShare('x'.repeat(8193))).rejects.toThrow(ShareError)
    await expect(decodeShare(await deflateForTest('[1,2'))).rejects.toThrow(ShareError)
    await expect(decodeShare(await edit((r) => (r.v = 3)))).rejects.toThrow(ShareError)
    await expect(decodeShare(await edit((r) => ((r.analysis as Analysis).hands[0]!.rules[0]!.max = 0)))).rejects.toThrow(ShareError) // min 1 > max 0
    await expect(decodeShare(await edit((r) => ((r.builds as { roles: unknown[][] }[])[0]!.roles[0]![1] = Array<string>(9).fill('r'))))).rejects.toThrow(ShareError)
    await expect(decodeShare(await edit((r) => ((r.builds as { deck: Deck }[])[0]!.deck.main = Array<number>(61).fill(1))))).rejects.toThrow(ShareError)
    await expect(decodeShare(await edit((r) => ((r.draw as Draw).turn = 11)))).rejects.toThrow(ShareError)
    await expect(decodeShare(await edit((r) => ((r.builds as { deckId: string }[])[0]!.deckId = '../etc')))).rejects.toThrow(ShareError)
    await expect(decodeShare(await edit((r) => (r.builds = [])))).rejects.toThrow(ShareError)
    await expect(decodeShare(await edit((r) => (r.focus = { kind: 'role', role: '' })))).rejects.toThrow(ShareError)
  })
  it('round-trips three builds and refuses seven', async () => {
    const a = calc().builds[0]!
    const three: Calculation = {
      ...calc(),
      builds: [a, { ...a, name: 'B', format: null, deckId: null, roles: new Map([[1001, ['Brick']]]) }, { ...a, name: 'C', deck: { ...a.deck, main: [...a.deck.main, 1037, 1038] } }],
    }
    const code = await encodeShare(three)
    expect(code.length).toBeLessThan(3000)
    expect(await decodeShare(code)).toEqual(three)
    const raw = JSON.parse(await inflateForTest(code)) as { builds: unknown[] }
    await expect(decodeShare(await deflateForTest(JSON.stringify({ ...raw, builds: Array<unknown>(7).fill(raw.builds[0]) })))).rejects.toThrow(ShareError)
  })
  it('reads a v1 link with a fresh seed and default effects, and refuses bad effects', async () => {
    const raw = JSON.parse(await inflateForTest(await encodeShare(calc()))) as Record<string, unknown>
    expect(raw.v).toBe(2)
    const v1: Record<string, unknown> = { ...raw, v: 1 }
    delete v1.seed
    delete v1.effects
    const back = await decodeShare(await deflateForTest(JSON.stringify(v1)))
    expect(back).toEqual({ ...calc(), seed: expect.any(Number), effects: DEFAULT_EFFECTS })
    expect(Number.isInteger(back.seed) && back.seed >= 0 && back.seed <= MAX_SEED).toBe(true)
    const bad = async (f: (raw: Record<string, unknown>) => void) => expect(decodeShare(await edit(f))).rejects.toThrow(ShareError)
    await bad((r) => (r.seed = -1))
    await bad((r) => (r.seed = 1.5))
    await bad((r) => delete r.effects)
    await bad((r) => ((r.effects as Effects).resolve = [1]))
    await bad((r) => ((r.effects as Effects).resolve = [35261759, 35261759]))
    await bad((r) => ((r.effects as { prosperity: number }).prosperity = 4))
  })
  it('normalizes roles and ignores unknown keys on the way in', async () => {
    const raw = JSON.parse(await inflateForTest(await encodeShare(calc()))) as Record<string, unknown>
    raw.extra = true
    ;(raw.builds as { roles: unknown[][] }[])[0]!.roles[0]![1] = ['  hand   trap ']
    const back = await decodeShare(await deflateForTest(JSON.stringify(raw)))
    expect(back.builds[0]!.roles.get(14558127)).toEqual(['Hand Trap'])
    expect('extra' in back).toBe(false)
  })
})
