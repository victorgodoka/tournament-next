import Link from 'next/link'
import { headers } from 'next/headers'
import { twMerge } from 'tailwind-merge'
import { WIKI_PAD, WikiBar } from '@omega/wiki'
import { userName } from '@omega/wiki/article'
import { Eyebrow } from '@ui/eyebrow/eyebrow'
import { AdBanner } from '@omega/ads/ad-banner'
import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { buttonClasses } from '@ui/button'
import { can, listArticles, listAuthors, type ArticleQuery } from '@utils/articles'
import { getMeServer } from '@utils/auth'
import { pageMetadata } from '@utils/metadata'
import { ArticleList } from './ArticleList'

export const metadata = pageMetadata({
  title: 'Omega Wiki',
  path: '/wiki',
  description:
    'Formats, banlists, rulings and client guides for YGO Omega, written and kept current by Duelists Unite editors.',
})

type Params = { q?: string; author?: string; status?: string; sort?: string; from?: string; to?: string }
type WikiRouteProps = { searchParams: Promise<Params> }

const TOOL_LINK = 'whitespace-nowrap text-cyan signal underline-offset-4 hover:text-ink hover:underline'
const FIELD = 'flex min-w-0 flex-col gap-1.5 text-ink-muted signal-sm'
const CONTROL =
  'min-w-0 border border-surface-400 bg-surface-200 px-2.75 py-2.25 text-ink caption placeholder:text-ink-muted hover:border-ink-muted focus-visible:border-cyan'

const SORTS = {
  'published-desc': 'Published · newest',
  'published-asc': 'Published · oldest',
  'updated-desc': 'Last edited · newest',
  'updated-asc': 'Last edited · oldest',
} as const
type SortKey = keyof typeof SORTS

/** The URL is user input: anything the API would 400 on is dropped here instead. */
const dateOr = (value?: string) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined)

const WikiPage = async ({ searchParams }: WikiRouteProps) => {
  const [params, cookie] = await Promise.all([searchParams, headers().then((list) => list.get('cookie'))])

  // Authors only need the cookie, so they load alongside the session instead of after it.
  const authorsLoad = listAuthors(cookie).catch(() => [])
  // The session decides whether drafts come back at all, so it is read before the index.
  // The index is public: if the session can't be read, it renders for a reader instead of failing.
  const me = await getMeServer(cookie).catch((error) => {
    console.error(error)
    return null
  })
  const isEditor = can(me, 'wiki.write')
  const isAdmin = can(me, 'user.manage')

  const sortKey: SortKey = params.sort && params.sort in SORTS ? (params.sort as SortKey) : 'published-desc'
  const [sort, order] = sortKey.split('-') as ['published' | 'updated', 'asc' | 'desc']
  const query: ArticleQuery = {
    search: params.q?.trim() || undefined,
    author: params.author && /^\d{1,20}$/.test(params.author) ? params.author : undefined,
    status: isEditor && (params.status === 'draft' || params.status === 'published') ? params.status : undefined,
    sort,
    order,
    from: dateOr(params.from),
    to: dateOr(params.to),
  }
  const filtered = !!(query.search || query.author || query.status || query.from || query.to)
  /** Everything behind the Filters disclosure. A non-zero count keeps it open, so an active filter is never hidden. */
  const refinements = [query.author, query.status, query.from, query.to, sortKey !== 'published-desc'].filter(Boolean).length

  const [index, authors] = await Promise.all([
    listArticles({ ...query, limit: 24 }, cookie).catch((error) => {
      console.error(error)
      return null
    }),
    authorsLoad,
  ])

  return (
    <>
      <Header />
      <main className="flex min-h-dvh flex-col overflow-x-clip bg-space-000 pt-16">
        <WikiBar
          section="Articles"
          placeholder="Search cards by name or part of one"
          link={{ label: 'Cards', to: '/wiki/card/72270339' }}
        />

        <header
          className={twMerge(
            'grid gap-6 border-b border-line py-[clamp(28px,4vw,48px)] lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end',
            WIKI_PAD,
          )}
        >
          <div className="min-w-0">
            <Eyebrow>Reference</Eyebrow>
            <h1 className="mt-4 text-ink display-1">Omega Wiki</h1>
            <p className="mt-3.5 max-w-[58ch] text-ink-dim lead">
              Formats, banlists, rulings and the client itself, explained by the people who script them.
            </p>
          </div>

          {isEditor || isAdmin ? (
            <nav aria-label="Editor tools" className="flex flex-wrap items-center gap-x-5 gap-y-3 lg:justify-end">
              {isAdmin ? (
                <Link href="/wiki/panel" className={TOOL_LINK}>
                  Editors panel
                </Link>
              ) : null}
              {isEditor && me ? (
                <>
                  <Link href={`/wiki?author=${me.id}`} className={TOOL_LINK}>
                    My articles
                  </Link>
                  <Link href="/wiki/new" className={buttonClasses({ variant: 'primary', size: 'sm' })}>
                    New article
                  </Link>
                </>
              ) : null}
            </nav>
          ) : null}
        </header>

        {/* A plain GET form: the index is server-rendered, so search and filters work without JavaScript. */}
        <form method="get" action="/wiki" className={twMerge('border-b border-line py-5', WIKI_PAD)}>
          <div className="flex max-w-3xl gap-2">
            <label htmlFor="wiki-search" className="sr-only">
              Search articles by title
            </label>
            <input
              id="wiki-search"
              type="search"
              name="q"
              defaultValue={query.search ?? ''}
              maxLength={100}
              placeholder="Search articles by title"
              className={twMerge(CONTROL, 'flex-1 body')}
            />
            <button type="submit" className={buttonClasses({ variant: 'primary', size: 'mono' })}>
              Search
            </button>
          </div>

          <details open={refinements > 0} className="group mt-3.5">
            <summary className="inline-flex cursor-pointer list-none items-center gap-2 text-ink-dim signal-sm hover:text-ink [&::-webkit-details-marker]:hidden">
              <span aria-hidden className="inline-block transition-transform group-open:rotate-90 motion-reduce:transition-none">
                ›
              </span>
              Filters and order
              {refinements ? <span className="text-cyan">({refinements} active)</span> : null}
            </summary>

            <div className="mt-3.5 grid grid-cols-2 gap-3 md:flex md:flex-wrap md:items-end">
              <label className={FIELD}>
                Author
                <select name="author" defaultValue={query.author ?? ''} className={CONTROL}>
                  <option value="">Anyone</option>
                  {authors.map((author) => (
                    <option key={author.id} value={author.id}>
                      {userName(author)}
                    </option>
                  ))}
                </select>
              </label>

              {isEditor ? (
                <label className={FIELD}>
                  Status
                  <select name="status" defaultValue={query.status ?? ''} className={CONTROL}>
                    <option value="">All</option>
                    <option value="published">Published</option>
                    <option value="draft">Drafts</option>
                  </select>
                </label>
              ) : null}

              <label className={FIELD}>
                Order
                <select name="sort" defaultValue={sortKey} className={CONTROL}>
                  {Object.entries(SORTS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className={FIELD}>
                From
                <input type="date" name="from" defaultValue={query.from ?? ''} className={CONTROL} />
              </label>
              <label className={FIELD}>
                To
                <input type="date" name="to" defaultValue={query.to ?? ''} className={CONTROL} />
              </label>

              <button type="submit" className={twMerge(buttonClasses({ variant: 'ghost', size: 'mono' }), 'col-span-2 md:col-span-1')}>
                Apply
              </button>
            </div>
            <p className="mt-2 text-ink-muted signal-sm">
              Dates filter by {sort === 'updated' ? 'last edit' : 'publication'}, matching the order.
            </p>
          </details>
        </form>

        <AdBanner id="ad-top" placement="content" className={twMerge('pt-8', WIKI_PAD)} />

        <section aria-labelledby="articles-head" className={twMerge('py-[clamp(28px,4vw,44px)]', WIKI_PAD)}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-5 gap-y-2">
            <h2 id="articles-head" className="text-ink display-6">
              {query.search ? `Titles matching “${query.search}”` : filtered ? 'Filtered articles' : 'Latest articles'}
            </h2>
            <span className="flex items-baseline gap-5">
              {isEditor ? <span className="text-ink-muted signal-sm">Drafts are shown to you</span> : null}
              {filtered || sortKey !== 'published-desc' ? (
                <Link href="/wiki" className={TOOL_LINK}>
                  Clear filters
                </Link>
              ) : null}
            </span>
          </div>

          <div className="mt-5">
            <ArticleList
              key={JSON.stringify(query)}
              first={index ?? { articles: [], nextCursor: null }}
              query={query}
              empty={
                !index
                  ? { title: "Couldn't load the articles", note: 'The wiki API did not answer. Reload the page in a moment.' }
                  : filtered
                  ? { title: 'Nothing matches these filters', note: 'Search reads titles only. Try a shorter word or widen the dates.' }
                  : { title: 'No articles yet', note: isEditor ? 'Start with New article above.' : 'Editors are writing the first ones.' }
              }
            />
          </div>

          <p className="mt-10 max-w-[62ch] text-ink-muted body-sm">
            Looking for a card? Card pages come straight from the card database: use the card search at the top, or{' '}
            <Link href="/wiki/card/72270339" className="text-cyan underline-offset-4 hover:text-ink hover:underline">
              open an example card
            </Link>
            .
          </p>
        </section>

        <AdBanner id="ad-bottom" placement="content" className={twMerge('pb-12', WIKI_PAD)} />
      </main>
      <Footer />
    </>
  )
}

export default WikiPage
