import { cache } from 'react'
import { headers } from 'next/headers'
import { notFound } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { AdBanner } from '@omega/ads/ad-banner'
import { Footer } from '@ui/footer'
import { Header } from '@ui/header'
import { getDeck, getDeckSocial } from '@utils/decks'
import { pageMetadata } from '@utils/metadata'
import { DeckView } from './deck-view'

type Props = { params: Promise<{ id: string }> }

/** Forwards the visitor's session: the owner and their friends read decks the public can't. `cache`: metadata and page share one request. */
const loadDeck = cache(async (id: string) => getDeck(id, (await headers()).get('cookie')))
const loadSocial = cache(async (id: string) => getDeckSocial(id, (await headers()).get('cookie')))

export async function generateMetadata({ params }: Props) {
  const { id } = await params
  const [deck, t] = await Promise.all([loadDeck(id), getTranslations('DeckEditor')])
  const path = `/decks/${encodeURIComponent(id)}`
  if (!deck) return pageMetadata({ title: t('deckMissing'), path, noIndex: true })
  return pageMetadata({
    title: deck.name,
    path,
    description: deck.description || t('page.meta', { name: deck.name, owner: deck.owner.name ?? t('browse.unknownOwner') }),
    // What shows depends on who looks: only a public deck is for crawlers.
    noIndex: deck.visibility !== 'public',
  })
}

const DeckPage = async ({ params }: Props) => {
  const { id } = await params
  const deck = await loadDeck(id)
  if (!deck) notFound()
  const social = await loadSocial(id)

  return (
    <>
      <Header />
      <main className="mx-auto flex min-h-dvh w-[min(var(--container-page),calc(100%-32px))] flex-col gap-8 pt-24 pb-24">
        <DeckView deck={deck} social={social} />
        <AdBanner id="ad-bottom" placement="content" />
      </main>
      <Footer />
    </>
  )
}

export default DeckPage
