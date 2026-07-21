import { CARD_ART_BASE, TIER_BADGE_BASE } from './profile.const'

export { tcgHref } from '../../components/affiliate-link/affiliate-link-utils'

export type TierInfo = {
  name: string
  image: string
  accentClass: string
}

const TIER_THRESHOLDS: Array<{ min: number; name: string }> = [
  { min: 2000, name: 'Omega' },
  { min: 1450, name: 'Master' },
  { min: 1000, name: 'Diamond' },
  { min: 600, name: 'Platinum' },
  { min: 350, name: 'Gold' },
  { min: 200, name: 'Silver' },
  { min: 50, name: 'Bronze' },
  { min: 0, name: 'Iron' },
]

export function getTierInfo(rating: number): TierInfo {
  const tierName =
    TIER_THRESHOLDS.find((tier) => rating >= tier.min)?.name ?? 'Unranked'
  const slug = tierName.toLowerCase()

  return {
    name: tierName,
    image: `${TIER_BADGE_BASE}/${slug}.png`,
    accentClass: `profile__tier--${slug}`,
  }
}

export function cardArtUrl(cardId: number): string {
  return `${CARD_ART_BASE}/${cardId}.jpg`
}

export function calculateWinRate(
  wins: number,
  losses: number,
  draws = 0,
): number {
  const total = wins + losses + draws
  return total > 0 ? (wins / total) * 100 : 0
}

export function getWinRateClass(winRate: number): string {
  if (winRate >= 70) return 'profile__win-rate--excellent'
  if (winRate >= 55) return 'profile__win-rate--good'
  if (winRate >= 45) return 'profile__win-rate--average'
  return 'profile__win-rate--low'
}

export function formatLastSeen(isoDate: string): string {
  const diff = Date.now() - new Date(isoDate).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

export function formatMatchDuration(start: string, end: string): string {
  const minutes = Math.floor(
    (new Date(end).getTime() - new Date(start).getTime()) / 60000,
  )
  return `${minutes}m`
}

export function isPlayerOnline(lastLogin: string): boolean {
  const diffMin = (Date.now() - new Date(lastLogin).getTime()) / 60000
  return diffMin < 5
}

const BIO_ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 'a', 'span']

let purifierPromise: Promise<typeof import('dompurify').default> | null = null

/** Lazily load DOMPurify (browser only) and force safe link semantics once. */
function getPurifier() {
  purifierPromise ??= import('dompurify').then(({ default: DOMPurify }) => {
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if (node.tagName !== 'A') return
      if (node.getAttribute('href')) {
        node.setAttribute('target', '_blank')
        node.setAttribute('rel', 'noopener noreferrer')
      }
    })
    return DOMPurify
  })
  return purifierPromise
}

/**
 * Sanitize an untrusted user bio via DOMPurify (never a hand-rolled walker).
 * Browser-only by design: callers render the bio after mount, so the server
 * pass simply gets an empty string instead of weaker sanitization.
 */
export async function sanitizeBioHtml(html: string): Promise<string> {
  if (!html || typeof window === 'undefined') return ''

  const DOMPurify = await getPurifier()
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: BIO_ALLOWED_TAGS,
    ALLOWED_ATTR: ['href', 'target', 'rel'],
    ALLOWED_URI_REGEXP: /^https?:\/\//i,
  })
}

function normalizeSocialHandle(handle: string): string {
  return handle.trim().replace(/^@+/, '')
}

export function buildTwitchUrl(handle: string): string {
  return `https://twitch.tv/${encodeURIComponent(normalizeSocialHandle(handle))}`
}

export function buildYoutubeUrl(handle: string): string {
  return `https://youtube.com/@${encodeURIComponent(normalizeSocialHandle(handle))}`
}

export function buildXUrl(handle: string): string {
  return `https://twitter.com/${encodeURIComponent(normalizeSocialHandle(handle))}`
}

export function buildInstagramUrl(handle: string): string {
  return `https://instagram.com/${encodeURIComponent(normalizeSocialHandle(handle))}`
}
