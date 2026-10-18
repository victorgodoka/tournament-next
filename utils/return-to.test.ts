import { afterEach, describe, expect, it, vi } from 'vitest'
import { setReturnTo, takeReturnTo } from './return-to'

const mapStorage = () => {
  const m = new Map<string, string>()
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  }
}
const denied = () => {
  throw new Error('denied')
}
const throwing = { getItem: denied, setItem: denied, removeItem: denied }

afterEach(() => vi.unstubAllGlobals())

describe('return-to', () => {
  it('rejects protocol-relative and non-rooted paths', () => {
    vi.stubGlobal('sessionStorage', mapStorage())
    setReturnTo('//evil.test')
    expect(takeReturnTo()).toBeNull()
    setReturnTo('https://evil.test')
    expect(takeReturnTo()).toBeNull()
    setReturnTo('/\\evil.test')
    expect(takeReturnTo()).toBeNull()
  })

  it('rejects control characters and whitespace that URL parsers strip', () => {
    const s = mapStorage()
    vi.stubGlobal('sessionStorage', s)
    for (const p of ['/\t/evil.test', '/\n/evil.test', '/ /evil.test', '/\r/evil.test']) {
      setReturnTo(p)
      expect(takeReturnTo()).toBeNull()
      // also rejected when taking, even if something else wrote it
      s.setItem('return-to', p)
      expect(takeReturnTo()).toBeNull()
    }
  })

  it('keeps query strings intact', () => {
    vi.stubGlobal('sessionStorage', mapStorage())
    setReturnTo('/deck-builder?d=ydke%3A%2F%2Fabc')
    expect(takeReturnTo()).toBe('/deck-builder?d=ydke%3A%2F%2Fabc')
  })

  it('returns the path once', () => {
    vi.stubGlobal('sessionStorage', mapStorage())
    setReturnTo('/deck-builder')
    expect(takeReturnTo()).toBe('/deck-builder')
    expect(takeReturnTo()).toBeNull()
  })

  it('survives throwing storage', () => {
    vi.stubGlobal('sessionStorage', throwing)
    expect(() => setReturnTo('/x')).not.toThrow()
    expect(takeReturnTo()).toBeNull()
  })

  it('survives missing sessionStorage', () => {
    vi.stubGlobal('sessionStorage', undefined)
    expect(() => setReturnTo('/x')).not.toThrow()
    expect(takeReturnTo()).toBeNull()
  })
})
