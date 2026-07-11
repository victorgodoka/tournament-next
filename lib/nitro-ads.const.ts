import type { NitroFloatingAdOptions, NitroRailAdOptions } from './nitro-ads.types'

export const NITROPAY_SITE_ID = '2429'

export const NITROPAY_SCRIPT_URL = `https://s.nitropay.com/ads-${NITROPAY_SITE_ID}.js`

export const NITRO_AD_SLOT_IDS = {
  stickyRail: 'nitro-ads-sticky-rail',
  floatingOutstream: 'nitro-ads-floating-outstream',
} as const

export const STICKY_RAIL_AD_OPTIONS = {
  format: 'rail',
  rail: 'left',
  railOffsetTop: 100,
  railOffsetBottom: 0,
  railCollisionWhitelist: [],
  railCloseColor: '#666666',
  railSpacing: 10,
  railStack: true,
  railStickyTop: 0,
  railVerticalAlign: 'center',
  report: {
    enabled: true,
    icon: true,
    wording: 'Report Ad',
    position: 'top-right',
  },
  mediaQuery: '(min-width: 1025px), (min-width: 768px) and (max-width: 1024px)',
} as const satisfies NitroRailAdOptions

export const FLOATING_OUTSTREAM_AD_OPTIONS = {
  format: 'floating',
  report: {
    enabled: true,
    icon: true,
    wording: 'Report Ad',
    position: 'top-left',
  },
} as const satisfies NitroFloatingAdOptions
