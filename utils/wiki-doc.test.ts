import { describe, expect, it } from 'vitest'
import { isAllowedSrc } from './wiki-doc'

describe('isAllowedSrc', () => {
  it('takes files from public/, card art and the wiki uploads', () => {
    expect(isAllowedSrc('/wiki-images/tier-list/2026-10-30-tcg-wide.jpg')).toBe(true)
    expect(isAllowedSrc('/wiki-images/troubleshooting/deck-manager.webp')).toBe(true)
    expect(isAllowedSrc('https://ygopro.online/assets/card-arts/72270339.jpg')).toBe(true)
    expect(isAllowedSrc('https://res.cloudinary.com/x/image/upload/wiki_assets/abc')).toBe(true)
  })

  it('refuses a route of this site: every reader would run it on the server', () => {
    expect(isAllowedSrc('/statistics/infographic/tier-list?ladder=genesys&size=tall&v=2026-10-30')).toBe(false)
    expect(isAllowedSrc('/profile/1/statistics/infographic/overview')).toBe(false)
    expect(isAllowedSrc('/_next/image?url=%2Fx.png&w=640&q=75')).toBe(false)
  })

  it('refuses another host', () => {
    expect(isAllowedSrc('//example.com/x.png')).toBe(false)
    expect(isAllowedSrc('https://example.com/x.png')).toBe(false)
  })
})
