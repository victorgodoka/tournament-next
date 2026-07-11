'use client'

import { useState } from 'react'
import { useAuthContext } from '@contexts/Auth/auth.context'
import { ErrorBannerViewProps } from './errorbanner.types'
import './errorbanner.styles.css'

const ErrorBannerView = ({ message, onDismiss }: ErrorBannerViewProps) => {
  const [isDismissed, setIsDismissed] = useState(false)

  if (isDismissed) return null

  const dismiss = () => {
    setIsDismissed(true)
    onDismiss()
  }

  return (
    <div className="error-banner" role="alert">
      <p className="error-banner__message">{message}</p>
      <button
        type="button"
        className="error-banner__dismiss"
        aria-label="Dismiss error message"
        onClick={dismiss}
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
