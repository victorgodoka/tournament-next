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
  railCollisionWhitelist: string[]
  railCloseColor: string
  railSpacing: number
  railStack: boolean
  railStickyTop: number
  railVerticalAlign: 'top' | 'center' | 'bottom'
  report: NitroAdReportOptions
  mediaQuery: string
}

export interface NitroFloatingAdOptions {
  format: 'floating'
  report: NitroAdReportOptions
}

export type NitroAdOptions = NitroRailAdOptions | NitroFloatingAdOptions

export interface NitroAdInstance {
  onNavigate?: (href?: string) => void
}

export interface NitroAdsApi {
  createAd: (
    id: string,
    options: NitroAdOptions,
  ) => NitroAdInstance | Promise<NitroAdInstance | null> | null
  removeAd?: (id: string) => void
  onNavigate?: (href?: string) => void
  loaded?: boolean
  queue: unknown[]
}

declare global {
  interface Window {
    nitroAds?: NitroAdsApi
  }
}
