import type {
  NitroAdReportOptions,
  NitroAnchorAdOptions,
  NitroFloatingAdOptions,
  NitroInterstitialAdOptions,
  NitroRailAdOptions,
} from './nitro-ads.types'

export const NITROPAY_SITE_ID = '2429'

export const NITROPAY_SCRIPT_URL = `https://s.nitropay.com/ads-${NITROPAY_SITE_ID}.js`

/** Site-wide placements. Nitro needs no placeholder element for any of them. */
export const NITRO_AD_SLOT_IDS = {
  railLeft: 'nitro-ads-rail-left',
  railRight: 'nitro-ads-rail-right',
  anchor: 'nitro-ads-anchor',
  floating: 'nitro-ads-floating',
  interstitial: 'nitro-ads-interstitial',
} as const

export const AD_REPORT = {
  enabled: true,
  icon: true,
  wording: 'Report Ad',
  position: 'top-right',
} as const satisfies NitroAdReportOptions

/**
 * Content is 1280px wide, so 1620px leaves 170px per gutter: a 160x600 fits. No stack, so the
 * 160x600 and 300x600 skyscrapers stay in the auction. The header is 60px, hence the sticky top.
 */
const RAIL = {
  format: 'rail',
  railOffsetTop: 100,
  railOffsetBottom: 220,
  railCollisionWhitelist: ['#site-header', '#site-footer', '.oh-space'],
  railCloseColor: '#666666',
  railSpacing: 10,
  railStack: false,
  railStickyTop: 80,
  railVerticalAlign: 'center',
  report: AD_REPORT,
  mediaQuery: '(min-width: 1620px)',
} as const satisfies Omit<NitroRailAdOptions, 'rail'>

export const RAIL_LEFT_AD_OPTIONS = { ...RAIL, rail: 'left' } as const satisfies NitroRailAdOptions

export const RAIL_RIGHT_AD_OPTIONS = { ...RAIL, rail: 'right' } as const satisfies NitroRailAdOptions

/** No close button: Nitro's advice for revenue. The background is the theme's #080a14. */
export const ANCHOR_AD_OPTIONS = {
  format: 'anchor',
  anchor: 'bottom',
  anchorClose: false,
  anchorBgColor: 'rgb(8 10 20 / 90%)',
  report: AD_REPORT,
} as const satisfies NitroAnchorAdOptions

/** Signed in, the messenger dock owns the bottom of the screen from 640px up. */
export const ANCHOR_MOBILE_AD_OPTIONS = {
  ...ANCHOR_AD_OPTIONS,
  mediaQuery: '(max-width: 639px)',
} as const satisfies NitroAnchorAdOptions

/** Bottom-left: the messenger dock owns bottom-right. Phones get the anchor instead. */
export const FLOATING_AD_OPTIONS = {
  format: 'floating',
  floating: { position: 'bottom-left' },
  mediaQuery: '(min-width: 640px)',
  report: AD_REPORT,
} as const satisfies NitroFloatingAdOptions

/** At most one per user every 5 minutes, and never on landing. */
export const INTERSTITIAL_AD_OPTIONS = {
  format: 'interstitial',
  interstitial: { triggers: { unhideWindow: true } },
  frequencyCap: 300,
  report: AD_REPORT,
} as const satisfies NitroInterstitialAdOptions
