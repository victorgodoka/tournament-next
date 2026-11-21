import { describe, expect, it } from 'vitest'
import type { AuditEntry } from '@utils/panel'
import { groupRepeats } from './group'

const entry = (id: string, at: string, over: Partial<AuditEntry> = {}): AuditEntry =>
  ({ id, at, action: 'panel.staples.set', outcome: 'success', status: 200, target: id, actor: { id: '1', username: 'a', role: 'ADMIN' }, ...over }) as AuditEntry

describe('groupRepeats', () => {
  const entries = [
    entry('3', '2026-11-14T12:00:40.000Z'),
    entry('2', '2026-11-14T12:00:20.000Z'),
    entry('1', '2026-11-14T12:00:05.000Z'),
    entry('0', '2026-11-14T11:59:59.000Z'),
    entry('x', '2026-11-14T11:59:58.000Z', { outcome: 'rejected' }),
  ]

  it('collapses consecutive repeats of one actor, action and outcome within the same minute', () => {
    const rows = groupRepeats(entries, new Set())
    expect(rows.map((r) => [r.id, r.n])).toEqual([['3', 3], ['0', 1], ['x', 1]])
    expect(rows[0]!.targets).toEqual(['3', '2', '1'])
  })

  it('opens a group to its single entries', () => {
    const rows = groupRepeats(entries, new Set(['3']))
    expect(rows.map((r) => [r.entry.id, r.child])).toEqual([['3', false], ['3', true], ['2', true], ['1', true], ['0', false], ['x', false]])
  })
})
