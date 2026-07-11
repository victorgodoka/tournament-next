import { Icon } from '@iconify/react'
import type { DiscordLoadingState } from './use-discord-login'

type DiscordLoadingViewProps = {
  loadingState: DiscordLoadingState
  errorMessage: string
}

function getLoadingMessage(loadingState: DiscordLoadingState) {
  switch (loadingState) {
    case 'authenticating':
      return 'Authenticating with Discord...'
    case 'fetching-profile':
      return 'Fetching your profile...'
    case 'generating-token':
      return 'Setting up your session...'
    case 'redirecting':
      return 'Welcome back! Redirecting...'
    case 'error':
      return 'Authentication Error'
    default:
      return 'Connecting to Discord...'
  }
}

function getLoadingIcon(loadingState: DiscordLoadingState) {
  if (loadingState === 'error') return 'mdi:alert-circle'
  if (loadingState === 'redirecting') return 'mdi:check-circle'
  return 'mdi:discord'
}

const DiscordLoadingView = ({
  loadingState,
  errorMessage,
}: DiscordLoadingViewProps) => {
  const isError = loadingState === 'error'
  const isRedirecting = loadingState === 'redirecting'

  return (
    <main className="discord-login" aria-live="polite">
      <div className="discord-login__backdrop" aria-hidden="true">
        <span className="discord-login__grid" />
        <span className="discord-login__orb discord-login__orb--secondary" />
        <span className="discord-login__orb discord-login__orb--accent" />
      </div>

      <div className="discord-login__content omega-container omega-container--narrow">
        <div
          className={`discord-login__icon-wrap${
            isError
              ? ' discord-login__icon-wrap--error'
              : isRedirecting
                ? ' discord-login__icon-wrap--success'
                : ' discord-login__icon-wrap--pulse'
          }`}
        >
          <Icon
            className="discord-login__icon"
            icon={getLoadingIcon(loadingState)}
            aria-hidden
          />
        </div>

        <h1 className="discord-login__title">{getLoadingMessage(loadingState)}</h1>

        {isError ? (
          <div className="discord-login__message-stack">
            <p className="discord-login__message discord-login__message--error">
              {errorMessage}
            </p>
            <p className="discord-login__message">
              Redirecting to home page in a few seconds...
            </p>
          </div>
        ) : isRedirecting ? (
          <p className="discord-login__message discord-login__message--success">
            Authentication successful! Taking you to your destination...
          </p>
        ) : (
          <div className="discord-login__message-stack">
            <p className="discord-login__message">
              Please wait while we securely authenticate your Discord account.
            </p>

            <div className="discord-login__progress" aria-hidden="true">
              <span
                className={`discord-login__progress-dot${
                  loadingState === 'authenticating'
                    ? ' discord-login__progress-dot--active'
                    : ''
                }`}
              />
              <span
                className={`discord-login__progress-dot${
                  loadingState === 'fetching-profile'
                    ? ' discord-login__progress-dot--active'
                    : ''
                }`}
              />
              <span
                className={`discord-login__progress-dot${
                  loadingState === 'generating-token'
                    ? ' discord-login__progress-dot--active'
                    : ''
                }`}
              />
            </div>
          </div>
        )}

        <aside className="discord-login__notice omega-surface omega-surface--secondary">
          <div className="discord-login__notice-header">
            <Icon
              className="discord-login__notice-icon"
              icon="mdi:shield-check"
              aria-hidden
            />
            <span className="discord-login__notice-title">Secure Authentication</span>
          </div>
          <p className="discord-login__notice-copy">
            Your Discord credentials are handled securely. We only access your basic
            profile information.
          </p>
        </aside>
      </div>
    </main>
  )
}

export default DiscordLoadingView
