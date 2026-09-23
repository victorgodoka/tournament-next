import { cache } from 'react'
import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { twMerge } from 'tailwind-merge'
import { LocalTime } from '@omega/profile/local-time'
import { AsideBlock, WIKI_ASIDE, WIKI_PAD, WikiBar } from '@omega/wiki'
import { ARTICLE_DATE_TIME, ArticleBody, Byline, StatusChip, userName } from '@omega/wiki/article'
import { ArticleView } from '@omega/wiki/article-view'
import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { getArticle } from '@utils/articles'
import { SITE_NAME, SITE_URL } from '@utils/config'
import { jsonLd, metaDescription, pageMetadata } from '@utils/metadata'
import { renderArticle } from '@utils/remark'
import type { Article } from '@utils/types'
import { imageSource, renderDocHtml } from '@utils/wiki-doc'
import { ArticleActions } from './ArticleActions'

type ArticleRouteProps = { params: Promise<{ slug: string }> }

/**
 * Forwards the visitor's session, which is what lets an editor open a draft at its public URL.
 * `cache`: metadata and page share one request instead of two uncached fetches.
 */
const loadArticle = cache(async (slug: string) => getArticle(slug, (await headers()).get('cookie')))

/** A block article writes its own summary; a Markdown one gets its opening text with the markup stripped. */
const describe = (article: Article) =>
  metaDescription(
    article.doc?.summary ||
      article.summary ||
      article.body
        .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
        .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
        .replace(/^\s*(#{1,6}|>|[-*+]|\d+\.)\s+/gm, '')
        .replace(/[*_`|~]/g, ''),
  ) || undefined

const coverUrl = (article: Article) => {
  const cover = article.doc?.cover && article.doc.assets[article.doc.cover.asset]
  return cover ? { url: imageSource(cover, 1200).src, alt: cover.alt } : undefined
}

/** Article + breadcrumb, so search and answer engines get the author, dates and place in the wiki. */
const articleJsonLd = (article: Article) => {
  const url = `${SITE_URL}/wiki/${article.slug}`
  const image = coverUrl(article)
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${url}#article`,
        headline: article.title,
        description: describe(article),
        url,
        mainEntityOfPage: url,
        inLanguage: 'en',
        datePublished: article.publishedAt,
        dateModified: article.updatedAt,
        author: { '@type': 'Person', name: userName(article.author) },
        ...(article.updatedBy ? { editor: { '@type': 'Person', name: userName(article.updatedBy) } } : {}),
        publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL, logo: `${SITE_URL}/logo.png` },
        ...(image ? { image: new URL(image.url, SITE_URL).href } : {}),
        ...(article.doc?.tags.length ? { keywords: article.doc.tags.join(', ') } : {}),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Omega Wiki', item: `${SITE_URL}/wiki` },
          { '@type': 'ListItem', position: 2, name: article.title, item: url },
        ],
      },
    ],
  }
}

export async function generateMetadata({ params }: ArticleRouteProps) {
  const { slug } = await params
  const article = await loadArticle(slug)

  if (!article) return pageMetadata({ title: 'Article not found', path: `/wiki/${slug}`, noIndex: true })

  const cover = coverUrl(article)
  return pageMetadata({
    title: article.title,
    path: `/wiki/${article.slug}`,
    description: describe(article),
    images: cover ? [cover] : undefined,
    article: {
      publishedTime: article.publishedAt ?? undefined,
      modifiedTime: article.updatedAt,
      authors: [userName(article.author)],
    },
    // A draft is only visible to editors, so it must never be indexed.
    noIndex: !article.publishedAt,
  })
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
  </>
)

/** Legacy Markdown article: one body, rendered as it always was. */
const MarkdownArticle = async ({ article }: { article: Article }) => {
  const html = await renderArticle(article.body)

  return (
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

        <ArticleBody html={html} className="mt-7" />
      </article>

      <aside className={twMerge('border-line lg:border-l', WIKI_ASIDE)}>
        <ArticleMeta article={article} />
      </aside>
    </div>
  )
}

const ArticleRoute = async ({ params }: ArticleRouteProps) => {
  const { slug } = await params
  const article = await loadArticle(slug)
  if (!article) notFound()

  return (
    <>
      <Header />
      <main className="flex min-h-dvh flex-col overflow-x-clip bg-surface-000 pt-16">
        {article.publishedAt ? <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(articleJsonLd(article))} /> : null}
        <WikiBar
          section="Articles"
          placeholder="Search cards by name or part of one"
          link={{ label: 'All articles', to: '/wiki' }}
        />

        {/* The doc is the whole page: same JSON, same component as the editor preview. */}
        {article.doc ? (
          <ArticleView doc={article.doc} slug={article.slug} html={await renderDocHtml(article.doc)}>
            {/* The Markdown page has a byline for this; the block page shows it here. */}
            <AsideBlock label="Updated">
              <p className="mt-2 text-ink-dim body-sm">
                <LocalTime iso={article.updatedAt} options={ARTICLE_DATE_TIME} /> by{' '}
                {userName(article.updatedBy ?? article.author)}
              </p>
            </AsideBlock>
            <ArticleMeta article={article} />
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
