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

const PublicDecksPage = async () => {
  const t = await getTranslations('DeckEditor.browse')
  return (
    <>
      <Header />
      <main className="mx-auto flex min-h-dvh w-[min(1280px,calc(100%-32px))] flex-col gap-8 pt-24 pb-24">
        <PageHeader eyebrow="Deck Builder" title={t('title')} lead={t('meta')} />
        <AdBanner id="ad-top" placement="content" />
        <DeckBrowser />
        <AdBanner id="ad-bottom" placement="content" />
      </main>
      <Footer />
    </>
  )
}

export default PublicDecksPage
