import { describe, expect, it } from 'vitest'
import type { CardData } from '@utils/deck/types'
import { addRole, normalizeRole, palette, removeRole, rolesFromTags, sameRole, tagsFromRoles, toggleRole } from './roles'

const magician = { id: 46986414, idOriginal: 46986414, idTcg: null, alias: null, ruleId: null, alternateArts: [46986431], name: 'Dark Magician' } as unknown as CardData
const cards = new Map<number, CardData>([
  [46986414, magician],
  [46986431, magician],
])

describe('roles', () => {
  it('reads tags under any print into one canonical card and dedupes spellings', () => {
    const roles = rolesFromTags({ '46986431': ['Starter'], '46986414': [' starter ', 'Engine'], '7': ['Brick'] }, cards)
    expect(roles.get(46986414)).toEqual(['Starter', 'Engine'])
    expect(roles.get(7)).toEqual(['Brick'])
    expect(rolesFromTags({ '7': ['', 'x'.repeat(25), 'ok'] }, cards).get(7)).toEqual(['ok'])
    expect(rolesFromTags({ '7': ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'] }, cards).get(7)).toHaveLength(8)
  })
  it('writes tags keyed by a print the deck holds', () => {
    const roles = new Map([[46986414, ['Starter']], [8, ['Brick']]])
    expect(tagsFromRoles(roles, { main: [1, 46986431], extra: [], side: [8] }, cards)).toEqual({ '46986431': ['Starter'], '8': ['Brick'] })
    expect(tagsFromRoles(new Map([[9, ['X']]]), { main: [1], extra: [], side: [] }, cards)).toEqual({})
    expect(tagsFromRoles(new Map([[1, []]]), { main: [1], extra: [], side: [] }, cards)).toEqual({})
  })
  it('toggles roles case-insensitively and stops at 8', () => {
    const one = toggleRole(new Map(), 1, 'Starter')
    expect(one.get(1)).toEqual(['Starter'])
    expect(toggleRole(one, 1, 'STARTER').has(1)).toBe(false)
    const eight = new Map([[1, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']]])
    expect(toggleRole(eight, 1, 'i')).toBe(eight)
    expect(toggleRole(one, 1, '   ')).toBe(one)
    expect(normalizeRole('x'.repeat(25))).toBeNull()
    expect(normalizeRole('  Hand   Trap ')).toBe('Hand Trap')
    expect(sameRole('hand trap', 'Hand Trap')).toBe(true)
  })
  it('addRole adds when absent and leaves a present role alone', () => {
    const one = addRole(new Map(), 1, 'Starter')
    expect(one.get(1)).toEqual(['Starter'])
    expect(addRole(one, 1, 'starter')).toBe(one)
    expect(addRole(one, 1, 'Engine').get(1)).toEqual(['Starter', 'Engine'])
  })
  it('palette: defaults first, then the roles in use', () => {
    expect(palette(new Map([[1, ['Engine', 'starter']], [2, ['board breaker']]]))).toEqual(['Starter', 'Extender', 'Hand Trap', 'Board Breaker', 'Brick', 'Non-Engine', 'Searcher', 'Needs Normal Summon', 'Engine'])
  })
  it('removeRole drops any spelling and keeps the same map when absent', () => {
    const roles = new Map([[1, ['Starter', 'Brick']]])
    expect(removeRole(roles, 1, 'brick')).toEqual(new Map([[1, ['Starter']]]))
    expect(removeRole(new Map([[1, ['Brick']]]), 1, 'Brick')).toEqual(new Map())
    expect(removeRole(roles, 1, 'Extender')).toBe(roles)
    expect(removeRole(roles, 2, 'Starter')).toBe(roles)
  })
})
