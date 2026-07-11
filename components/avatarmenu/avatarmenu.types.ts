import type { User } from '@contexts/Auth/auth.types'

export type AvatarmenuComponentProps = {
  user?: User
  logout: () => void
  isLoggingOut?: boolean
}
