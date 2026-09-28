import { describe, expect, it } from 'vitest'
import { change } from './welcome'

describe('welcome formatting', () => {
  it('compares against the previous window', () => {
    expect(change(106, 100)).toEqual({ up: true, label: '+6.0%' })
    expect(change(986, 1000)).toEqual({ up: false, label: '−1.4%' })
    expect(change(5, 0)).toBeNull()
  })
})
