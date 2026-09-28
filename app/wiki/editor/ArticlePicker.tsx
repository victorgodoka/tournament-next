'use client'

import { useEffect, useState } from 'react'
import { listArticles } from '@utils/articles'
import type { ArticleSummary } from '@utils/types'
import { Frame, INPUT } from './ui'

type Answer = { query: string; articles: ArticleSummary[]; failed: boolean }

/** Debounced `GET /wiki?search=`. Answers are tagged with their query, so a stale one never shows. */
export const useArticleSearch = (query: string) => {
  const [answer, setAnswer] = useState<Answer | null>(null)
  const text = query.trim()
  const ready = text.length >= 2

  useEffect(() => {
    if (!ready) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      listArticles({ search: text.slice(0, 100), limit: 8 }, undefined, controller.signal)
        .then(({ articles }) => setAnswer({ query: text, articles, failed: false }))
        .catch((error: Error) => {
          if (error.name !== 'AbortError') setAnswer({ query: text, articles: [], failed: true })
        })
    }, 300)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [text, ready])

  return ready ? (answer?.query === text ? answer : 'loading') : null
}

/**
 * Find an article by title or keyword. The article being edited and anything already picked are left
 * out: the server refuses a self-reference, and drafts are valid targets (WIKI_API §4.6).
 */
export const ArticlePicker = ({
  label,
  exclude,
  onPick,
  disabled,
}: {
  label: string
  exclude: string[]
  onPick: (article: ArticleSummary) => void
  disabled?: boolean
}) => {
  const [query, setQuery] = useState('')
  const answer = useArticleSearch(query)
  const rows = answer && answer !== 'loading' ? answer.articles.filter((article) => !exclude.includes(article.slug)) : []

  return (
    <div className="min-w-0">
      <Frame>
        <input
          type="search"
          aria-label={label}
          placeholder={label}
          disabled={disabled}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className={INPUT + ' body-sm disabled:opacity-40'}
        />
      </Frame>
      {answer ? (
        <div aria-live="polite" className="mt-1.5 max-h-64 overflow-y-auto border border-line bg-surface-100">
          {answer === 'loading' ? (
            <p className="px-3 py-2 text-ink-muted body-sm">Searching…</p>
          ) : answer.failed ? (
            <p className="px-3 py-2 text-loss body-sm">The wiki search is unavailable right now.</p>
          ) : !rows.length ? (
            <p className="px-3 py-2 text-ink-muted body-sm">No other article matches “{answer.query}”.</p>
          ) : (
            <ul>
              {rows.map((article) => (
                <li key={article.slug}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(article)
                      setQuery('')
                    }}
                    className="flex w-full cursor-pointer items-center gap-3 px-3 py-2 text-left hover:bg-ground-soft"
                  >
                    <span className="min-w-0 flex-1 truncate text-ink body-sm">{article.title}</span>
                    <span className="shrink-0 text-ink-muted data">/wiki/{article.slug}</span>
                    {article.publishedAt ? null : <span className="shrink-0 text-gold signal-sm">Draft</span>}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  )
}
