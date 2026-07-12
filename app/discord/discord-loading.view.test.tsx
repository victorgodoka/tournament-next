import { describe, expect, it } from 'vitest'
import { render, screen } from '../../test/test-utils'
import DiscordLoadingView from './discord-loading.view'

describe('DiscordLoadingView', () => {
  it.each([
    ['authenticating', 'Authenticating with Discord...'],
    ['fetching-profile', 'Fetching your profile...'],
    ['generating-token', 'Setting up your session...'],
    ['redirecting', 'Welcome back! Redirecting...'],
    ['error', 'Authentication Error'],
  ] as const)(
    'shows the message for %s state',
    (loadingState, expectedMessage) => {
      render(
        <DiscordLoadingView
          loadingState={loadingState}
          errorMessage="Invalid code"
        />,
      )

      expect(
        screen.getByRole('heading', { name: expectedMessage }),
      ).toBeInTheDocument()
    },
  )

  it('shows the error message when authentication fails', () => {
    render(
      <DiscordLoadingView
        loadingState="error"
        errorMessage="Discord authorization was denied."
      />,
    )

    expect(
      screen.getByText('Discord authorization was denied.'),
    ).toBeInTheDocument()
    expect(
      screen.getByText(/redirecting to home page in a few seconds/i),
    ).toBeInTheDocument()
  })

  it('shows success copy when redirecting', () => {
    render(
      <DiscordLoadingView loadingState="redirecting" errorMessage="" />,
    )

    expect(
      screen.getByText(/authentication successful/i),
    ).toBeInTheDocument()
  })
})
