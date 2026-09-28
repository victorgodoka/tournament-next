import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound, permanentRedirect } from 'next/navigation'
import { twMerge } from 'tailwind-merge'
import { LocalTime } from '@omega/profile/local-time'
import { WIKI_PAD, WikiBar } from '@omega/wiki'
import { ARTICLE_DATE_TIME, ArticleBody, Byline } from '@omega/wiki/article'
import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { getArticle, getRevision, getRevisions } from '@utils/articles'
import { noIndexMetadata } from '@utils/metadata'
import { WikiBlocks } from '@omega/wiki/blocks'
import { renderArticle } from '@utils/remark'
import { renderDocHtml } from '@utils/wiki-doc'
import { RestoreButton } from './RestoreButton'

type HistoryRouteProps = {
  params: Promise<{ slug: string }>
  searchParams: Promise<{ rev?: string }>
}

export async function generateMetadata({ params }: HistoryRouteProps) {
  const { slug } = await params
  return noIndexMetadata(`History of ${slug}`, `/wiki/${slug}/history`)
}

/**
 * Every save leaves a revision holding the content **as it ended up**, so the newest one mirrors
 * the article. Newest first, at most 50, no pagination.
 */
const HistoryPage = async ({ params, searchParams }: HistoryRouteProps) => {
  const [{ slug }, { rev }, cookie] = await Promise.all([
    params,
    searchParams,
    headers().then((list) => list.get('cookie')),
  ])

  const [article, revisions] = await Promise.all([getArticle(slug, cookie), getRevisions(slug, cookie).catch(() => [])])
  if (!article) notFound()
  // Revisions only answer on the current address.
  if (article.slug !== slug) permanentRedirect(`/wiki/${article.slug}/history${rev ? `?rev=${encodeURIComponent(rev)}` : ''}`)

  // A revision id that belongs to another article answers 404, so an unknown `rev` just shows nothing.
  const revision = rev ? await getRevision(slug, rev, cookie) : null
  // A block revision's `body` is only the plain-text projection; `doc` is the page.
  const html = revision && !revision.doc ? await renderArticle(revision.body) : null
  const docHtml = revision?.doc ? await renderDocHtml(revision.doc) : null

  return (
    <>
      <Header />
      <main className="flex min-h-dvh flex-col overflow-x-clip bg-space-000 pt-16">
        <WikiBar
          section="Articles"
          placeholder="Search cards by name or part of one"
          link={{ label: 'All articles', to: '/wiki' }}
        />

        <div className={twMerge('py-[clamp(24px,3vw,40px)]', WIKI_PAD)}>
          <nav aria-label="Breadcrumb" className="text-ink-muted signal-sm">
            <Link href="/wiki" className="text-ink-muted hover:text-cyan">
              Omega Wiki
            </Link>{' '}
            /{' '}
            <Link href={`/wiki/${article.slug}`} className="text-ink-muted hover:text-cyan">
              {article.slug}
            </Link>{' '}
            / history
          </nav>

          <h1 className="mt-4 text-ink display-2">{article.title}</h1>
          <p className="mt-3 max-w-[62ch] text-ink-dim body">
            {revisions.length
              ? 'Every save is kept, newest first. Open one to read it as it stood, then restore it as a new edit.'
              : 'No revisions are available for this article.'}
          </p>

          <div className="mt-7 grid grid-cols-1 gap-[clamp(20px,3vw,40px)] lg:grid-cols-[320px_minmax(0,1fr)]">
            <ol className="border border-line">
              {revisions.map((entry, index) => {
                const current = entry.id === rev
                return (
                  <li key={entry.id} className="border-b border-line last:border-b-0">
                    <Link
                      href={`/wiki/${article.slug}/history?rev=${entry.id}`}
                      aria-current={current ? 'true' : undefined}
                      className={twMerge(
                        'block px-4 py-3.5 hover:bg-ground-soft',
                        current && 'bg-ground-subtle shadow-selected',
                      )}
                    >
                      <span className="flex items-baseline justify-between gap-3">
                        <span className="truncate text-ink body-strong">{entry.title}</span>
                        <span className="shrink-0 text-ink-muted signal-sm">
                          {index === 0 ? 'Current' : `#${entry.id}`}
                        </span>
                      </span>
                      <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-ink-muted body-sm">
                        <Byline user={entry.editor} size={18} />
                        <LocalTime iso={entry.createdAt} options={ARTICLE_DATE_TIME} />
                      </span>
                    </Link>
                  </li>
                )
              })}
            </ol>

            <div className="min-w-0">
              {revision ? (
                <>
                  <p className="text-ink-muted signal-sm">
                    Revision #{revision.id} · saved <LocalTime iso={revision.createdAt} options={ARTICLE_DATE_TIME} />
                  </p>
                  <h2 className="mt-2.5 text-ink display-4">{revision.title}</h2>

                  <div className="mt-4">
                    <RestoreButton slug={article.slug} revisionId={revision.id} />
                  </div>

                  {revision.doc && docHtml ? (
                    <WikiBlocks doc={revision.doc} html={docHtml} className="mt-6 border-t border-line pt-6" />
                  ) : (
                    <ArticleBody html={html ?? ''} className="mt-6 border-t border-line pt-6" />
                  )}
                </>
              ) : (
                <p className="text-ink-muted body">
                  {rev ? 'That revision does not belong to this article.' : 'Pick a revision to read it.'}
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}

export default HistoryPage
