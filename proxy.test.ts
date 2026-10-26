import { expect, test } from 'vitest'
import { allow } from './proxy'

test('allows 20 requests per minute per ip, then resets', () => {
  const t = 1_000_000
  for (let i = 0; i < 20; i++) expect(allow('1.1.1.1', t)).toBe(true)
  expect(allow('1.1.1.1', t + 1)).toBe(false)
  expect(allow('2.2.2.2', t + 1)).toBe(true)
  expect(allow('1.1.1.1', t + 60_000)).toBe(true)
})
