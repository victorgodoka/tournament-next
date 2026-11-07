// @vitest-environment happy-dom
import { useState } from 'react'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { listArticles } from '@utils/articles'
import { ArticlePreviewFields } from './ArticlePreviewFields'

vi.mock('@utils/articles', () => ({ listArticles: vi.fn(async () => ({ articles: [{ id: 1, slug: 'sample-guide', title: 'Sample guide', summary: 'A guide.', publishedAt: '2026-11-07' }], nextCursor: null })) }))
vi.mock('@utils/wiki-article-preview', async (original) => ({
  ...await original<typeof import('@utils/wiki-article-preview')>(),
  loadArticlePreview: vi.fn(async (slug: string) => ({ slug, title: 'Sample guide', summary: 'A guide.' })),
}))
afterEach(() => { cleanup(); vi.clearAllMocks() })
const Editor = () => { const [slug, setSlug] = useState(''); return <ArticlePreviewFields slug={slug} onChange={setSlug} /> }

describe('Article Preview editor', () => {
  it('searches published articles by name and fills the selected slug', async () => {
    render(<Editor />)
    fireEvent.change(screen.getByRole('searchbox', { name: 'Search articles by name' }), { target: { value: 'Sample' } })
    fireEvent.click(await screen.findByRole('button', { name: /Sample guide/ }))
    expect((screen.getByLabelText('Article slug') as HTMLInputElement).value).toBe('sample-guide')
    expect(listArticles).toHaveBeenCalledWith(expect.objectContaining({ search: 'Sample', status: 'published' }), undefined, expect.anything())
    await waitFor(() => expect(screen.getByRole('link', { name: /Sample guide/ }).getAttribute('href')).toBe('/wiki/sample-guide'))
  })
  it('also accepts a directly typed slug', async () => {
    render(<Editor />)
    fireEvent.change(screen.getByLabelText('Article slug'), { target: { value: 'another-guide' } })
    await waitFor(() => expect(screen.getByRole('link', { name: /Sample guide/ }).getAttribute('href')).toBe('/wiki/another-guide'))
  })
})
