const rawSiteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ?? 'https://next.duelistsunite.org'

export const SITE_URL = rawSiteUrl.replace(/\/$/, '')

export const SITE_NAME = 'YGO Omega'
export const SITE_TITLE = 'YGO Omega | Duelists Unite'
export const SITE_DESCRIPTION =
  'YGO Omega — the free Yu-Gi-Oh! simulator by Duelists Unite. Play online, build decks, join tournaments, and explore the meta.'

export const OG_IMAGE = {
  url: '/logo.png',
  width: 153,
  height: 142,
  alt: 'YGO Omega logo',
} as const

export const ORGANIZATION_SAME_AS = [
  'https://discord.gg/duelistsunite',
  'https://x.com/duelistsunite',
  'https://www.twitch.tv/duelistsunite',
  'https://www.youtube.com/channel/UC_x5XG1OV2P6u7R-Fbq2oA',
  'https://forum.duelistsunite.org/',
] as const

export const PRIVACY_TERMS_CONST = {
  LAST_UPDATE: '2026-07-11',
  EMAIL: 'admin@duelistsunite.org',
  COUNTRY: 'Canada',
  JURISDICTION: 'Canada',
} as const

export const DISCORD_SERVER_LINK = 'https://discord.gg/duelistsunite'
