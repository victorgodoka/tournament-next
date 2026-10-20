import { cache } from 'react'
import Link from 'next/link'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { twMerge } from 'tailwind-merge'
import { LocalTime } from '@omega/profile/local-time'
import { AsideBlock, WIKI_ASIDE, WIKI_PAD, WikiBar } from '@omega/wiki'
import { ARTICLE_DATE_TIME, ArticleBody, Byline, StatusChip, userName } from '@omega/wiki/article'
import { ArticleView } from '@omega/wiki/article-view'
import { AdArticle } from '@omega/ads/ad-article'
import { AdBanner } from '@omega/ads/ad-banner'
import { AdVideo } from '@omega/ads/ad-video'
import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { getArticle } from '@utils/articles'
import { SITE_NAME } from '@utils/config'
import { jsonLd, pageMetadata } from '@utils/metadata'
import { renderArticle } from '@utils/remark'
import type { Article, ArticleSeo } from '@utils/types'
import { renderDocHtml } from '@utils/wiki-doc'
import { ArticleActions } from './ArticleActions'

type ArticleRouteProps = { params: Promise<{ slug: string }> }

/**
 * Forwards the visitor's session, which is what lets an editor open a draft at its public URL.
 * `cache`: metadata and page share one request instead of two uncached fetches.
 */
const loadArticle = cache(async (slug: string) => getArticle(slug, (await headers()).get('cookie')))

/**
 * The head comes whole from `article.seo`, which the server derives from the saved doc: recomputing it
 * here would let the page, the sitemap and the JSON-LD disagree (REVISAO_WIKI §2.4). Keywords are left
 * out on purpose: Google ignores `<meta name="keywords">`, and they are in the JSON-LD already.
 */
const seoMetadata = (article: Article, seo: ArticleSeo): Metadata => {
  const image = seo.image
  // `seo.image.src` is already cut to 1200×630 when the upload is big enough: never transform it again.
  const large = !!image && image.width >= 1200 && image.height >= 630
  return {
    title: seo.title,
    description: seo.description,
    alternates: { canonical: seo.canonical },
    robots: { index: !seo.robots.includes('noindex'), follow: !seo.robots.includes('nofollow') },
    openGraph: {
      type: 'article',
      title: seo.title,
      description: seo.description,
      url: seo.canonical,
      siteName: SITE_NAME,
      images: image ? [{ url: image.src, width: image.width, height: image.height, alt: image.alt }] : [],
      publishedTime: article.publishedAt ?? undefined,
      modifiedTime: article.updatedAt,
      authors: [userName(article.author)],
    },
    twitter: {
      card: large ? 'summary_large_image' : 'summary',
      title: seo.title,
      description: seo.description,
      images: image ? [image.src] : [],
    },
  }
}

export async function generateMetadata({ params }: ArticleRouteProps): Promise<Metadata> {
  const { slug } = await params
  const article = await loadArticle(slug)

  if (!article) return pageMetadata({ title: 'Article not found', path: `/wiki/${slug}`, noIndex: true })
  if (article.seo) return seoMetadata(article, article.seo)
  // A server without the SEO fields: the bare minimum, and never index a draft.
  return pageMetadata({ title: article.title, path: `/wiki/${article.slug}`, noIndex: !article.publishedAt })
}

/** Status, dates, history and the editing controls: shared by both article kinds. */
const ArticleMeta = ({ article }: { article: Article }) => (
  <>
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
        <Link href={`/wiki/${article.slug}/history`} className="text-cyan hover:text-cyan">
          Read the history
        </Link>
      </p>
    </AsideBlock>

    <AsideBlock label="Editing">
      <div className="mt-2.5">
        <ArticleActions slug={article.slug} authorId={article.author.id} published={!!article.publishedAt} />
      </div>
    </AsideBlock>
  </>
)

/** Legacy Markdown article: one body, rendered as it always was. */
const MarkdownArticle = async ({ article }: { article: Article }) => {
  const html = await renderArticle(article.body)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px]">
      <article id="ad-article" className={twMerge('py-[clamp(24px,3vw,40px)]', WIKI_PAD)}>
        <nav aria-label="Breadcrumb" className="text-ink-muted signal-sm">
          <Link href="/wiki" className="text-ink-muted hover:text-cyan">
            Omega Wiki
          </Link>{' '}
          / {article.slug}
        </nav>

        <div className="mt-3 flex flex-wrap items-center gap-2.5">
          <StatusChip publishedAt={article.publishedAt} />
          {article.publishedAt ? null : <span className="text-ink-muted signal-sm">Only editors can see this page</span>}
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

        <AdVideo id="ad-video" className="mt-7" />
        <ArticleBody html={html} className="mt-7" />
      </article>
      <AdArticle targetId="ad-article" />

      <aside className={twMerge('border-line lg:border-l', WIKI_ASIDE)}>
        <ArticleMeta article={article} />
        <AdBanner id="ad-aside" placement="aside" />
      </aside>
    </div>
  )
}

const ArticleRoute = async ({ params }: ArticleRouteProps) => {
  const { slug } = await params
  const article = await loadArticle(slug)
  if (!article) notFound()
  // The API answers a former address with 301 and `fetch` follows it: never serve the article at the old
  // URL (two indexed URLs split the ranking). Build the target from the body, not the relative Location.
  if (article.slug !== slug) permanentRedirect(`/wiki/${article.slug}`)

  return (
    <>
      <Header />
      <main className="flex min-h-dvh flex-col overflow-x-clip bg-space-000 pt-16">
        {/* `jsonLd` escapes `<`: the server doesn't, and a `</script>` in an FAQ answer would close the tag. */}
        {article.publishedAt && article.seo ? <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(article.seo.jsonLd)} /> : null}
        <WikiBar
          section="Articles"
          placeholder="Search cards by name or part of one"
          link={{ label: 'All articles', to: '/wiki' }}
        />

        {/* The doc is the whole page: same JSON, same component as the editor preview. */}
        {article.doc ? (
          <ArticleView
            doc={article.doc}
            slug={article.slug}
            html={await renderDocHtml(article.doc)}
            links={article.links}
            bodyId="ad-article"
            lead={<AdVideo id="ad-video" className="mb-8" />}
          >
            {/* The Markdown page has a byline for this; the block page shows it here. */}
            <AsideBlock label="Updated">
              <p className="mt-2 text-ink-dim body-sm">
                <LocalTime iso={article.updatedAt} options={ARTICLE_DATE_TIME} /> by{' '}
                {userName(article.updatedBy ?? article.author)}
              </p>
            </AsideBlock>
            <ArticleMeta article={article} />
            <AdBanner id="ad-aside" placement="aside" />
            <AdArticle targetId="ad-article" />
          </ArticleView>
        ) : (
          <MarkdownArticle article={article} />
        )}
      </main>
      <Footer />
    </>
  )
}

export default ArticleRoute
