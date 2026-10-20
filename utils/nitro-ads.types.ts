/** NitroAds options, as https://api-docs.nitropay.com/ documents them. Only the keys this site sets. */

export type NitroAdReportPosition =
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'

export interface NitroAdReportOptions {
  enabled: boolean
  icon: boolean
  wording: string
  position: NitroAdReportPosition
}

export interface NitroRailAdOptions {
  format: 'rail'
  rail: 'left' | 'right'
  railOffsetTop: number
  railOffsetBottom: number
  /** Selectors the rail ignores when it checks for collisions. */
  railCollisionWhitelist: readonly string[]
  railCloseColor: string
  railSpacing: number
  railStack: boolean
  railStickyTop: number
  railVerticalAlign: 'top' | 'center'
  report: NitroAdReportOptions
  mediaQuery: string
}

export interface NitroAnchorAdOptions {
  format: 'anchor'
  anchor: 'bottom' | 'top'
  anchorClose: boolean
  anchorBgColor: string
  mediaQuery?: string
  report: NitroAdReportOptions
}

export interface NitroFloatingAdOptions {
  format: 'floating'
  floating: { position: 'bottom-left' | 'bottom-right' }
  mediaQuery: string
  report: NitroAdReportOptions
}

export interface NitroInterstitialAdOptions {
  format: 'interstitial'
  interstitial: { triggers: { unhideWindow: boolean } }
  /** Seconds between two interstitials for the same user. */
  frequencyCap: number
  report: NitroAdReportOptions
}

export type NitroAdOptions =
  | NitroRailAdOptions
  | NitroAnchorAdOptions
  | NitroFloatingAdOptions
  | NitroInterstitialAdOptions

export interface NitroAdInstance {
  onNavigate?: (href?: string) => void
}

export interface NitroAdsApi {
  createAd: (
    id: string,
    options: NitroAdOptions,
  ) => NitroAdInstance | Promise<NitroAdInstance | null> | null
  removeAd?: (id: string) => void
  loaded?: boolean
  queue: unknown[]
}

declare global {
  interface Window {
    nitroAds?: NitroAdsApi
  }
}
