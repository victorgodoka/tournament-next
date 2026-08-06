import ButtonComponent from '../button/button.component'
import IconComponent from '../icon/icon.component'
import { ErrorPageProps } from './error-page.types'
import './error-page.styles.css'
import BackdropComponent from '../backdrop/backdrop.component'

const ErrorPage = ({
  code,
  title = 'Something went wrong',
  description = "We hit a snag talking to the server. Try again, or head back while we sort it out.",
  details,
  retryLabel = 'Try Again',
  onRetry,
  isPending = false,
  backHref = '/',
  backLabel = 'Back to Home',
}: ErrorPageProps) => {
  return (
    <div className="error-page" role="alert" aria-labelledby="error-page-title">
      

      <div className="error-page__content omega-container omega-container--narrow">
        <span className="error-page__eyebrow">
          <IconComponent icon="mdi:alert-circle-outline" width={14} height={14} />
          {code ? `Error ${code}` : 'Request Failed'}
        </span>

        <div className="error-page__icon-ring" aria-hidden="true">
          <span className="error-page__icon-glow" />
          <IconComponent className="error-page__icon" icon="mdi:alert-octagon" width={40} height={40} />
        </div>

        <h1 id="error-page-title" className="error-page__title">
          {title}
        </h1>

        <p className="error-page__description">{description}</p>

        {details && (
          <details className="error-page__details">
            <summary className="error-page__details-summary">Technical details</summary>
            <pre className="error-page__details-body">{details}</pre>
          </details>
        )}

        <div className="error-page__actions">
          {onRetry && (
            <ButtonComponent
              type="button"
              variant="primary"
              icon="mdi:refresh"
              loading={isPending}
              onClick={onRetry}
            >
              {retryLabel}
            </ButtonComponent>
          )}
          <ButtonComponent to={backHref} variant={onRetry ? 'outline' : 'primary'}>
            {backLabel}
          </ButtonComponent>
        </div>
      </div>
    </div>
  )
}

export default ErrorPage
