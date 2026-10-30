import { describe, expect, it } from 'vitest'
import { oneAtATime } from './one-at-a-time'

const busy = () => 'busy'

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
      oneAtATime(job(() => 'a'), busy),
      oneAtATime(job(() => { throw new Error('b') }), busy),
      oneAtATime(job(() => 'c'), busy),
    ])
    expect(most).toBe(1)
    expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected', 'fulfilled'])
  })

  it('answers busy past three jobs in line, and takes jobs again once they finish', async () => {
    let release = () => {}
    const gate = new Promise<void>((resolve) => { release = resolve })
    const job = (name: string) => async () => {
      await gate
      return name
    }
    const line = ['a', 'b', 'c', 'd'].map((name) => oneAtATime(job(name), busy))
    release()
    expect(await Promise.all(line)).toEqual(['a', 'b', 'c', 'busy'])
    expect(await oneAtATime(job('e'), busy)).toBe('e')
  })

  it('frees its place when a job fails', async () => {
    const fail = async () => { throw new Error('x') }
    await Promise.allSettled([oneAtATime(fail, busy), oneAtATime(fail, busy), oneAtATime(fail, busy)])
    expect(await oneAtATime(async () => 'next', busy)).toBe('next')
  })
})
