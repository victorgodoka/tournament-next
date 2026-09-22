import Link from 'next/link'
import { headers } from 'next/headers'
import { twMerge } from 'tailwind-merge'
import { WIKI_PAD, WikiBar } from '@omega/wiki'
import { Eyebrow } from '@ui/eyebrow/eyebrow'
import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { buttonClasses } from '@ui/button'
import { can, listArticles } from '@utils/articles'
import { getMeServer } from '@utils/auth'
import { pageMetadata } from '@utils/metadata'
import { ArticleList } from './ArticleList'

export const metadata = pageMetadata({
  title: 'Omega Wiki',
  path: '/wiki',
  description:
    'Formats, banlists, rulings and client guides for YGO Omega, written and kept current by Duelists Unite editors.',
})

type WikiRouteProps = { searchParams: Promise<{ q?: string; mine?: string }> }

const TOOL_LINK = 'whitespace-nowrap text-gold signal hover:text-cyan'

const WikiPage = async ({ searchParams }: WikiRouteProps) => {
  const [{ q, mine }, cookie] = await Promise.all([searchParams, headers().then((list) => list.get('cookie'))])

  // The session decides whether drafts come back at all, so it is read before the index.
  const me = await getMeServer(cookie).catch(() => null)
  const isEditor = can(me, 'wiki.write')
  const author = mine && me ? me.id : undefined

  const index = await listArticles({ search: q, author, limit: 20 }, cookie).catch((error) => {
    console.error(error)
    return { articles: [], nextCursor: null }
  })

  return (
    <>
      <Header />
      <main className="flex min-h-dvh flex-col overflow-x-hidden bg-surface-000 pt-16">
        <WikiBar
          section="Articles"
          placeholder="Search cards by name or part of one"
          link={{ label: 'Cards', to: '/wiki/card/72270339' }}
        />

        <div className={twMerge('py-[clamp(28px,4vw,44px)]', WIKI_PAD)}>
          <Eyebrow meta={isEditor ? 'Drafts visible to you' : 'Written by Duelists Unite editors'}>Reference</Eyebrow>
          <h1 className="mt-4 text-ink display-1">Omega Wiki</h1>
          <p className="mt-3.5 max-w-[62ch] text-ink-dim lead">
            Formats, banlists, rulings and the client itself, explained by the people who script them. Card pages come
            straight from the card database and live under <Link href="/wiki/card/72270339" className="text-gold hover:text-cyan">Cards</Link>.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3.5">
            {/* A plain GET form: the index is server-rendered, so search works without JavaScript. */}
            <form method="get" action="/wiki" className="flex min-w-0 flex-[1_1_18rem] gap-2">
              <label htmlFor="wiki-search" className="sr-only">
                Search articles by title
              </label>
              <input
                id="wiki-search"
                type="search"
                name="q"
                defaultValue={q ?? ''}
                maxLength={100}
                placeholder="Search articles by title"
                className="min-w-0 flex-1 border border-surface-400 bg-surface-200 px-2.75 py-2.25 text-ink caption placeholder:text-ink-muted hover:border-ink-muted focus-visible:border-cyan"
              />
              {mine ? <input type="hidden" name="mine" value="1" /> : null}
              <button type="submit" className={buttonClasses({ variant: 'ghost', size: 'mono' })}>
                Search
              </button>
            </form>

            {isEditor ? (
              <>
                <Link href={mine ? '/wiki' : '/wiki?mine=1'} className={TOOL_LINK}>
                  {mine ? 'All articles' : 'My articles'}
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

          <div className="mt-7">
            <ArticleList
              key={`${q ?? ''}|${author ?? ''}`}
              first={index}
              query={{ search: q, author }}
              empty={
                q
                  ? { title: 'Nothing matches that title', note: 'Search reads titles only. Try a shorter word.' }
                  : author
                    ? { title: 'You haven’t written anything yet', note: 'Start one with “New article”. It is born a draft, so nobody sees it until you publish.' }
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
