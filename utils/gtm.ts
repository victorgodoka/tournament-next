/**
 * Google Tag Manager (GA4 lives inside the container). Every event goes through `track`, so the
 * names and parameters in docs/analytics/tracking-plan.md are the whole contract with GTM.
 */

export const GTM_ID = 'GTM-55HLGPXN'

export const GTM_SCRIPT_URL = `https://www.googletagmanager.com/gtm.js?id=${GTM_ID}`

/** EEA, UK and Switzerland: Nitro's CMP asks there, so nothing is stored until it answers. */
const CONSENT_REGIONS = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT',
  'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'IS', 'LI', 'NO', 'GB', 'CH',
]

/**
 * Runs in <head> before gtm.js: Consent Mode v2 defaults must be on the dataLayer before any tag.
 * Granted outside the consent regions; denied inside until `consentFromTcf` updates it.
 */
export const GTM_BOOTSTRAP = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}
gtag('consent','default',{ad_storage:'granted',ad_user_data:'granted',ad_personalization:'granted',analytics_storage:'granted'});
gtag('consent','default',{ad_storage:'denied',ad_user_data:'denied',ad_personalization:'denied',analytics_storage:'denied',region:${JSON.stringify(CONSENT_REGIONS)},wait_for_update:500});
gtag('set','ads_data_redaction',true);gtag('set','url_passthrough',true);
dataLayer.push({'gtm.start':Date.now(),event:'gtm.js'});`

type Params = Record<string, string | number | boolean | null | undefined>

declare global {
  interface Window {
    dataLayer?: unknown[]
    __tcfapi?: (command: 'addEventListener', version: 2, callback: (tcData: TcData, success: boolean) => void) => void
  }
}

/**
 * GTM merges every push into one data model, so an event's parameters would ride along on the
 * next one (a `tournament_id` on a later `deck_save`). The reset after each push stops that.
 */
export const track = (event: string, params: Params = {}): void => {
  if (typeof window === 'undefined') return
  ;(window.dataLayer ??= []).push({ event, ...params }, function (this: { reset(): void }) {
    this.reset()
  })
}

/** gtag's own shape: GTM reads consent commands only as an `arguments` object, never a plain array. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
function gtag(..._args: unknown[]) {
  // eslint-disable-next-line prefer-rest-params
  ;(window.dataLayer ??= []).push(arguments)
}

export const updateConsent = (consent: ConsentState): void => {
  if (typeof window !== 'undefined') gtag('consent', 'update', consent)
}

/** The fields of a TCF v2.2 TCData this site reads. */
export interface TcData {
  gdprApplies?: boolean
  eventStatus?: 'tcloaded' | 'cmpuishown' | 'useractioncomplete'
  purpose?: { consents?: Record<string, boolean> }
}

type Grant = 'granted' | 'denied'
export interface ConsentState {
  ad_storage: Grant
  analytics_storage: Grant
  ad_user_data: Grant
  ad_personalization: Grant
}

/**
 * TCF purposes to Consent Mode: 1 store on device, 3+4 personalised ads, 7 measure ads.
 * `null` while the CMP is still waiting on the visitor.
 */
export const consentFromTcf = (tcData: TcData): ConsentState | null => {
  if (tcData.eventStatus === 'cmpuishown') return null
  const p = tcData.gdprApplies ? (tcData.purpose?.consents ?? {}) : null
  const ok = (...ids: number[]): Grant => (!p || ids.every((id) => p[id]) ? 'granted' : 'denied')
  return {
    ad_storage: ok(1),
    analytics_storage: ok(1),
    ad_user_data: ok(1, 7),
    ad_personalization: ok(1, 3, 4),
  }
}

/** Set by `signIn` before the Discord redirect, read once the visitor comes back signed in. */
export const LOGIN_PENDING_KEY = 'omega_login_pending'
