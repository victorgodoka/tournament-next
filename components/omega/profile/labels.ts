import type { Region, SocialNetwork } from '@utils/types'

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

export const SOCIAL: Record<SocialNetwork, { label: string; icon: string }> = {
  instagram: { label: 'Instagram', icon: 'mdi:instagram' },
  x: { label: 'X', icon: 'simple-icons:x' },
  youtube: { label: 'YouTube', icon: 'mdi:youtube' },
  twitch: { label: 'Twitch', icon: 'mdi:twitch' },
  website: { label: 'Website', icon: 'mdi:web' },
}

// ponytail: fixed locale so server and client render the same digits; per-reader locale needs a client-only formatter.
const NUMBER = new Intl.NumberFormat('en-US')
export const formatNumber = (value: number) => NUMBER.format(value)
