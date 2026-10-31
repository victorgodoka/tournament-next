'use client'

import { Fragment, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { twMerge } from 'tailwind-merge'
import { AdBanner } from '@omega/ads/ad-banner'
import { WIKI_CHIP, WIKI_CHIP_ON, WIKI_SCROLL_ROW, WikiHead } from '@omega/wiki'
import { ARTICLE_LIST, ArticleRow } from '@omega/wiki/article'
import { buttonClasses } from '@ui/button'
import { Icon } from '@ui/icon'
import { listArticles, type ArticleQuery } from '@utils/articles'
import type { ArticleIndex } from '@utils/types'
import { adAfter } from './ad-breaks'

export type ListOption = {
  label: string
  to: string
  on: boolean
  count?: number
  /** A sort's name where it stands alone: the phone's select. */
  full?: string
}

type ArticleListProps = {
  first: ArticleIndex
  /** The filters the server used, replayed on every "load more" so a cursor walk stays consistent. */
  query: ArticleQuery
  /** Copy for the empty state, which differs between a search, "my articles" and an empty wiki. */
  empty: { title: string; note: string; clear?: boolean }
  num: string
  heading: string
  /** Everything readable, for "Showing x of y". */
  total: number
  sortLabel: string
  topics: ListOption[]
  sorts: ListOption[]
  /** The Filters form, and whether an active filter keeps it open. */
  filters: React.ReactNode
  filtersOpen: boolean
  /** A line beside the toolbar: what an editor needs to know about the list. */
  note?: React.ReactNode
  aside: React.ReactNode
}

/** A phone's sort: the three chips don't fit beside Filters. */
const SortSelect = ({ sorts }: { sorts: ListOption[] }) => {
  const router = useRouter()
  return (
    <label className={twMerge(WIKI_CHIP, 'relative min-h-10 min-w-0 flex-1 text-ink [--edge:var(--color-line-strong)] sm:hidden')}>
      <span className="sr-only">Order</span>
      <select
        value={sorts.find((sort) => sort.on)?.to}
        onChange={(event) => router.push(event.target.value)}
        className="w-full appearance-none bg-transparent pr-6 uppercase outline-none"
      >
        {sorts.map(({ label, full, to }) => (
          <option key={to} value={to} className="bg-surface-100">
            {full ?? label}
          </option>
        ))}
      </select>
      <Icon name="down" size={16} className="pointer-events-none absolute right-3" />
    </label>
  )
}

/** The index list, with cursor pagination. A new search remounts it from the server's first page. */
export const ArticleList = ({ first, query, empty, num, heading, total, sortLabel, topics, sorts, filters, filtersOpen, note, aside }: ArticleListProps) => {
  const [{ articles, nextCursor }, setPage] = useState(first)
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [showFilters, setShowFilters] = useState(filtersOpen)

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

  return (
    <section id="articles" aria-labelledby="articles-head" className="mx-auto flex w-full max-w-page scroll-mt-20 flex-col gap-3.5 px-gutter pt-10 sm:gap-6 sm:pt-14 sm:pb-18">
      <WikiHead num={num} id="articles-head" end={`Showing ${articles.length} of ${Math.max(total, articles.length)} · ${sortLabel}`}>
        {heading}
      </WikiHead>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="flex min-w-0 flex-col gap-3.5 sm:gap-4">
          <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
            <nav aria-label="Topic" className={twMerge('flex max-w-[100vw] gap-2', WIKI_SCROLL_ROW)}>
              {topics.map(({ label, to, on, count }) => (
                <Link key={to} href={to} aria-current={on ? 'true' : undefined} className={twMerge(WIKI_CHIP, 'max-sm:min-h-10', on && WIKI_CHIP_ON)}>
                  {label}
                  <span className="opacity-70">{count}</span>
                </Link>
              ))}
            </nav>

            <div className="flex w-full items-center gap-2.5 sm:ml-auto sm:w-auto sm:gap-3">
              <nav aria-label="Order" className="flex max-sm:hidden">
                {sorts.map(({ label, to, on }, i) => (
                  <Link key={to} href={to} aria-current={on ? 'true' : undefined} className={twMerge(WIKI_CHIP, i && '-ml-px', on && WIKI_CHIP_ON)}>
                    {label}
                  </Link>
                ))}
              </nav>
              <SortSelect sorts={sorts} />
              <button
                type="button"
                aria-expanded={showFilters}
                onClick={() => setShowFilters((open) => !open)}
                className={twMerge(WIKI_CHIP, 'text-ink [--edge:var(--color-line-strong)] max-sm:min-h-10')}
              >
                <Icon name="filter" size={16} />
                Filters
              </button>
            </div>
          </div>

          {showFilters ? filters : null}
          {note}

          {articles.length ? (
            <>
              <ul className={ARTICLE_LIST}>
                {articles.map((article, i) => {
                  const ad = adAfter(i, articles.length)
                  return (
                    <Fragment key={article.id}>
                      <ArticleRow article={article} />
                      {ad ? (
                        <li className="bg-space-000">
                          <AdBanner id={`ad-list-${ad}`} placement="content" className="py-2" />
                        </li>
                      ) : null}
                    </Fragment>
                  )
                })}
              </ul>

              {nextCursor || status === 'error' ? (
                <div className="flex flex-wrap items-center gap-3.5">
                  {nextCursor ? (
                    <button type="button" onClick={loadMore} disabled={status === 'loading'} className={buttonClasses({ variant: 'secondary', size: 'signal' })}>
                      {status === 'loading' ? 'Loading…' : 'Load more'}
                    </button>
                  ) : null}
                  {status === 'error' ? (
                    <p role="alert" className="text-loss body-sm">
                      Couldn&apos;t load more articles. Try again.
                    </p>
                  ) : null}
                </div>
              ) : null}
            </>
          ) : (
            <div className="dots cut flex flex-col items-center gap-3 px-6 py-10 text-center">
              <span className="text-ink display-3">{empty.title}</span>
              <p className="text-ink-dim body-sm">{empty.note}</p>
              {empty.clear ? (
                <Link href="/wiki#articles" className={buttonClasses({ variant: 'secondary', size: 'signal' })}>
                  Show all articles
                </Link>
              ) : null}
            </div>
          )}
        </div>

        {aside}
      </div>
    </section>
  )
}
