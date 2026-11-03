import { getTranslations } from 'next-intl/server'
import { AdBanner } from '@omega/ads/ad-banner'
import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { PageHeader } from '@ui/page-header'
import { pageMetadata } from '@utils/metadata'
import { DeckBrowser } from './deck-browser'

export async function generateMetadata() {
  const t = await getTranslations('DeckEditor.browse')
  return pageMetadata({ title: t('title'), path: '/decks', description: t('meta') })
}

const PublicDecksPage = async ({ searchParams }: { searchParams: Promise<{ archetype?: string | string[] }> }) => {
  const t = await getTranslations('DeckEditor.browse')
  const { archetype } = await searchParams
  return (
    <>
      <Header />
      <main className="mx-auto flex min-h-dvh w-[min(var(--container-page),calc(100%-32px))] flex-col gap-8 pt-24 pb-24">
        <PageHeader eyebrow="Deck Builder" title={t('title')} lead={t('meta')} />
        <AdBanner id="ad-top" placement="content" />
        <DeckBrowser initialArchetype={typeof archetype === 'string' ? archetype : ''} />
        <AdBanner id="ad-bottom" placement="content" />
      </main>
      <Footer />
    </>
  )
}

export default PublicDecksPage
