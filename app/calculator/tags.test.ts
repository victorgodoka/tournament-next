import { describe, expect, it } from 'vitest'
import type { DeckCard } from '@utils/combo/deck-cards'
import type { Hand, Roles } from '@utils/combo/types'
import { roleCopies, suggestedRule, tagGroups, tagMeta, untaggedCount } from './tags'

describe('tags', () => {
  it('tagMeta finds a default by any spelling and falls back to custom', () => {
    expect(tagMeta('hand trap')).toMatchObject({ icon: 'hand', slug: 'handTrap', suggest: null })
    expect(tagMeta('Engine')).toEqual({ icon: 'tag', tone: 'var(--color-ink-muted)', suggest: 'need', slug: null })
  })

  it('suggestedRule: need is ≥ 1, avoid is = 0, none is null', () => {
    expect(suggestedRule('starter')).toEqual({ subject: { kind: 'role', role: 'Starter' }, min: 1, max: null })
    expect(suggestedRule('Brick')).toEqual({ subject: { kind: 'role', role: 'Brick' }, min: 0, max: 0 })
    expect(suggestedRule('Hand Trap')).toBeNull()
    expect(suggestedRule('Engine')).toEqual({ subject: { kind: 'role', role: 'Engine' }, min: 1, max: null })
  })

  it('tagGroups splits by the rules of every hand, keeping palette order', () => {
    const hands = [
      { name: '', rules: [{ subject: { kind: 'role', role: 'brick' }, min: 0, max: 0 }] },
      { name: '', rules: [{ subject: { kind: 'card', id: 1 }, min: 1, max: null }, { subject: { kind: 'role', role: 'Starter' }, min: 1, max: null }] },
    ] as Hand[]
    expect(tagGroups(['Starter', 'Extender', 'Brick', 'Engine'], hands)).toEqual({ used: ['Starter', 'Brick'], labels: ['Extender', 'Engine'] })
    expect(tagGroups(['Starter'], [])).toEqual({ used: [], labels: ['Starter'] })
  })

  it('untaggedCount ignores 0-copy rows; roleCopies sums copies', () => {
    const rows: DeckCard[] = [
      { id: 1, copies: 3, card: null, passcode: 1 },
      { id: 2, copies: 0, card: null, passcode: 2 },
      { id: 3, copies: 2, card: null, passcode: 3 },
    ]
    const roles: Roles = new Map([[1, ['Starter']]])
    expect(untaggedCount(rows, roles)).toBe(1)
    expect(roleCopies(rows, roles, 'starter')).toBe(3)
  })
})
