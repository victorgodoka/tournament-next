import { describe, expect, it } from 'vitest'
import { subFace } from './format'
import { nameOf, range } from './shared'

describe('subFace', () => {
  it('takes a mixed deck’s second archetype’s card from its own deck, else its lead row, and none for a single one', () => {
    const faces = { '1': 10, '2': 20, '3*': 30, '1>2': 12 }
    expect(subFace('1>2', faces)).toBe(20)
    expect(subFace('1>3', faces)).toBe(30)
    expect(subFace('1>4', faces)).toBeNull()
    expect(subFace('1', faces)).toBeNull()
  })
})

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
