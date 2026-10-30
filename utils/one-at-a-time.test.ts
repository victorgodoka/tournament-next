import { describe, expect, it } from 'vitest'
import { oneAtATime } from './one-at-a-time'

describe('oneAtATime', () => {
  it('never overlaps two jobs, and a failure does not stop the next', async () => {
    let running = 0
    let most = 0
    const job = (result: () => string) => async () => {
      most = Math.max(most, ++running)
      await new Promise((resolve) => setTimeout(resolve, 5))
      running--
      return result()
    }
    const results = await Promise.allSettled([
      oneAtATime(job(() => 'a')),
      oneAtATime(job(() => { throw new Error('b') })),
      oneAtATime(job(() => 'c')),
    ])
    expect(most).toBe(1)
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected', 'fulfilled'])
  })
})
