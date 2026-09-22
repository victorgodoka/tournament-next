import { describe, expect, it } from 'vitest'
import { bioProblem, diff, SOCIAL_FIELDS, toForm } from './form'

const settings = {
  bio: 'Hi',
  region: 'brazil',
  visibility: 'everyone',
  favoriteCard: { id: 46986431, name: 'Dark Magician' },
  favoriteDeck: { name: 'Mitsurugi', art: { id: 13332685, name: 'Ame no Habakiri no Mitsurugi' } },
  socials: [
    { network: 'x', handle: '@marufuji', href: 'https://x.com/marufuji' },
    { network: 'youtube', handle: null, href: 'https://youtube.com/@marufujiduels' },
    { network: 'website', handle: null, href: 'https://marufuji.gg' },
  ],
} as const

describe('edit profile form', () => {
  it('sends nothing when nothing changed, including socials read back from the API', () => {
    const form = toForm(structuredClone(settings) as never)
    expect(diff(form, form)).toEqual({})
    expect(diff(form, toForm(structuredClone(settings) as never))).toEqual({})
  })

  it('sends only changed fields, in the PATCH shape', () => {
    const from = toForm(structuredClone(settings) as never)
    const to = {
      ...from,
      region: null,
      favoriteCard: null,
      favoriteDeckName: '  ',
      favoriteDeckArt: null,
      socials: { ...from.socials, x: '@new_handle', website: '' },
    }

    expect(diff(from, to)).toEqual({
      region: null,
      favoriteCardId: null,
      favoriteDeckName: null,
      favoriteDeckCardId: null,
      socials: [
        { network: 'x', handle: '@new_handle', href: 'https://x.com/new_handle' },
        { network: 'youtube', handle: '@marufujiduels', href: 'https://youtube.com/@marufujiduels' },
      ],
    })
  })

  it('caps social inputs under the API limits', () => {
    for (const { network, max, toSocial } of SOCIAL_FIELDS) {
      const { handle, href } = toSocial('a'.repeat(max))
      expect(handle?.length ?? 0, network).toBeLessThanOrEqual(64)
      expect(href.length, network).toBeLessThanOrEqual(500)
    }
  })

  it('catches bios the API would reject', () => {
    expect(bioProblem('**fine** [site](https://a.b)')).toBeNull()
    expect(bioProblem('<b>no</b>')).toMatch(/HTML/)
    expect(bioProblem('<https://a.b>')).toMatch(/HTML/)
    expect(bioProblem('[site](a.b)')).toMatch(/http/)
    expect(bioProblem('[1]: ftp://a.b')).toMatch(/http/)
    expect(bioProblem('x'.repeat(2001))).toMatch(/2000/)
  })
})
