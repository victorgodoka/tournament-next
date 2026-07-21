'use client'

import { useAuthContext } from '@contexts/Auth/auth.context'
import { ErrorBannerViewProps } from './errorbanner.types'
import './errorbanner.styles.css'

const ErrorBannerView = ({ message, onDismiss }: ErrorBannerViewProps) => {
  return (
    <div className="error-banner" role="alert">
      <p className="error-banner__message">{message}</p>
      <button
        type="button"
        className="error-banner__dismiss"
        aria-label="Dismiss error message"
        onClick={onDismiss}
      >
        ×
      </button>
    </div>
  )
}

const ErrorBanner = () => {
  const { error, clearError } = useAuthContext()

  if (!error) return null

  return <ErrorBannerView key={error} message={error} onDismiss={clearError} />
}

export default ErrorBanner
