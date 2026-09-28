import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { can } from '@utils/articles'
import { getMeServer } from '@utils/auth'
import { noIndexMetadata } from '@utils/metadata'
import { DocEditor } from '../editor/DocEditor'

export const metadata = noIndexMetadata('New article', '/wiki/new')

/**
 * `wiki.write` only. A reader gets the same answer as for a page that doesn't exist.
 * The session is not caught: an API failure used to land here as `null` and 404 an editor.
 */
const NewArticlePage = async () => {
  const me = await getMeServer((await headers()).get('cookie'))
  if (!can(me, 'wiki.write')) notFound()

  return (
    <>
      <Header />
      <main className="flex min-h-dvh flex-col overflow-x-clip bg-space-000 pt-16">
        <DocEditor />
      </main>
      <Footer />
    </>
  )
}

export default NewArticlePage
