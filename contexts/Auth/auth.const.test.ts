import { describe, expect, it } from 'vitest'
import {
  createGuestUser,
  isAuthenticatedUser,
  isValidStoredUser,
} from './auth.const'
import { authenticatedUser } from '../../test/fixtures/user.fixture'

describe('auth.const', () => {
  describe('createGuestUser', () => {
    it('creates a guest user with id 0', () => {
      expect(createGuestUser()).toEqual({
        id: '0',
        username: '',
        displayname: '',
        avatar: '',
      })
    })
  })

  describe('isAuthenticatedUser', () => {
    it('returns false for guest users', () => {
      expect(isAuthenticatedUser(createGuestUser())).toBe(false)
    })

    it('returns true for authenticated users', () => {
      expect(isAuthenticatedUser(authenticatedUser)).toBe(true)
    })
  })

  describe('isValidStoredUser', () => {
    it('accepts valid stored users', () => {
      expect(isValidStoredUser(authenticatedUser)).toBe(true)
    })

    it('rejects guest users', () => {
      expect(isValidStoredUser(createGuestUser())).toBe(false)
    })

    it('rejects malformed values', () => {
      expect(isValidStoredUser(null)).toBe(false)
      expect(isValidStoredUser({ id: 123 })).toBe(false)
    })
  })
})
