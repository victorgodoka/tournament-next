// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Evaluation } from '@utils/combo/evaluate'
import { deltaPoints, OddsHeadline } from './odds-headline'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: { points: string }) => (values ? `${key} ${values.points}` : key),
  useFormatter: () => ({
    number: (n: number, o?: { style?: string; minimumFractionDigits?: number }) => (o?.style === 'percent' ? `${Math.round(n * 100)}%` : n.toFixed(o?.minimumFractionDigits ?? 0)),
  }),
}))

const evaluation = (p: number): Evaluation => ({ hands: [], any: { p, favorable: 0n, total: 1n }, draw: 5, deckSize: 40 })

afterEach(cleanup)

describe('deltaPoints', () => {
  it('rounds to one decimal and hides 0.0', () => {
    expect(deltaPoints(0.743, 0.712)).toBe(3.1)
    expect(deltaPoints(0.5, 0.5004)).toBeNull()
    expect(deltaPoints(0.4, 0.45)).toBe(-5)
  })
})

describe('OddsHeadline', () => {
  it('shows the percentage and an up arrow against the baseline', () => {
    render(<OddsHeadline result={evaluation(0.743)} hasHands baseline={0.712} />)
    expect(screen.getByText('odds.playable')).toBeTruthy()
    expect(screen.getByText('74%')).toBeTruthy()
    expect(screen.getByText('▲ +3.1')).toBeTruthy()
    expect(screen.getByText('odds.up 3.1')).toBeTruthy()
  })
  it('a drop shows a down arrow with a true minus', () => {
    render(<OddsHeadline result={evaluation(0.4)} hasHands baseline={0.45} />)
    expect(screen.getByText('▼ −5.0')).toBeTruthy()
    expect(screen.getByText('odds.down 5.0')).toBeTruthy()
  })
  it('no baseline, or a change that rounds to 0.0, shows no delta', () => {
    const { rerender } = render(<OddsHeadline result={evaluation(0.5)} hasHands baseline={null} />)
    expect(screen.getByText('50%')).toBeTruthy()
    expect(screen.queryByText(/[▲▼]/)).toBeNull()
    rerender(<OddsHeadline result={evaluation(0.5)} hasHands baseline={0.5004} />)
    expect(screen.queryByText(/[▲▼]/)).toBeNull()
  })
  it('no hands: the hint, no percentage', () => {
    render(<OddsHeadline result={evaluation(0.743)} hasHands={false} baseline={0.5} />)
    expect(screen.getByText('odds.noHands')).toBeTruthy()
    expect(screen.queryByText('74%')).toBeNull()
    expect(screen.queryByText(/[▲▼]/)).toBeNull()
  })
  it('an evaluation error shows the error and no delta', () => {
    render(<OddsHeadline result={{ error: 'tooFewCards' }} hasHands baseline={0.5} />)
    expect(screen.getByText('results.tooFewCards')).toBeTruthy()
    expect(screen.queryByText(/%/)).toBeNull()
    expect(screen.queryByText(/[▲▼]/)).toBeNull()
  })
})
