import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { pageMetadata } from '@utils/metadata'
import { getBanlists } from '@utils/wiki'
import { AdminPanel } from './AdminPanel'

export const metadata = {
  ...pageMetadata({
    title: 'Admin panel',
    path: '/admin',
    description: 'Tournament formats, scheduled tournaments and ranked operations.',
  }),
  robots: { index: false, follow: false },
}

/**
 * The gate is in the client: every `/panel` route needs the session cookie, which is scoped to the
 * API host and never reaches this server. Only the banlist picker is read here — it is public,
 * cached for an hour, and would otherwise cost the browser a round trip before the first form opens.
 */
const AdminPage = async () => {
  const banlists = await getBanlists()

  return (
    <>
      <Header />
      <main className="flex min-h-dvh flex-col overflow-x-hidden pt-16 pb-[clamp(56px,7vw,96px)]">
        <AdminPanel banlists={banlists} />
      </main>
      <Footer />
    </>
  )
}

export default AdminPage
