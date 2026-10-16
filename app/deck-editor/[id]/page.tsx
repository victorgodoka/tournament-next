import { Header } from '@ui/header'
import { DeckEditorLoader } from '../deck-editor.loader'

const DeckEditorDeckPage = async ({ params }: { params: Promise<{ id: string }> }) => {
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
