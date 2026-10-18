import { getTranslations } from 'next-intl/server'
import { Header } from '@ui/header'
import { pageMetadata } from '@utils/metadata'
import { DeckEditorLoader } from '../deck-editor.loader'

type Props = { params: Promise<{ id: string }> }

// Decks are private by default: never indexed.
export async function generateMetadata({ params }: Props) {
  const [{ id }, t] = await Promise.all([params, getTranslations('DeckEditor')])
  return pageMetadata({ title: t('title'), path: `/deck-builder/${encodeURIComponent(id)}`, description: t('meta'), noIndex: true })
}

const DeckEditorDeckPage = async ({ params }: Props) => {
  const { id } = await params
  return (
    <>
      <Header />
      <main className="min-h-dvh pt-16">
        <DeckEditorLoader deckId={id} />
      </main>
    </>
  )
}

export default DeckEditorDeckPage
