'use client'

import { useAuthContext } from '@contexts'
import ButtonComponent from '../button/button.component'
import { DISCORD_OAUTH_URL } from './auth.const'
import { buildDiscordOAuthUrl } from '@lib/discord-oauth'
import { trackLoginStart } from '@lib/gtm'
import AvatarmenuComponent from '../avatarmenu/avatarmenu.component'
import { isAuthenticatedUser } from '@contexts/Auth/auth.const'
import './auth.styles.css'

const AuthComponent = () => {
  const { user, logout, isLoading, isLoggingOut, justLoggedOut } = useAuthContext()

  const startDiscordSignIn = () => {
    const url = buildDiscordOAuthUrl(DISCORD_OAUTH_URL)
    if (url) {
      trackLoginStart()
      window.location.assign(url)
    }
  }

  if (isLoading) {
    return (
      <div className="auth auth--loading" aria-busy="true" aria-label="Loading account">
        <span className="auth__skeleton" />
      </div>
    )
  }

  const showSession = isAuthenticatedUser(user) || isLoggingOut

  return (
    <div className="auth">
      {showSession ? (
        <div
          className={`auth__session${isLoggingOut ? ' auth__session--exit' : ''}`}
          aria-busy={isLoggingOut || undefined}
          aria-label={isLoggingOut ? 'Signing out' : undefined}
        >
          {isAuthenticatedUser(user) ? (
            <AvatarmenuComponent
              user={user}
              logout={() => logout()}
              isLoggingOut={isLoggingOut}
            />
          ) : null}
        </div>
      ) : (
        <div className={`auth__signin${justLoggedOut ? ' auth__signin--enter' : ''}`}>
          {DISCORD_OAUTH_URL ? (
            <ButtonComponent
              variant="secondary"
              size="lg"
              icon="mdi:discord"
              aria-label="Login with Discord"
              onClick={startDiscordSignIn}
            >
              Sign in
            </ButtonComponent>
          ) : (
            <ButtonComponent
              variant="secondary"
              size="lg"
              icon="mdi:discord"
              aria-label="Login with Discord"
              disabled
              title="Discord sign-in is not configured"
            >
              Sign in
            </ButtonComponent>
          )}
        </div>
      )}
    </div>
  )
}

export default AuthComponent
