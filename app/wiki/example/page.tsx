import { twMerge } from 'tailwind-merge'
import { WIKI_CARD } from '@omega/wiki'
import { ArticleByline } from '@omega/wiki/article'
import { ArticleView } from '@omega/wiki/article-view'
import { ShareButtons } from '@omega/wiki/share-buttons'
import { HeaderSearch } from '@omega/wiki/wiki-search'
import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { SITE_URL } from '@utils/config'
import { noIndexMetadata } from '@utils/metadata'
import { renderDocHtml } from '@utils/wiki-doc'
import { EXAMPLE_AUTHOR, EXAMPLE_DOC, EXAMPLE_LINKS, EXAMPLE_UPDATED_AT } from './doc'

export const metadata = noIndexMetadata('Example article', '/wiki/example')

const ExampleArticlePage = async () => {
  const html = await renderDocHtml(EXAMPLE_DOC)

  return (
    <>
      <Header extra={<HeaderSearch />} />
      <main className="flex min-h-dvh flex-col overflow-x-clip bg-space-000 pt-15">
        <ArticleView
          doc={EXAMPLE_DOC}
          slug="example"
          html={html}
          links={EXAMPLE_LINKS}
          meta={
            <ArticleByline user={EXAMPLE_AUTHOR} updatedAt={EXAMPLE_UPDATED_AT}>
              <div className="ml-auto">
                <ShareButtons url={`${SITE_URL}/wiki/example`} title={EXAMPLE_DOC.title} />
              </div>
            </ArticleByline>
          }
        >
          <div className={twMerge(WIKI_CARD, 'p-5')}>
            <p className="text-ink-muted signal">Document</p>
            <p className="mt-2 text-ink-dim mono-data">
              v{EXAMPLE_DOC.v} · {EXAMPLE_DOC.blocks.length} blocks · {Object.keys(EXAMPLE_DOC.assets).length} assets
            </p>
          </div>
        </ArticleView>

        <details className="mx-auto w-full max-w-page border-t border-line px-gutter py-6">
          <summary className="cursor-pointer text-ink-muted signal-sm hover:text-cyan">Stored document (JSON)</summary>
          <pre className="mt-4 max-h-[60dvh] overflow-auto border border-line bg-surface-200 p-4 text-ink-dim mono-note">
            {JSON.stringify(EXAMPLE_DOC, null, 2)}
          </pre>
        </details>
      </main>
      <Footer />
    </>
  )
}

export default ExampleArticlePage
