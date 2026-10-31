import { describe, expect, it } from 'vitest'
import { isWikiTopic, topicOf } from './wiki-topics'

describe('topicOf', () => {
  it('finds a listed article, and any dated meta report', () => {
    expect(topicOf('omega-install-guide')).toBe('start')
    expect(topicOf('yu-gi-oh-meta-report-november-6-2026')).toBe('meta')
  })

  it('leaves an unlisted article without a topic', () => {
    expect(topicOf('a-brand-new-article')).toBeUndefined()
  })
})

describe('isWikiTopic', () => {
  it('takes the four topics and nothing else from the URL', () => {
    expect(isWikiTopic('meta')).toBe(true)
    expect(isWikiTopic('toString')).toBe(false)
    expect(isWikiTopic(undefined)).toBe(false)
  })
})
