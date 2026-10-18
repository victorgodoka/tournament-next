import { getTranslations } from 'next-intl/server'
import { Header } from '@ui/header'
import { pageMetadata } from '@utils/metadata'
import { DeckEditorLoader } from './deck-editor.loader'

export async function generateMetadata() {
  const t = await getTranslations('DeckEditor')
  return pageMetadata({ title: t('title'), path: '/deck-builder', description: t('meta') })
}

const DeckEditorPage = () => (
  <>
    <Header />
    <main className="min-h-dvh pt-16">
      <DeckEditorLoader deckId={null} />
    </main>
  </>
)

export default DeckEditorPage
