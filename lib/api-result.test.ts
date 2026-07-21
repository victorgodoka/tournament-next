import { describe, expect, it } from 'vitest'
import { apiFailure, apiSuccess, isRecord } from './api-result'

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
})
