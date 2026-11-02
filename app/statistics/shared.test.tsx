import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { Interval } from './Interval'
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

describe('Interval', () => {
  const html = (expected?: number) => renderToStaticMarkup(<Interval lo={0.54} hi={0.56} value={0.55} expected={expected} />)

  it('names the interval and the value', () => {
    expect(html()).toContain('role="img"')
    expect(html()).toContain('aria-label="54–56, value 55"')
  })

  it('colors the band only when the interval excludes the expected rate', () => {
    expect(html(0.5)).toContain('bg-win')
    expect(html(0.6)).toContain('bg-loss')
    expect(html(0.55)).not.toMatch(/bg-win|bg-loss/)
    expect(html()).not.toMatch(/bg-win|bg-loss/)
  })
})
