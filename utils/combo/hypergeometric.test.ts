import { describe, expect, it } from 'vitest'
import { atLeast, choose, distribution, odds } from './hypergeometric'

describe('hypergeometric', () => {
  it('counts combinations exactly', () => {
    expect(choose(40, 5)).toBe(658008n)
    expect(choose(37, 5)).toBe(435897n)
    expect(choose(5, 6)).toBe(0n)
    expect(choose(5, -1)).toBe(0n)
    expect(choose(0, 0)).toBe(1n)
    expect(choose(60, 30)).toBe(118264581564861424n)
  })
  it('gives the exact distribution of 3 copies in 40 over 5 cards', () => {
    const d = distribution(40, 3, 5)
    expect(d.map((o) => o.favorable)).toEqual([435897n, 198135n, 23310n, 666n])
    expect(d[0]!.total).toBe(658008n)
    expect(atLeast(d, 1).favorable).toBe(222111n)
    expect(atLeast(d, 1).p).toBeCloseTo(0.33755, 4)
    expect(atLeast(d, 4)).toEqual(odds(0n, 658008n))
  })
  it('odds: p is 0 on an empty total and keeps 15 digits on huge counts', () => {
    expect(odds(0n, 0n).p).toBe(0)
    expect(odds(1n, 2n).p).toBe(0.5)
    expect(odds(choose(60, 30) / 2n, choose(60, 30)).p).toBeCloseTo(0.5, 12)
  })
})
