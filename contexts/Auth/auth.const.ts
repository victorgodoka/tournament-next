import type { User } from './auth.types'

export const AUTH_EXPIRED_EVENT = 'omega:auth-expired'

export const GUEST_USER_ID = '0' as const

export const createGuestUser = (): User => ({
  id: GUEST_USER_ID,
  username: '',
  displayname: '',
  avatar: '',
})

export const isAuthenticatedUser = (user: Pick<User, 'id'>): boolean =>
  user.id !== GUEST_USER_ID

export function isValidStoredUser(value: unknown): value is User {
  if (typeof value !== 'object' || value === null) return false

  const record = value as Record<string, unknown>

  return (
    typeof record.id === 'string' &&
    record.id !== GUEST_USER_ID &&
    typeof record.username === 'string' &&
    typeof record.displayname === 'string' &&
    typeof record.avatar === 'string'
  )
}

export const LOGOUT_ANIMATION_MS = 320
