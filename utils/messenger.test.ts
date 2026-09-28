import { describe, expect, it } from 'vitest'
import { contactName, mergeMessages, sortRoster } from './messenger'
import type { RosterEntry } from './types'

const entry = (id: string, presence: RosterEntry['presence'], displayName: string, nickname: string | null = null): RosterEntry => ({
  id, presence, displayName, nickname, username: id, avatar: null, cosmetics: {}, kind: 'friend', note: null, status: null, song: null,
})

const message = (id: string) => ({ id, mine: false, body: id, createdAt: '2026-09-15T19:02:11.000Z' })

describe('messenger helpers', () => {
  it('prefers nickname, then display name, then username', () => {
    expect(contactName({ nickname: 'Seto', displayName: 'Seto Kaiba', username: 'kaiba' })).toBe('Seto')
    expect(contactName({ nickname: null, displayName: null, username: 'kaiba' })).toBe('kaiba')
  })

  it('sorts by presence, then by shown name', () => {
    const sorted = sortRoster([
      entry('a', 'offline', 'Aaron'),
      entry('b', 'away', 'Bea'),
      entry('c', 'ready', 'Zed'),
      entry('d', 'ready', 'Zoe', 'Alpha'),
      entry('e', 'busy', 'Eve'),
    ])
    expect(sorted.map((e) => e.id)).toEqual(['d', 'c', 'e', 'b', 'a'])
  })

  it('merges pages oldest first by bigint id, without duplicates', () => {
    const merged = mergeMessages([message('9'), message('10')], [message('12'), message('10'), message('8')])
    expect(merged.map((m) => m.id)).toEqual(['8', '9', '10', '12'])
  })
})
