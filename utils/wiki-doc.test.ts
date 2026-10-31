import { afterEach, describe, expect, it, vi } from 'vitest'
import { cardsByIds } from '@utils/cards'
import { emptyDoc, frameKey, isAllowedSrc, renderDocHtml, type WikiDoc } from './wiki-doc'

vi.mock('@utils/cards', () => ({ cardsByIds: vi.fn() }))

const lookup = vi.mocked(cardsByIds)

afterEach(() => lookup.mockReset())

const doc: WikiDoc = {
  ...emptyDoc(),
  blocks: [
    { id: 'text', type: 'text', md: '[card:1] and [Two](/wiki/card/2)' },
    { id: 'cards', type: 'cards', cards: [{ id: 3, name: 'Three' }] },
  ],
}

const card = (kind: 'monster' | 'spell', monsterTypes: string[] = []) => ({ kind, monsterTypes, name: 'Named' }) as never

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

describe('renderDocHtml', () => {
  it('looks every card up once: tags, links and cards blocks', async () => {
    lookup.mockResolvedValue(new Map())
    await renderDocHtml(doc)
    expect(lookup).toHaveBeenCalledOnce()
    expect(lookup.mock.calls[0]?.[0]).toEqual([1, 2, 3])
  })

  it('makes no lookup for a doc without cards', async () => {
    await renderDocHtml({ ...emptyDoc(), blocks: [{ id: 'text', type: 'text', md: 'plain' }] })
    expect(lookup).not.toHaveBeenCalled()
  })

  it('hands out each frame', async () => {
    lookup.mockResolvedValue(new Map([[1, card('spell')], [3, card('monster', ['link'])]]))
    const html = await renderDocHtml(doc)
    expect(html[frameKey(1)]).toBe('spell')
    expect(html[frameKey(3)]).toBe('link')
  })

  it('still renders when the lookup fails, as it does outside the API allowlist', async () => {
    lookup.mockRejectedValue(new Error('403'))
    const html = await renderDocHtml(doc)
    expect(html.text).toBeTruthy()
    expect(html[frameKey(1)]).toBeUndefined()
  })
})
