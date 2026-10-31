import { cache } from 'react'
import Link from 'next/link'
import { headers } from 'next/headers'
import type { Metadata } from 'next'
import { notFound, permanentRedirect } from 'next/navigation'
import { twMerge } from 'tailwind-merge'
import { LocalTime } from '@omega/profile/local-time'
import { WIKI_ASIDE, WIKI_CARD, WIKI_PAD } from '@omega/wiki'
import { ARTICLE_DATE_TIME, ArticleBody, ArticleByline, Byline, StatusChip, userName } from '@omega/wiki/article'
import { ArticleView } from '@omega/wiki/article-view'
import { ArticleBar } from '@omega/wiki/article-bar'
import { ArticleComments } from '@omega/wiki/comments'
import { HeaderSearch } from '@omega/wiki/wiki-search'
import { AdArticle } from '@omega/ads/ad-article'
import { AdBanner } from '@omega/ads/ad-banner'
import { AdVideo } from '@omega/ads/ad-video'
import { WIKI_BODY_ID } from '@utils/nitro-ads.const'
import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { getArticle, getSocial } from '@utils/articles'
import { SITE_NAME, SITE_URL } from '@utils/config'
import { jsonLd, pageMetadata } from '@utils/metadata'
import { renderArticle } from '@utils/remark'
import type { Article, ArticleSeo, ArticleSocial } from '@utils/types'
import { renderDocHtml } from '@utils/wiki-doc'
import { ArticleActions } from './ArticleActions'

type ArticleRouteProps = { params: Promise<{ slug: string }> }

/**
 * Forwards the visitor's session, which is what lets an editor open a draft at its public URL.
 * `cache`: metadata and page share one request instead of two uncached fetches.
 */
const loadArticle = cache(async (slug: string) => getArticle(slug, (await headers()).get('cookie')))

/** Views, likes and comments, read beside the article. `null` for a draft, or when the API didn't answer. */
const loadSocial = cache(async (slug: string) => getSocial(slug, (await headers()).get('cookie')))

/** What a share points at: the canonical address, absolute. */
const shareUrl = (article: Article) => new URL(article.seo?.canonical ?? `/wiki/${article.slug}`, SITE_URL).toString()

type SocialProps = { article: Article; social: ArticleSocial | null }

const Bar = ({ article, social }: SocialProps) => (
  <ArticleBar slug={article.slug} url={shareUrl(article)} title={article.title} social={social} />
)

/** The banner sits between the article and the conversation, never inside either. */
const Conversation = ({ article, social }: SocialProps) => (
  <>
    <AdBanner id="ad-comments" placement="content" className="mt-12" />
    <ArticleComments slug={article.slug} initial={social?.comments ?? null} />
  </>
)

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
  <div className={twMerge(WIKI_CARD, 'flex flex-col gap-3 p-5')}>
    <dl className="flex flex-col gap-3">
      <div>
        <dt className="text-ink-muted signal">Status</dt>
        <dd className="mt-1 text-sm/5 text-ink">
          {article.publishedAt ? (
            <>
              Live since <LocalTime iso={article.publishedAt} options={ARTICLE_DATE_TIME} />
            </>
          ) : (
            'Draft — not listed, not indexed'
          )}
        </dd>
      </div>
      <div>
        <dt className="text-ink-muted signal">Created</dt>
        <dd className="mt-1 text-ink-dim mono-data">
          <LocalTime iso={article.createdAt} options={ARTICLE_DATE_TIME} />
        </dd>
      </div>
    </dl>
    <Link href={`/wiki/${article.slug}/history`} className="self-start signal-strong hover:text-ink">
      Read the history →
    </Link>
    <ArticleActions slug={article.slug} authorId={article.author.id} published={!!article.publishedAt} />
  </div>
)

/** Legacy Markdown article: one body, rendered as it always was. */
const MarkdownArticle = async ({ article, social }: SocialProps) => {
  const html = await renderArticle(article.body)
  const published = !!article.publishedAt

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className={twMerge('min-w-0 py-[clamp(24px,3vw,40px)]', WIKI_PAD)}>
        <article id={WIKI_BODY_ID}>
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

          {published ? (
            <div className="mt-7">
              <Bar article={article} social={social} />
            </div>
          ) : null}
          <AdVideo id="ad-video" className={published ? undefined : 'mt-7'} />
          <ArticleBody html={html} className="mt-7" />
        </article>
        {published ? <Conversation article={article} social={social} /> : null}
      </div>
      <AdArticle targetId={WIKI_BODY_ID} />

      <aside className={twMerge('border-line lg:border-l', WIKI_ASIDE)}>
        <ArticleMeta article={article} />
        <AdBanner id="ad-aside" placement="aside" />
      </aside>
    </div>
  )
}

const ArticleRoute = async ({ params }: ArticleRouteProps) => {
  const { slug } = await params
  // Side by side: the social read answers 404 for a draft, which then simply shows none of it.
  const [article, social] = await Promise.all([loadArticle(slug), loadSocial(slug)])
  if (!article) notFound()
  // The API answers a former address with 301 and `fetch` follows it: never serve the article at the old
  // URL (two indexed URLs split the ranking). Build the target from the body, not the relative Location.
  if (article.slug !== slug) permanentRedirect(`/wiki/${article.slug}`)
  const published = !!article.publishedAt
  // An article's `links` carry its own children only: a child reads the rest of its hub from the hub.
  const hub = article.links?.hub && !article.links.children.length ? await loadArticle(article.links.hub.slug).catch(() => null) : null
  const links = article.links && hub?.links ? { ...article.links, children: hub.links.children } : article.links

  return (
    <>
      <Header extra={<HeaderSearch />} />
      <main className="flex min-h-dvh flex-col overflow-x-clip bg-space-000 pt-15">
        {/* `jsonLd` escapes `<`: the server doesn't, and a `</script>` in an FAQ answer would close the tag. */}
        {article.publishedAt && article.seo ? <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(article.seo.jsonLd)} /> : null}

        {/* The doc is the whole page: same JSON, same component as the editor preview. */}
        {article.doc ? (
          <ArticleView
            doc={article.doc}
            slug={article.slug}
            html={await renderDocHtml(article.doc)}
            links={links}
            bodyId={WIKI_BODY_ID}
            meta={
              <ArticleByline user={article.author} updatedAt={article.updatedAt}>
                {published ? <Bar article={article} social={social} /> : <StatusChip publishedAt={null} />}
              </ArticleByline>
            }
            lead={<AdVideo id="ad-video" className="mb-5" />}
            footer={published ? <Conversation article={article} social={social} /> : null}
          >
            <ArticleMeta article={article} />
            <AdBanner id="ad-aside" placement="aside" />
            <AdArticle targetId={WIKI_BODY_ID} />
          </ArticleView>
        ) : (
          <MarkdownArticle article={article} social={social} />
        )}
      </main>
      <Footer />
    </>
  )
}

export default ArticleRoute
