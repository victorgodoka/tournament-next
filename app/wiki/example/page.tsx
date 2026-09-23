import { twMerge } from 'tailwind-merge'
import { AsideBlock, WIKI_PAD } from '@omega/wiki'
import { ArticleView } from '@omega/wiki/article-view'
import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { noIndexMetadata } from '@utils/metadata'
import { renderDocHtml } from '@utils/wiki-doc'
import { EXAMPLE_DOC } from './doc'

export const metadata = noIndexMetadata('Example article', '/wiki/example')

const ExampleArticlePage = async () => {
  const html = await renderDocHtml(EXAMPLE_DOC)

  return (
    <>
      <Header />
      <main className="flex min-h-dvh flex-col overflow-x-clip bg-surface-000">
        <ArticleView doc={EXAMPLE_DOC} slug="example" html={html}>
          <AsideBlock label="Document" className="bg-ground-subtle">
            <p className="mt-2 text-ink-dim mono-data">
              v{EXAMPLE_DOC.v} · {EXAMPLE_DOC.blocks.length} blocks · {Object.keys(EXAMPLE_DOC.assets).length} assets
            </p>
          </AsideBlock>
        </ArticleView>

        <details className={twMerge('border-t border-line py-6', WIKI_PAD)}>
          <summary className="cursor-pointer text-ink-muted signal-sm hover:text-gold">Stored document (JSON)</summary>
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
