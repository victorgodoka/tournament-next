import { describe, expect, it } from 'vitest'
import { isWikiTopic, topicOf } from './wiki-topics'

describe('topicOf', () => {
  it('finds a listed article, and any dated meta report', () => {
    expect(topicOf('omega-install-guide')).toBe('start')
    expect(topicOf('yu-gi-oh-meta-report-november-6-2026')).toBe('meta')
  })

  it('leaves an unlisted article without a topic', () => {
    expect(topicOf('a-brand-new-article')).toBeUndefined()
    expect(topicOf('toString')).toBeUndefined()
  })

  it('classifies new articles from the index without registering a slug', () => {
    expect(topicOf({ slug: 'new-guide', title: 'Beginner guide to Omega' })).toBe('start')
    expect(topicOf({ slug: 'new-list', title: 'TCG tier list for November' })).toBe('meta')
    expect(topicOf({ slug: 'new-rules', title: 'Understanding the latest banlist' })).toBe('formats')
    expect(topicOf({ slug: 'new-help', title: 'Troubleshooting deck import crashes' })).toBe('support')
    expect(topicOf({ slug: 'overview', title: 'Omega overview', summary: 'Compare competitive decks.' })).toBe('meta')
  })

  it('preserves editorial assignments and gives titles priority over summaries', () => {
    expect(topicOf({ slug: 'omega-install-guide', title: 'Omega decks' })).toBe('start')
    expect(topicOf({ slug: 'custom-deck-guide', title: 'Deck building', summary: 'Install Omega and check its banlist.' })).toBe('meta')
  })
})

describe('isWikiTopic', () => {
  it('takes the four topics and nothing else from the URL', () => {
    expect(isWikiTopic('meta')).toBe(true)
    expect(isWikiTopic('toString')).toBe(false)
    expect(isWikiTopic(undefined)).toBe(false)
  })
})
