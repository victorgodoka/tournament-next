import { createGuestUser } from './auth.const'
import type { User, UserActions } from './auth.types'

export const authReducer = (state: User, action: UserActions): User => {
  switch (action.type) {
    case 'SET_USER':
      return action.payload
    case 'LOGOUT':
      return createGuestUser()
    default:
      return state
  }
}
