import { describe, expect, it, vi } from 'vitest'
import { screen, userEvent, renderWithAuth } from '../../test/test-utils'
import ErrorBanner from './errorbanner.component'

describe('ErrorBanner', () => {
  it('renders nothing when there is no auth error', () => {
    renderWithAuth(<ErrorBanner />, { error: null })

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('shows the error message in an alert', () => {
    renderWithAuth(<ErrorBanner />, {
      error: 'Session expired. Please sign in again.',
    })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Session expired. Please sign in again.',
    )
  })

  it('dismisses the banner by clearing the auth error', async () => {
    const user = userEvent.setup()
    const clearError = vi.fn()

    renderWithAuth(<ErrorBanner />, {
      error: 'Something went wrong.',
      clearError,
    })

    await user.click(
      screen.getByRole('button', { name: /dismiss error message/i }),
    )

    // The banner is fully context-driven: clearing the error (first test
    // covers error: null) is what removes it — no duplicate local state.
    expect(clearError).toHaveBeenCalledTimes(1)
  })
})
