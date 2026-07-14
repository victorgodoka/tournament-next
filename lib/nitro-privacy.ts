import type {} from './nitro-privacy.types'

/**
 * NitroPay's DOM scan for `[data-ccpa-link]` runs when its script first
 * loads, so content mounted afterward needs this explicit re-trigger.
 * https://nitropay.com/docs/us-privacy-law-compliance-steps/
 */
export function refreshCcpaOptOutLink(): void {
  if (typeof window === 'undefined') return
  window.__uspapi?.('addLink', 1)
}

/**
 * Re-triggers injection of the "manage consent" button into
 * `#ncmp-consent-link` for content mounted after NitroPay's CMP loads.
 * https://nitropay.com/docs/creating-a-link-for-the-user-to-manage-their-consents/
 */
export function refreshConsentManagementLink(): void {
  if (typeof window === 'undefined') return
  window.__cmp?.('addConsentLink')
}
