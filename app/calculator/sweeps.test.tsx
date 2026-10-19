// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DeckCard } from '@utils/combo/deck-cards'
import { DEFAULT_DRAW, type Analysis, type Roles } from '@utils/combo/types'
import { Sweeps } from './sweeps'

vi.mock('next-intl', () => ({
  // Values ride along after the key, so a line like "reached at 2 copies" is checkable.
  useTranslations: () => (key: string, v?: Record<string, unknown>) => (v ? `${key}:${Object.values(v).join(',')}` : key),
  useLocale: () => 'en',
  useFormatter: () => ({ number: (n: number, o?: { style?: string }) => (o?.style === 'percent' ? `${Math.round(n * 100)}%` : String(n)) }),
}))

const row = (id: number, copies: number): DeckCard => ({ id, copies, card: null, passcode: id })
const STARTER = { kind: 'role', role: 'Starter' } as const
// 40 cards: card 1 is the only Starter, card 2 and 38 others are filler
const rows = [row(1, 1), row(2, 1), ...Array.from({ length: 38 }, (_, i) => row(10 + i, 1))]
const roles: Roles = new Map([[1, ['Starter']]])
const analysis: Analysis = { hands: [{ name: 'Combo', rules: [{ subject: STARTER, min: 1, max: null }] }] }
const base = { rows, roles, analysis, draw: DEFAULT_DRAW, banlist: null, focus: null, nameOf: (id: number) => `card ${id}` }

beforeEach(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      disconnect() {}
    },
  )
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('Sweeps', () => {
  it('sweeps copies of the first tagged card and names the first count that reaches the target', () => {
    render(<Sweeps {...base} />)
    expect(screen.getByLabelText('sweeps.copiesOf:card 1')).toBeTruthy() // the chart, titled by the card
    expect(screen.getAllByText('hands.any')).toHaveLength(2) // the legend and the reached list; no direct label on the line, which overlaps the hand's
    expect(screen.getAllByText('sweeps.notReached')).toHaveLength(2) // Combo and Any at 80 %
    fireEvent.change(screen.getByLabelText('sweeps.target'), { target: { value: '20' } })
    expect(screen.getAllByText('sweeps.reached.copies:2')).toHaveLength(2) // 2 of 40 over 5 cards: 23.7 %
    fireEvent.change(screen.getByLabelText('sweeps.card'), { target: { value: '2' } })
    expect(screen.getByLabelText('sweeps.copiesOf:card 2')).toBeTruthy()
  })
  it('switches to deck size and turn', () => {
    render(<Sweeps {...base} />)
    fireEvent.click(screen.getByText('sweeps.deckSize'))
    expect(screen.getByLabelText('sweeps.deckSize')).toBeTruthy()
    expect(screen.getByText('60')).toBeTruthy() // the last x label
    fireEvent.click(screen.getByText('sweeps.turn'))
    expect(screen.getByText('6')).toBeTruthy()
  })
  it('asks for a hand when there is none', () => {
    render(<Sweeps {...base} analysis={{ hands: [] }} />)
    expect(screen.getByText('sweeps.noHands')).toBeTruthy()
  })
})
