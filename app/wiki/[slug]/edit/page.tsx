import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound, permanentRedirect } from 'next/navigation'
import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { can, getArticle } from '@utils/articles'
import { getMeServer } from '@utils/auth'
import { noIndexMetadata } from '@utils/metadata'
import { LegacyEditor } from '../../editor/LegacyEditor'
import { DocEditor } from '../../editor/DocEditor'

type EditRouteProps = { params: Promise<{ slug: string }> }

export async function generateMetadata({ params }: EditRouteProps) {
  const { slug } = await params
  return noIndexMetadata(`Editing ${slug}`, `/wiki/${slug}/edit`)
}

/** Any editor may edit any article, including one they didn't write (WIKI_API §4.7). */
const EditArticlePage = async ({ params }: EditRouteProps) => {
  const { slug } = await params
  const cookie = (await headers()).get('cookie')

  // No catch on the session: an unreachable API is an error page, not a fake 404.
  const [me, article] = await Promise.all([getMeServer(cookie), getArticle(slug, cookie)])
  if (!article || !can(me, 'wiki.write')) notFound()
  // A former address: edit under the current one, or History and the next save would target the old slug.
  if (article.slug !== slug) permanentRedirect(`/wiki/${article.slug}/edit`)

  return (
    <>
      <Header />
      <main className="flex min-h-dvh flex-col overflow-x-clip bg-space-000 pt-16">
        {article.doc ? (
          // Every save changes `updatedAt`: the editor starts over from what the server now holds.
          <DocEditor key={article.updatedAt} article={{ ...article, doc: article.doc }} />
        ) : (
          // Markdown articles keep the text form, with a way into the block editor.
          <LegacyEditor article={article}>
            <nav aria-label="Breadcrumb" className="text-ink-muted signal-sm">
              <Link href="/wiki" className="text-ink-muted hover:text-cyan">
                Omega Wiki
              </Link>{' '}
              /{' '}
              <Link href={`/wiki/${article.slug}`} className="text-ink-muted hover:text-cyan">
                {article.slug}
              </Link>{' '}
              / edit
            </nav>
            <h1 className="mt-3.5 mb-7 text-ink display-2">{article.title}</h1>
          </LegacyEditor>
        )}
      </main>
      <Footer />
    </>
  )
}

export default EditArticlePage
