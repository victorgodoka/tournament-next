import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearDraft, draftKey, readDraft, sameDraft, writeDraft, type Draft } from './drafts'

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

  it('sameDraft compares deck, name and format, not revision or time', () => {
    const later: Draft = { ...draft, revision: 9, at: 5 }
    expect(sameDraft(draft, later)).toBe(true)
    expect(sameDraft(draft, { ...draft, name: 'E' })).toBe(false)
    expect(sameDraft(draft, { ...draft, format: 1 })).toBe(false)
    expect(sameDraft(draft, { ...draft, deck: { ...draft.deck, side: [4] } })).toBe(false)
  })
})
