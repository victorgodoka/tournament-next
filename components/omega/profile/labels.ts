import type { Region, SocialNetwork, Visibility } from '@utils/types'

/** The API sends stable enums; labels and icons are the client's job. */
export const REGION_LABEL: Record<Region, string> = {
  north_america: 'North America',
  latam: 'LATAM',
  brazil: 'Brazil',
  eu_west: 'EU West',
  eu_east: 'EU East',
  middle_east: 'Middle East',
  africa: 'Africa',
  asia: 'Asia',
  oceania: 'Oceania',
}

/** Only the owner ever sees this: it is their own privacy setting, not a viewer-facing state. */
export const VISIBILITY_LABEL: Record<Visibility, string> = {
  everyone: 'Visible to everyone',
  nobody: 'Private',
}

export const WINDOW_LABEL = { '7d': 'Last 7 days', '14d': 'Last 14 days', '28d': 'Last 28 days', season: 'This season' } as const

/** `W–L–D`. */
export const formatRecord = ({ wins, loses, draws }: { wins: number; loses: number; draws: number }) => `${wins}–${loses}–${draws}`

/** One decimal, `53.7%`. `—` without games. */
export const formatRate = (wins: number, total: number) => (total ? `${(Math.round((wins / total) * 1000) / 10).toFixed(1)}%` : '—')

export const SOCIAL: Record<SocialNetwork, { label: string }> = {
  instagram: { label: 'Instagram' },
  x: { label: 'X' },
  youtube: { label: 'YouTube' },
  twitch: { label: 'Twitch' },
  website: { label: 'Website' },
}

// ponytail: fixed locale so server and client render the same digits; per-reader locale needs a client-only formatter.
const NUMBER = new Intl.NumberFormat('en-US')
export const formatNumber = (value: number) => NUMBER.format(value)
