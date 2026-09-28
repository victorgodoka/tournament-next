import { describe, expect, it } from 'vitest'
import { emptyDoc, isUploadDate, shareCrop, validateDoc, type WikiDoc } from './wiki-doc'
import { seoChecks, seoScore } from './wiki-seo'

const doc = (patch: Partial<WikiDoc>): WikiDoc => ({
  ...emptyDoc(),
  title: 'Sky Striker: deck guide',
  summary: 'Sky Striker is a Spell-heavy archetype.',
  blocks: [
    { id: 'b1', type: 'text', md: 'Intro without the word. See [links](/wiki/link-monsters).' },
    { id: 'b2', type: 'heading', level: 2, text: 'History', anchor: 'history' },
  ],
  ...patch,
})

describe('seoChecks', () => {
  it('points the missing focus keyword at the first paragraph and the first H2', () => {
    const checks = seoChecks(doc({ seo: { keyword: 'sky striker' } }), { slug: 'sky-striker' })
    const byId = Object.fromEntries(checks.map((check) => [check.id, check]))
    expect(byId['keyword-head']?.level).toBe('pass')
    expect(byId['keyword-intro']).toMatchObject({ level: 'warn', block: 'b1' })
    expect(byId['keyword-h2']).toMatchObject({ level: 'warn', block: 'b2' })
    expect(byId.links?.level).toBe('pass')
  })

  it('flags an orphan page and a small share image as fixes', () => {
    const small = doc({
      assets: { a: { id: 'a', src: '/a.png', width: 624, height: 624, alt: 'Raye artwork' } },
      cover: { asset: 'a' },
    })
    const levels = Object.fromEntries(seoChecks(small, { slug: 'x' }).map((check) => [check.id, check.level]))
    expect(levels).toMatchObject({ orphan: 'fix', share: 'fix', alt: 'warn' })
  })

  it('scores all-pass at 100 and all-fix at 0', () => {
    expect(seoScore([{ id: 'a', level: 'pass', text: '' }])).toBe(100)
    expect(seoScore([{ id: 'a', level: 'fix', text: '' }])).toBe(0)
  })
})

describe('shareCrop', () => {
  it('centres on the focal point and stays inside the image', () => {
    const crop = shareCrop({ id: 'a', src: '/a', width: 1920, height: 1080, alt: 'x', focal: { x: 100, y: 0 } })
    expect(crop.w).toBeCloseTo(1920)
    expect(crop.h).toBeCloseTo(1008)
    expect(crop.x).toBe(0)
    expect(crop.y).toBe(0)
  })
})

describe('validateDoc, new fields', () => {
  it('refuses a small share image, too many related and a bad upload date', () => {
    const problems = validateDoc(
      doc({
        assets: { a: { id: 'a', src: '/a.png', width: 624, height: 624, alt: 'x' } },
        seo: { image: 'a', keywords: ['A', 'a'] },
        related: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
        blocks: [{ id: 'v', type: 'video', videoId: 'fzwWvs-6FEs', title: 'x', uploadDate: '2005-02-30' }],
      }),
    )
    expect(problems.join('\n')).toMatch(/at least 1200×630/)
    expect(problems.join('\n')).toMatch(/keyword appears twice/)
    expect(problems.join('\n')).toMatch(/at most 6 related/)
    expect(problems.join('\n')).toMatch(/upload date/)
    expect(isUploadDate('2024-05-01')).toBe(true)
  })
})
