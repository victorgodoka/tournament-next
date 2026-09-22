import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { twMerge } from 'tailwind-merge'
import { LocalTime } from '@omega/profile/local-time'
import { AsideBlock, WIKI_ASIDE, WIKI_PAD, WikiBar } from '@omega/wiki'
import { ARTICLE_DATE_TIME, ArticleBody, Byline, StatusChip, userName } from '@omega/wiki/article'
import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { getArticle } from '@utils/articles'
import { pageMetadata } from '@utils/metadata'
import { renderArticle } from '@utils/remark'
import { ArticleActions } from './ArticleActions'

type ArticleRouteProps = { params: Promise<{ slug: string }> }

/** Forwards the visitor's session, which is what lets an editor open a draft at its public URL. */
const loadArticle = async (slug: string) => getArticle(slug, (await headers()).get('cookie'))

export async function generateMetadata({ params }: ArticleRouteProps) {
  const { slug } = await params
  const article = await loadArticle(slug)

  if (!article) return pageMetadata({ title: 'Article not found', path: `/wiki/${slug}`, noIndex: true })

  return pageMetadata({
    title: article.title,
    path: `/wiki/${article.slug}`,
    // First paragraph-ish: enough for a card, without shipping 100 KB of Markdown to a crawler.
    description: article.body.replace(/[#*_>`-]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 180) || undefined,
    // A draft is only visible to editors, so it must never be indexed.
    noIndex: !article.publishedAt,
  })
}

const ArticleRoute = async ({ params }: ArticleRouteProps) => {
  const { slug } = await params
  const article = await loadArticle(slug)
  if (!article) notFound()

  const html = await renderArticle(article.body)

  return (
    <>
      <Header />
      <main className="flex min-h-dvh flex-col overflow-x-hidden bg-surface-000 pt-16">
        <WikiBar
          section="Articles"
          placeholder="Search cards by name or part of one"
          link={{ label: 'All articles', to: '/wiki' }}
        />

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px]">
          <article className={twMerge('py-[clamp(24px,3vw,40px)]', WIKI_PAD)}>
            <nav aria-label="Breadcrumb" className="text-ink-muted signal-sm">
              <Link href="/wiki" className="text-ink-muted hover:text-gold">
                Omega Wiki
              </Link>{' '}
              / {article.slug}
            </nav>

            <div className="mt-3 flex flex-wrap items-center gap-2.5">
              <StatusChip publishedAt={article.publishedAt} />
              {article.publishedAt ? null : (
                <span className="text-ink-muted signal-sm">Only editors can see this page</span>
              )}
            </div>

            <h1 className="mt-3.5 text-ink display-2">{article.title}</h1>

            <p className="mt-3.5 flex flex-wrap items-center gap-x-3.5 gap-y-2 text-ink-muted body-sm">
              <Byline user={article.author} />
              <span aria-hidden>·</span>
              <span>
                updated <LocalTime iso={article.updatedAt} options={ARTICLE_DATE_TIME} />
                {article.updatedBy ? ` by ${userName(article.updatedBy)}` : ''}
              </span>
            </p>

            <ArticleBody html={html} className="mt-7" />
          </article>

          <aside className={twMerge('border-line lg:border-l', WIKI_ASIDE)}>
            <AsideBlock label="Status">
              <p className="mt-2 text-ink body-strong">
                {article.publishedAt ? (
                  <>
                    Live since <LocalTime iso={article.publishedAt} options={ARTICLE_DATE_TIME} />
                  </>
                ) : (
                  'Draft — not listed, not indexed'
                )}
              </p>
            </AsideBlock>

            <AsideBlock label="Created">
              <p className="mt-2 text-ink-dim mono-data">
                <LocalTime iso={article.createdAt} options={ARTICLE_DATE_TIME} />
              </p>
            </AsideBlock>

            <AsideBlock label="Revisions">
              <p className="mt-2">
                <Link href={`/wiki/${article.slug}/history`} className="text-gold hover:text-cyan">
                  Read the history
                </Link>
              </p>
            </AsideBlock>

            <AsideBlock label="Editing">
              <div className="mt-2.5">
                <ArticleActions slug={article.slug} authorId={article.author.id} published={!!article.publishedAt} />
              </div>
            </AsideBlock>
          </aside>
        </div>
      </main>
      <Footer />
    </>
  )
}

export default ArticleRoute
