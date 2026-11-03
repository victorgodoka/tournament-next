import { describe, expect, it } from 'vitest'
import { nameOf, range } from './shared'

describe('nameOf', () => {
  it('falls back to the key for a setcode without a name', () => {
    expect(nameOf({ key: '207', name: null })).toBe('207')
    expect(nameOf({ key: '482', name: 'Snake-Eye' })).toBe('Snake-Eye')
    expect(nameOf({ key: '207*', name: null })).toBe('207')
  })
})

describe('range', () => {
  it('shows an interval as a range, not a ±', () => {
    expect(range(0.54, 0.56)).toBe('54–56')
    expect(range(0.5121, 0.5225)).toBe('51.2–52.3')
  })
})
