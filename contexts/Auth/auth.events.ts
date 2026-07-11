import { AUTH_EXPIRED_EVENT } from './auth.const'

export function dispatchAuthExpired(message?: string) {
  window.dispatchEvent(
    new CustomEvent(AUTH_EXPIRED_EVENT, { detail: { message } }),
  )
}
