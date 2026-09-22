import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { twMerge } from 'tailwind-merge'
import { WIKI_PAD, WikiBar } from '@omega/wiki'
import { Eyebrow } from '@ui/eyebrow/eyebrow'
import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { can } from '@utils/articles'
import { getMeServer } from '@utils/auth'
import { noIndexMetadata } from '@utils/metadata'
import { ArticleForm } from '../ArticleForm'

export const metadata = noIndexMetadata('New article', '/wiki/new')

/** `wiki.write` only. A reader gets the same answer as for a page that doesn't exist. */
const NewArticlePage = async () => {
  const me = await getMeServer((await headers()).get('cookie')).catch(() => null)
  if (!can(me, 'wiki.write')) notFound()

  return (
    <>
      <Header />
      <main className="flex min-h-dvh flex-col overflow-x-hidden bg-surface-000 pt-16">
        <WikiBar section="Articles" placeholder="Search cards by name or part of one" link={{ label: 'All articles', to: '/wiki' }} />

        <div className={twMerge('py-[clamp(24px,3vw,40px)]', WIKI_PAD)}>
          <nav aria-label="Breadcrumb" className="text-ink-muted signal-sm">
            <Link href="/wiki" className="text-ink-muted hover:text-gold">
              Omega Wiki
            </Link>{' '}
            / new
          </nav>

          <Eyebrow className="mt-4" meta="Born a draft">
            Write
          </Eyebrow>
          <h1 className="mt-3.5 text-ink display-2">New article</h1>
          <p className="mt-3 max-w-[62ch] text-ink-dim body">
            Saving as a draft keeps it off the index and answers 404 for everyone but editors. Publishing is a separate
            act, from the article itself.
          </p>

          <div className="mt-7">
            <ArticleForm />
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}

export default NewArticlePage
