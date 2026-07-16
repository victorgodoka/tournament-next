import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildInstagramUrl,
  buildTwitchUrl,
  buildXUrl,
  buildYoutubeUrl,
  calculateWinRate,
  cardArtUrl,
  formatLastSeen,
  formatMatchDuration,
  getTierInfo,
  getWinRateClass,
  isPlayerOnline,
  sanitizeBioHtml,
  tcgHref,
} from './profile.utils'

describe('profile.utils', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-06-15T12:00:00Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('getTierInfo', () => {
    it('returns Omega tier for high ratings', () => {
      expect(getTierInfo(2100).name).toBe('Omega')
    })

    it('returns Iron tier for low ratings', () => {
      expect(getTierInfo(10).name).toBe('Iron')
    })
  })

  describe('calculateWinRate', () => {
    it('calculates win rate including draws', () => {
      expect(calculateWinRate(7, 2, 1)).toBe(70)
    })

    it('returns 0 when there are no games', () => {
      expect(calculateWinRate(0, 0, 0)).toBe(0)
    })
  })

  describe('getWinRateClass', () => {
    it('returns excellent for high win rates', () => {
      expect(getWinRateClass(75)).toBe('profile__win-rate--excellent')
    })

    it('returns low for poor win rates', () => {
      expect(getWinRateClass(30)).toBe('profile__win-rate--low')
    })
  })

  describe('formatLastSeen', () => {
    it('returns Just now for recent activity', () => {
      expect(formatLastSeen('2025-06-15T11:59:30Z')).toBe('Just now')
    })

    it('returns minutes ago for recent activity', () => {
      expect(formatLastSeen('2025-06-15T11:30:00Z')).toBe('30m ago')
    })
  })

  describe('formatMatchDuration', () => {
    it('returns duration in minutes', () => {
      expect(
        formatMatchDuration('2025-06-01T14:00:00Z', '2025-06-01T14:25:00Z'),
      ).toBe('25m')
    })
  })

  describe('isPlayerOnline', () => {
    it('returns true when last login was within 5 minutes', () => {
      expect(isPlayerOnline('2025-06-15T11:57:00Z')).toBe(true)
    })

    it('returns false when last login was over 5 minutes ago', () => {
      expect(isPlayerOnline('2025-06-15T11:00:00Z')).toBe(false)
    })
  })

  describe('sanitizeBioHtml', () => {
    it('removes script tags and event handlers', () => {
      const result = sanitizeBioHtml(
        '<p onclick="alert(1)">Hello</p><script>alert(1)</script>',
      )

      expect(result).not.toContain('<script')
      expect(result).not.toContain('onclick')
      expect(result).toContain('Hello')
    })

    it('strips unsafe href values from links', () => {
      const result = sanitizeBioHtml('<a href="javascript:alert(1)">Click</a>')

      expect(result).not.toContain('javascript:')
    })

    it('returns empty string for empty input', () => {
      expect(sanitizeBioHtml('')).toBe('')
    })
  })

  describe('social URL builders', () => {
    it('normalizes handles with leading @', () => {
      expect(buildTwitchUrl('@streamer')).toBe('https://twitch.tv/streamer')
      expect(buildYoutubeUrl('@channel')).toBe('https://youtube.com/@channel')
      expect(buildXUrl('@handle')).toBe('https://twitter.com/handle')
      expect(buildInstagramUrl('@profile')).toBe('https://instagram.com/profile')
    })
  })

  describe('cardArtUrl', () => {
    it('builds card art URL from card id', () => {
      expect(cardArtUrl(89631139)).toContain('89631139.jpg')
    })
  })

  describe('tcgHref', () => {
    it('builds a partner tcgplayer search link', () => {
      expect(tcgHref('Blue-Eyes White Dragon')).toContain('partner.tcgplayer.com')
    })

    it('preserves the exact card name after the affiliate redirect decodes the u param', () => {
      const name = 'Ash Blossom & Joyous Spring'
      const href = tcgHref(name)

      // TCGplayer decodes the `u` param once, then reads `q` from that URL.
      const destination = decodeURIComponent(href.split('?u=')[1])
      const query = new URL(destination).searchParams.get('q')
      expect(query).toBe(name)
    })
  })
})
