import { describe, expect, it } from 'vitest'
import { authReducer } from './auth.reducer'
import { createGuestUser } from './auth.const'
import { authenticatedUser } from '../../test/fixtures/user.fixture'

describe('auth.reducer', () => {
  it('sets the user on SET_USER', () => {
    const state = createGuestUser()

    expect(authReducer(state, { type: 'SET_USER', payload: authenticatedUser })).toBe(
      authenticatedUser,
    )
  })

  it('resets to guest on LOGOUT', () => {
    const state = authenticatedUser

    expect(authReducer(state, { type: 'LOGOUT' })).toEqual(createGuestUser())
  })

  it('returns the current state for unknown actions', () => {
    const state = authenticatedUser

    expect(
      authReducer(state, { type: 'UNKNOWN' } as never),
    ).toBe(state)
  })
})
