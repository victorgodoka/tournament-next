'use client'

import { useState } from 'react'
import { ArticleCard } from '@omega/wiki/article'
import { EmptyBox } from '@omega/profile/empty-box'
import { buttonClasses } from '@ui/button'
import { listArticles, type ArticleQuery } from '@utils/articles'
import type { ArticleIndex } from '@utils/types'

type ArticleListProps = {
  first: ArticleIndex
  /** The filters the server used, replayed on every "load more" so a cursor walk stays consistent. */
  query: ArticleQuery
  /** Copy for the empty state, which differs between a search, "my articles" and an empty wiki. */
  empty: { title: string; note: string }
}

/** The index list, with cursor pagination. A new search remounts it from the server's first page. */
export const ArticleList = ({ first, query, empty }: ArticleListProps) => {
  const [{ articles, nextCursor }, setPage] = useState(first)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')

  const loadMore = async () => {
    if (!nextCursor) return
    setStatus('loading')
    try {
      const page = await listArticles({ ...query, cursor: nextCursor, limit: 24 })
      setPage((current) => ({ articles: [...current.articles, ...page.articles], nextCursor: page.nextCursor }))
      setStatus('idle')
    } catch (error) {
      console.error(error)
      setStatus('error')
    }
  }

  if (!articles.length) {
    return (
      <EmptyBox title={empty.title} className="mt-5">
        {empty.note}
      </EmptyBox>
    )
  }

  return (
    <>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {articles.map((article) => (
          <ArticleCard key={article.id} article={article} />
        ))}
      </ul>

      <div className="mt-5 flex flex-wrap items-center gap-3.5">
        {nextCursor ? (
          <button
            type="button"
            onClick={loadMore}
            disabled={status === 'loading'}
            className={buttonClasses({ variant: 'ghost', size: 'sm' })}
          >
            {status === 'loading' ? 'Loading…' : 'Load more'}
          </button>
        ) : null}
        <p className="text-ink-muted signal-sm">{articles.length} shown</p>
        {status === 'error' ? (
          <p role="alert" className="text-negative body-sm">
            Couldn&apos;t load more articles. Try again.
          </p>
        ) : null}
      </div>
    </>
  )
}
