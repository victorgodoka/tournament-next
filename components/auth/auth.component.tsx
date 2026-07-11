import { useAuthContext } from '@contexts'
import ButtonComponent from '../button/button.component'
import { DISCORD_OAUTH_URL } from './auth.const'
import AvatarmenuComponent from '../avatarmenu/avatarmenu.component'
import { isAuthenticatedUser } from '@contexts/Auth/auth.const'
import './auth.styles.css'

const AuthComponent = () => {
  const { user, logout, isLoading, isLoggingOut, justLoggedOut } = useAuthContext()

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
          <ButtonComponent
            variant="secondary"
            size="lg"
            icon="mdi:discord"
            aria-label="Login with Discord"
            href={DISCORD_OAUTH_URL}
          >
            Sign in
          </ButtonComponent>
        </div>
      )}
    </div>
  )
}

export default AuthComponent
