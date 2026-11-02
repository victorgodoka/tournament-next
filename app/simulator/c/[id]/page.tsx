import { getTranslations } from 'next-intl/server'
import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { API_URL } from '@utils/auth'
import type { SharedCombo } from '@utils/combos'
import { metaDescription, pageMetadata } from '@utils/metadata'
import { ComboPlayerLoader } from './combo-player.loader'
import { AdBanner } from '@omega/ads/ad-banner'

type Props = { params: Promise<{ id: string }> }

// The link preview (Discord): the combo's title, its deck and its length. Only a published combo is indexed. A private one
// answers 404 here, with no session, so its title never reaches a preview.
export async function generateMetadata({ params }: Props) {
  const [{ id }, t] = await Promise.all([params, getTranslations('Simulator')])
  const path = `/simulator/c/${encodeURIComponent(id)}`
  try {
    const res = await fetch(`${API_URL}/combos/${encodeURIComponent(id)}`, { next: { revalidate: 60 } })
    if (!res.ok) throw new Error(`combo ${res.status}`)
    const { title, payload, visibility }: SharedCombo = await res.json()
    const description = metaDescription([payload.name, t('player.meta', { count: payload.actions.length })].filter(Boolean).join(' · '))
    return pageMetadata({ title: `${title} — ${t('title')}`, path, description, noIndex: visibility !== 'public' })
  } catch {
    // Unknown, deleted, or the API is down: the simulator's own preview.
    return pageMetadata({ title: t('title'), path, description: t('meta'), noIndex: true })
  }
}

const ComboPlayerPage = async ({ params }: Props) => {
  const { id } = await params
  return (
    <>
      <Header />
      {/* As the simulator's page: clipped sideways at the viewport edge, for a card sliding in from a pile. */}
      <main data-clear-gutters className="min-h-dvh overflow-x-clip pt-16">
        <ComboPlayerLoader id={id} />
        <AdBanner id="ad-bottom" placement="content" className="mx-auto mb-12 w-[min(var(--container-page),calc(100%-32px))]" />
      </main>
      <Footer />
    </>
  )
}

export default ComboPlayerPage
