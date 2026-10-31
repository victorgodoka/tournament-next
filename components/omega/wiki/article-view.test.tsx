// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { emptyDoc } from '@utils/wiki-doc'
import { ArticleView } from './article-view'

vi.mock('next/image', () => ({ default: () => null }))

afterEach(cleanup)

const doc = { ...emptyDoc(), title: 'Fire King' }

describe('ArticleView', () => {
  it('puts the lead right after the opening paragraph, in the article the bodyId names', () => {
    const opening = { ...doc, blocks: [{ id: 'one', type: 'text', md: 'x' }, { id: 'two', type: 'text', md: 'y' }] } as typeof doc
    const { container } = render(
      <ArticleView doc={opening} slug="fire-king" html={{ one: <p id="opening" />, two: <p id="next" /> }} bodyId="wiki-body" lead={<div id="ad-video" />} />,
    )
    const lead = container.querySelector('article#wiki-body #ad-video')
    expect(lead?.previousElementSibling?.querySelector('#opening')).toBeTruthy()
    expect(lead?.nextElementSibling?.querySelector('#next')).toBeTruthy()
  })

  it('puts the lead first when the article opens with something else', () => {
    const { container } = render(
      <ArticleView doc={doc} slug="fire-king" html={{}} bodyId="wiki-body" lead={<div id="ad-video" />} />,
    )
    expect(container.querySelector('article#wiki-body #ad-video')?.previousElementSibling).toBeNull()
  })

  it('marks this article in its hub instead of linking to it', () => {
    const links = {
      hub: { slug: 'fire', title: 'Fire decks', summary: '' },
      related: [],
      children: [
        { slug: 'fire-king', title: 'Fire King', summary: '' },
        { slug: 'fire-fist', title: 'Fire Fist', summary: '' },
      ],
    }
    const { container } = render(<ArticleView doc={doc} slug="fire-king" html={{}} links={links} />)
    expect(container.textContent).toContain("You're here")
    expect(container.querySelector('aside a[href="/wiki/fire-king"]')).toBeNull()
    expect(container.querySelector('aside a[href="/wiki/fire-fist"]')).not.toBeNull()
  })

  it('leaves the hub out for an article in none', () => {
    const { container } = render(<ArticleView doc={doc} slug="fire-king" html={{}} links={{ hub: null, related: [], children: [] }} />)
    expect(container.textContent).not.toContain('In this hub')
  })

  it('carries no ad hooks for the editor preview, which passes neither', () => {
    const { container } = render(<ArticleView doc={doc} slug="fire-king" html={{}} />)
    expect(container.querySelector('#ad-video')).toBeNull()
    expect(container.querySelector('#wiki-body')).toBeNull()
  })
})
