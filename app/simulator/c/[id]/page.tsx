import { getTranslations } from 'next-intl/server'
import { Header } from '@ui/header'
import { API_URL } from '@utils/auth'
import type { SharedCombo } from '@utils/combos'
import { metaDescription, pageMetadata } from '@utils/metadata'
import { ComboPlayerLoader } from './combo-player.loader'

type Props = { params: Promise<{ id: string }> }

// The link preview (Discord): the combo's title, its deck and its length. Unlisted, so never indexed.
export async function generateMetadata({ params }: Props) {
  const [{ id }, t] = await Promise.all([params, getTranslations('Simulator')])
  const path = `/simulator/c/${encodeURIComponent(id)}`
  try {
    const res = await fetch(`${API_URL}/combos/${encodeURIComponent(id)}`, { next: { revalidate: 60 } })
    if (!res.ok) throw new Error(`combo ${res.status}`)
    const { title, payload }: SharedCombo = await res.json()
    const description = metaDescription([payload.name, t('player.meta', { count: payload.actions.length })].filter(Boolean).join(' · '))
    return pageMetadata({ title: `${title} — ${t('title')}`, path, description, noIndex: true })
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
      <main className="min-h-dvh overflow-x-clip pt-16">
        <ComboPlayerLoader id={id} />
      </main>
    </>
  )
}

export default ComboPlayerPage
