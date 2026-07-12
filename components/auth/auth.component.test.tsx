import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as discordOAuth from '@lib/discord-oauth'
import {
  authenticatedUser,
  renderWithAuth,
  screen,
  userEvent,
} from '../../test/test-utils'
import AuthComponent from './auth.component'

vi.mock('./auth.const', () => ({
  DISCORD_OAUTH_URL: 'https://discord.com/oauth2/authorize?client_id=test',
}))

vi.mock('@lib/discord-oauth', async () => {
  const actual = await vi.importActual<typeof discordOAuth>('@lib/discord-oauth')
  return {
    ...actual,
    buildDiscordOAuthUrl: vi.fn(),
  }
})

describe('AuthComponent', () => {
  beforeEach(() => {
    vi.mocked(discordOAuth.buildDiscordOAuthUrl).mockReturnValue(
      'https://discord.com/oauth2/authorize?state=test',
    )
  })

  it('shows a loading skeleton while auth is loading', () => {
    renderWithAuth(<AuthComponent />, { isLoading: true })

    expect(screen.getByLabelText(/loading account/i)).toHaveAttribute(
      'aria-busy',
      'true',
    )
  })

  it('shows the Discord sign-in button for guests', () => {
    renderWithAuth(<AuthComponent />)

    expect(
      screen.getByRole('button', { name: /login with discord/i }),
    ).toBeInTheDocument()
    expect(screen.getByText('Sign in')).toBeInTheDocument()
  })

  it('starts Discord sign-in when the button is clicked', async () => {
    const user = userEvent.setup()
    const assign = vi.fn()
    vi.stubGlobal('location', { ...window.location, assign })

    renderWithAuth(<AuthComponent />)

    await user.click(
      screen.getByRole('button', { name: /login with discord/i }),
    )

    expect(discordOAuth.buildDiscordOAuthUrl).toHaveBeenCalled()
    expect(assign).toHaveBeenCalledWith(
      'https://discord.com/oauth2/authorize?state=test',
    )

    vi.unstubAllGlobals()
  })

  it('shows the avatar menu for authenticated users', () => {
    renderWithAuth(<AuthComponent />, { user: authenticatedUser })

    expect(
      screen.getByRole('button', {
        name: /test duelist account menu/i,
      }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /login with discord/i }),
    ).not.toBeInTheDocument()
  })
})
