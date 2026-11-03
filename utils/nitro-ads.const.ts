import type {
  NitroAdReportOptions,
  NitroAdSizes,
  NitroAnchorAdOptions,
  NitroArticleAdOptions,
  NitroDisplayAdOptions,
  NitroVideoNcAdOptions,
  NitroFloatingAdOptions,
  NitroInterstitialAdOptions,
  NitroRailAdOptions,
} from './nitro-ads.types'

const NITROPAY_SITE_ID = '2429'

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
 * Content is 1280px wide, so 1620px leaves 170px per gutter: a 160x600 fits. Between 1366px and
 * 1620px `--container-page` narrows to keep those 170px. Nitro drops the rail when any element
 * starts inside its track (a full-width `main` too) unless it or an ancestor is allowlisted.
 * `data-clear-gutters` allowlists a full-width wrapper whose content keeps to `--container-page`:
 * Nitro stops checking everything inside it, so a page with full-bleed content can't carry it. No stack, so
 * the 300x600 stays in the auction where it fits. The header is 60px, hence the sticky top.
 */
const RAIL = {
  format: 'rail',
  railOffsetTop: 100,
  railOffsetBottom: 220,
  railCollisionWhitelist: ['#site-header', '#site-footer', '.oh-space', '[data-clear-gutters]'],
  railCloseColor: '#666666',
  railSpacing: 10,
  railStack: false,
  railStickyTop: 80,
  railVerticalAlign: 'center',
  report: AD_REPORT,
  mediaQuery: '(min-width: 1366px)',
} as const satisfies Omit<NitroRailAdOptions, 'rail'>

export const RAIL_LEFT_AD_OPTIONS = { ...RAIL, rail: 'left' } as const satisfies NitroRailAdOptions

export const RAIL_RIGHT_AD_OPTIONS = { ...RAIL, rail: 'right' } as const satisfies NitroRailAdOptions

/**
 * Signed in, the messenger dock's 52px bar sits in this rail's column, and Nitro's rails stack over
 * everything of ours: a rail on the bar makes it unclickable. Top-aligned the rail ends 700px down at
 * most (100 + 600), so from 752px of height the two never touch. Shorter screens go without.
 */
export const RAIL_RIGHT_DOCK_AD_OPTIONS = {
  ...RAIL_RIGHT_AD_OPTIONS,
  railVerticalAlign: 'top',
  mediaQuery: '(min-width: 1366px) and (min-height: 752px)',
} as const satisfies NitroRailAdOptions

/**
 * The body width from which a 300px rail, 10px off the edge, clears 1280px of content. Narrower, a
 * page whose wrapper is allowlisted (`.oh-space`) would get one over its content: 160x600 only.
 */
export const RAIL_WIDE_MIN_WIDTH = 1280 + 2 * 310

/**
 * A wiki article keeps 1280px at every width, so its rails wait for the 170px gutters that leaves. It takes a media
 * query: Nitro's collision check is no help, it runs under `app/loading.tsx`, whose wrapper is allowlisted.
 */
export const RAIL_ARTICLE_QUERY = `(min-width: ${1280 + 2 * 170}px)`

/** The signed-in right rail on an article: the same width, and the height that clears the messenger dock. */
export const RAIL_ARTICLE_DOCK_QUERY = `${RAIL_ARTICLE_QUERY} and (min-height: 752px)`

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

/**
 * In-content sizes: the more sizes a slot takes, the more bidders compete. Each slot keeps the ones
 * that fit its width when it asks (`fitSizes`). Every slot reserves 250px, the tallest of them, so
 * no fill shifts the page.
 */
export const CONTENT_SIZES = [
  [970, 250],
  [970, 90],
  [728, 90],
  [300, 250],
  [320, 100],
  [320, 50],
] as const satisfies NitroAdSizes

/**
 * The wiki article's body, which Nitro's `article` format spaces units through. Never an ad-like id
 * (`ad-article`, `ad-top`…): EasyList hides those, and here that would hide the article.
 */
export const WIKI_BODY_ID = 'wiki-body'

/** Below `lg` the wiki aside moves above the article: there the anchor covers phones instead. */
export const ASIDE_AD_OPTIONS = {
  sizes: [[300, 250]],
  renderVisibleOnly: true,
  mediaQuery: '(min-width: 1024px)',
  report: AD_REPORT,
} as const satisfies NitroDisplayAdOptions

/** A half page in a side column (the profile's), with the medium rectangle as the fallback. */
export const ASIDE_TALL_AD_OPTIONS = {
  sizes: [[300, 600], [300, 250]],
  renderVisibleOnly: true,
  mediaQuery: '(min-width: 1024px)',
  report: AD_REPORT,
} as const satisfies NitroDisplayAdOptions

/** The article column is about 620px wide on desktop: `fitSizes` drops the 728 there, and keeps it for a wider column. */
export const ARTICLE_AD_OPTIONS = {
  format: 'article',
  sizes: [[728, 90], [300, 250], [320, 100], [320, 50]],
  pageInterval: 1,
  articleOffsetTop: 80,
  report: AD_REPORT,
} as const satisfies NitroArticleAdOptions

/** Nitro's defaults: plays in place, floats once scrolled off. */
export const VIDEO_NC_AD_OPTIONS = {
  format: 'video-nc',
  report: AD_REPORT,
} as const satisfies NitroVideoNcAdOptions
