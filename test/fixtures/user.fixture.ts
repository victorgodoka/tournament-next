import type { User } from '@contexts/Auth/auth.types'

export const guestUser: User = {
  id: '0',
  username: '',
  displayname: '',
  avatar: '',
}

export const authenticatedUser: User = {
  id: '123456789',
  username: 'duelist',
  displayname: 'Test Duelist',
  avatar: 'abc123',
}
