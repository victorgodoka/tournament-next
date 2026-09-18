/** Edit-profile form model: pure, so it runs in tests without the app. */
import type { CardArt, ProfileSettings, ProfileSettingsPatch, ProfileSocial, Region, SocialNetwork, Visibility } from "@utils/types";

/* ── Limits the API enforces (PROFILE_API.md §3.3), checked here first so saves don't bounce ── */

export const BIO_MAX = 2000
export const DECK_NAME_MAX = 64
export const COVER_MAX_BYTES = 4 * 1024 * 1024
export const COVER_TYPES = ['image/jpeg', 'image/png']

export const bioProblem = (bio: string) => {
  if (bio.length > BIO_MAX) return `Keep your bio under ${BIO_MAX} characters.`
  if (/<[a-z/!]/i.test(bio)) return 'Raw HTML isn’t allowed in your bio. Use Markdown instead.'
  if (/\]\((?!https?:\/\/)/i.test(bio) || /^\s*\[[^\]]+\]:\s*(?!https?:\/\/)/im.test(bio)) return 'Bio links need a full http:// or https:// address.'
  return null
}

/* ── Form model ── */

export type Form = {
  coverImageId: string | null
  bio: string
  region: Region | null
  visibility: Visibility
  favoriteCard: CardArt | null
  favoriteDeckName: string
  favoriteDeckArt: CardArt | null
  /** Raw input per network: a handle without `@`, or a URL without the scheme. */
  socials: Record<SocialNetwork, string>
}

const handleSocial = (network: SocialNetwork, base: string) => (value: string): ProfileSocial =>
  ({ network, handle: `@${value}`, href: `${base}${encodeURIComponent(value)}` })

export const SOCIAL_FIELDS: { network: SocialNetwork; prefix: string; placeholder: string; toSocial: (value: string) => ProfileSocial }[] = [
  { network: 'instagram', prefix: '@', placeholder: 'marufuji', toSocial: handleSocial('instagram', 'https://instagram.com/') },
  { network: 'x', prefix: '@', placeholder: 'marufuji_ygo', toSocial: handleSocial('x', 'https://x.com/') },
  { network: 'youtube', prefix: '@', placeholder: 'marufujiduels', toSocial: handleSocial('youtube', 'https://youtube.com/@') },
  { network: 'twitch', prefix: '@', placeholder: 'marufuji_live', toSocial: handleSocial('twitch', 'https://twitch.tv/') },
  { network: 'website', prefix: 'https://', placeholder: 'marufuji.gg', toSocial: (value) => ({ network: 'website', handle: null, href: `https://${value}` }) },
]

const cleanSocial = (network: SocialNetwork, value: string) =>
  network === 'website' ? value.trim().replace(/^https?:\/\//i, '') : value.trim().replace(/^@/, '')

const socialInput = ({ network, handle, href }: ProfileSocial) =>
  cleanSocial(network, network === 'website' ? href : handle ?? decodeURIComponent(href.split('/').pop() ?? ''))

const toSocials = (socials: Form['socials']) =>
  SOCIAL_FIELDS.flatMap(({ network, toSocial }) => {
    const value = cleanSocial(network, socials[network])
    return value ? [toSocial(value)] : []
  })

export const toForm = (settings: ProfileSettings): Form => ({
  coverImageId: settings.coverImageId,
  bio: settings.bio,
  region: settings.region,
  visibility: settings.visibility,
  favoriteCard: settings.favoriteCard,
  favoriteDeckName: settings.favoriteDeck?.name ?? '',
  favoriteDeckArt: settings.favoriteDeck?.art ?? null,
  socials: Object.assign(
    { instagram: '', x: '', youtube: '', twitch: '', website: '' },
    Object.fromEntries(settings.socials.map((social) => [social.network, socialInput(social)])),
  ),
})

/** Changed fields only, in the shape `PATCH /profiles/me` expects. */
export const diff = (from: Form, to: Form): ProfileSettingsPatch => {
  const patch: ProfileSettingsPatch = {}
  if (from.coverImageId !== to.coverImageId) patch.coverImageId = to.coverImageId
  if (from.bio !== to.bio) patch.bio = to.bio
  if (from.region !== to.region) patch.region = to.region
  if (from.visibility !== to.visibility) patch.visibility = to.visibility
  if (from.favoriteCard?.id !== to.favoriteCard?.id) patch.favoriteCardId = to.favoriteCard?.id ?? null
  if (from.favoriteDeckName.trim() !== to.favoriteDeckName.trim()) patch.favoriteDeckName = to.favoriteDeckName.trim() || null
  if (from.favoriteDeckArt?.id !== to.favoriteDeckArt?.id) patch.favoriteDeckCardId = to.favoriteDeckArt?.id ?? null
  const socials = toSocials(to.socials)
  if (JSON.stringify(toSocials(from.socials)) !== JSON.stringify(socials)) patch.socials = socials
  return patch
}
