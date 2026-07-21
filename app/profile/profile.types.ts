export type ProfilePageProps = {
  params: Promise<{ id: string }>
}

export interface ProfileCustomizationData {
  success?: boolean
  id: string
  duelist_bio?: string
  duelist_favorite?: number | string | null
  duelist_banner_url?: string
  hide_history?: number
  socialTwitch?: string
  socialYoutube?: string
  socialX?: string
  socialInstagram?: string
}

export type ProfileIdClientProps = {
  profileId: string
}
