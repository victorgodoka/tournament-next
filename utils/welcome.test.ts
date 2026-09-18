import { describe, expect, it } from 'vitest'
import { change, countdown, relative } from './welcome'

const now = Date.parse('2026-09-12T17:26:00Z')
const plus = (minutes: number) => new Date(now + minutes * 60_000).toISOString()

describe('welcome formatting', () => {
  it('compares against the previous window', () => {
    expect(change(106, 100)).toEqual({ up: true, label: '+6.0%' })
    expect(change(986, 1000)).toEqual({ up: false, label: '−1.4%' })
    expect(change(5, 0)).toBeNull()
  })

  it('describes time relative to now', () => {
    expect(relative(plus(0), now)).toBe('just now')
    expect(relative(plus(-4), now)).toBe('4 minutes ago')
    expect(relative(plus(-22 * 60), now)).toBe('22 hours ago')
    expect(relative(plus(-26 * 60), now)).toBe('yesterday')
    expect(relative(plus(160), now)).toBe('in 3 hours')
  })

  it('counts down to a start time', () => {
    expect(countdown(plus(160), now)).toBe('in 2 h 40 m')
    expect(countdown(plus(12), now)).toBe('in 12 m')
    expect(countdown(plus(-5), now)).toBe('in 0 m')
  })
})
