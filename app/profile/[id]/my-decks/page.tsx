import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { DeckBrowser } from '@app/decks/deck-browser'
import { AdBanner } from '@omega/ads/ad-banner'
import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { PageHeader } from '@ui/page-header'
import { pageMetadata } from '@utils/metadata'
import { getProfile } from '@utils/profile'

type MyDecksRouteProps = { params: Promise<{ id: string }> }

/** Same call, same cookie, same `limit` as the statistics route, so `cache` shares it with the metadata. */
const loadProfile = async (id: string) => getProfile(id, (await headers()).get('cookie'))

const nameOf = (profile: NonNullable<Awaited<ReturnType<typeof loadProfile>>>) => profile.displayName ?? profile.handle ?? 'Unknown duelist'

export async function generateMetadata({ params }: MyDecksRouteProps) {
  const { id } = await params
  const [profile, t] = await Promise.all([loadProfile(id), getTranslations('DeckEditor.browse')])
  const path = `/profile/${id}/my-decks`
  if (!profile) return pageMetadata({ title: 'Profile not found', path, noIndex: true })
  const name = nameOf(profile)
  // What shows depends on who looks (friends-only decks): never indexed.
  return pageMetadata({ title: t('userTitle', { name }), path, description: t('userMeta', { name }), noIndex: true })
}

/** A duelist's decks: each one's own visibility decides who sees it, the owner sees all of them. */
const MyDecksRoute = async ({ params }: MyDecksRouteProps) => {
  const { id } = await params
  const [profile, t] = await Promise.all([loadProfile(id), getTranslations('DeckEditor.browse')])
  if (!profile) notFound()

  return (
    <>
      <Header />
      <main className="mx-auto flex min-h-dvh w-[min(var(--container-page),calc(100%-32px))] flex-col gap-8 pt-24 pb-24">
        <PageHeader eyebrow="Profile" title={t('userTitle', { name: nameOf(profile) })} />
        <AdBanner id="ad-top" placement="content" />
        <DeckBrowser userId={id} />
        <AdBanner id="ad-bottom" placement="content" />
      </main>
      <Footer />
    </>
  )
}

export default MyDecksRoute
