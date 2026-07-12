import { describe, expect, it } from 'vitest'
import {
  apiFailure,
  apiSuccess,
  isRecord,
  unwrapApiData,
} from './api-result'

describe('api-result', () => {
  describe('isRecord', () => {
    it('returns true for plain objects', () => {
      expect(isRecord({ ok: true })).toBe(true)
    })

    it('returns false for null and primitives', () => {
      expect(isRecord(null)).toBe(false)
      expect(isRecord('value')).toBe(false)
    })
  })

  describe('apiSuccess and apiFailure', () => {
    it('creates success results', () => {
      expect(apiSuccess({ id: 1 })).toEqual({ ok: true, data: { id: 1 } })
    })

    it('creates failure results', () => {
      expect(apiFailure('Failed')).toEqual({ ok: false, message: 'Failed' })
    })
  })

  describe('unwrapApiData', () => {
    it('unwraps nested data payloads', () => {
      expect(unwrapApiData<{ id: number }>({ data: { id: 1 } })).toEqual({
        id: 1,
      })
    })

    it('returns the body when no data field exists', () => {
      expect(unwrapApiData<{ id: number }>({ id: 1 })).toEqual({ id: 1 })
    })

    it('returns null for non-record values', () => {
      expect(unwrapApiData('invalid')).toBeNull()
    })
  })
})
