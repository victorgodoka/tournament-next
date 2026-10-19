// @vitest-environment happy-dom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DeckCard } from '@utils/combo/deck-cards'
import { evaluate, type Evaluation } from '@utils/combo/evaluate'
import { nextSeed } from '@utils/combo/rng'
import { dealHand } from '@utils/combo/simulate'
import { DEFAULT_DRAW, DEFAULT_EFFECTS, DRAW_EFFECTS, type Analysis, type Roles } from '@utils/combo/types'
import { Simulator } from './simulator'

vi.mock('next-intl', () => ({
  // Values ride along after the key, so a line like "estimateLabel:7000" is checkable.
  useTranslations: () => (key: string, v?: Record<string, unknown>) => (v ? `${key}:${Object.values(v).join(',')}` : key),
  useLocale: () => 'en',
  useFormatter: () => ({ number: (n: number, o?: { style?: string }) => (o?.style === 'percent' ? `${Math.round(n * 100)}%` : String(n)) }),
}))
vi.mock('next/image', () => ({ default: () => null }))

const D = DRAW_EFFECTS
const row = (id: number, copies: number): DeckCard => ({ id, copies, card: null, passcode: id })
const STARTER = { kind: 'role', role: 'Starter' } as const
// 40 cards: 3 Starters, 3 Traps, Desires, Prosperity, 32 filler
const rows = [row(1, 3), row(2, 3), row(D.desires, 1), row(D.prosperity, 1), ...Array.from({ length: 32 }, (_, i) => row(200 + i, 1))]
const roles: Roles = new Map([[1, ['Starter']], [2, ['Hand Trap']]])
const analysis: Analysis = { hands: [{ name: 'Combo', rules: [{ subject: STARTER, min: 1, max: null }] }] }
const result = evaluate(rows, roles, analysis, DEFAULT_DRAW)
const base = {
  rows,
  roles,
  analysis,
  draw: DEFAULT_DRAW,
  effects: DEFAULT_EFFECTS,
  extraSize: 15,
  seed: 42,
  result,
  nameOf: (id: number) => `card ${id}`,
  onSeed: vi.fn(),
  onToggleEffect: vi.fn(),
  onBanish: vi.fn(),
}

afterEach(cleanup)

describe('Simulator', () => {
  it('deals drawCount cards, says which hands pass, Deal again advances the seed, Draw next adds a card', () => {
    render(<Simulator {...base} />)
    const hand = () => within(screen.getByRole('list', { name: 'simulator.deal' })).getAllByRole('listitem')
    expect(hand()).toHaveLength(5)
    const d = dealHand(rows, roles, analysis, DEFAULT_DRAW, DEFAULT_EFFECTS, 15, 42)
    d.hand.forEach((id, i) => expect(hand()[i]!.textContent).toContain(`card ${id}`))
    expect(screen.getAllByText(d.any ? 'simulator.passes' : 'simulator.fails')).toHaveLength(2) // Combo and Any agree with one hand
    fireEvent.click(screen.getByText('simulator.drawNext'))
    expect(hand()).toHaveLength(6)
    fireEvent.click(screen.getByText('simulator.dealAgain'))
    expect(base.onSeed).toHaveBeenCalledWith(nextSeed(42))
  })
  it("lists the deck's draw effects with a switch each and a 3 / 6 control on Prosperity", () => {
    render(<Simulator {...base} />)
    expect(screen.getAllByRole('switch')).toHaveLength(2)
    // The label wraps the switch and its hint, so the accessible name carries both.
    fireEvent.click(screen.getByRole('switch', { name: new RegExp(`simulator\\.resolve:card ${D.desires}`) }))
    expect(base.onToggleEffect).toHaveBeenCalledWith(D.desires)
    fireEvent.click(within(screen.getByRole('group', { name: 'simulator.banish' })).getByText('3'))
    expect(base.onBanish).toHaveBeenCalledWith('prosperity', 3)
    cleanup()
    render(<Simulator {...base} rows={rows.filter((r) => r.id !== D.desires && r.id !== D.prosperity)} />)
    expect(screen.getByText(/^simulator\.noEffects/)).toBeTruthy()
  })
  it('runs the simulation in chunks, labels the estimates, and marks them stale when the deck changes', async () => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0) as unknown as number)
    vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
    const { rerender } = render(<Simulator {...base} />)
    fireEvent.change(screen.getByLabelText('simulator.runs'), { target: { value: '7000' } })
    await act(async () => {
      fireEvent.click(screen.getByText('simulator.simulate'))
      await new Promise((r) => setTimeout(r, 50))
    })
    expect(screen.getAllByText('simulator.estimateLabel:7000').length).toBeGreaterThan(0)
    const table = screen.getByRole('table')
    expect(within(table).getAllByRole('row')).toHaveLength(3) // header, Combo, Any
    const exact = `${Math.round((result as Evaluation).any.p * 100)}%`
    expect(within(table).getAllByText(exact).length).toBeGreaterThan(0)
    expect(screen.queryByText('simulator.stale')).toBeNull()
    rerender(<Simulator {...base} rows={rows.slice(0, 39)} />)
    expect(screen.getByText('simulator.stale')).toBeTruthy()
  })
  it('shows the too-few-cards notice instead of a hand', () => {
    render(<Simulator {...base} rows={[row(1, 3)]} result={{ error: 'tooFewCards' }} />)
    expect(screen.getByText('results.tooFewCards')).toBeTruthy()
    expect(screen.queryByText('simulator.dealAgain')).toBeNull()
  })
})
