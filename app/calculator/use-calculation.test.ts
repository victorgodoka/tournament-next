// @vitest-environment happy-dom
import { renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { DEFAULT_DRAW, type Analysis, type Build } from '@utils/combo/types'
import type { CardMap } from '@utils/deck/types'
import { useCalculations } from './use-calculation'

const build = (name: string, main: number[]): Build => ({ name, deck: { main, extra: [], side: [] }, roles: new Map(), format: null, deckId: null })
const analysis: Analysis = { hands: [{ name: '', rules: [{ subject: { kind: 'role', role: 'Starter' }, min: 1, max: null }] }] }
const cards: CardMap = new Map()

describe('useCalculations', () => {
  it("keeps a build's view when only its name or another build changed", () => {
    const a = build('A', [1, 1])
    const b = build('B', [2])
    const originals = [a.deck, b.deck]
    const { result, rerender } = renderHook(({ builds }: { builds: Build[] }) => useCalculations(builds, originals, cards, analysis, DEFAULT_DRAW, null), {
      initialProps: { builds: [a, b] },
    })
    const [viewA, viewB] = result.current
    rerender({ builds: [{ ...a, name: 'renamed' }, b] })
    expect(result.current[0]).toBe(viewA)
    expect(result.current[1]).toBe(viewB)
    rerender({ builds: [a, { ...b, roles: new Map([[2, ['Starter']]]) }] })
    expect(result.current[0]).toBe(viewA)
    expect(result.current[1]).not.toBe(viewB)
    expect(result.current[1]!.palette).toEqual(['Starter', 'Extender', 'Hand Trap', 'Brick'])
  })
})
