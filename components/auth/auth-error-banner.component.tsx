import { useState } from 'react'
import { useAuthContext } from '@contexts/Auth/auth.context'
import './auth-error-banner.styles.css'

type AuthErrorBannerViewProps = {
  message: string
  onDismiss: () => void
}

const AuthErrorBannerView = ({ message, onDismiss }: AuthErrorBannerViewProps) => {
  const [isDismissed, setIsDismissed] = useState(false)

  if (isDismissed) return null

  const dismiss = () => {
    setIsDismissed(true)
    onDismiss()
  }

  return (
    <div className="auth-error-banner" role="alert">
      <p className="auth-error-banner__message">{message}</p>
      <button
        type="button"
        className="auth-error-banner__dismiss"
        aria-label="Dismiss error message"
        onClick={dismiss}
      >
        ×
      </button>
    </div>
  )
}

const AuthErrorBanner = () => {
  const { error, clearError } = useAuthContext()

  if (!error) return null

  return <AuthErrorBannerView key={error} message={error} onDismiss={clearError} />
}

export default AuthErrorBanner
