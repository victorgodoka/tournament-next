import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearDraft, draftKey, readDraft, setReturnTo, takeReturnTo, writeDraft, type Draft } from './drafts'

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

const draft: Draft = { deck: { main: [1, 2], extra: [3], side: [] }, name: 'D', format: null, revision: 2, at: 1000 }

afterEach(() => vi.unstubAllGlobals())

describe('drafts', () => {
  it('draftKey', () => {
    expect(draftKey('abc')).toBe('deck-draft:abc')
    expect(draftKey(null)).toBe('deck-draft:new')
  })

  it('round-trips and clears', () => {
    vi.stubGlobal('localStorage', mapStorage())
    writeDraft('k', draft)
    expect(readDraft('k')).toEqual(draft)
    clearDraft('k')
    expect(readDraft('k')).toBeNull()
  })

  it('reads malformed or wrong-shaped values as null', () => {
    const s = mapStorage()
    vi.stubGlobal('localStorage', s)
    s.setItem('k', '{nope')
    expect(readDraft('k')).toBeNull()
    s.setItem('k', JSON.stringify({ ...draft, deck: { main: ['x'], extra: [], side: [] } }))
    expect(readDraft('k')).toBeNull()
    s.setItem('k', JSON.stringify({ ...draft, name: 5 }))
    expect(readDraft('k')).toBeNull()
    s.setItem('k', JSON.stringify({ ...draft, at: undefined }))
    expect(readDraft('k')).toBeNull()
    s.setItem('k', 'null')
    expect(readDraft('k')).toBeNull()
  })

  it('survives throwing storage', () => {
    vi.stubGlobal('localStorage', throwing)
    expect(readDraft('k')).toBeNull()
    expect(() => writeDraft('k', draft)).not.toThrow()
    expect(() => clearDraft('k')).not.toThrow()
  })

  it('survives a storage property access that throws', () => {
    vi.stubGlobal('localStorage', undefined)
    expect(readDraft('k')).toBeNull()
    expect(() => writeDraft('k', draft)).not.toThrow()
    expect(() => clearDraft('k')).not.toThrow()
  })
})

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
    setReturnTo('/deck-editor?d=ydke%3A%2F%2Fabc')
    expect(takeReturnTo()).toBe('/deck-editor?d=ydke%3A%2F%2Fabc')
  })

  it('returns the path once', () => {
    vi.stubGlobal('sessionStorage', mapStorage())
    setReturnTo('/deck-editor')
    expect(takeReturnTo()).toBe('/deck-editor')
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
