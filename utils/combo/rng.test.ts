import { describe, expect, it } from 'vitest'
import { MAX_SEED, nextSeed, randomSeed, rng, type Rng } from './rng'

describe('rng', () => {
  it('is reproducible from a seed, differs between seeds, stays in [0, 1)', () => {
    const take = (r: Rng) => Array.from({ length: 5 }, () => r.next())
    const first = take(rng(42))
    expect(take(rng(42))).toEqual(first)
    expect(take(rng(43))).not.toEqual(first)
    expect(first.every((x) => x >= 0 && x < 1)).toBe(true)
    expect(new Set(take(rng(0))).size).toBe(5) // seed 0 is a live state
  })
  it('int(n) is in range and uniform enough', () => {
    const r = rng(7)
    const buckets = Array<number>(10).fill(0)
    for (let i = 0; i < 10_000; i++) buckets[r.int(10)]!++
    expect(buckets.reduce((a, b) => a + b)).toBe(10_000) // every value landed in 0..9
    // 1000 expected per bucket, standard deviation 30: 850..1150 is five of them.
    expect(Math.min(...buckets)).toBeGreaterThan(850)
    expect(Math.max(...buckets)).toBeLessThan(1150)
  })
  it('seeds are 32-bit unsigned integers and nextSeed moves', () => {
    const s = randomSeed()
    expect(Number.isInteger(s) && s >= 0 && s <= MAX_SEED).toBe(true)
    expect(nextSeed(1)).not.toBe(1)
    expect(nextSeed(MAX_SEED)).toBeLessThanOrEqual(MAX_SEED)
    expect(nextSeed(nextSeed(5))).not.toBe(nextSeed(5))
  })
})
