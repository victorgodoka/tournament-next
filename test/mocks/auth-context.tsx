import type { ReactElement, ReactNode } from 'react'
import { render, type RenderOptions } from '@testing-library/react'
import { vi } from 'vitest'
import { AuthContext } from '../../contexts/Auth/auth.context'
import { createGuestUser } from '../../contexts/Auth/auth.const'
import type { User } from '../../contexts/Auth/auth.types'
import { authenticatedUser } from '../fixtures/user.fixture'

export type AuthContextValue = NonNullable<
  React.ComponentProps<typeof AuthContext.Provider>['value']
>

export const defaultAuthContextValue: AuthContextValue = {
  user: createGuestUser(),
  isLoading: false,
  isLoggingOut: false,
  justLoggedOut: false,
  error: null,
  clearError: vi.fn(),
  logout: vi.fn(),
  dispatch: vi.fn(),
}

export function createAuthContextValue(
  overrides: Partial<AuthContextValue> = {},
): AuthContextValue {
  return {
    ...defaultAuthContextValue,
    clearError: vi.fn(),
    logout: vi.fn(),
    dispatch: vi.fn(),
    ...overrides,
  }
}

export function AuthContextProvider({
  children,
  value = defaultAuthContextValue,
}: {
  children: ReactNode
  value?: AuthContextValue
}) {
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function renderWithAuth(
  ui: ReactElement,
  authOverrides?: Partial<AuthContextValue>,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  const value = createAuthContextValue(authOverrides)

  return {
    ...render(<AuthContextProvider value={value}>{ui}</AuthContextProvider>, options),
    auth: value,
  }
}

export { authenticatedUser, createGuestUser }
export type { User }
