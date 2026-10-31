// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ArticleSummary } from '@utils/types'
import { ArticleCard, ArticleRow } from './article'

vi.mock('next/image', () => ({ default: () => null }))
// The real one needs next-intl's provider.
vi.mock('@omega/profile/local-time', () => ({ LocalTime: ({ iso }: { iso: string }) => iso }))
vi.mock('@omega/wiki/local-day', () => ({ LocalDay: ({ iso }: { iso: string }) => iso }))

const article: ArticleSummary = {
  id: 1,
  slug: 'banlist',
  title: 'Banlist',
  summary: '',
  author: { id: '1', username: 'godoka', avatarUrl: null, cosmetics: {} },
  publishedAt: '2026-09-12T18:04:11.201Z',
  createdAt: '2026-09-10T12:00:00.000Z',
  updatedAt: '2026-09-12T18:04:11.201Z',
}

describe('ArticleCard', () => {
  afterEach(cleanup)

  it('shows views, likes and comments', () => {
    render(<ArticleCard article={{ ...article, views: 1520, likes: 34, commentCount: 0 }} />)

    expect(screen.getByText('1.5K').textContent).toBe('1.5Kviews')
    expect(screen.getByText('34').textContent).toBe('34likes')
    expect(screen.getByText('0').textContent).toBe('0comments')
  })

  it('hides the row when the API sent no counts', () => {
    render(<ArticleCard article={article} />)

    expect(screen.queryByText('views')).toBeNull()
  })
})

describe('ArticleRow', () => {
  afterEach(cleanup)

  it('names a listed article\'s topic and counts its views', () => {
    const { container } = render(<ArticleRow article={{ ...article, slug: 'ygo-omega-faq', views: 1 }} />)

    expect(screen.getByText('Support')).toBeTruthy()
    expect(container.textContent).toContain('1 view')
  })

  it('shows a draft as one', () => {
    render(<ArticleRow article={{ ...article, publishedAt: null }} />)

    expect(screen.getByText('Draft')).toBeTruthy()
  })
})
