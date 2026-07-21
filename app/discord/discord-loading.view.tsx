import BackdropComponent from '@components/backdrop/backdrop.component'
import IconComponent from '../../components/icon/icon.component'
import type { DiscordLoadingState } from '../../hooks/use-discord-login'
import { cn } from '@sglara/cn'

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
  const discordStateClass = isError
    ? "discord-login__icon-wrap--error"
    : isRedirecting
      ? "discord-login__icon-wrap--success"
      : "discord-login__icon-wrap--pulse";

  return (
    <div className="discord-login" aria-live="polite">
      <BackdropComponent />

      <div className="discord-login__content omega-container omega-container--narrow">
        <div
          className={cn("discord-login__icon-wrap", discordStateClass)}
        >
          <IconComponent
            className="discord-login__icon"
            icon={getLoadingIcon(loadingState)}
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
                className={cn("discord-login__progress-dot", {
                  "discord-login__progress-dot--active":
                    loadingState === "authenticating",
                })}
              />

              <span
                className={cn("discord-login__progress-dot", {
                  "discord-login__progress-dot--active":
                    loadingState === "fetching-profile",
                })}
              />
            </div>
          </div>
        )}

        <aside className="discord-login__notice omega-surface omega-surface--secondary">
          <div className="discord-login__notice-header">
            <IconComponent
              className="discord-login__notice-icon"
              icon="mdi:shield-check"
            />
            <span className="discord-login__notice-title">Secure Authentication</span>
          </div>
          <p className="discord-login__notice-copy">
            Your Discord credentials are handled securely. We only access your basic
            profile information.
          </p>
        </aside>
      </div>
    </div>
  )
}

export default DiscordLoadingView
