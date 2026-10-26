import { getTranslations } from 'next-intl/server'
import { Header } from '@ui/header'
import { pageMetadata } from '@utils/metadata'
import { DeckEditorLoader } from './deck-editor.loader'
import { VipPromo } from '@omega/ads/vip-promo'

export async function generateMetadata() {
  const t = await getTranslations('DeckEditor')
  return pageMetadata({ title: t('title'), path: '/deck-builder', description: t('meta') })
}

const DeckEditorPage = () => (
  <>
    <Header />
    <main className="min-h-dvh pt-16">
      {/* No footer on this page: our VIP pitch ends the deck column instead. */}
      <DeckEditorLoader deckId={null} promo={<VipPromo className="lg:mt-auto" />} />
    </main>
  </>
)

export default DeckEditorPage
