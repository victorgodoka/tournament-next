// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Evaluation } from '@utils/combo/evaluate'
import type { Build, Hand } from '@utils/combo/types'
import { Compare, compareRows } from './compare'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
  useFormatter: () => ({ number: (n: number, o?: { style?: string }) => (o?.style === 'percent' ? `${Math.round(n * 100)}%` : String(n)) }),
}))

const hand = (name: string): Hand => ({ name, rules: [{ subject: { kind: 'role', role: 'Starter' }, min: 1, max: null }] })
const odds = (p: number) => ({ favorable: BigInt(Math.round(p * 100)), total: 100n, p })
const evaluation = (ps: number[], any: number): Evaluation => ({ hands: ps.map((p, i) => ({ name: String(i), odds: odds(p) })), any: odds(any), draw: 5, deckSize: 40 })
const b = (name: string, size: number): Build => ({ name, deck: { main: Array<number>(size).fill(1), extra: [], side: [] }, roles: new Map(), format: null, deckId: null })

afterEach(cleanup)

describe('compare', () => {
  it('deltas are percentage points against build A, blank where a build has no result', () => {
    const rows = compareRows([hand('a'), hand('b')], [evaluation([0.5, 0.2], 0.6), evaluation([0.6, 0.1], 0.65), { error: 'tooFewCards' }])
    expect(rows.map((r) => r.key)).toEqual([0, 1, 'any'])
    expect(rows[0]!.cells.map((c) => c.p)).toEqual([0.5, 0.6, null])
    expect(rows[0]!.cells.map((c) => c.delta)).toEqual([null, expect.closeTo(10, 6), null])
    expect(rows[1]!.cells[1]!.delta).toBeCloseTo(-10, 6)
    expect(rows[2]!.cells[1]!.delta).toBeCloseTo(5, 6)
  })
  it('renders one column per build with the deck size, each hand, any hand and the deltas', () => {
    render(<Compare builds={[b('X', 40), b('Y', 41)]} hands={[hand('Combo')]} results={[evaluation([0.5], 0.5), evaluation([0.62], 0.62)]} />)
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual(['', 'A · X', 'B · Y'])
    expect(screen.getByText('40')).toBeTruthy()
    expect(screen.getByText('41')).toBeTruthy()
    expect(screen.getAllByText('62%')).toHaveLength(2)
    expect(screen.getAllByText('compare.delta')).toHaveLength(2)
  })
})
