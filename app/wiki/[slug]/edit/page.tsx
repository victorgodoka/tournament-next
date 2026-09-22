import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { twMerge } from 'tailwind-merge'
import { WIKI_PAD, WikiBar } from '@omega/wiki'
import { StatusChip } from '@omega/wiki/article'
import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { can, getArticle } from '@utils/articles'
import { getMeServer } from '@utils/auth'
import { noIndexMetadata } from '@utils/metadata'
import { ArticleForm } from '../../ArticleForm'

type EditRouteProps = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: EditRouteProps) {
  const { slug } = await params
  return noIndexMetadata(`Editing ${slug}`, `/wiki/${slug}/edit`)
}

/** Any editor may edit any article, including one they didn't write (WIKI_API §4.7). */
const EditArticlePage = async ({ params }: EditRouteProps) => {
  const { slug } = await params
  const cookie = (await headers()).get('cookie')

  const [me, article] = await Promise.all([getMeServer(cookie).catch(() => null), getArticle(slug, cookie)])
  if (!article || !can(me, 'wiki.write')) notFound()

  return (
    <>
      <Header />
      <main className="flex min-h-dvh flex-col overflow-x-hidden bg-surface-000 pt-16">
        <WikiBar
          section="Articles"
          placeholder="Search cards by name or part of one"
          link={{ label: 'All articles', to: '/wiki' }}
        />

        <div className={twMerge('py-[clamp(24px,3vw,40px)]', WIKI_PAD)}>
          <nav aria-label="Breadcrumb" className="text-ink-muted signal-sm">
            <Link href="/wiki" className="text-ink-muted hover:text-gold">
              Omega Wiki
            </Link>{' '}
            /{' '}
            <Link href={`/wiki/${article.slug}`} className="text-ink-muted hover:text-gold">
              {article.slug}
            </Link>{' '}
            / edit
          </nav>

          <div className="mt-4 flex flex-wrap items-center gap-2.5">
            <StatusChip publishedAt={article.publishedAt} />
            <Link href={`/wiki/${article.slug}/history`} className="text-gold signal-sm hover:text-cyan">
              History
            </Link>
          </div>

          <h1 className="mt-3.5 text-ink display-2">{article.title}</h1>
          <p className="mt-3 max-w-[62ch] text-ink-dim body">
            Every save writes a revision, so nothing is lost and a bad edit can be restored from the history.
          </p>

          <div className="mt-7">
            <ArticleForm article={article} />
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}

export default EditArticlePage
