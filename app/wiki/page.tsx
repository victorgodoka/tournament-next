import Link from 'next/link'
import { headers } from 'next/headers'
import { twMerge } from 'tailwind-merge'
import { AdBanner } from '@omega/ads/ad-banner'
import { WIKI_CHIP, WIKI_SCROLL_ROW } from '@omega/wiki'
import { userName } from '@omega/wiki/article'
import { WikiSearch } from '@omega/wiki/wiki-search'
import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { buttonClasses } from '@ui/button'
import { can, listAllArticles, listArticles, listAuthors, type ArticleQuery } from '@utils/articles'
import { getMeServer } from '@utils/auth'
import { log } from '@utils/log'
import { pageMetadata } from '@utils/metadata'
import { isWikiTopic, TOPIC_IDS, topicOf, WIKI_TOPICS } from '@utils/wiki-topics'
import { ArticleList, type ListOption } from './ArticleList'
import { hasMetaSection, IndexAside, MetaSection, StartHere, TopicsSection } from './sections'

export const metadata = pageMetadata({
  title: 'Omega Wiki',
  path: '/wiki',
  description:
    'Formats, banlists, rulings and client guides for YGO Omega, written and kept current by Duelists Unite editors.',
})

type Params = { q?: string; author?: string; status?: string; sort?: string; from?: string; to?: string; topic?: string }
type WikiRouteProps = { searchParams: Promise<Params> }

const TOOL_LINK = 'whitespace-nowrap text-cyan signal underline-offset-4 hover:text-ink hover:underline'
const FIELD = 'flex min-w-0 flex-col gap-1.5 text-ink-muted signal'
const CONTROL = 'cut flex min-h-11 items-center px-3 text-sm text-ink [--edge:var(--color-line-strong)] [--fill:var(--color-surface-200)]'
const INPUT = 'w-full bg-transparent outline-none [color-scheme:dark]'
const AD_BAND = 'mx-auto w-full max-w-page px-gutter'

/** `most-read` isn't an API sort (it answers 400): the page orders the whole list by views itself. */
const SORTS = {
  'published-desc': 'Newest first',
  'published-asc': 'Oldest first',
  'most-read': 'Most read first',
  'updated-desc': 'Last edited, newest first',
  'updated-asc': 'Last edited, oldest first',
} as const
type SortKey = keyof typeof SORTS

/** A reader's orders. The edit dates are an editor's, in Filters. */
const READER_SORTS: SortKey[] = ['published-desc', 'published-asc', 'most-read']

/** Search reads titles and summaries, so these go there. The turn timer is only in the FAQ's text. */
const POPULAR = [
  { label: 'Install', to: '/wiki?q=install#articles' },
  { label: 'Discord', to: '/wiki?q=discord#articles' },
  { label: 'Turn timer', to: '/wiki/ygo-omega-faq#gameplay-and-settings' },
  { label: 'Genesys', to: '/wiki?q=genesys#articles' },
  { label: 'Manual mode', to: '/wiki?q=manual%20mode#articles' },
]

/** The URL is user input: anything the API would 400 on is dropped here instead. */
const dateOr = (value?: string) => (value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined)

const WikiPage = async ({ searchParams }: WikiRouteProps) => {
  const [params, cookie] = await Promise.all([searchParams, headers().then((list) => list.get('cookie'))])

  // Authors only need the cookie, so they load alongside the session instead of after it.
  const authorsLoad = listAuthors(cookie).catch(() => [])
  // The session decides whether drafts come back at all, so it is read before the index.
  // The index is public: if the session can't be read, it renders for a reader instead of failing.
  const me = await getMeServer(cookie).catch((error) => {
    log('error', 'API_ERROR', { call: 'GET /auth/me', page: '/wiki', err: error })
    return null
  })
  const isEditor = can(me, 'wiki.write')
  const isAdmin = can(me, 'user.manage')

  const sortKey: SortKey = params.sort && params.sort in SORTS ? (params.sort as SortKey) : 'published-desc'
  const [sort, order] = (sortKey === 'most-read' ? ['published', 'desc'] : sortKey.split('-')) as ['published' | 'updated', 'asc' | 'desc']
  const topic = isWikiTopic(params.topic) ? params.topic : undefined
  const query: ArticleQuery = {
    search: params.q?.trim() || undefined,
    author: params.author && /^\d{1,20}$/.test(params.author) ? params.author : undefined,
    status: isEditor && (params.status === 'draft' || params.status === 'published') ? params.status : undefined,
    sort,
    order,
    from: dateOr(params.from),
    to: dateOr(params.to),
  }
  const filtered = !!(query.search || query.author || query.status || query.from || query.to || topic)
  /** Everything behind the Filters disclosure. A non-zero count keeps it open, so an active filter is never hidden. */
  const refinements = [query.author, query.status, query.from, query.to, sort === 'updated'].filter(Boolean).length
  /** Neither a topic nor views exist in the API: both need the whole list here, so they don't paginate. */
  const whole = !!topic || sortKey === 'most-read'

  // Topic counts and local sorting need every cursor page, not just the API's first 100 rows.
  const [index, page, authors] = await Promise.all([
    listAllArticles({}, cookie).catch((error) => {
      log('error', 'API_ERROR', { call: 'GET /wiki', page: '/wiki', err: error })
      return null
    }),
    (whole ? listAllArticles(query, cookie) : listArticles({ ...query, limit: 24 }, cookie)).catch((error) => {
      log('error', 'API_ERROR', { call: 'GET /wiki', page: '/wiki', query, err: error })
      return null
    }),
    authorsLoad,
  ])
  const published = (index?.articles ?? []).filter((article) => article.publishedAt)
  const listed = (page?.articles ?? []).filter((article) => !topic || topicOf(article) === topic)
  const first = {
    articles: sortKey === 'most-read' ? listed.toSorted((a, b) => (b.views ?? 0) - (a.views ?? 0)) : listed,
    nextCursor: whole ? null : (page?.nextCursor ?? null),
  }

  /** The index with these filters changed, the rest as they are. */
  const indexHref = (patch: Partial<Params>) => {
    const { q, author, status, sort: sortParam, from, to } = params
    const search = new URLSearchParams()
    for (const [name, value] of Object.entries({ q, author, status, sort: sortParam, from, to, topic, ...patch })) {
      if (value) search.set(name, value)
    }
    return `/wiki${search.size ? `?${search}` : ''}#articles`
  }

  // Counts per topic are section 01's: chips carrying them too pushed the sort onto a second row.
  const topics: ListOption[] = [
    { label: 'All', to: indexHref({ topic: undefined }), on: !topic },
    ...TOPIC_IDS.map((id) => ({ label: WIKI_TOPICS[id].chip, to: indexHref({ topic: id }), on: topic === id })),
  ]
  const sorts: ListOption[] = READER_SORTS.map((key) => ({
    label: SORTS[key],
    to: indexHref({ sort: key === 'published-desc' ? undefined : key }),
    on: sortKey === key,
  }))

  const filters = (
    // A plain GET form: the index is server-rendered, so filters work as links do.
    <form method="get" action="/wiki#articles" className="cut flex flex-wrap items-end gap-4 px-5 py-4">
      {query.search ? <input type="hidden" name="q" value={query.search} /> : null}
      {topic ? <input type="hidden" name="topic" value={topic} /> : null}
      {isEditor ? null : <input type="hidden" name="sort" value={sortKey} />}

      <label className={FIELD}>
        Author
        <span className={twMerge(CONTROL, 'min-w-45')}>
          <select name="author" defaultValue={query.author ?? ''} className={INPUT}>
            <option value="">Anyone</option>
            {authors.map((author) => (
              <option key={author.id} value={author.id}>
                {userName(author)}
              </option>
            ))}
          </select>
        </span>
      </label>

      {isEditor ? (
        <>
          <label className={FIELD}>
            Status
            <span className={CONTROL}>
              <select name="status" defaultValue={query.status ?? ''} className={INPUT}>
                <option value="">All</option>
                <option value="published">Published</option>
                <option value="draft">Drafts</option>
              </select>
            </span>
          </label>
          <label className={FIELD}>
            Order
            <span className={CONTROL}>
              <select name="sort" defaultValue={sortKey} className={INPUT}>
                {Object.entries(SORTS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </span>
          </label>
        </>
      ) : null}

      <label className={FIELD}>
        {sort === 'updated' ? 'Edited from' : 'Published from'}
        <span className={CONTROL}>
          <input type="date" name="from" defaultValue={query.from ?? ''} className={INPUT} />
        </span>
      </label>
      <label className={FIELD}>
        To
        <span className={CONTROL}>
          <input type="date" name="to" defaultValue={query.to ?? ''} className={INPUT} />
        </span>
      </label>

      <button type="submit" className={buttonClasses({ variant: 'secondary', size: 'signal' })}>
        Apply
      </button>
      {filtered || sortKey !== 'published-desc' ? (
        <Link href="/wiki#articles" className="inline-flex min-h-11 items-center signal-strong hover:text-ink">
          Clear
        </Link>
      ) : null}
    </form>
  )

  return (
    <>
      <Header />
      <main className="wiki-ground flex min-h-dvh flex-col overflow-x-clip pt-15">
        <section className="dots border-b border-line">
          <div className="mx-auto flex w-full max-w-page flex-wrap items-stretch gap-12 px-gutter pt-10 pb-8 sm:pt-16 sm:pb-14">
            <div className="flex min-w-0 flex-[999_1_560px] flex-col gap-4.5 sm:gap-6">
              <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
                <div className="flex items-center gap-2 sm:gap-2.5">
                  <span aria-hidden className="size-2 bg-gold" />
                  <span className="text-ink-muted signal">Omega Wiki · Reference</span>
                </div>
                {isEditor || isAdmin ? (
                  <nav aria-label="Editor tools" className="ml-auto flex flex-wrap items-center gap-x-5 gap-y-3">
                    {isAdmin ? (
                      <Link href="/wiki/panel" className={TOOL_LINK}>
                        Editors panel
                      </Link>
                    ) : null}
                    {isEditor && me ? (
                      <>
                        <Link href={`/wiki?author=${me.id}#articles`} className={TOOL_LINK}>
                          My articles
                        </Link>
                        <Link href="/wiki/new" className={buttonClasses({ variant: 'primary', size: 'sm' })}>
                          New article
                        </Link>
                      </>
                    ) : null}
                  </nav>
                ) : null}
              </div>

              <h1 className="text-4xl/none text-ink display-hero sm:text-[56px]">Omega Wiki</h1>
              <p className="max-w-140 text-base/[26px] text-ink-dim sm:text-lg/7">
                Formats, banlists, rulings and the client itself, explained by the people who script them.
              </p>

              <div className="mt-1 flex w-full max-w-170 flex-col gap-2.5 sm:mt-2 sm:gap-3">
                <WikiSearch defaultQuery={query.search} keep={{ topic, sort: params.sort, author: query.author, status: query.status, from: query.from, to: query.to }} />
                <div className={twMerge('flex items-center gap-2', WIKI_SCROLL_ROW)}>
                  <span className="mr-1 shrink-0 text-ink-muted signal-sm">Popular</span>
                  {POPULAR.map(({ label, to }) => (
                    <Link key={to} href={to} className={twMerge(WIKI_CHIP, 'min-h-10 sm:min-h-8')}>
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>

            <StartHere className="flex-[1_1_340px] max-sm:hidden" />
          </div>
        </section>

        <div className="px-gutter pt-6 sm:hidden">
          <StartHere />
        </div>

        <AdBanner id="ad-top" placement="content" className={twMerge(AD_BAND, 'pt-10 sm:pt-14')} />

        {published.length ? <TopicsSection articles={published} /> : null}
        <MetaSection articles={published} />

        <ArticleList
          key={JSON.stringify({ query, topic, sortKey })}
          first={first}
          query={query}
          num={hasMetaSection(published) ? '03' : '02'}
          heading={query.search ? `Titles matching “${query.search}”` : 'All articles'}
          total={whole ? listed.length : filtered || isEditor ? undefined : index ? published.length : undefined}
          topics={topics}
          sorts={sorts}
          filters={filters}
          filtersOpen={refinements > 0}
          note={isEditor ? <p className="text-ink-muted signal-sm">Drafts are shown to you</p> : null}
          aside={<IndexAside articles={published} />}
          empty={
            !page
              ? { title: "Couldn't load the articles", note: 'The wiki API did not answer. Reload the page in a moment.' }
              : filtered
                ? { title: 'No articles match', note: 'Try a shorter search, or clear the topic filter.', clear: true }
                : { title: 'No articles yet', note: isEditor ? 'Start with New article above.' : 'Editors are writing the first ones.' }
          }
        />

        <AdBanner id="ad-bottom" placement="content" className={twMerge(AD_BAND, 'pt-10 sm:pt-0 sm:pb-18')} />
      </main>
      <Footer className="mt-10 sm:mt-0" />
    </>
  )
}

export default WikiPage
