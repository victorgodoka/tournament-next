import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { twMerge } from 'tailwind-merge'
import { Callout, WIKI_PAD, WikiBar } from '@omega/wiki'
import { Eyebrow } from '@ui/eyebrow/eyebrow'
import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { can, listEditors } from '@utils/articles'
import { getMeServer } from '@utils/auth'
import { noIndexMetadata } from '@utils/metadata'
import { EditorsPanel } from './EditorsPanel'

export const metadata = noIndexMetadata('Editors panel', '/wiki/panel')

/** `user.manage` only — admins. Everyone else gets the not-found page. */
const PanelPage = async () => {
  const cookie = (await headers()).get('cookie')
  const me = await getMeServer(cookie).catch(() => null)
  if (!can(me, 'user.manage')) notFound()

  const editors = await listEditors(cookie).catch((error) => {
    console.error(error)
    return []
  })

  return (
    <>
      <Header />
      <main className="flex min-h-dvh flex-col overflow-x-clip bg-surface-000 pt-16">
        <WikiBar
          section="Panel"
          placeholder="Search cards by name or part of one"
          link={{ label: 'All articles', to: '/wiki' }}
        />

        <div className={twMerge('py-[clamp(24px,3vw,40px)]', WIKI_PAD)}>
          <nav aria-label="Breadcrumb" className="text-ink-muted signal-sm">
            <Link href="/wiki" className="text-ink-muted hover:text-gold">
              Omega Wiki
            </Link>{' '}
            / panel
          </nav>

          <Eyebrow className="mt-4" meta={`${editors.length} with write access`}>
            Administration
          </Eyebrow>
          <h1 className="mt-3.5 text-ink display-2">Editors</h1>
          <p className="mt-3 max-w-[62ch] text-ink-dim body">
            An editor can write any article and publish it, but can only delete their own. Admins can delete any.
          </p>

          <div className="mt-7">
            <EditorsPanel initial={editors} />
          </div>

          <div className="max-w-[72ch]">
            <Callout>
              Nobody becomes an admin through this panel. Admins are seeded in the database, and no route here touches
              an account that already is one.
            </Callout>
          </div>
        </div>
      </main>
      <Footer />
    </>
  )
}

export default PanelPage
