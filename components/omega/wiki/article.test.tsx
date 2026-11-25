// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ArticleSummary } from '@utils/types'
import { ArticleCard } from './article'

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
  it('hides the counts when the API sent none', () => {
    render(<ArticleCard article={article} />)

    expect(screen.queryByText('views')).toBeNull()
  })

  afterEach(cleanup)

  it('names a listed article\'s topic and counts its views, likes and comments', () => {
    render(<ArticleCard article={{ ...article, slug: 'ygo-omega-faq', views: 1, likes: 2, commentCount: 3 }} />)

    expect(screen.getByText('Support')).toBeTruthy()
    expect(screen.getByText('1').textContent).toBe('1views')
    expect(screen.getByText('2').textContent).toBe('2likes')
    expect(screen.getByText('3').textContent).toBe('3comments')
  })

  it('shows a draft as one', () => {
    render(<ArticleCard article={{ ...article, publishedAt: null }} />)

    expect(screen.getByText('Draft')).toBeTruthy()
  })
})
