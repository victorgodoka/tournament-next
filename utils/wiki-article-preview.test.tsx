import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { renderArticle } from './remark'
import { emptyDoc, renderDocHtml, validateDoc } from './wiki-doc'
import { loadArticlePreview } from './wiki-article-preview'

vi.mock('./code-highlight', () => ({ lowlight: { registered: () => false } }))

afterEach(() => vi.unstubAllGlobals())
const response = (slug = 'test-guide') => ({ slug, title: 'Test guide', summary: 'A public guide.', publishedAt: '2026-11-07', doc: { cover: { asset: 'cover' }, assets: { cover: { id: 'cover', src: '/wiki-images/article-cover.png', width: 1920, height: 420, alt: 'Guide cover' } } } })

describe('article links', () => {
  it('open text, card and statistics links in a new tab and keep in-page anchors in place', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false })))
    const html = renderToStaticMarkup(await renderArticle('[Guide](/wiki/guide), [card](/wiki/card/14558127), [deck](/statistics/archetypes/482?ladder=tcg), [site](https://example.com) and [settings](#current-settings).'))
    for (const href of ['/wiki/guide', '/wiki/card/14558127', '/statistics/archetypes/482?ladder=tcg', 'https://example.com'])
      expect(html).toMatch(new RegExp(`<a[^>]*href="${href.replace(/[?]/g, '\\?')}"[^>]*target="_blank"[^>]*rel="noopener noreferrer"|<a[^>]*target="_blank"[^>]*href="${href.replace(/[?]/g, '\\?')}"`))
    expect(html).toMatch(/<a[^>]*href="#current-settings"/)
    expect(html).not.toMatch(/<a[^>]*href="#current-settings"[^>]*target=/)
  })

  it('open the article preview card in a new tab', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => response() })))
    const html = renderToStaticMarkup(await renderArticle('[article=test-guide]'))
    expect(html).toMatch(/<a[^>]*href="\/wiki\/test-guide"[^>]*target="_blank"/)
  })
})

describe('article previews', () => {
  it('renders a card between paragraphs, with cover, title and summary', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => response() }))
    vi.stubGlobal('fetch', fetchMock)
    const html = renderToStaticMarkup(await renderArticle('Before **the card** [article=test-guide] After the card.'))
    expect(html).toContain('Test guide')
    expect(html).toContain('A public guide.')
    expect(html).toContain('/wiki/test-guide')
    expect(html).toContain('Guide cover')
    expect(html.indexOf('Before')).toBeLessThan(html.indexOf('Test guide'))
    expect(html.indexOf('After')).toBeGreaterThan(html.indexOf('Test guide'))
    expect(html).not.toMatch(/<p[^>]*>\s*<a[^>]*class="cut/)
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining('/wiki/test-guide'), expect.objectContaining({ credentials: 'omit', next: { revalidate: 300 } }))
  })

  it('expands repeated references with one metadata read per render', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => response('repeat-guide') }))
    vi.stubGlobal('fetch', fetchMock)
    const html = renderToStaticMarkup(await renderArticle('[article=repeat-guide]\n\n[article=repeat-guide]'))
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(html.match(/href="\/wiki\/repeat-guide"/g)).toHaveLength(2)
  })

  it('keeps tags literal inside inline code, fenced code and link labels', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    const html = renderToStaticMarkup(await renderArticle('`[article=code-guide]`\n\n```text\n[article=fenced-guide]\n```\n\n[[article=linked-guide]](/wiki/other)'))
    expect(fetchMock).not.toHaveBeenCalled()
    expect(html).toContain('[article=code-guide]')
    expect(html).toContain('[article=fenced-guide]')
    expect(html).toContain('[article=linked-guide]')
  })

  it('hides unpublished metadata and falls back when the API fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => ({ ...response('draft-guide'), publishedAt: null, title: 'Private draft title' }) })))
    const draft = renderToStaticMarkup(await renderArticle('[article=draft-guide]'))
    expect(draft).not.toContain('Private draft title')
    expect(draft).toContain('Preview unavailable')
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline') }))
    expect(renderToStaticMarkup(await renderArticle('[article=missing-guide]'))).toContain('/wiki/missing-guide')
  })

  it('validates and renders the block through the same preview pipeline', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, json: async () => response('block-guide') })))
    const doc = { ...emptyDoc(), title: 'Cards', blocks: [{ id: 'preview', type: 'article-preview' as const, slug: 'block-guide' }] }
    expect(validateDoc(doc)).toEqual([])
    const html = await renderDocHtml(doc)
    expect(renderToStaticMarkup(<>{html.preview}</>)).toContain('Test guide')
    expect(validateDoc({ ...doc, blocks: [{ ...doc.blocks[0]!, slug: 'https://example.com' }] })).toContain('Block 1 (article-preview) needs an article slug.')
  })

  it('makes no request for an invalid slug', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    expect(await loadArticlePreview('../private')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
