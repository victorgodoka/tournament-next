// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { emptyDoc } from '@utils/wiki-doc'
import { ArticleView } from './article-view'

vi.mock('next/image', () => ({ default: () => null }))

afterEach(cleanup)

const doc = { ...emptyDoc(), title: 'Fire King' }

describe('ArticleView', () => {
  it('puts the lead first in the article the bodyId names', () => {
    const { container } = render(
      <ArticleView doc={doc} slug="fire-king" html={{}} bodyId="ad-article" lead={<div id="ad-video" />} />,
    )
    const article = container.querySelector('article#ad-article')
    expect(article?.firstElementChild?.id).toBe('ad-video')
  })

  it('carries no ad hooks for the editor preview, which passes neither', () => {
    const { container } = render(<ArticleView doc={doc} slug="fire-king" html={{}} />)
    expect(container.querySelector('#ad-video')).toBeNull()
    expect(container.querySelector('#ad-article')).toBeNull()
  })
})
