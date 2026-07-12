import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  authenticatedUser,
  mockRouter,
  renderWithAuth,
  resetNextNavigationMocks,
  screen,
} from '../../test/test-utils'
import ProfileIndexClient from './profile-index.client'

vi.mock('next/navigation', () => ({
  useRouter: () => mockRouter,
}))

describe('ProfileIndexClient', () => {
  beforeEach(() => {
    resetNextNavigationMocks()
  })

  it('shows the guest empty state', () => {
    renderWithAuth(<ProfileIndexClient />)

    expect(
      screen.getByRole('heading', {
        name: /the profile you're looking for doesn't exist/i,
      }),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute(
      'href',
      '/',
    )
    expect(screen.getByRole('link', { name: /leaderboards/i })).toHaveAttribute(
      'href',
      '/leaderboards',
    )
  })

  it('redirects authenticated users to their profile', () => {
    renderWithAuth(<ProfileIndexClient />, { user: authenticatedUser })

    expect(mockRouter.replace).toHaveBeenCalledWith(
      `/profile/${authenticatedUser.id}`,
    )
    expect(screen.getByLabelText(/loading profile/i)).toBeInTheDocument()
  })
})
