import Link from 'next/link'
import { headers } from 'next/headers'
import { twMerge } from 'tailwind-merge'
import { WIKI_PAD, WikiBar } from '@omega/wiki'
import { userName } from '@omega/wiki/article'
import { Eyebrow } from '@ui/eyebrow/eyebrow'
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

const TOOL_LINK = 'whitespace-nowrap text-gold signal hover:text-cyan'
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
  const me = await getMeServer(cookie).catch(() => null)
  const isEditor = can(me, 'wiki.write')

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

  const [index, authors] = await Promise.all([
    listArticles({ ...query, limit: 24 }, cookie).catch((error) => {
      console.error(error)
      return { articles: [], nextCursor: null }
    }),
    authorsLoad,
  ])

  return (
    <>
      <Header />
      <main className="flex min-h-dvh flex-col overflow-x-clip bg-surface-000 pt-16">
        <WikiBar
          section="Articles"
          placeholder="Search cards by name or part of one"
          link={{ label: 'Cards', to: '/wiki/card/72270339' }}
        />

        {/* A plain GET form: the index is server-rendered, so search and filters work without JavaScript. */}
        <form method="get" action="/wiki" className={twMerge('border-b border-line py-5', WIKI_PAD)}>
          <div className="flex gap-2">
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

            <div className="col-span-2 flex items-center gap-4 md:col-span-1">
              <button type="submit" className={buttonClasses({ variant: 'ghost', size: 'mono' })}>
                Apply
              </button>
              {filtered || sortKey !== 'published-desc' ? (
                <Link href="/wiki" className={TOOL_LINK}>
                  Clear
                </Link>
              ) : null}
            </div>
          </div>
          <p className="mt-2 text-ink-muted signal-sm">
            Dates filter by {sort === 'updated' ? 'last edit' : 'publication'}, matching the order.
          </p>
        </form>

        <div className={twMerge('py-[clamp(28px,4vw,44px)]', WIKI_PAD)}>
          <Eyebrow meta={isEditor ? 'Drafts visible to you' : 'Written by Duelists Unite editors'}>Reference</Eyebrow>
          <h1 className="mt-4 text-ink display-1">Omega Wiki</h1>
          <p className="mt-3.5 max-w-[62ch] text-ink-dim lead">
            Formats, banlists, rulings and the client itself, explained by the people who script them. Card pages come
            straight from the card database and live under <Link href="/wiki/card/72270339" className="text-gold hover:text-cyan">Cards</Link>.
          </p>

          {isEditor || can(me, 'user.manage') ? (
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3.5">
              {isEditor && me ? (
                <>
                  <Link href={`/wiki?author=${me.id}`} className={TOOL_LINK}>
                    My articles
                  </Link>
                  <Link href="/wiki/new" className={buttonClasses({ variant: 'primary', size: 'mono' })}>
                    New article
                  </Link>
                </>
              ) : null}
              {can(me, 'user.manage') ? (
                <Link href="/wiki/panel" className={TOOL_LINK}>
                  Editors panel
                </Link>
              ) : null}
            </div>
          ) : null}

          <div className="mt-7">
            <ArticleList
              key={JSON.stringify(query)}
              first={index}
              query={query}
              empty={
                filtered
                  ? { title: 'Nothing matches these filters', note: 'Search reads titles only. Try a shorter word or widen the dates.' }
                  : { title: 'No articles yet', note: 'The wiki is empty. Editors can write the first one.' }
              }
            />
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}

export default WikiPage
