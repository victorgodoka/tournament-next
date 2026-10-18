// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Evaluation } from '@utils/combo/evaluate'
import { odds } from '@utils/combo/hypergeometric'
import type { Hand, Rule, Subject } from '@utils/combo/types'
import { HandBuilder } from './hand-builder'

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
  useLocale: () => 'en',
  useFormatter: () => ({ number: (n: number, o?: { style?: string }) => (o?.style === 'percent' ? `${Math.round(n * 100)}%` : String(n)) }),
}))

const STARTER = { kind: 'role', role: 'Starter' } as const
const rule = (subject: Subject, min: number, max: number | null = null): Rule => ({ subject, min, max })
const hand = (name: string, rules: Rule[]): Hand => ({ name, rules })
/** Hands at the given probabilities (out of 100) and the union. */
const evaluation = (ps: number[], any: number): Evaluation => ({
  hands: ps.map((p, i) => ({ name: String(i), odds: odds(BigInt(Math.round(p * 100)), 100n) })),
  any: odds(BigInt(Math.round(any * 100)), 100n),
  draw: 5,
  deckSize: 40,
})
const noop = () => {}
const base = {
  subjects: { roles: ['Starter', 'Hand Trap', 'Brick'], cards: [], nameOf: (id: number) => String(id) },
  result: evaluation([], 0),
  unusedRoles: new Set<string>(),
  onAdd: noop,
  onRemove: noop,
  onRename: noop,
  onRule: noop,
  onAddRule: noop,
  onRemoveRule: noop,
}

afterEach(cleanup)

describe('HandBuilder', () => {
  it('presets create the hand from the spec', () => {
    const onAdd = vi.fn()
    render(<HandBuilder {...base} analysis={{ hands: [] }} onAdd={onAdd} />)
    fireEvent.click(screen.getByText('hands.preset.starterTrapNoBrick'))
    expect(onAdd).toHaveBeenCalledWith({
      name: '',
      rules: [
        { subject: { kind: 'role', role: 'Starter' }, min: 1, max: null },
        { subject: { kind: 'role', role: 'Hand Trap' }, min: 1, max: null },
        { subject: { kind: 'role', role: 'Brick' }, min: 0, max: 0 },
      ],
    })
    fireEvent.click(screen.getByText('hands.add'))
    expect(onAdd).toHaveBeenLastCalledWith()
  })
  it("shows each hand's odds, the union, and flags a role no card has", () => {
    render(
      <HandBuilder
        {...base}
        analysis={{ hands: [hand('a', [rule(STARTER, 1)]), hand('b', [rule({ kind: 'role', role: 'Engine' }, 1)])] }}
        result={evaluation([0.5, 0.25], 0.6)}
        unusedRoles={new Set(['Engine'])}
      />,
    )
    expect(screen.getAllByText('50%').length).toBe(1)
    expect(screen.getByText('25%')).toBeTruthy()
    expect(screen.getByText('60%')).toBeTruthy()
    expect(screen.getAllByText('hands.unusedRole').length).toBe(1)
    expect(screen.queryByText('hands.preset.starter')).toBeNull()
  })
  it('a max typed below min is sent as min, and the row controls call back', () => {
    const onRule = vi.fn()
    const onRemove = vi.fn()
    const onRemoveRule = vi.fn()
    const onAddRule = vi.fn()
    render(<HandBuilder {...base} analysis={{ hands: [hand('a', [rule(STARTER, 2, 3)])] }} onRule={onRule} onRemove={onRemove} onRemoveRule={onRemoveRule} onAddRule={onAddRule} />)
    fireEvent.change(screen.getByLabelText('hands.max'), { target: { value: '1' } })
    expect(onRule).toHaveBeenCalledWith(0, 0, { subject: STARTER, min: 2, max: 2 })
    fireEvent.change(screen.getByLabelText('hands.max'), { target: { value: '' } })
    expect(onRule).toHaveBeenLastCalledWith(0, 0, { subject: STARTER, min: 2, max: null })
    fireEvent.change(screen.getByLabelText('hands.subject'), { target: { value: 'role:Brick' } })
    expect(onRule).toHaveBeenLastCalledWith(0, 0, { subject: { kind: 'role', role: 'Brick' }, min: 2, max: 3 })
    fireEvent.click(screen.getByText('hands.addRule'))
    expect(onAddRule).toHaveBeenCalledWith(0)
    fireEvent.click(screen.getByRole('button', { name: 'hands.removeRule' }))
    expect(onRemoveRule).toHaveBeenCalledWith(0, 0)
    fireEvent.click(screen.getByRole('button', { name: 'hands.remove' }))
    expect(onRemove).toHaveBeenCalledWith(0)
  })
  it('shows the evaluation error in place of the union', () => {
    render(<HandBuilder {...base} analysis={{ hands: [hand('a', [rule(STARTER, 1)])] }} result={{ error: 'tooFewCards' }} />)
    expect(screen.getByText('results.tooFewCards')).toBeTruthy()
  })
})
