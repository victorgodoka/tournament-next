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
  friends_rivals: 'Visible to friends & rivals',
  friends: 'Visible to friends',
  nobody: 'Visible to you only',
}

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
