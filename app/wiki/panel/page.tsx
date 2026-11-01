import Link from 'next/link'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { twMerge } from 'tailwind-merge'
import { Callout, WIKI_PAD, WikiBar } from '@omega/wiki'
import { Eyebrow } from '@ui/eyebrow'
import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { can, listEditors } from '@utils/articles'
import { getMeServer } from '@utils/auth'
import { noIndexMetadata } from '@utils/metadata'
import { EditorsPanel } from './EditorsPanel'

export const metadata = noIndexMetadata('Editors panel', '/wiki/panel')

/**
 * `user.manage` only — admins. Everyone else gets the not-found page.
 * Neither call is caught: a failed session read must not 404 an admin, and a failed
 * list must not render an empty panel that looks like nobody can write.
 */
const PanelPage = async () => {
  const cookie = (await headers()).get('cookie')
  const me = await getMeServer(cookie)
  if (!can(me, 'user.manage')) notFound()

  const editors = await listEditors(cookie)

  return (
    <>
      <Header />
      <main className="flex min-h-dvh flex-col overflow-x-clip bg-space-000 pt-16">
        <WikiBar section="Panel" placeholder="Search cards by name or part of one" link={{ label: 'All articles', to: '/wiki' }} />

        <header className={twMerge('border-b border-line py-[clamp(24px,3vw,40px)]', WIKI_PAD)}>
          <nav aria-label="Breadcrumb" className="text-ink-muted signal-sm">
            <Link href="/wiki" className="text-ink-muted hover:text-cyan">
              Omega Wiki
            </Link>{' '}
            / panel
          </nav>
          <Eyebrow className="mt-4">Administration</Eyebrow>
          <h1 className="mt-3.5 text-ink display-2">Who can write</h1>
          <p className="mt-3 max-w-[62ch] text-ink-dim body">
            Editors write and publish any article, and delete only their own. Admins can delete any.
          </p>
        </header>

        <div className={twMerge('py-[clamp(28px,4vw,48px)]', WIKI_PAD)}>
          <EditorsPanel initial={editors}>
            <Callout>
              Nobody becomes an admin here. Admins are seeded in the database, and no route in this panel touches an
              account that already is one.
            </Callout>
          </EditorsPanel>
        </div>
      </main>
      <Footer />
    </>
  )
}

export default PanelPage
