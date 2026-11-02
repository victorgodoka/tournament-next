import { getTranslations } from 'next-intl/server'
import { AdBanner } from '@omega/ads/ad-banner'
import { Button } from '@ui/button'
import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { PageHeader } from '@ui/page-header'
import { pageMetadata } from '@utils/metadata'
import { ComboBrowser } from './combo-browser'

export async function generateMetadata() {
  const t = await getTranslations('Simulator')
  return pageMetadata({ title: t('browse.title'), path: '/simulator/combos', description: t('browse.meta') })
}

const PublishedCombosPage = async () => {
  const t = await getTranslations('Simulator')
  return (
    <>
      <Header />
      <main className="mx-auto flex min-h-dvh w-[min(var(--container-page),calc(100%-32px))] flex-col gap-8 pt-24 pb-24">
        <PageHeader eyebrow={t('eyebrow')} title={t('browse.title')} lead={t('browse.meta')} end={<Button href="/simulator">{t('browse.open')}</Button>} />
        <AdBanner id="ad-top" placement="content" />
        <ComboBrowser />
        <AdBanner id="ad-bottom" placement="content" />
      </main>
      <Footer />
    </>
  )
}

export default PublishedCombosPage
