import { describe, expect, it } from 'vitest'
import { adAfter } from './ad-breaks'

describe('adAfter', () => {
  it('puts a banner after every 12th card', () => {
    expect(adAfter(11, 24)).toBe(1)
    expect(adAfter(23, 25)).toBe(2)
    expect([...Array(48).keys()].map((i) => adAfter(i, 48)).filter(Boolean)).toEqual([1, 2, 3])
  })

  it('never after the last card, where the bottom banner follows', () => {
    expect(adAfter(23, 24)).toBeNull()
    expect(adAfter(11, 12)).toBeNull()
  })

  it('leaves the other cards alone', () => {
    expect(adAfter(0, 24)).toBeNull()
    expect(adAfter(12, 24)).toBeNull()
  })
})
