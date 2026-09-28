import { describe, expect, it } from 'vitest'
import { bitsLabel, bitsOf } from './params'

describe('extra rules bits', () => {
  it('reads a uint64 above 2^53 without losing bits', () => {
    expect(bitsOf('70368744177664')).toEqual([46])
    expect(bitsOf('0x8000000000000001')).toEqual([0, 63])
  })

  it('collapses runs of three or more', () => {
    expect(bitsLabel(bitsOf(String(2 ** 34 + 2 ** 36)))).toBe('Bits 34, 36')
    expect(bitsLabel([19, 20, 21, 23, 24, 25, 26, 37])).toBe('Bits 19–21, 23–26, 37')
    expect(bitsLabel([])).toBe('None')
    expect(bitsLabel(bitsOf('nope'))).toBe('Invalid')
  })
})
